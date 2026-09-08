/**
 * @file Home page (Daily Pairing): data loading + DOM bootstrap.
 *
 * 1) pick a quote
 * 2) infer its philosophical profile
 * 3) gather TMDB candidates, prioritizing curated and thematic matches
 * 4) rank works by thematic affinity to the quote
 */

import { getDisplayAuthorName, getPhilosopherUrlByAuthor } from '/scripts/domain/philosopherAuthors.js';
import { CURATED_TV_IDS } from '/scripts/domain/curatedTvIds.js';
import { discoverTMDB, getDetailsFromTMDB, getTrendingFromTMDB } from '/scripts/seriesapi.js';
import {
  buildCuratedMatchIndex,
  buildQuoteProfile,
  formatThemeLabel,
  getThemeGenreFilters,
  mapDetailsToCandidate,
  mergeCandidateBuckets,
  rankCandidates,
} from '/scripts/mediaRankCore.js';
import { getSession, setupAuthUI } from '/scripts/auth-ui.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { t } from '/scripts/services/i18n.js';
import { localizeItemOverviews } from '/scripts/services/tmdbOverviewI18n.js';
import { resolveDisplayQuoteText } from '/scripts/services/quoteDisplayResolve.js';
import { getUiLocale } from '/scripts/services/uiLocale.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';
import { updatePageSeo } from '/scripts/seo.js';
import { rankTrendingByLensOverlap } from '/scripts/domain/searchLensRanking.js';
import { hashString } from '/scripts/domain/detailsQuotePipeline.js';
import { selectHomeQuote } from '/scripts/domain/homeQuoteSelection.js';
import { listRatings } from '/scripts/ratings-api.js';
import { ratingsByTargetId } from '/scripts/domain/userRatings.js';

const API_BASE = '/api';
const HOME_RESULT_LIMIT = 10;
const DAILY_PAIRING_ENDPOINT = `${API_BASE}/daily-pairing`;

const CURATED_MATCH_INDEX = buildCuratedMatchIndex();

function getDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function loadQuoteRatingsMap() {
  try {
    const session = await getSession();
    if (!session?.authenticated) return null;
    const payload = await listRatings({ targetType: 'quote' });
    return ratingsByTargetId(payload.ratings || []);
  } catch {
    return null;
  }
}

async function resolveCuratedCandidate(tmdbId) {
  const mediaType = CURATED_TV_IDS.has(String(tmdbId)) ? 'tv' : 'movie';
  const details = await getDetailsFromTMDB(tmdbId, mediaType);
  return mapDetailsToCandidate(details, mediaType);
}

async function getCuratedCandidatesForQuote(quoteId) {
  if (quoteId == null) return [];

  const tmdbIds = CURATED_MATCH_INDEX.get(String(quoteId)) || [];
  if (tmdbIds.length === 0) return [];

  const results = await Promise.all(
    tmdbIds
      .slice(0, 6)
      .map(id => resolveCuratedCandidate(id).catch(() => null))
  );

  return results.filter(Boolean);
}

async function getQuoteForHome() {
  const ratingsByQuoteId = await loadQuoteRatingsMap();

  try {
    const res = await fetch(`${API_BASE}/quotes/catalog?lang=en`);
    if (!res.ok) throw new Error('Quotes API error');
    const quotes = await res.json();
    if (Array.isArray(quotes) && quotes.length > 0) {
      const selectedQuote = selectHomeQuote(quotes, getDayKey(), ratingsByQuoteId);
      if (selectedQuote) return selectedQuote;
    }
  } catch (e) {
    console.warn('Quote catalog failed, using fallback:', e.message);
  }

  try {
    const res = await fetch(`${API_BASE}/quotes`);
    if (!res.ok) throw new Error('Quotes API error');
    const payload = await res.json();
    const quotes = Array.isArray(payload?.data)
      ? payload.data
      : (Array.isArray(payload) ? payload : []);
    if (quotes.length > 0) {
      const selectedQuote = selectHomeQuote(quotes, getDayKey(), ratingsByQuoteId);
      if (selectedQuote) return selectedQuote;
    }
  } catch (e) {
    console.warn('Local quotes failed, using fallback:', e.message);
  }

  const { getQuotes } = await import('/scripts/philosophersapi.js');
  const allQuotes = await getQuotes();
  if (allQuotes.length === 0) {
    return {
      id: null,
      quote: 'Think deeply, watch meaningfully.',
      author: 'PhiloMedia',
      themes: [],
    };
  }

  return selectHomeQuote(allQuotes, getDayKey(), ratingsByQuoteId) || {
    id: null,
    quote: 'Think deeply, watch meaningfully.',
    author: 'PhiloMedia',
    themes: [],
  };
}

