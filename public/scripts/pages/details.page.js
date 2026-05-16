/**
 * @file details.page.js
 * @description Details page controller for PhiloMedia.
 *
 * Quote strategy:
 * 1) Render a static philosophical quote immediately (curated -> thematic -> random)
 * 2) Silently append an AI interpretive layer below (non-blocking)
 * 3) Rank related works by philosophical affinity instead of relying on raw TMDB similarity
 */

import {
  getDetailsFromTMDB,
  getRecommendationsFromTMDB,
  getReviewsFromTMDB,
  getSimilarFromTMDB,
} from '/scripts/seriesapi.js';
import { discoverTMDBCached, searchTMDBCached } from '/scripts/services/tmdbCachedClient.js';
import { getQuoteCatalog, getQuotes } from '/scripts/philosophersapi.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
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
import { escapeHtml } from '/scripts/ui/viewHelpers.js';
import { formatYear, formatRuntime } from '/scripts/ui/detailsFormatters.js';
import { renderFacts } from '/scripts/ui/detailsFacts.js';
import {
  MIN_DECENT_SCORE,
  MIN_DECENT_THEME_SCORE,
  MIN_DECENT_TOKEN_SCORE,
  MIN_STRONG_THEME_SCORE,
  MIN_STRONG_TOKEN_SCORE,
} from '/scripts/domain/detailsPageConfig.js';
import { getDisplayTitle } from '/scripts/domain/detailsMediaHelpers.js';
import {
  buildQuoteFallbackKey,
  buildSearchQuery,
  buildSourceContext,
  createThemeWeightMap,
  extractSalientTokenGroups,
  mergeCandidateBuckets,
  normalizeQuoteEntry,
  rankRelatedCandidates,
  scoreQuoteAuthorLens,
  scoreQuoteQuality,
  scoreQuoteThemeAlignment,
  scoreQuoteTokenAlignmentGrouped,
} from '/scripts/domain/detailsQuotePipeline.js';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
const AI_ENDPOINT = '/api/ai/quotes/generate/media-context';
const AI_TRIGGER_DELAY_MS = 800;

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

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
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
    discoverTMDBCached(type, {
      withGenres: genreIds,
      withOriginalLanguage: details.original_language || '',
      sortBy: 'popularity.desc',
    }).catch(() => []),
    searchQuery
      ? searchTMDBCached(searchQuery)
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

  return rankRelatedCandidates(details, reviews, merged, id);
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
    const match = allQuotes
      .map(normalizeQuoteEntry)
      .find(quote => String(quote.id) === String(curatedId));
    if (match) return match;
  }

  try {
    const sourceContext = buildSourceContext(details, reviews);
    const sourceThemeWeights = createThemeWeightMap(analyzeWorkForThemes(sourceContext), 8);
    const sourceTokens = extractSalientTokenGroups(sourceContext, 4, 6);
    const rankedQuotes = allQuotes
      .map(normalizeQuoteEntry)
      .filter(quote => quote.quote && quote.author)
      .map(quote => {
        const themeScore = scoreQuoteThemeAlignment(sourceThemeWeights, quote);
        const tokenScore = scoreQuoteTokenAlignmentGrouped(sourceTokens, quote);
        const authorScore = scoreQuoteAuthorLens(sourceThemeWeights, quote);
        const qualityScore = scoreQuoteQuality(quote);
        const deterministicNudge = (hashString(buildQuoteFallbackKey(details, quote)) % 100) / 1000;

        return {
          ...quote,
          _score: themeScore * 1.8 + tokenScore + authorScore + qualityScore * 0.45 + deterministicNudge,
          _themeScore: themeScore,
          _tokenScore: tokenScore,
          _authorScore: authorScore,
        };
      })
      .sort((a, b) => b._score - a._score);

    const strongThemeMatch = rankedQuotes.find(quote =>
      quote._themeScore >= MIN_STRONG_THEME_SCORE
      && quote._tokenScore >= MIN_STRONG_TOKEN_SCORE
    );
    if (strongThemeMatch) return strongThemeMatch;

    const decentMatch = rankedQuotes.find(quote =>
      quote._score >= MIN_DECENT_SCORE
      && quote._themeScore >= MIN_DECENT_THEME_SCORE
      && quote._tokenScore >= MIN_DECENT_TOKEN_SCORE
    );
    if (decentMatch) return decentMatch;
  } catch (err) {
    console.warn('[PhiloMedia] Theme analysis failed:', err.message);
  }

  return allQuotes
    .map(normalizeQuoteEntry)
    .filter(quote => quote.quote && quote.author)
    .map(quote => ({
      ...quote,
      _score: scoreQuoteQuality(quote) + (hashString(buildQuoteFallbackKey(details, quote)) % 100) / 1000,
    }))
    .sort((a, b) => b._score - a._score)[0] || null;
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
      getQuoteCatalog('en').catch(() => getQuotes()).catch(() => []),
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
