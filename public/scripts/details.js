/**
 * @file details.js
 * @description Details page controller for PhiloMedia.
 *
 * Quote strategy:
 * 1) Render a static philosophical quote immediately (curated -> thematic -> random)
 * 2) Silently append an AI interpretive layer below (non-blocking)
 * 3) Rank related works by philosophical affinity instead of relying on raw TMDB similarity
 */

import {
  discoverTMDB,
  getDetailsFromTMDB,
  getRecommendationsFromTMDB,
  getReviewsFromTMDB,
  getSimilarFromTMDB,
  searchTMDB,
} from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';
import { getSession, redirectToLogin, setupAuthUI } from '/scripts/auth-ui.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { getDisplayAuthorName, getPhilosopherUrlByAuthor } from '/scripts/philosopher-data.js';
import { updatePageSeo } from '/scripts/seo.js';
import {
  buildLibraryItem,
  getLibraryStatus,
  removeLibraryItem,
  saveLibraryItem,
} from '/scripts/library-api.js';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
const AI_ENDPOINT = '/api/ai/quotes/generate/media-context';
const AI_TRIGGER_DELAY_MS = 800;
const RELATED_LIMIT = 6;

const NOISE_WORDS = new Set([
  'about', 'after', 'alive', 'along', 'already', 'another', 'around', 'away',
  'because', 'before', 'become', 'becomes', 'becoming', 'beginning', 'between',
  'business', 'character', 'characters', 'city', 'family', 'father', 'find',
  'finds', 'following', 'friend', 'friends', 'girl', 'girls', 'group', 'help',
  'helps', 'home', 'japan', 'journey', 'life', 'lives', 'mother', 'movie',
  'movies', 'must', 'older', 'ordinary', 'school', 'series', 'show', 'story',
  'student', 'students', 'takes', 'their', 'there', 'these', 'through', 'time',
  'tries', 'trying', 'under', 'while', 'world', 'years', 'young',
]);

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    type: params.get('type'),
  };
}

