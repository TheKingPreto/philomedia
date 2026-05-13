import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { discoverTMDB, getReviewsFromTMDB, searchTMDB } from '/scripts/seriesapi.js';
import { setupAuthUI } from '/scripts/auth-ui.js';
import { renderMediaCards } from '/scripts/media-card.js';

const LENS_FILTERS = [
  {
    id: 'epistemology',
    label: 'Truth & Knowledge',
    summary: 'Works shaped by doubt, evidence, hidden truths, and uncertainty.',
    themes: ['epistemology', 'truth-deception'],
    keywords: ['truth', 'knowledge', 'doubt', 'deception', 'evidence'],
    movieGenres: [9648, 878, 53],
    tvGenres: [9648, 80, 18, 10765],
  },
  {
    id: 'self-knowledge',
    label: 'Identity',
    summary: 'Stories about self-discovery, fractured selves, and inner reflection.',
    themes: ['self-knowledge', 'existentialism'],
    keywords: ['identity', 'self', 'reflection', 'persona', 'introspection'],
    movieGenres: [18, 9648, 878],
    tvGenres: [18, 9648, 10765, 16],
  },
  {
    id: 'power-corruption',
    label: 'Power',
    summary: 'Power struggles, political decay, and the cost of control.',
    themes: ['power-corruption', 'political-philosophy'],
    keywords: ['power', 'corruption', 'control', 'authority', 'ambition'],
    movieGenres: [18, 80, 53, 10752],
    tvGenres: [18, 80, 10768, 10759],
  },
  {
    id: 'stoicism',
    label: 'Resilience',
    summary: 'Works about endurance, discipline, adversity, and inner strength.',
    themes: ['stoicism', 'suffering', 'heros-journey', 'virtue'],
    keywords: ['resilience', 'endure', 'adversity', 'discipline', 'strength', 'survival', 'courage'],
    movieGenres: [18, 12, 28, 10752],
    tvGenres: [18, 10759, 10768, 16],
  },
  {
    id: 'memory-time',
    label: 'Memory & Time',
    summary: 'Narratives that orbit memory, regret, time, and perception.',
    themes: ['memory-time', 'metaphysics'],
    keywords: ['memory', 'time', 'past', 'future', 'regret'],
    movieGenres: [9648, 878, 18],
    tvGenres: [9648, 18, 10765, 16],
  },
  {
    id: 'alienation',
    label: 'Alienation',
    summary: 'Works about isolation, disconnection, outsiders, and belonging.',
    themes: ['alienation', 'conformity-individuality'],
    keywords: ['alienation', 'isolation', 'outsider', 'belonging', 'society'],
    movieGenres: [18, 878, 9648],
    tvGenres: [18, 9648, 10765],
  },
  {
    id: 'social-justice',
    label: 'Justice & Society',
    summary: 'Stories about inequality, rights, oppression, and social order.',
    themes: ['social-justice', 'political-philosophy'],
    keywords: ['justice', 'inequality', 'rights', 'society', 'oppression'],
    movieGenres: [18, 80, 99, 10752],
    tvGenres: [18, 80, 10768, 99],
  },
  {
    id: 'consciousness-ai',
    label: 'Consciousness & AI',
    summary: 'Works that question mind, humanity, technology, and sentience.',
    themes: ['consciousness-ai', 'technology-modernity'],
    keywords: ['consciousness', 'ai', 'android', 'machine', 'humanity'],
    movieGenres: [878, 9648, 18],
    tvGenres: [10765, 9648, 18],
  },
  {
    id: 'utopia-dystopia',
    label: 'Utopia & Dystopia',
    summary: 'Worlds shaped by control, rebellion, ideal societies, and collapse.',
    themes: ['utopia-dystopia', 'power-corruption'],
    keywords: ['utopia', 'dystopia', 'control', 'rebellion', 'society'],
    movieGenres: [878, 9648, 28],
    tvGenres: [10765, 10768, 10759],
  },
  {
    id: 'freedom-choice',
    label: 'Freedom & Choice',
    summary: 'Stories about free will, consequence, destiny, and moral responsibility.',
    themes: ['existentialism', 'stoicism', 'political-philosophy'],
    keywords: ['freedom', 'choice', 'responsibility', 'destiny', 'liberty', 'fate'],
    movieGenres: [18, 878, 53],
    tvGenres: [18, 10765, 9648],
  },
  {
    id: 'faith-spirituality',
    label: 'Faith & Spirituality',
    summary: 'Works that explore belief, transcendence, ritual, and the sacred.',
    themes: ['sacred-profane', 'metaphysics', 'truth-deception'],
    keywords: ['faith', 'spiritual', 'divine', 'sacred', 'ritual', 'transcendence'],
    movieGenres: [18, 14, 9648],
    tvGenres: [18, 10765, 9648],
  },
  {
    id: 'humanism',
    label: 'Humanism',
    summary: 'Works centered on dignity, empathy, compassion, and human potential.',
    themes: ['humanism', 'virtue', 'the-other-alterity'],
    keywords: ['humanity', 'dignity', 'compassion', 'empathy', 'human', 'hope'],
    movieGenres: [18, 12, 16],
    tvGenres: [18, 16, 10759],
  },
];