function buildDailyPairingUrl({ limit = HOME_RESULT_LIMIT, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    lang: getUiLocale(),
  });
  return `${DAILY_PAIRING_ENDPOINT}?${params.toString()}`;
}

function buildHighlightsContext(profile) {
  if (!profile || !Array.isArray(profile.themes) || profile.themes.length === 0) {
    return t('home.dialogue_context_default');
  }

  const themes = profile.themes.slice(0, 2).map(formatThemeLabel);

  if (themes.length === 1) {
    return t('home.dialogue_context_one', { theme: themes[0] });
  }

  return t('home.dialogue_context_two', { themeA: themes[0], themeB: themes[1] });
}

function localizeHomeContent(content) {
  const themes = content.themes || [];
  const highlightsContext = getUiLocale() === 'en' && content.highlightsContext
    ? content.highlightsContext
    : (themes.length ? buildHighlightsContext({ themes }) : t('home.dialogue_context_default'));

  return {
    ...content,
    highlightsTitle: t('home.dialogue_title'),
    highlightsContext,
  };
}

function mapDailyPairingContent(payload) {
  return localizeHomeContent({
    id: payload.slug || null,
    source: payload.source || 'editorial-calendar',
    quote: payload.quote,
    quote_en: payload.quote_en || payload.quote,
    author: payload.author,
    themes: payload.themes || [],
    highlightsContext: payload.highlightsContext || '',
    results: Array.isArray(payload.results) ? payload.results : [],
    totalWorks: Number(payload.totalWorks) || 0,
    returnedWorks: Number(payload.returnedWorks) || 0,
    nextOffset: Number(payload.nextOffset) || 0,
    hasMore: Boolean(payload.hasMore),
  });
}

async function getEditorialDailyContent({ offset = 0, limit = HOME_RESULT_LIMIT } = {}) {
  const res = await fetch(buildDailyPairingUrl({ limit, offset }));
  if (!res.ok) throw new Error('Daily pairing unavailable');

  const payload = await res.json();
  const content = mapDailyPairingContent(payload);
  if (!content.quote || !content.author || content.results.length === 0) {
    throw new Error('Daily pairing incomplete');
  }

  return content;
}

