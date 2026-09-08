import { discoverTMDBCached, searchTMDBCached } from '/scripts/services/tmdbCachedClient.js';
import {
  getLensDiscoveryPool,
  hasLensDiscoveryPool,
  refreshLensDiscoveryPoolIfCached,
  setLensDiscoveryPool,
} from '/scripts/services/searchLensDiscoveryCache.js';
import {
  REVIEW_RERANK_LIMIT,
  rerankLensSelectionWithReviews,
} from '/scripts/services/searchLensReviewRerankService.js';
import { setupAuthUI } from '/scripts/auth-ui.js';
import { t } from '/scripts/services/i18n.js';
import { getLocalizedLensById } from '/scripts/services/searchFilterI18n.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';
import { localizeItemOverviews } from '/scripts/services/tmdbOverviewI18n.js';
import { createMediaCard, hydrateMediaCards, renderMediaCards } from '/scripts/media-card.js';
import { getLensById, getRatingFilterById, buildLensKeywordDiscoverOptions, buildLensGenreDiscoverOptions } from '/scripts/domain/searchFilters.js';
import { annotateResults, mergeResultsByIdentity, scoreLensAffinity } from '/scripts/domain/searchLensRanking.js';
import {
  applySearchToolbarFilters,
  balanceResultsByMedia,
  getResultPriorityScore,
  getSyncFilteredSearchResults,
  sortVisibleSearchResults,
} from '/scripts/domain/searchResultTransforms.js';
import { setSearchEmpty, setSearchError, setSearchLoading } from '/scripts/ui/searchPageViews.js';
import {
  renderSearchFilterControls,
  renderSearchSortControl,
} from '/scripts/ui/searchPageFilterControls.js';

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsContainer = document.getElementById('search-results');
const lensSuggestionsContainer = document.getElementById('lens-suggestions');
const mediaFiltersContainer = document.getElementById('media-filters');
const ratingFiltersContainer = document.getElementById('rating-filters');
const clearFiltersButton = document.getElementById('clear-search-filters');
const searchToolbar = document.getElementById('search-toolbar');
const resultsMeta = document.getElementById('search-results-meta');
const resultsTitle = document.getElementById('search-results-title');
const resultsSummary = document.getElementById('search-results-summary');
const sortSelect = document.getElementById('sort-select');
const searchResultsSection = document.getElementById('search-results-section');

const searchPageEls = {
  resultsMeta,
  searchToolbar,
  resultsContainer,
};

const state = {
  rawResults: [],
  currentQuery: '',
  discoveryLensId: '',
  filters: {
    lens: 'all',
    media: 'all',
    rating: 'any',
    sort: 'recommended',
  },
  lensPage: 0,
  lensAllResults: [],
};

const LENS_DISPLAY_LIMIT = 10;
const LENS_POOL_LIMIT = 40;

function buildResultsSummary(totalResults, visibleResults) {
  const activeLens = getLocalizedLensById(state.filters.lens);

  if (state.currentQuery) {
    resultsTitle.textContent = t('search.results_for', { query: state.currentQuery });
    if (activeLens) {
      resultsSummary.textContent = t('search.results_resonate', {
        visible: visibleResults,
        total: totalResults,
        lens: activeLens.label.toLowerCase(),
      });
      return;
    }

    resultsSummary.textContent = t('search.results_found', { count: visibleResults });
    return;
  }

  if (state.discoveryLensId) {
    const discoveryLens = getLocalizedLensById(state.discoveryLensId);
    if (discoveryLens) {
      resultsTitle.textContent = discoveryLens.label;
      if (activeLens && activeLens.id !== discoveryLens.id) {
        resultsSummary.textContent = t('search.results_filtered', {
          visible: visibleResults,
          total: totalResults,
          lens: activeLens.label.toLowerCase(),
        });
        return;
      }

      resultsSummary.textContent = discoveryLens.summary;
      return;
    }
  }

  resultsTitle.textContent = t('search.results_title');
  resultsSummary.textContent = t('search.results_available', { count: visibleResults });
}