const MEDIA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

const RATING_FILTERS = [
  { id: 'any', label: 'Any rating', min: 0 },
  { id: '7plus', label: '7+ TMDB', min: 7 },
  { id: '8plus', label: '8+ TMDB', min: 8 },
];

const SORT_FILTERS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'recent', label: 'Newest' },
  { id: 'popularity', label: 'Most popular' },
];

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
};

const LENS_DISPLAY_LIMIT = 10;
const LENS_POOL_LIMIT = 24;
const REVIEW_RERANK_LIMIT = 6;
const REVIEW_CONTEXT_LIMIT = 4500;
const reviewContextCache = new Map();
const discoverRequestCache = new Map();
const searchRequestCache = new Map();
const lensDiscoveryCache = new Map();

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function normalizeText(text) {
  if (!text) return '';

  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCacheKey(prefix, payload) {
  return `${prefix}:${JSON.stringify(payload)}`;
}

async function discoverTMDBCached(media, options = {}) {
  const cacheKey = buildCacheKey('discover', { media, ...options });
  if (!discoverRequestCache.has(cacheKey)) {
    discoverRequestCache.set(cacheKey, discoverTMDB(media, options));
  }

  const result = await discoverRequestCache.get(cacheKey);
  if (!Array.isArray(result) || result.length === 0) {
    discoverRequestCache.delete(cacheKey);
  }
  return Array.isArray(result) ? result : [];
}

async function searchTMDBCached(query) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) return [];

  const cacheKey = buildCacheKey('search', { query: trimmedQuery.toLowerCase() });
  if (!searchRequestCache.has(cacheKey)) {
    searchRequestCache.set(cacheKey, searchTMDB(trimmedQuery).catch(error => {
      searchRequestCache.delete(cacheKey);
      throw error;
    }));
  }

  const result = await searchRequestCache.get(cacheKey);
  return Array.isArray(result) ? result : [];
}

function getLensById(lensId) {
  return LENS_FILTERS.find(lens => lens.id === lensId) || null;
}

function getRatingFilterById(ratingId) {
  return RATING_FILTERS.find(filter => filter.id === ratingId) || RATING_FILTERS[0];
}

function getReleaseTimestamp(item) {
  const rawDate = item.release_date || item.first_air_date || '';
  const timestamp = Date.parse(rawDate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMediaType(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  if (item.title) return 'movie';
  if (item.name) return 'tv';
  return 'unknown';
}

function setSearchLoading(message = 'Searching...') {
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="loading-skeleton" aria-hidden="true">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
    <p class="loading-message">${escapeHtml(message)}</p>
  `;
}

function setSearchError(message, isServerError = false) {
  const isRateLimited = /too many/i.test(String(message || ''));
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="error-state">
      <p class="error-state-title">${escapeHtml(message)}</p>
      ${isServerError
        ? '<p class="error-state-text">Check that <code>TMDB_API_KEY</code> is set on the server.</p>'
        : (isRateLimited ? '<p class="error-state-text">Please wait a few seconds and try again. Theme exploration is now cached as you browse.</p>' : '')}
    </div>
  `;
}

function setSearchEmpty(message = 'Try another search term.') {
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">No results found</p>
      <p class="empty-state-text">${escapeHtml(message)}</p>
    </div>
  `;
}

function annotateResult(item, index) {
  const mediaType = getMediaType(item);
  const title = item.title || item.name || 'Untitled';
  const overview = item.overview || '';
  const textContext = `${title} ${overview}`.trim();
  const themeMatches = analyzeWorkForThemes(textContext);

  return {
    ...item,
    media_type: mediaType,
    _searchIndex: index,
    _themeMatches: themeMatches,
    _themeIds: themeMatches.map(match => match.theme),
    _normalizedContext: normalizeText(textContext),
  };
}

function annotateResults(results) {
  return (results || [])
    .map((item, index) => annotateResult(item, index))
    .filter(item => item.media_type === 'movie' || item.media_type === 'tv');
}

function mergeResultsByIdentity(items) {
  const merged = new Map();

  items.forEach((item, index) => {
    if (!item || item.id == null) return;

    const mediaType = getMediaType(item);
    if (mediaType !== 'movie' && mediaType !== 'tv') return;

    const key = `${mediaType}:${item.id}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...item,
        media_type: mediaType,
        _searchIndex: index,
      });
      return;
    }

    merged.set(key, {
      ...existing,
      ...item,
      media_type: mediaType,
      overview: existing.overview || item.overview || '',
      poster_path: existing.poster_path || item.poster_path || null,
      vote_average: Math.max(Number(existing.vote_average) || 0, Number(item.vote_average) || 0),
      popularity: Math.max(Number(existing.popularity) || 0, Number(item.popularity) || 0),
      genre_ids: Array.isArray(existing.genre_ids) && existing.genre_ids.length > 0
        ? existing.genre_ids
        : (item.genre_ids || []),
      _searchIndex: Math.min(existing._searchIndex ?? index, index),
    });
  });

  return annotateResults([...merged.values()]);
}