async function getFeaturedMediaForQuote(quoteData) {
  const profile = buildQuoteProfile(quoteData);
  const seed = hashString(`${quoteData.quote}|${quoteData.author}`);
  const genreFilter = profile.preferredGenres.slice(0, 3).join(',');
  const themeGenreFilters = getThemeGenreFilters(profile.themes);

  const moviePopularPage = (seed % 4) + 1;
  const movieRatedPage = (Math.floor(seed / 7) % 4) + 1;
  const tvPopularPage = (Math.floor(seed / 13) % 4) + 1;
  const tvRatedPage = (Math.floor(seed / 17) % 4) + 1;
  const themedMoviePage = (Math.floor(seed / 19) % 5) + 1;
  const themedTvPage = (Math.floor(seed / 23) % 5) + 1;
  const themeDiscoveries = themeGenreFilters.flatMap((filter, index) => {
    const page = ((Math.floor(seed / (29 + index * 6)) + index) % 5) + 1;
    return [
      discoverTMDB('movie', {
        page,
        withGenres: filter.withGenres,
        sortBy: 'vote_average.desc',
      }).then(items => ({ source: `movie-theme-${filter.theme}`, items })),
      discoverTMDB('tv', {
        page,
        withGenres: filter.withGenres,
        sortBy: 'vote_average.desc',
      }).then(items => ({ source: `tv-theme-${filter.theme}`, items })),
    ];
  });

  const [curatedCandidates, buckets] = await Promise.all([
    getCuratedCandidatesForQuote(quoteData.id).catch(() => []),
    Promise.all([
      discoverTMDB('movie', { page: moviePopularPage, sortBy: 'popularity.desc' }).then(items => ({ source: 'movie-popular', items })),
      discoverTMDB('movie', { page: movieRatedPage, sortBy: 'vote_average.desc' }).then(items => ({ source: 'movie-rated', items })),
      discoverTMDB('tv', { page: tvPopularPage, sortBy: 'popularity.desc' }).then(items => ({ source: 'tv-popular', items })),
      discoverTMDB('tv', { page: tvRatedPage, sortBy: 'vote_average.desc' }).then(items => ({ source: 'tv-rated', items })),
      genreFilter
        ? discoverTMDB('movie', {
            page: themedMoviePage,
            withGenres: genreFilter,
            sortBy: 'vote_average.desc',
          }).then(items => ({ source: 'movie-themed', items }))
        : Promise.resolve({ source: 'movie-themed', items: [] }),
      genreFilter
        ? discoverTMDB('tv', {
            page: themedTvPage,
            withGenres: genreFilter,
            sortBy: 'vote_average.desc',
          }).then(items => ({ source: 'tv-themed', items }))
        : Promise.resolve({ source: 'tv-themed', items: [] }),
      ...themeDiscoveries,
    ]),
  ]);

  const candidates = mergeCandidateBuckets([
    { source: 'curated', items: curatedCandidates },
    ...buckets,
  ]);

  return {
    results: rankCandidates(profile, candidates),
    profile,
  };
}

async function loadContent() {
  try {
    return await getEditorialDailyContent();
  } catch (error) {
    console.warn('Daily editorial pairing failed, using ranked fallback:', error.message);
  }

  const quoteData = await getQuoteForHome();
  const { results, profile } = await getFeaturedMediaForQuote(quoteData);

  return localizeHomeContent({
    id: quoteData.id,
    quote: quoteData.quote,
    author: quoteData.author,
    themes: profile.themes,
    results: Array.isArray(results) ? results : [],
  });
}

async function loadMoreContent(offset, limit = HOME_RESULT_LIMIT) {
  return getEditorialDailyContent({ offset, limit });
}

function setLoading(highlightsEl, loading = true) {
  if (loading) {
    highlightsEl.innerHTML = `
      <div class="loading-skeleton" aria-hidden="true">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
      <p class="loading-message">Finding meaningful connections for you...</p>
    `;
  }
}