async function renderResults(items) {
  const localized = await localizeItemOverviews(items);
  renderMediaCards(resultsContainer, localized, {
    overviewLength: 110,
  });
}

async function getLensFilteredResults(items, lens, { poolLimit = LENS_DISPLAY_LIMIT } = {}) {
  const filtered = applySearchToolbarFilters(items, {
    media: state.filters.media,
    ratingMin: getRatingFilterById(state.filters.rating).min,
  });

  const ranked = filtered
    .map(item => ({
      ...item,
      _activeLensScore: scoreLensAffinity(item, lens),
    }))
    .sort((a, b) =>
      b._activeLensScore - a._activeLensScore
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || a._searchIndex - b._searchIndex
    );

  const strongMatches = ranked.filter(item => item._activeLensScore >= 9);
  const selectionCap = Math.max(poolLimit, REVIEW_RERANK_LIMIT);
  const selected = (strongMatches.length >= 8 ? strongMatches : ranked)
    .slice(0, selectionCap);

  const reranked = await rerankLensSelectionWithReviews(selected, lens, {
    getPriorityScore: getResultPriorityScore,
  });

  return state.filters.media === 'all'
    ? balanceResultsByMedia(reranked, poolLimit)
    : reranked.slice(0, poolLimit);
}

async function extendLensPool(lensId) {
  const lens = getLensById(lensId);
  if (!lens) return;

  const page = Math.floor(state.rawResults.length / 20) + 1;
  const keywordOptions = buildLensKeywordDiscoverOptions(lens, { page, sortBy: 'vote_average.desc' });
  const useKeywords = Boolean(keywordOptions.withKeywords);

  const [moreMovies, moreSeries] = await Promise.all([
    discoverTMDBCached('movie', useKeywords
      ? keywordOptions
      : buildLensGenreDiscoverOptions(lens, 'movie', { page, sortBy: 'vote_average.desc' })),
    discoverTMDBCached('tv', useKeywords
      ? keywordOptions
      : buildLensGenreDiscoverOptions(lens, 'tv', { page, sortBy: 'vote_average.desc' })),
  ]);

  const existing = new Set(state.rawResults.map(r => `${r.media_type}:${r.id}`));
  const newItems = mergeResultsByIdentity([...(moreMovies || []), ...(moreSeries || [])])
    .filter(item => !existing.has(`${item.media_type}:${item.id}`));

  if (!newItems.length) return;

  state.rawResults = mergeResultsByIdentity([...state.rawResults, ...newItems]);
  refreshLensDiscoveryPoolIfCached(lensId, state.rawResults);
}

function ensureLensPaginationMount() {
  let paginationEl = document.getElementById('lens-pagination');
  if (!paginationEl && searchResultsSection) {
    paginationEl = document.createElement('div');
    paginationEl.id = 'lens-pagination';
    paginationEl.className = 'lens-pagination';
    searchResultsSection.appendChild(paginationEl);
  }
  return paginationEl;
}

function renderLensPagination(visible = 0) {
  const paginationEl = ensureLensPaginationMount();
  if (!paginationEl) return;

  if (state.filters.lens === 'all' || !state.lensAllResults.length) {
    paginationEl.hidden = true;
    return;
  }

  const total = state.lensAllResults.length;
  const hasMore = visible < total;

  if (!hasMore) {
    paginationEl.hidden = true;
    return;
  }

  paginationEl.hidden = false;
  paginationEl.innerHTML = `
    <p class="lens-pagination-count">${t('search.works_shown', { visible, total })}</p>
    <button type="button" id="load-more-lens" class="ghost-button">
      ${t('search.see_more')}
    </button>
  `;
}