function scoreLensAffinity(item, lens) {
  if (!lens) return 0;

  const themeSet = new Set(item._themeIds || []);
  const normalized = item._normalizedContext || '';
  const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  const preferredGenres = item.media_type === 'tv'
    ? (lens.tvGenres || [])
    : (lens.movieGenres || []);
  let score = 0;

  lens.themes.forEach((theme, index) => {
    if (themeSet.has(theme)) {
      score += Math.max(12, 24 - index * 4);
    }
  });

  lens.keywords.forEach((keyword, index) => {
    if (normalized.includes(normalizeText(keyword))) {
      score += Math.max(4, 12 - index * 1.5);
    }
  });

  if (preferredGenres.length && genreIds.length) {
    const lensGenreSet = new Set(preferredGenres);
    const overlap = genreIds.filter(genreId => lensGenreSet.has(genreId)).length;
    if (overlap > 0) {
      score += overlap * 5;
    }
  }

  score += Math.max(0, Number(item.vote_average || 0) - 6) * 1.5;
  score += Math.min(5, (Number(item.popularity) || 0) / 45);

  return score;
}

function buildReviewContext(reviews = []) {
  return reviews
    .map(review => review?.content || '')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, REVIEW_CONTEXT_LIMIT);
}

function scoreLensTextAffinity(text, lens) {
  if (!lens || !text) return 0;

  const normalized = normalizeText(text);
  const themeMatches = analyzeWorkForThemes(text);
  const themeSet = new Set(themeMatches.map(match => match.theme));
  let score = 0;

  lens.themes.forEach((theme, index) => {
    if (themeSet.has(theme)) {
      score += Math.max(10, 22 - index * 4);
    }
  });

  lens.keywords.forEach((keyword, index) => {
    if (normalized.includes(normalizeText(keyword))) {
      score += Math.max(3, 9 - index * 1.1);
    }
  });

  return score;
}

function renderFilterButton(container, filter, activeId, groupName) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-chip';
  if (filter.id === activeId) {
    button.classList.add('is-active');
    button.setAttribute('aria-pressed', 'true');
  } else {
    button.setAttribute('aria-pressed', 'false');
  }

  button.dataset.group = groupName;
  button.dataset.value = filter.id;
  button.textContent = filter.label;
  if (filter.summary) {
    button.title = filter.summary;
  }

  container.appendChild(button);
}

function renderFilterControls() {
  lensSuggestionsContainer.innerHTML = '';
  mediaFiltersContainer.innerHTML = '';
  ratingFiltersContainer.innerHTML = '';

  LENS_FILTERS.forEach(filter => {
    renderFilterButton(lensSuggestionsContainer, filter, state.filters.lens, 'lens');
  });

  MEDIA_FILTERS.forEach(filter => {
    renderFilterButton(mediaFiltersContainer, filter, state.filters.media, 'media');
  });

  RATING_FILTERS.forEach(filter => {
    renderFilterButton(ratingFiltersContainer, filter, state.filters.rating, 'rating');
  });

  if (sortSelect) {
    sortSelect.value = state.filters.sort;
  }
}

