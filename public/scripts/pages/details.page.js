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
import { getSession, redirectToLogin, setupAuthUI } from '/scripts/auth-ui.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { getDisplayAuthorName, getPhilosopherAuthorBySlug, getPhilosopherUrl, getPhilosopherUrlByAuthor } from '/scripts/domain/philosopherAuthors.js';
import { updatePageSeo } from '/scripts/seo.js';
import {
  buildLibraryItem,
  getLibraryStatus,
  removeLibraryItem,
  saveLibraryItem,
} from '/scripts/library-api.js';
import { mountMediaStarRating, mountQuoteThumbRating } from '/scripts/ui/userRatingControls.js';
import { escapeHtml } from '/scripts/ui/viewHelpers.js';
import { t } from '/scripts/services/i18n.js';
import { getDisplayQuoteText } from '/scripts/services/quoteDisplayResolve.js';
import { localizeItemOverviews } from '/scripts/services/tmdbOverviewI18n.js';
import { getUiLocale } from '/scripts/services/uiLocale.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';
import { formatYear, formatRuntime } from '/scripts/ui/detailsFormatters.js';
import { renderFacts } from '/scripts/ui/detailsFacts.js';
import { WEAK_POOL_SIZE } from '/scripts/domain/detailsPageConfig.js';
import { getDisplayTitle } from '/scripts/domain/detailsMediaHelpers.js';
import {
  buildSearchQuery,
  buildSourceContext,
  buildSourceThemeWeights,
  extractSalientTokenGroups,
  hashString,
  mergeCandidateBuckets,
  normalizeQuoteEntry,
  rankQuotesForSource,
  rankRelatedCandidates,
  scoreQuoteQuality,
  selectQuoteForMedia,
} from '/scripts/domain/detailsQuotePipeline.js';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
const AI_ENDPOINT = '/api/ai/quotes/generate/media-context';
const AI_TRIGGER_DELAY_MS = 800;

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from');
  const philosopher = params.get('philosopher') || (from === 'philosopher' ? params.get('slug') : '');
  return {
    id: params.get('id'),
    type: params.get('type'),
    philosopherSlug: String(philosopher || '').trim(),
  };
}