async function renderFilteredState({ append = false } = {}) {
  if (!state.rawResults.length) {
    const paginationEl = document.getElementById('lens-pagination');
    if (paginationEl) {
      paginationEl.hidden = true;
      paginationEl.replaceChildren();
    }
    setSearchEmpty(searchPageEls, t('search.empty_hint_lens'));
    return;
  }

  const activeLens = getLensById(state.filters.lens);
  const filtered = activeLens
    ? await getLensFilteredResults(state.rawResults, activeLens, { poolLimit: LENS_POOL_LIMIT })
    : getSyncFilteredSearchResults({
      items: state.rawResults,
      filters: {
        lens: state.filters.lens,
        media: state.filters.media,
        ratingMin: getRatingFilterById(state.filters.rating).min,
      },
      discoveryLensId: state.discoveryLensId,
      lensDisplayLimit: LENS_DISPLAY_LIMIT,
    });

  if (activeLens) {
    state.lensAllResults = filtered;
  } else {
    state.lensAllResults = [];
  }

  searchToolbar.hidden = false;

  if (!filtered.length) {
    resultsMeta.hidden = false;
    buildResultsSummary(state.rawResults.length, 0);
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">${t('search.no_match_filters_title')}</p>
        <p class="empty-state-text">${t('search.no_match_filters_text')}</p>
      </div>
    `;
    renderLensPagination(0);
    return;
  }

  const visibleCap = (state.lensPage + 1) * LENS_DISPLAY_LIMIT;
  const sliceForSort = activeLens ? filtered.slice(0, visibleCap) : filtered;
  const pageResults = sortVisibleSearchResults(sliceForSort, state.filters.sort);

  const summaryTotal = activeLens ? filtered.length : state.rawResults.length;
  resultsMeta.hidden = false;
  buildResultsSummary(summaryTotal, pageResults.length);

  if (append && activeLens) {
    const startIdx = state.lensPage * LENS_DISPLAY_LIMIT;
    const newItems = pageResults.slice(startIdx, startIdx + LENS_DISPLAY_LIMIT);
    if (!newItems.length) {
      state.lensPage = Math.max(0, state.lensPage - 1);
      await renderFilteredState({ append: false });
      return;
    }
    const localizedNew = await localizeItemOverviews(newItems);
    const fragment = document.createDocumentFragment();
    localizedNew.forEach((item, i) => {
      fragment.appendChild(createMediaCard(item, {
        index: startIdx + i,
        overviewLength: 110,
      }));
    });
    resultsContainer.appendChild(fragment);
    hydrateMediaCards(resultsContainer).catch(() => {});
  } else {
    await renderResults(pageResults);
  }

  renderLensPagination(pageResults.length);
}

async function handleLensLoadMoreClick(event) {
  const button = event.target.closest('#load-more-lens');
  if (!button || button.disabled) return;

  button.disabled = true;
  button.textContent = t('search.loading');

  state.lensPage += 1;

  const want = (state.lensPage + 1) * LENS_DISPLAY_LIMIT;
  try {
    if (want > state.lensAllResults.length && state.discoveryLensId) {
      await extendLensPool(state.discoveryLensId);
    }
    await renderFilteredState({ append: true });
  } catch {
    state.lensPage = Math.max(0, state.lensPage - 1);
  } finally {
    const nextBtn = document.getElementById('load-more-lens');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = t('search.see_more');
    }
  }
}

async function runThemeDiscovery(lensId) {
  state.lensPage = 0;
  const lens = getLensById(lensId);
  if (!lens) return;

  if (hasLensDiscoveryPool(lensId)) {
    state.rawResults = getLensDiscoveryPool(lensId);
    state.currentQuery = '';
    state.discoveryLensId = lensId;
    await renderFilteredState();
    return;
  }

  setSearchLoading(searchPageEls, `Exploring ${lens.label.toLowerCase()}...`);

  const keywordOptions = buildLensKeywordDiscoverOptions(lens);
  const hasKeywords = Boolean(keywordOptions.withKeywords);

  const [
    movieRated,
    moviePopular,
    seriesRated,
    seriesPopular,
  ] = await Promise.all([
    discoverTMDBCached('movie', {
      page: 1,
      sortBy: 'vote_average.desc',
      ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'movie')),
    }),
    discoverTMDBCached('movie', {
      page: 1,
      sortBy: 'popularity.desc',
      ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'movie')),
    }),
    discoverTMDBCached('tv', {
      page: 1,
      sortBy: 'vote_average.desc',
      ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'tv')),
    }),
    discoverTMDBCached('tv', {
      page: 1,
      sortBy: 'popularity.desc',
      ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'tv')),
    }),
  ]);

  let combined = mergeResultsByIdentity([
    ...(movieRated || []),
    ...(moviePopular || []),
    ...(seriesRated || []),
    ...(seriesPopular || []),
  ]);

  let currentMovieCount = combined.filter(item => item.media_type === 'movie').length;
  let currentSeriesCount = combined.filter(item => item.media_type === 'tv').length;

  if (combined.length < 16 || currentMovieCount < 5 || currentSeriesCount < 5) {
    const [movieRatedPageTwo, seriesRatedPageTwo] = await Promise.all([
      discoverTMDBCached('movie', {
        page: 2,
        sortBy: 'vote_average.desc',
        ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'movie')),
      }),
      discoverTMDBCached('tv', {
        page: 2,
        sortBy: 'vote_average.desc',
        ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'tv')),
      }),
    ]);

    combined = mergeResultsByIdentity([
      ...combined,
      ...(movieRatedPageTwo || []),
      ...(seriesRatedPageTwo || []),
    ]);

    currentMovieCount = combined.filter(item => item.media_type === 'movie').length;
    currentSeriesCount = combined.filter(item => item.media_type === 'tv').length;
  }

  if (combined.length < 12 || currentMovieCount < 4 || currentSeriesCount < 4) {
    const genreFallback = hasKeywords;
    const [fallbackMovies, fallbackSeries] = await Promise.all([
      discoverTMDBCached('movie', {
        page: 1,
        sortBy: 'vote_average.desc',
        ...(genreFallback ? buildLensGenreDiscoverOptions(lens, 'movie') : {}),
      }),
      discoverTMDBCached('tv', {
        page: 1,
        sortBy: 'vote_average.desc',
        ...(genreFallback ? buildLensGenreDiscoverOptions(lens, 'tv') : {}),
      }),
    ]);

    combined = mergeResultsByIdentity([
      ...combined,
      ...(fallbackMovies || []),
      ...(fallbackSeries || []),
    ]);
  }

  const ranked = combined
    .map(item => ({
      ...item,
      _discoveryScore: scoreLensAffinity(item, lens),
    }))
    .sort((a, b) =>
      b._discoveryScore - a._discoveryScore
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
    );

  const discoveredPool = balanceResultsByMedia(ranked, LENS_POOL_LIMIT);
  if (discoveredPool.length) {
    setLensDiscoveryPool(lensId, discoveredPool);
  }
  state.rawResults = discoveredPool.map(item => ({ ...item }));
  state.currentQuery = '';
  state.discoveryLensId = lensId;
  await renderFilteredState();
}

async function runSearch(query) {
  state.lensPage = 0;
  setSearchLoading(searchPageEls, t('search.searching'));

  const results = await searchTMDBCached(query);
  state.rawResults = annotateResults(results);
  state.currentQuery = query;
  state.discoveryLensId = '';
}

async function handleSubmit(event) {
  event.preventDefault();

  const query = input.value.trim();
  if (!query) {
    if (state.filters.lens !== 'all') {
      try {
        await runThemeDiscovery(state.filters.lens);
      } catch (error) {
        const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
        setSearchError(searchPageEls, error.message || t('search.fetch_error'), is502);
      }
      return;
    }

    resultsMeta.hidden = true;
    resultsContainer.innerHTML = `<p class="inline-message">${t('search.enter_title')}</p>`;
    return;
  }

  try {
    await runSearch(query);

    if (!state.rawResults.length) {
      setSearchEmpty(searchPageEls, t('search.empty_hint_search'));
      return;
    }

    await renderFilteredState();
  } catch (error) {
    const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
    setSearchError(searchPageEls, error.message || t('search.fetch_error'), is502);
  }
}

async function handleLensClick(event) {
  const button = event.target.closest('button[data-group="lens"]');
  if (!button) return;

  state.lensPage = 0;
  const nextLens = state.filters.lens === button.dataset.value ? 'all' : button.dataset.value;
  const shouldRefreshDiscovery = !state.currentQuery && nextLens !== 'all';
  state.filters.lens = nextLens;
  renderSearchFilterControls({
    lensSuggestionsContainer,
    mediaFiltersContainer,
    ratingFiltersContainer,
    sortSelect,
    filters: state.filters,
  });

  if (shouldRefreshDiscovery) {
    try {
      await runThemeDiscovery(nextLens);
    } catch (error) {
      const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
      setSearchError(searchPageEls, error.message || t('search.fetch_error'), is502);
    }
    return;
  }

  if (state.rawResults.length) {
    await renderFilteredState();
  }
}

async function handleToolbarClick(event) {
  const button = event.target.closest('button[data-group]');
  if (!button) return;

  const { group, value } = button.dataset;
  state.lensPage = 0;
  if (group === 'media') {
    state.filters.media = value;
  }

  if (group === 'rating') {
    state.filters.rating = value;
  }

  renderSearchFilterControls({
    lensSuggestionsContainer,
    mediaFiltersContainer,
    ratingFiltersContainer,
    sortSelect,
    filters: state.filters,
  });

  if (state.rawResults.length) {
    await renderFilteredState();
  }
}

async function handleSortChange(event) {
  state.lensPage = 0;
  state.filters.sort = event.target.value || 'recommended';

  if (state.rawResults.length) {
    await renderFilteredState();
  }
}

async function clearFilters() {
  state.lensPage = 0;
  state.filters.media = 'all';
  state.filters.rating = 'any';
  state.filters.lens = 'all';
  state.filters.sort = 'recommended';
  renderSearchFilterControls({
    lensSuggestionsContainer,
    mediaFiltersContainer,
    ratingFiltersContainer,
    sortSelect,
    filters: state.filters,
  });

  if (state.rawResults.length) {
    await renderFilteredState();
  }
}

async function hydrateFromQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q')?.trim() || '';
  const requestedLens = params.get('lens')?.trim() || '';
  const lens = getLensById(requestedLens)?.id || '';

  if (!query && !lens) {
    return;
  }

  if (query) {
    input.value = query;
  }

  if (lens) {
    state.filters.lens = lens;
    renderSearchFilterControls({
      lensSuggestionsContainer,
      mediaFiltersContainer,
      ratingFiltersContainer,
      sortSelect,
      filters: state.filters,
    });
  }

  if (query) {
    try {
      await runSearch(query);

      if (!state.rawResults.length) {
        setSearchEmpty(searchPageEls, t('search.empty_hint_search'));
        return;
      }

      await renderFilteredState();
    } catch (error) {
      const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
      setSearchError(searchPageEls, error.message || t('search.fetch_error'), is502);
    }
    return;
  }

  if (lens) {
    try {
      await runThemeDiscovery(lens);
    } catch (error) {
      const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
      setSearchError(searchPageEls, error.message || t('search.fetch_error'), is502);
    }
  }
}

function init() {
  setupLanguageChrome();
  setupAuthUI().catch(() => {});
  resultsMeta.hidden = true;
  renderSearchSortControl(sortSelect, state.filters.sort);
  renderSearchFilterControls({
    lensSuggestionsContainer,
    mediaFiltersContainer,
    ratingFiltersContainer,
    sortSelect,
    filters: state.filters,
  });
  form.addEventListener('submit', handleSubmit);
  lensSuggestionsContainer.addEventListener('click', handleLensClick);
  searchResultsSection?.addEventListener('click', handleLensLoadMoreClick);
  mediaFiltersContainer.addEventListener('click', handleToolbarClick);
  ratingFiltersContainer.addEventListener('click', handleToolbarClick);
  sortSelect.addEventListener('change', handleSortChange);
  clearFiltersButton.addEventListener('click', clearFilters);
  hydrateFromQueryParams().catch(() => {});
}

init();