function renderSortControl() {
  if (!sortSelect) return;

  sortSelect.innerHTML = '';
  SORT_FILTERS.forEach(filter => {
    const option = document.createElement('option');
    option.value = filter.id;
    option.textContent = filter.label;
    sortSelect.appendChild(option);
  });

  sortSelect.value = state.filters.sort;
}

function applyToolbarFilters(items) {
  let filtered = [...items];

  if (state.filters.media !== 'all') {
    filtered = filtered.filter(item => item.media_type === state.filters.media);
  }

  const ratingFloor = getRatingFilterById(state.filters.rating).min;
  if (ratingFloor > 0) {
    filtered = filtered.filter(item => Number(item.vote_average || 0) >= ratingFloor);
  }

  return filtered;
}

function getSyncFilteredResults(items) {
  const filtered = applyToolbarFilters(items);

  const activeLens = getLensById(state.filters.lens);
  if (activeLens) {
    const ranked = filtered
      .map(item => ({
        ...item,
        _activeLensScore: scoreLensAffinity(item, activeLens),
      }))
      .sort((a, b) =>
        b._activeLensScore - a._activeLensScore
        || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
        || a._searchIndex - b._searchIndex
      );

    const strongMatches = ranked.filter(item => item._activeLensScore >= 9);
    const selected = (strongMatches.length >= 8 ? strongMatches : ranked).slice(0, LENS_DISPLAY_LIMIT);
    return state.filters.media === 'all'
      ? balanceResultsByMedia(selected, LENS_DISPLAY_LIMIT)
      : selected;
  }

  if (state.discoveryLensId) {
    const discoveryLens = getLensById(state.discoveryLensId);
    if (discoveryLens) {
      return filtered
        .sort((a, b) =>
          scoreLensAffinity(b, discoveryLens) - scoreLensAffinity(a, discoveryLens)
          || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
        )
        .slice(0, LENS_DISPLAY_LIMIT);
    }
  }

  return filtered.sort((a, b) => a._searchIndex - b._searchIndex);
}

function buildResultsSummary(totalResults, visibleResults) {
  const activeLens = getLensById(state.filters.lens);

  if (state.currentQuery) {
    resultsTitle.textContent = `Results for "${state.currentQuery}"`;
    if (activeLens) {
      resultsSummary.textContent = `${visibleResults} of ${totalResults} works still resonate with ${activeLens.label.toLowerCase()}.`;
      return;
    }

    resultsSummary.textContent = `${visibleResults} works found for this search.`;
    return;
  }

  if (state.discoveryLensId) {
    const discoveryLens = getLensById(state.discoveryLensId);
    if (discoveryLens) {
      resultsTitle.textContent = discoveryLens.label;
      if (activeLens && activeLens.id !== discoveryLens.id) {
        resultsSummary.textContent = `${visibleResults} of ${totalResults} works remain after filtering toward ${activeLens.label.toLowerCase()}.`;
        return;
      }

      resultsSummary.textContent = discoveryLens.summary;
      return;
    }
  }

  resultsTitle.textContent = 'Search results';
  resultsSummary.textContent = `${visibleResults} works available.`;
}