function renderThinkerBackLink(slug) {
  const crumb = document.getElementById('details-thinker-crumb');
  if (!crumb) return;

  if (!slug) {
    crumb.hidden = true;
    crumb.innerHTML = '';
    return;
  }

  const href = getPhilosopherUrl(slug);
  if (!href) {
    crumb.hidden = true;
    crumb.innerHTML = '';
    return;
  }

  const author = getPhilosopherAuthorBySlug(slug);
  const label = t('details.back_to_thinker', { name: author?.name || slug });
  crumb.hidden = false;
  crumb.innerHTML = `<a class="details-thinker-back" href="${href}">${escapeHtml(label)}</a>`;
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
      <p>${t('details.loading')}</p>
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
    <h2>${t('details.error_title')}</h2>
    <p>${escapeHtml(message)}</p>
    <a href="/html/index.html" class="btn-back">${t('details.back_home')}</a>
  `;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
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
    attribution.innerHTML = `${escapeHtml(t('details.streaming_prefix'))} <a href="${watchLink}" target="_blank" rel="noreferrer">${escapeHtml(t('details.streaming_link_label'))}</a>.`;
    return;
  }

  attribution.textContent = t('details.streaming_attribution');
}

function setActionButtonState(button, { active, loading, activeLabel, idleLabel }) {
  if (!button) return;

  button.disabled = Boolean(loading);
  button.classList.toggle('is-active', Boolean(active));
  button.classList.toggle('is-loading', Boolean(loading));
  button.textContent = loading
    ? t('details.saving')
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
      activeLabel: t('details.saved_watchlist'),
      idleLabel: t('details.save_watchlist'),
    });

    setActionButtonState(favoriteButton, {
      active: status.inFavorites,
      loading: loadingFavorites,
      activeLabel: t('details.saved_favorites'),
      idleLabel: t('details.add_favorites'),
    });

    setActionButtonState(watchedButton, {
      active: status.inWatched,
      loading: loadingWatched,
      activeLabel: t('details.marked_watched'),
      idleLabel: t('details.mark_watched'),
    });

    if (feedbackMessage) {
      hint.textContent = feedbackMessage;
      return;
    }

    if (!session.authenticated) {
      hint.textContent = t('details.sign_in_hint');
      return;
    }

    if (status.inWatchlist || status.inFavorites || status.inWatched) {
      hint.textContent = t('details.already_saved');
      return;
    }

    hint.textContent = t('details.library_hint');
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
      feedbackMessage = t('details.watchlist_error');
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
      feedbackMessage = t('details.favorites_error');
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
      feedbackMessage = t('details.watched_error');
      render();
    }
  });
}

function populateDetails(details, type) {
  const img = document.getElementById('details-image');
  const title = getDisplayTitle(details);
  const mediaLabel = type === 'tv' ? t('details.series') : t('details.movie');
  const releaseDate = type === 'tv' ? details.first_air_date : details.release_date;
  const posterUrl = details.poster_path ? `${TMDB_IMAGE_BASE}${details.poster_path}` : '';

  if (img) {
    if (details.poster_path) {
      img.src = posterUrl;
      img.alt = t('details.poster_alt', { title });
      img.classList.remove('no-poster');
    } else {
      img.removeAttribute('src');
      img.classList.add('no-poster');
      img.alt = t('details.no_poster');
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
  setText('details-overview', details.overview || t('details.no_overview'));
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

async function renderRelatedWorks(works) {
  const section = document.getElementById('related-works');
  const container = document.getElementById('related-results');
  if (!section || !container) return;

  if (!Array.isArray(works) || works.length === 0) {
    section.hidden = true;
    container.innerHTML = '';
    return;
  }

  section.hidden = false;
  const localized = await localizeItemOverviews(works);
  renderMediaCards(container, localized, {
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

  const mediaKey = `${type}:${id}`;

  try {
    const sourceThemeWeights = buildSourceThemeWeights(details, reviews, type, 8);
    const sourceTokens = extractSalientTokenGroups(buildSourceContext(details, reviews), 4, 6);
    const rankedQuotes = rankQuotesForSource(allQuotes, sourceThemeWeights, sourceTokens);

    const selected = selectQuoteForMedia(rankedQuotes, mediaKey);
    if (selected) return selected;
  } catch (err) {
    console.warn('[PhiloMedia] Theme analysis failed:', err.message);
  }

  const byQuality = allQuotes
    .map(normalizeQuoteEntry)
    .filter(quote => quote.quote && quote.author)
    .map(quote => ({ ...quote, _score: scoreQuoteQuality(quote) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, WEAK_POOL_SIZE);

  return byQuality.length > 0
    ? byQuality[hashString(mediaKey) % byQuality.length]
    : null;
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
    <div class="ai-badge">${escapeHtml(t('details.ai_reading'))}</div>
    <p class="ai-quote-text">"${escapeHtml(text)}"</p>
    <span class="ai-quote-author">${authorMarkup}</span>
    ${explanation ? `<p class="ai-quote-explanation">${escapeHtml(explanation)}</p>` : ''}
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
      <span>${escapeHtml(t('details.ai_in_progress'))}</span>
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
        body: JSON.stringify({
          tmdbId: String(id),
          mediaType: type,
          locale: getUiLocale(),
        }),
      });

      const raw = await res.text();
      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
      }

      if (!res.ok) {
        const reason = data?.code || data?.error;
        const message = reason === 'ai_not_configured'
          ? t('details.ai_not_configured')
          : reason === 'ai_quota_exceeded'
            ? t('details.ai_quota_exceeded')
            : t('details.ai_unavailable');
        container.innerHTML = `
          <div class="ai-placeholder error">
            <span>${escapeHtml(message)}</span>
          </div>
        `;
        return;
      }

      if (data?.available === false) {
        container.innerHTML = `
          <div class="ai-placeholder error">
            <span>${escapeHtml(t('details.ai_incomplete'))}</span>
          </div>
        `;
        return;
      }

      const quoteText = data?.quote?.quoteText || data?.quoteText;
      const authorName = data?.quote?.authorName || data?.authorName;

      if (!quoteText || !authorName) {
        container.innerHTML = `
          <div class="ai-placeholder error">
            <span>${escapeHtml(t('details.ai_incomplete'))}</span>
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
          <span>${escapeHtml(t('details.ai_failed'))}</span>
        </div>
      `;
    }
  }, AI_TRIGGER_DELAY_MS);
}

async function init() {
  setupLanguageChrome();
  setupAuthUI().catch(() => {});

  const { id, type, philosopherSlug } = getQueryParams();

  renderThinkerBackLink(philosopherSlug);

  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    showError(t('details.invalid_id'));
    return;
  }

  setLoading(true);

  try {
    const [details, allQuotes, reviews] = await Promise.all([
      getDetailsFromTMDB(id, type).catch(() => null),
      getQuoteCatalog('en').catch(() => getQuoteCatalog(getUiLocale())).catch(() => getQuotes()).catch(() => []),
      getReviewsFromTMDB(id, type).catch(() => []),
    ]);

    if (!details) {
      showError(t('details.load_failed'));
      return;
    }

    populateDetails(details, type);
    initializeLibraryActions(details, type).catch(() => {});
    mountMediaStarRating({
      container: document.getElementById('details-star-rating'),
      hintEl: document.getElementById('details-rating-hint'),
      mediaType: type,
      tmdbId: String(details.id),
    }).catch(() => {});

    const [relatedWorks, staticQuote] = await Promise.all([
      loadRelatedWorks(id, type, details, reviews).catch(() => []),
      resolveStaticQuote(id, type, details, allQuotes, reviews),
    ]);

    await renderRelatedWorks(relatedWorks);

    if (staticQuote) {
      renderStaticQuote({
        text: getDisplayQuoteText(staticQuote),
        author: staticQuote.author,
      });
      mountQuoteThumbRating({
        container: document.getElementById('quote-rating'),
        upButton: document.getElementById('quote-rating-up'),
        downButton: document.getElementById('quote-rating-down'),
        hintEl: document.getElementById('quote-rating-hint'),
        quoteId: staticQuote.id,
      }).catch(() => {});
    } else {
      setText('quote-text', t('details.no_quote'));
      setText('quote-author', '');
    }

    renderAIPlaceholder();
    scheduleAIEnhancement(id, type);
  } catch (err) {
    console.error('[PhiloMedia] Unexpected error:', err);
    showError(t('details.unexpected_error'));
  } finally {
    setLoading(false);
  }
}

init();