function setLoading(visible) {
  let overlay = document.getElementById('loading-overlay');

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
      <div class="loading-spinner" aria-hidden="true"></div>
      <p>Loading details...</p>
    `;
    document.querySelector('main').prepend(overlay);
  }

  overlay.style.display = visible ? 'flex' : 'none';
  overlay.setAttribute('aria-hidden', String(!visible));
}

function showError(message) {
  setLoading(false);
  updatePageSeo({
    title: 'PhiloMedia | Details unavailable',
    description: 'The requested PhiloMedia media page could not be loaded right now.',
    path: window.location.pathname,
    type: 'article',
  });

  document.getElementById('details-container')
    ?.querySelectorAll('.details-poster, .details-info')
    .forEach(el => {
      el.style.display = 'none';
    });

  let el = document.getElementById('details-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'details-error';
    el.setAttribute('role', 'alert');
    document.querySelector('main').appendChild(el);
  }

  el.innerHTML = `
    <h2>Something went wrong</h2>
    <p>${message}</p>
    <a href="/html/index.html" class="btn-back">Back to home</a>
  `;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

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

function getDisplayTitle(details) {
  return details.title || details.name || 'Unknown';
}

function getDisplayDate(item) {
  return item.release_date || item.first_air_date || '';
}

function getYear(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? null : date.getFullYear();
}

function formatYear(dateString) {
  return getYear(dateString)?.toString() || 'Unknown year';
}

function formatRuntime(details, type) {
  if (type === 'movie' && Number.isFinite(details.runtime) && details.runtime > 0) {
    const hours = Math.floor(details.runtime / 60);
    const minutes = details.runtime % 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  if (type === 'tv') {
    const runtime = Array.isArray(details.episode_run_time)
      ? details.episode_run_time.find(value => Number.isFinite(value) && value > 0)
      : null;
    const seasons = Number.isFinite(details.number_of_seasons) && details.number_of_seasons > 0
      ? `${details.number_of_seasons} season${details.number_of_seasons === 1 ? '' : 's'}`
      : '';

    if (seasons && runtime) return `${seasons} | ${runtime} min episodes`;
    if (seasons) return seasons;
    if (runtime) return `${runtime} min episodes`;
  }

  return 'Runtime unavailable';
}

function formatRating(details) {
  const voteAverage = Number(details.vote_average);
  const voteCount = Number(details.vote_count);

  if (!Number.isFinite(voteAverage) || voteAverage <= 0) {
    return '';
  }

  const rounded = voteAverage.toFixed(1);
  if (!Number.isFinite(voteCount) || voteCount <= 0) {
    return `${rounded}/10`;
  }

  return `${rounded}/10 from ${voteCount.toLocaleString()} votes`;
}

function joinNames(items, key = 'name', limit = 3) {
  if (!Array.isArray(items) || items.length === 0) return '';

  return items
    .map(item => item?.[key])
    .filter(Boolean)
    .slice(0, limit)
    .join(', ');
}

function getCreativeLead(details, type) {
  if (type === 'tv') {
    return joinNames(details.created_by, 'name', 3);
  }

  const directors = Array.isArray(details.credits?.crew)
    ? details.credits.crew.filter(person => person?.job === 'Director')
    : [];

  return joinNames(directors, 'name', 3);
}

function getStudio(details, type) {
  const source =
    type === 'tv' && Array.isArray(details.networks) && details.networks.length > 0
      ? details.networks
      : details.production_companies;

  return joinNames(source, 'name', 3);
}

function getGenres(details) {
  return joinNames(details.genres, 'name', 4);
}

function getStreamingProviders(details) {
  const providers = details.watchProviders?.providers;
  if (!Array.isArray(providers) || providers.length === 0) return '';

  return providers
    .map(provider => provider?.provider_name)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
}

function renderAttribution(details) {
  const attribution = document.getElementById('details-attribution');
  if (!attribution) return;

  const watchLink = details.watchProviders?.link;
  const hasProviders = Array.isArray(details.watchProviders?.providers)
    && details.watchProviders.providers.length > 0;

  if (!hasProviders) {
    attribution.hidden = true;
    attribution.innerHTML = '';
    return;
  }

  attribution.hidden = false;

  if (watchLink) {
    attribution.innerHTML = `Streaming availability via <a href="${watchLink}" target="_blank" rel="noreferrer">JustWatch on TMDB</a>.`;
    return;
  }

  attribution.textContent = 'Streaming availability via JustWatch on TMDB.';
}

function setActionButtonState(button, { active, loading, activeLabel, idleLabel }) {
  if (!button) return;

  button.disabled = Boolean(loading);
  button.classList.toggle('is-active', Boolean(active));
  button.classList.toggle('is-loading', Boolean(loading));
  button.textContent = loading
    ? 'Saving...'
    : (active ? activeLabel : idleLabel);
}

async function initializeLibraryActions(details, type) {
  const actions = document.getElementById('details-actions');
  const watchlistButton = document.getElementById('watchlist-button');
  const favoriteButton = document.getElementById('favorite-button');
  const watchedButton = document.getElementById('watched-button');
  const hint = document.getElementById('details-actions-hint');

  if (!actions || !watchlistButton || !favoriteButton || !watchedButton || !hint) return;

  const session = await getSession();
  if (!session.oauthEnabled) {
    actions.hidden = true;
    hint.hidden = true;
    return;
  }

  const item = buildLibraryItem(details, type);
  let status = {
    inWatchlist: false,
    inFavorites: false,
    inWatched: false,
  };
  let feedbackMessage = '';

  const render = ({
    loadingWatchlist = false,
    loadingFavorites = false,
    loadingWatched = false,
  } = {}) => {
    actions.hidden = false;
    hint.hidden = false;

    setActionButtonState(watchlistButton, {
      active: status.inWatchlist,
      loading: loadingWatchlist,
      activeLabel: 'Saved to watchlist',
      idleLabel: 'Save to watchlist',
    });

    setActionButtonState(favoriteButton, {
      active: status.inFavorites,
      loading: loadingFavorites,
      activeLabel: 'Saved to favorites',
      idleLabel: 'Add to favorites',
    });

    setActionButtonState(watchedButton, {
      active: status.inWatched,
      loading: loadingWatched,
      activeLabel: 'Marked as watched',
      idleLabel: 'Mark as watched',
    });

    if (feedbackMessage) {
      hint.textContent = feedbackMessage;
      return;
    }

    if (!session.authenticated) {
      hint.textContent = 'Sign in with Google to save this work to your personal library.';
      return;
    }

    if (status.inWatchlist || status.inFavorites || status.inWatched) {
      hint.textContent = 'This work is already saved in your library.';
      return;
    }

    hint.textContent = 'Use your library to keep track of titles you want to revisit.';
  };

  if (session.authenticated) {
    status = await getLibraryStatus(item.tmdbId, item.mediaType).catch(() => status);
  }

  render();

  watchlistButton.addEventListener('click', async () => {
    if (!session.authenticated) {
      redirectToLogin();
      return;
    }

    render({ loadingWatchlist: true });

    try {
      const payload = status.inWatchlist
        ? await removeLibraryItem('watchlist', item.tmdbId, item.mediaType)
        : await saveLibraryItem('watchlist', item);

      status = payload.status || status;
      feedbackMessage = '';
      render();
    } catch (error) {
      feedbackMessage = 'We could not update your watchlist right now.';
      render();
    }
  });

  favoriteButton.addEventListener('click', async () => {
    if (!session.authenticated) {
      redirectToLogin();
      return;
    }

    render({ loadingFavorites: true });

    try {
      const payload = status.inFavorites
        ? await removeLibraryItem('favorites', item.tmdbId, item.mediaType)
        : await saveLibraryItem('favorites', item);

      status = payload.status || status;
      feedbackMessage = '';
      render();
    } catch (error) {
      feedbackMessage = 'We could not update your favorites right now.';
      render();
    }
  });

  watchedButton.addEventListener('click', async () => {
    if (!session.authenticated) {
      redirectToLogin();
      return;
    }

    render({ loadingWatched: true });

    try {
      const payload = status.inWatched
        ? await removeLibraryItem('watched', item.tmdbId, item.mediaType)
        : await saveLibraryItem('watched', item);

      status = payload.status || status;
      feedbackMessage = '';
      render();
    } catch (error) {
      feedbackMessage = 'We could not update your watched list right now.';
      render();
    }
  });
}

function renderFacts(details, type) {
  const container = document.getElementById('details-facts');
  if (!container) return;

  const facts = [
    formatRating(details),
    getCreativeLead(details, type),
    getStudio(details, type),
    getGenres(details),
    getStreamingProviders(details),
  ].filter(Boolean);

  container.innerHTML = '';
  container.hidden = facts.length === 0;

  facts.forEach(fact => {
    const item = document.createElement('span');
    item.className = 'detail-fact';

    const value = document.createElement('span');
    value.className = 'detail-fact-value';
    value.textContent = fact;

    item.appendChild(value);
    container.appendChild(item);
  });
}

function populateDetails(details, type) {
  const img = document.getElementById('details-image');
  const title = getDisplayTitle(details);
  const mediaLabel = type === 'tv' ? 'Series' : 'Movie';
  const releaseDate = type === 'tv' ? details.first_air_date : details.release_date;
  const posterUrl = details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : '';

  if (img) {
    if (details.poster_path) {
      img.src = posterUrl;
      img.alt = `Poster of ${title}`;
      img.classList.remove('no-poster');
    } else {
      img.removeAttribute('src');
      img.classList.add('no-poster');
      img.alt = 'No poster available';
    }
  }

  updatePageSeo({
    title: `${title} | PhiloMedia`,
    description: details.overview || `${title} receives a philosophical reading, contextual quote pairing, and related works inside PhiloMedia.`,
    path: `${window.location.pathname}?id=${encodeURIComponent(details.id)}&type=${encodeURIComponent(type)}`,
    image: posterUrl,
    type: 'article',
  });

  setText('details-title', title);
  setText(
    'details-meta',
    `${mediaLabel} | ${formatYear(releaseDate)} | ${formatRuntime(details, type)}`
  );
  renderFacts(details, type);
  renderAttribution(details);
  setText('details-overview', details.overview || 'No overview available.');
}

function buildSourceContext(details, reviews = []) {
  const parts = [
    getDisplayTitle(details),
    details.overview || '',
    Array.isArray(details.genres) ? details.genres.map(genre => genre?.name).filter(Boolean).join(' ') : '',
    Array.isArray(reviews) ? reviews.map(review => review.content || '').join(' ') : '',
  ].filter(Boolean);

  return parts.join(' ').trim();
}

function extractSalientTokens(text, limit = 10) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const counts = new Map();

  normalized.split(' ').forEach(token => {
    if (!token || token.length < 4) return;
    if (/^\d+$/.test(token)) return;
    if (NOISE_WORDS.has(token)) return;

    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .slice(0, limit);
}

function buildSearchQuery(details, reviews) {
  const contextTokens = extractSalientTokens(buildSourceContext(details, reviews), 6);
  const titleTokens = extractSalientTokens(getDisplayTitle(details), 2);
  const queryTokens = [...new Set([...contextTokens, ...titleTokens])].slice(0, 4);
  return queryTokens.join(' ');
}

function createThemeWeightMap(themeScores, limit = 6) {
  const topThemes = themeScores.slice(0, limit);
  const total = topThemes.reduce((sum, item) => sum + item.score, 0) || 1;
  return new Map(topThemes.map(item => [item.theme, item.score / total]));
}

function scoreThemeAlignment(sourceWeights, candidateText) {
  if (!sourceWeights.size) return 0;

  const candidateThemes = analyzeWorkForThemes(candidateText);
  const candidateWeights = createThemeWeightMap(candidateThemes);

  let score = 0;
  for (const [theme, sourceWeight] of sourceWeights.entries()) {
    const candidateWeight = candidateWeights.get(theme);
    if (candidateWeight) {
      score += sourceWeight * candidateWeight * 100;
    }
  }

  return score;
}

function scoreTokenAlignment(sourceTokens, candidateText) {
  if (!sourceTokens.length) return 0;

  const candidateTokens = new Set(extractSalientTokens(candidateText, 16));
  let score = 0;

  sourceTokens.forEach((token, index) => {
    if (candidateTokens.has(token)) {
      score += Math.max(3, 12 - index * 1.4);
    }
  });

  return score;
}

function scoreGenreAlignment(sourceGenreIds, candidateGenreIds) {
  if (!sourceGenreIds.length || !Array.isArray(candidateGenreIds) || candidateGenreIds.length === 0) {
    return 0;
  }

  const sourceGenreSet = new Set(sourceGenreIds);
  const overlap = candidateGenreIds.filter(id => sourceGenreSet.has(id)).length;
  if (!overlap) return 0;

  return (overlap / sourceGenreIds.length) * 16;
}

function scoreYearAlignment(sourceDate, candidateDate) {
  const sourceYear = getYear(sourceDate);
  const candidateYear = getYear(candidateDate);

  if (!sourceYear || !candidateYear) return 0;

  const delta = Math.abs(sourceYear - candidateYear);
  return Math.max(0, 8 - delta * 0.5);
}

function scoreLocaleAlignment(details, candidate) {
  let score = 0;

  if (details.original_language && candidate.original_language === details.original_language) {
    score += 6;
  }

  if (Array.isArray(details.origin_country) && Array.isArray(candidate.origin_country)) {
    const sameCountry = details.origin_country.some(country => candidate.origin_country.includes(country));
    if (sameCountry) score += 4;
  }

  return score;
}

function scoreSourceBoost(candidate) {
  const sources = Array.isArray(candidate._sources) ? candidate._sources : [];
  let boost = 0;

  if (sources.includes('recommendation')) boost += 12;
  if (sources.includes('similar')) boost += 8;
  if (sources.includes('search')) boost += 7;
  if (sources.includes('discover')) boost += 4;

  return boost;
}

function mergeCandidateBuckets(buckets, currentId, type) {
  const merged = new Map();

  buckets.forEach(({ items, source }) => {
    (items || []).forEach(item => {
      if (!item || item.id == null || String(item.id) === String(currentId)) return;
      if (item.media_type && item.media_type !== type) return;

      const existing = merged.get(String(item.id));
      if (!existing) {
        merged.set(String(item.id), {
          ...item,
          _sources: [source],
        });
        return;
      }

      const mergedSources = [...new Set([...(existing._sources || []), source])];
      merged.set(String(item.id), {
        ...existing,
        ...item,
        overview: existing.overview || item.overview || '',
        poster_path: existing.poster_path || item.poster_path || null,
        vote_average: Math.max(Number(existing.vote_average) || 0, Number(item.vote_average) || 0),
        popularity: Math.max(Number(existing.popularity) || 0, Number(item.popularity) || 0),
        _sources: mergedSources,
      });
    });
  });

  return [...merged.values()];
}

function rankRelatedCandidates(details, reviews, candidates) {
  const sourceContext = buildSourceContext(details, reviews);
  const sourceThemeWeights = createThemeWeightMap(analyzeWorkForThemes(sourceContext), 6);
  const sourceTokens = extractSalientTokens(sourceContext, 10);
  const sourceGenreIds = Array.isArray(details.genres)
    ? details.genres.map(genre => genre?.id).filter(Boolean)
    : [];
  const sourceDate = getDisplayDate(details);

  const ranked = candidates
    .map(candidate => {
      const candidateContext = `${candidate.title || candidate.name || ''} ${candidate.overview || ''}`.trim();
      const themeScore = scoreThemeAlignment(sourceThemeWeights, candidateContext);
      const tokenScore = scoreTokenAlignment(sourceTokens, candidateContext);
      const genreScore = scoreGenreAlignment(sourceGenreIds, candidate.genre_ids);
      const localeScore = scoreLocaleAlignment(details, candidate);
      const yearScore = scoreYearAlignment(sourceDate, getDisplayDate(candidate));
      const sourceBoost = scoreSourceBoost(candidate);
      const ratingScore = Math.max(0, Number(candidate.vote_average || 0) - 6) * 1.4;
      const popularityScore = Math.min(8, (Number(candidate.popularity) || 0) / 35);
      const weakMatchPenalty = themeScore < 14 && tokenScore < 10 ? 18 : 0;
      const noOverviewPenalty = candidate.overview ? 0 : 10;

      const score =
        themeScore * 1.3
        + tokenScore
        + genreScore
        + localeScore
        + yearScore
        + sourceBoost
        + ratingScore
        + popularityScore
        - weakMatchPenalty
        - noOverviewPenalty;

      return {
        ...candidate,
        _score: score,
      };
    })
    .sort((a, b) => b._score - a._score);

  const strongMatches = ranked.filter(candidate => candidate._score >= 24);
  return (strongMatches.length >= 3 ? strongMatches : ranked).slice(0, RELATED_LIMIT);
}

async function loadRelatedWorks(id, type, details, reviews) {
  const genreIds = Array.isArray(details.genres)
    ? details.genres.map(genre => genre?.id).filter(Boolean).join(',')
    : '';
  const searchQuery = buildSearchQuery(details, reviews);

  const [
    similarWorks,
    recommendedWorks,
    discoveredWorks,
    searchedWorks,
  ] = await Promise.all([
    getSimilarFromTMDB(id, type).catch(() => []),
    getRecommendationsFromTMDB(id, type).catch(() => []),
    discoverTMDB(type, {
      withGenres: genreIds,
      withOriginalLanguage: details.original_language || '',
      sortBy: 'popularity.desc',
    }).catch(() => []),
    searchQuery
      ? searchTMDB(searchQuery)
          .then(items => items.filter(item => item.media_type === type))
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const merged = mergeCandidateBuckets([
    { items: recommendedWorks, source: 'recommendation' },
    { items: similarWorks, source: 'similar' },
    { items: discoveredWorks, source: 'discover' },
    { items: searchedWorks, source: 'search' },
  ], id, type);

  return rankRelatedCandidates(details, reviews, merged);
}

function renderRelatedWorks(works) {
  const section = document.getElementById('related-works');
  const container = document.getElementById('related-results');
  if (!section || !container) return;

  if (!Array.isArray(works) || works.length === 0) {
    section.hidden = true;
    container.innerHTML = '';
    return;
  }

  section.hidden = false;
  renderMediaCards(container, works, {
    overviewLength: 110,
  });
}

async function resolveStaticQuote(id, type, details, allQuotes, reviews) {
  if (!allQuotes?.length) return null;

  const curatedId = curatedQuoteMatches[id];
  if (curatedId) {
    const match = allQuotes.find(quote => String(quote.id) === String(curatedId));
    if (match) return match;
  }

  try {
    const reviewText = Array.isArray(reviews)
      ? reviews.map(review => review.content || '').join(' ')
      : '';

    const combined = `${details.overview || ''} ${reviewText}`.trim();
    const profile = analyzeWorkForThemes(combined);

    let best = null;
    let highScore = 0;

    for (const quote of allQuotes) {
      const themes = new Set(quote.themes || []);
      let score = 0;

      for (const themeProfile of profile) {
        if (themes.has(themeProfile.theme) && themeProfile.score > score) {
          score = themeProfile.score;
        }
      }

      if (score > highScore) {
        highScore = score;
        best = quote;
      }
    }

    if (best) return best;
  } catch (err) {
    console.warn('[PhiloMedia] Theme analysis failed:', err.message);
  }

  return allQuotes[Math.floor(Math.random() * allQuotes.length)];
}

function renderStaticQuote({ text, author }) {
  const textEl = document.getElementById('quote-text');
  const authorEl = document.getElementById('quote-author');

  if (!textEl || !authorEl) return;

  textEl.textContent = `"${text}"`;
  authorEl.textContent = '';

  const displayName = getDisplayAuthorName(author);
  const url = getPhilosopherUrlByAuthor(author);

  if (!url) {
    authorEl.textContent = `- ${displayName}`;
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.textContent = `- ${displayName}`;
  authorEl.appendChild(link);
}

function renderAIExpansion({ text, author, explanation }) {
  const container = document.getElementById('ai-quote-container');
  if (!container) return;

  container.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'ai-quote-block';
  const displayName = getDisplayAuthorName(author);
  const authorUrl = getPhilosopherUrlByAuthor(author);
  const authorMarkup = authorUrl
    ? `<a href="${authorUrl}">- ${escapeHtml(displayName)}</a>`
    : `- ${escapeHtml(displayName)}`;

  block.innerHTML = `
    <div class="ai-badge">AI interpretive reading</div>
    <p class="ai-quote-text">"${text}"</p>
    <span class="ai-quote-author">${authorMarkup}</span>
    ${explanation ? `<p class="ai-quote-explanation">${explanation}</p>` : ''}
  `;

  container.appendChild(block);
  block.getBoundingClientRect();
  block.classList.add('visible');
}

function renderAIPlaceholder() {
  const container = document.getElementById('ai-quote-container');
  if (!container) return;

  container.innerHTML = `
    <div class="ai-placeholder visible">
      <span class="ai-thinking-dot"></span>
      <span>AI interpretive reading in progress...</span>
    </div>
  `;
}

function scheduleAIEnhancement(id, type) {
  setTimeout(async () => {
    const container = document.getElementById('ai-quote-container');
    if (!container) return;

    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tmdbId: id, mediaType: type }),
      });

      if (!res.ok) {
        container.innerHTML = `
          <div class="ai-placeholder error">
            <span>AI interpretation unavailable.</span>
          </div>
        `;
        return;
      }

      const data = await res.json();
      const quoteText = data.quote?.quoteText || data.quoteText;
      const authorName = data.quote?.authorName || data.authorName;

      if (!quoteText || !authorName) {
        container.innerHTML = `
          <div class="ai-placeholder error">
            <span>AI interpretation incomplete.</span>
          </div>
        `;
        return;
      }

      renderAIExpansion({
        text: quoteText,
        author: authorName,
        explanation: data.explanation || '',
      });
    } catch (err) {
      container.innerHTML = `
        <div class="ai-placeholder error">
          <span>AI interpretation failed.</span>
        </div>
      `;
    }
  }, AI_TRIGGER_DELAY_MS);
}

async function init() {
  setupAuthUI().catch(() => {});

  const { id, type } = getQueryParams();

  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    showError('Invalid or missing media identifier.');
    return;
  }

  setLoading(true);

  try {
    const [details, allQuotes, reviews] = await Promise.all([
      getDetailsFromTMDB(id, type).catch(() => null),
      getQuotes().catch(() => []),
      getReviewsFromTMDB(id, type).catch(() => []),
    ]);

    if (!details) {
      showError('Could not load media details.');
      return;
    }

    populateDetails(details, type);
    initializeLibraryActions(details, type).catch(() => {});

    const [relatedWorks, staticQuote] = await Promise.all([
      loadRelatedWorks(id, type, details, reviews).catch(() => []),
      resolveStaticQuote(id, type, details, allQuotes, reviews),
    ]);

    renderRelatedWorks(relatedWorks);

    if (staticQuote) {
      renderStaticQuote({
        text: staticQuote.quote,
        author: staticQuote.author,
      });
    } else {
      setText('quote-text', 'No philosophical quote available.');
      setText('quote-author', '');
    }

    renderAIPlaceholder();
    scheduleAIEnhancement(id, type);
  } catch (err) {
    console.error('[PhiloMedia] Unexpected error:', err);
    showError('An unexpected error occurred.');
  } finally {
    setLoading(false);
  }
}

init();