function renderQuoteAuthor(container, author) {
  if (!container) return;

  const displayName = getDisplayAuthorName(author);
  const url = getPhilosopherUrlByAuthor(author);

  container.textContent = '';

  if (!url) {
    container.textContent = `- ${displayName}`;
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.textContent = `- ${displayName}`;
  container.appendChild(link);
}

function updatePagination({ button, count, visibleCount, totalWorks, hasMore }) {
  const wrapper = document.getElementById('highlights-pagination');
  if (!wrapper || !button || !count) return;

  wrapper.hidden = totalWorks <= visibleCount && !hasMore;
  button.hidden = !hasMore;
  button.disabled = false;
  button.textContent = t('home.load_more');
    count.textContent = totalWorks > 0
    ? t('home.works_shown', { visible: visibleCount, total: totalWorks })
    : '';
}

async function renderPhilosophicalTrending() {
  const section = document.getElementById('philosophical-trending');
  const container = document.getElementById('trending-results');
  if (!section || !container) return;

  try {
    const [movies, series] = await Promise.all([
      getTrendingFromTMDB('movie', { window: 'week' }),
      getTrendingFromTMDB('tv', { window: 'week' }),
    ]);
    const ranked = rankTrendingByLensOverlap(
      [...(movies || []), ...(series || [])],
      undefined,
      { minScore: 8, limit: 8 }
    );

    if (!ranked.length) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    const localized = await localizeItemOverviews(ranked);
    renderMediaCards(container, localized, { overviewLength: 100 });
  } catch (error) {
    console.warn('Philosophical trending unavailable:', error.message);
    section.hidden = true;
  }
}

async function init() {
  setupLanguageChrome();
  setupAuthUI().catch(() => {});
  updatePageSeo({
    title: t('home.seo_title'),
    description: t('home.seo_description'),
    path: '/html/index.html',
    type: 'website',
  });

  const quoteTextEl = document.getElementById('quote-text');
  const quoteAuthorEl = document.getElementById('quote-author');
  const highlightsTitleEl = document.getElementById('highlights-title');
  const highlightsContextEl = document.getElementById('highlights-context');
  const highlightsEl = document.getElementById('highlights');
  const loadMoreButton = document.getElementById('load-more-highlights');
  const highlightsCountEl = document.getElementById('highlights-count');
  let visibleResults = [];
  let pagination = {
    hasMore: false,
    nextOffset: 0,
    totalWorks: 0,
  };

  setLoading(highlightsEl, true);

  try {
    const content = await loadContent();
    const displayQuote = await resolveDisplayQuoteText({
      quote: content.quote_en || content.quote,
      author: content.author,
      id: content.id,
      quote_en: content.quote_en || content.quote,
      quote_pt: content.quote_pt,
      quote_original: content.quote_original,
      originalLanguage: content.originalLanguage,
    });

    quoteTextEl.textContent = `"${displayQuote}"`;
    quoteTextEl.setAttribute('aria-busy', 'false');
    renderQuoteAuthor(quoteAuthorEl, content.author);
    if (highlightsTitleEl && content.highlightsTitle) {
      highlightsTitleEl.textContent = content.highlightsTitle;
    }
    if (highlightsContextEl && content.highlightsContext) {
      highlightsContextEl.textContent = content.highlightsContext;
    }

    highlightsEl.querySelector('.loading-message')?.remove();
    highlightsEl.querySelector('.loading-skeleton')?.remove();

    if (!content.results || content.results.length === 0) {
      highlightsEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">No recommendations right now</p>
          <p class="empty-state-text">Make sure <code>TMDB_API_KEY</code> is set on the server, or try the <a href="/html/search.html">search</a>.</p>
        </div>
      `;
    } else {
    visibleResults = content.results;
    pagination = {
      hasMore: Boolean(content.hasMore),
      nextOffset: Number(content.nextOffset) || visibleResults.length,
      totalWorks: Number(content.totalWorks) || visibleResults.length,
    };

    const localizedResults = await localizeItemOverviews(visibleResults);
    renderMediaCards(highlightsEl, localizedResults, {
      overviewLength: 100,
    });
    updatePagination({
      button: loadMoreButton,
      count: highlightsCountEl,
      visibleCount: visibleResults.length,
      totalWorks: pagination.totalWorks,
      hasMore: pagination.hasMore,
    });
    }
  } catch (err) {
    console.error(err);
    if (quoteTextEl) {
      quoteTextEl.textContent = t('home.error_title');
      quoteTextEl.setAttribute('aria-busy', 'false');
    }
    if (quoteAuthorEl) quoteAuthorEl.textContent = '';
    highlightsEl.innerHTML = `
      <div class="error-state">
        <p class="error-state-title">${t('home.error_title')}</p>
        <p class="error-state-text">${t('home.error_retry')}</p>
      </div>
    `;
  }

  loadMoreButton?.addEventListener('click', async () => {
    if (!pagination.hasMore) return;

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = t('home.loading');

    try {
      const nextContent = await loadMoreContent(pagination.nextOffset);
      visibleResults = [...visibleResults, ...(nextContent.results || [])];
      pagination = {
        hasMore: Boolean(nextContent.hasMore),
        nextOffset: Number(nextContent.nextOffset) || visibleResults.length,
        totalWorks: Number(nextContent.totalWorks) || visibleResults.length,
      };

      const localizedResults = await localizeItemOverviews(visibleResults);
      renderMediaCards(highlightsEl, localizedResults, {
        overviewLength: 100,
      });
    } catch (error) {
      loadMoreButton.textContent = t('home.load_more_failed');
    } finally {
      updatePagination({
        button: loadMoreButton,
        count: highlightsCountEl,
        visibleCount: visibleResults.length,
        totalWorks: pagination.totalWorks,
        hasMore: pagination.hasMore,
      });
    }
  });

  renderPhilosophicalTrending().catch(() => {});
}

init();