function sortVisibleResults(items) {
  const visible = [...items];

  if (state.filters.sort === 'rating') {
    return visible.sort((a, b) =>
      (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || (Number(b.vote_count) || 0) - (Number(a.vote_count) || 0)
      || getResultPriorityScore(b) - getResultPriorityScore(a)
      || a._searchIndex - b._searchIndex
    );
  }

  if (state.filters.sort === 'recent') {
    return visible.sort((a, b) =>
      getReleaseTimestamp(b) - getReleaseTimestamp(a)
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || getResultPriorityScore(b) - getResultPriorityScore(a)
      || a._searchIndex - b._searchIndex
    );
  }

  if (state.filters.sort === 'popularity') {
    return visible.sort((a, b) =>
      (Number(b.popularity) || 0) - (Number(a.popularity) || 0)
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || getResultPriorityScore(b) - getResultPriorityScore(a)
      || a._searchIndex - b._searchIndex
    );
  }

  return visible;
}

function renderResults(items) {
  renderMediaCards(resultsContainer, items, {
    overviewLength: 110,
  });
}

function getResultPriorityScore(item) {
  if (Number.isFinite(item._activeLensScore)) return item._activeLensScore;
  if (Number.isFinite(item._discoveryScore)) return item._discoveryScore;
  if (Number.isFinite(item._combinedLensScore)) return item._combinedLensScore;
  return Number(item.vote_average) || 0;
}

function balanceResultsByMedia(items, limit = LENS_DISPLAY_LIMIT) {
  const movies = items.filter(item => item.media_type === 'movie');
  const series = items.filter(item => item.media_type === 'tv');

  if (!movies.length || !series.length) {
    return items.slice(0, limit);
  }

  const orderedBuckets = getResultPriorityScore(movies[0]) >= getResultPriorityScore(series[0])
    ? [movies, series]
    : [series, movies];

  const blended = [];
  while (blended.length < limit && (orderedBuckets[0].length || orderedBuckets[1].length)) {
    orderedBuckets.forEach(bucket => {
      if (bucket.length && blended.length < limit) {
        blended.push(bucket.shift());
      }
    });
  }

  return blended;
}

async function getReviewContextForItem(item) {
  const cacheKey = `${item.media_type}:${item.id}`;
  if (reviewContextCache.has(cacheKey)) {
    return reviewContextCache.get(cacheKey);
  }

  const reviews = await getReviewsFromTMDB(item.id, item.media_type).catch(() => []);
  const context = buildReviewContext(reviews);
  reviewContextCache.set(cacheKey, context);
  return context;
}

async function rerankLensSelectionWithReviews(items, lens) {
  const leadItems = items.slice(0, REVIEW_RERANK_LIMIT);
  const tailItems = items.slice(REVIEW_RERANK_LIMIT);

  const rerankedLead = await Promise.all(
    leadItems.map(async item => {
      const reviewContext = await getReviewContextForItem(item);
      const reviewScore = scoreLensTextAffinity(reviewContext, lens);
      const combinedScore =
        getResultPriorityScore(item)
        + reviewScore * 1.15
        + (reviewContext ? 2 : 0);

      return {
        ...item,
        _reviewScore: reviewScore,
        _combinedLensScore: combinedScore,
      };
    })
  );

  const preservedTail = tailItems.map(item => ({
    ...item,
    _reviewScore: item._reviewScore || 0,
    _combinedLensScore: getResultPriorityScore(item),
  }));

  return [...rerankedLead, ...preservedTail].sort((a, b) =>
    b._combinedLensScore - a._combinedLensScore
    || b._reviewScore - a._reviewScore
    || getResultPriorityScore(b) - getResultPriorityScore(a)
    || a._searchIndex - b._searchIndex
  );
}

async function getLensFilteredResults(items, lens) {
  const filtered = applyToolbarFilters(items);

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
  const selected = (strongMatches.length >= 8 ? strongMatches : ranked)
    .slice(0, Math.max(LENS_DISPLAY_LIMIT, REVIEW_RERANK_LIMIT));

  const reranked = await rerankLensSelectionWithReviews(selected, lens);
  const limited = reranked.slice(0, LENS_DISPLAY_LIMIT);

  return state.filters.media === 'all'
    ? balanceResultsByMedia(limited, LENS_DISPLAY_LIMIT)
    : limited;
}

async function renderFilteredState() {
  if (!state.rawResults.length) {
    setSearchEmpty('Try a title or click one of the suggested lenses above.');
    return;
  }

  const activeLens = getLensById(state.filters.lens);
  const filtered = activeLens
    ? await getLensFilteredResults(state.rawResults, activeLens)
    : getSyncFilteredResults(state.rawResults);
  searchToolbar.hidden = false;

  if (!filtered.length) {
    resultsMeta.hidden = false;
    buildResultsSummary(state.rawResults.length, 0);
    resultsContainer.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No works match these filters</p>
        <p class="empty-state-text">Try another lens, lower the rating floor, or clear the filters.</p>
      </div>
    `;
    return;
  }

  const sortedResults = sortVisibleResults(filtered);
  resultsMeta.hidden = false;
  buildResultsSummary(state.rawResults.length, sortedResults.length);
  renderResults(sortedResults);
}

async function runThemeDiscovery(lensId) {
  const lens = getLensById(lensId);
  if (!lens) return;

  if (lensDiscoveryCache.has(lensId)) {
    state.rawResults = lensDiscoveryCache.get(lensId).map(item => ({ ...item }));
    state.currentQuery = '';
    state.discoveryLensId = lensId;
    await renderFilteredState();
    return;
  }

  setSearchLoading(`Exploring ${lens.label.toLowerCase()}...`);

  const movieGenreFilter = (lens.movieGenres || []).join('|');
  const tvGenreFilter = (lens.tvGenres || []).join('|');

  const [
    movieRated,
    moviePopular,
    seriesRated,
    seriesPopular,
  ] = await Promise.all([
    discoverTMDBCached('movie', {
      page: 1,
      withGenres: movieGenreFilter,
      sortBy: 'vote_average.desc',
    }),
    discoverTMDBCached('movie', {
      page: 1,
      withGenres: movieGenreFilter,
      sortBy: 'popularity.desc',
    }),
    discoverTMDBCached('tv', {
      page: 1,
      withGenres: tvGenreFilter,
      sortBy: 'vote_average.desc',
    }),
    discoverTMDBCached('tv', {
      page: 1,
      withGenres: tvGenreFilter,
      sortBy: 'popularity.desc',
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
        withGenres: movieGenreFilter,
        sortBy: 'vote_average.desc',
      }),
      discoverTMDBCached('tv', {
        page: 2,
        withGenres: tvGenreFilter,
        sortBy: 'vote_average.desc',
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
    const [fallbackMovies, fallbackSeries] = await Promise.all([
      discoverTMDBCached('movie', {
        page: 1,
        sortBy: 'vote_average.desc',
      }),
      discoverTMDBCached('tv', {
        page: 1,
        sortBy: 'vote_average.desc',
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
    lensDiscoveryCache.set(lensId, discoveredPool);
  }
  state.rawResults = discoveredPool.map(item => ({ ...item }));
  state.currentQuery = '';
  state.discoveryLensId = lensId;
  await renderFilteredState();
}

async function runSearch(query) {
  setSearchLoading('Searching for thoughtful matches...');

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
        setSearchError(error.message || 'Error fetching data. Please try again.', is502);
      }
      return;
    }

    resultsMeta.hidden = true;
    resultsContainer.innerHTML = '<p class="inline-message">Enter a title or choose one of the suggested lenses.</p>';
    return;
  }

  try {
    await runSearch(query);

    if (!state.rawResults.length) {
      setSearchEmpty('Try another title or use a philosophical lens to explore.');
      return;
    }

    await renderFilteredState();
  } catch (error) {
    const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
    setSearchError(error.message || 'Error fetching data. Please try again.', is502);
  }
}

async function handleLensClick(event) {
  const button = event.target.closest('button[data-group="lens"]');
  if (!button) return;

  const nextLens = state.filters.lens === button.dataset.value ? 'all' : button.dataset.value;
  const shouldRefreshDiscovery = !state.currentQuery && nextLens !== 'all';
  state.filters.lens = nextLens;
  renderFilterControls();

  if (shouldRefreshDiscovery) {
    try {
      await runThemeDiscovery(nextLens);
    } catch (error) {
      const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
      setSearchError(error.message || 'Error fetching data. Please try again.', is502);
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
  if (group === 'media') {
    state.filters.media = value;
  }

  if (group === 'rating') {
    state.filters.rating = value;
  }

  renderFilterControls();

  if (state.rawResults.length) {
    await renderFilteredState();
  }
}

async function handleSortChange(event) {
  state.filters.sort = event.target.value || 'recommended';

  if (state.rawResults.length) {
    await renderFilteredState();
  }
}

async function clearFilters() {
  state.filters.media = 'all';
  state.filters.rating = 'any';
  state.filters.lens = 'all';
  state.filters.sort = 'recommended';
  renderFilterControls();

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
    renderFilterControls();
  }

  if (query) {
    try {
      await runSearch(query);

      if (!state.rawResults.length) {
        setSearchEmpty('Try another title or use a philosophical lens to explore.');
        return;
      }

      await renderFilteredState();
    } catch (error) {
      const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
      setSearchError(error.message || 'Error fetching data. Please try again.', is502);
    }
    return;
  }

  if (lens) {
    try {
      await runThemeDiscovery(lens);
    } catch (error) {
      const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
      setSearchError(error.message || 'Error fetching data. Please try again.', is502);
    }
  }
}

function init() {
  setupAuthUI().catch(() => {});
  resultsMeta.hidden = true;
  renderSortControl();
  renderFilterControls();
  form.addEventListener('submit', handleSubmit);
  lensSuggestionsContainer.addEventListener('click', handleLensClick);
  mediaFiltersContainer.addEventListener('click', handleToolbarClick);
  ratingFiltersContainer.addEventListener('click', handleToolbarClick);
  sortSelect.addEventListener('change', handleSortChange);
  clearFiltersButton.addEventListener('click', clearFilters);
  hydrateFromQueryParams().catch(() => {});
}

init();
