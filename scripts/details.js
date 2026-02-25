/**
 * @file details.js
 * @description Details page controller for PhiloMedia.
 *
 * Core fix: The previous implementation called `detailsContainer.innerHTML = '<p>Loading...</p>'`
 * which destroyed all child elements (details-image, details-title, etc.) from the DOM.
 * After the async call returned, getElementById() found nothing and silently skipped updates,
 * leaving the "Loading details..." text on screen forever.
 *
 * Solution: Use a dedicated loading overlay that never touches the content structure.
 */

import { getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';

// ─── URL Params ───────────────────────────────────────────────────────────────

/**
 * Extracts and validates `id` and `type` from the current URL query string.
 * @returns {{ id: string|null, type: string|null }}
 */
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    type: params.get('type'),
  };
}

// ─── Loading State ────────────────────────────────────────────────────────────

/**
 * Shows or hides a dedicated loading overlay WITHOUT touching content elements.
 * This is the key fix — the old code used innerHTML on the container, which
 * destroyed child elements that the rest of the code expected to find.
 *
 * @param {boolean} visible
 */
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

// ─── Error State ──────────────────────────────────────────────────────────────

/**
 * Displays a user-friendly error message inside the details section.
 * Does NOT use innerHTML on the main container to avoid destroying elements.
 *
 * @param {string} message
 */
function showError(message) {
  setLoading(false);

  const detailsSection = document.getElementById('details-container');
  if (!detailsSection) return;

  // Hide the normal content structure
  detailsSection.querySelectorAll('.details-poster, .details-info').forEach(el => {
    el.style.display = 'none';
  });

  // Insert or update an error message node
  let errorEl = document.getElementById('details-error');
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'details-error';
    errorEl.setAttribute('role', 'alert');
    detailsSection.appendChild(errorEl);
  }

  errorEl.innerHTML = `
    <h2>Something went wrong</h2>
    <p>${message}</p>
    <a href="/html/index.html" class="btn-back">← Back to Home</a>
  `;
}

// ─── DOM Population ───────────────────────────────────────────────────────────

/**
 * Safely sets the text content of a DOM element by ID.
 *
 * @param {string} id
 * @param {string} text
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * Populates the details section with data from TMDB.
 * All element lookups happen AFTER the loading state is resolved,
 * with the original DOM structure intact.
 *
 * @param {Object} details - TMDB details response object
 */
function populateDetails(details) {
  document.title = `PhiloMedia — ${details.title || details.name || 'Details'}`;

  const posterImg = document.getElementById('details-image');
  if (posterImg) {
    if (details.poster_path) {
      posterImg.src = `${TMDB_IMAGE_BASE}${details.poster_path}`;
      posterImg.alt = `Poster of ${details.title || details.name}`;
    } else {
      posterImg.src = '';
      posterImg.alt = 'No poster available';
      posterImg.classList.add('no-poster');
    }
  }

  setText('details-title', details.title || details.name || 'Unknown');
  setText(
    'details-meta',
    `Release: ${details.release_date || details.first_air_date || 'Unknown'}`
  );
  setText('details-overview', details.overview || 'No overview available.');
}

/**
 * Finds and renders the best philosophical quote for the given media.
 * Priority: curated match → theme analysis → random fallback.
 *
 * @param {string} id        - TMDB media ID
 * @param {string} type      - 'movie' | 'tv'
 * @param {Object} details   - TMDB details object (for overview text)
 * @param {Array}  allQuotes - Full quotes array
 */
async function populateQuote(id, type, details, allQuotes) {
  if (!allQuotes || allQuotes.length === 0) {
    setText('quote-text', 'No philosophical quote available for this work.');
    setText('quote-author', '');
    return;
  }

  let bestQuote = null;

  // 1. Check curated matches first (highest quality, no computation needed)
  const curatedQuoteId = curatedQuoteMatches[id];
  if (curatedQuoteId) {
    bestQuote = allQuotes.find(q => q.id === curatedQuoteId) || null;
  }

  // 2. If no curated match, use theme analysis
  if (!bestQuote) {
    try {
      const reviews = await getReviewsFromTMDB(id, type).catch(() => []);
      const reviewText = Array.isArray(reviews)
        ? reviews.map(r => r.content || '').join(' ')
        : '';
      const combinedText = `${details.overview || ''} ${reviewText}`.trim();
      const workThemeProfile = analyzeWorkForThemes(combinedText);

      let highestScore = 0;

      for (const quote of allQuotes) {
        const quoteThemes = new Set(quote.themes);
        let strongestScore = 0;

        for (const themeProfile of workThemeProfile) {
          if (quoteThemes.has(themeProfile.theme) && themeProfile.score > strongestScore) {
            strongestScore = themeProfile.score;
          }
        }

        if (strongestScore > highestScore) {
          highestScore = strongestScore;
          bestQuote = quote;
        }
      }
    } catch (err) {
      console.warn('[PhiloMedia] Theme analysis failed, using random fallback:', err.message);
    }
  }

  // 3. Random fallback — always show something meaningful
  if (!bestQuote) {
    bestQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
  }

  if (bestQuote) {
    setText('quote-text', `"${bestQuote.quote}"`);
    setText('quote-author', `— ${bestQuote.author}`);
  }
}

// ─── Main Init ────────────────────────────────────────────────────────────────

/**
 * Entry point for the details page.
 * Validates params → shows loading → fetches data → populates DOM → hides loading.
 */
async function init() {
  const { id, type } = getQueryParams();

  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    showError('Invalid or missing media identifier. Please go back and try again.');
    return;
  }

  setLoading(true);

  try {
    // Fetch media details and quotes in parallel for performance
    const [details, allQuotes] = await Promise.all([
      getDetailsFromTMDB(id, type).catch(() => null),
      getQuotes().catch(() => []),
    ]);

    if (!details) {
      showError('Could not load media details. The service may be temporarily unavailable.');
      return;
    }

    // Populate content while the loading overlay is still visible,
    // then hide it — this prevents layout flicker.
    populateDetails(details);
    await populateQuote(id, type, details, allQuotes);

  } catch (error) {
    console.error('[PhiloMedia] Unexpected error in details.init():', error);
    showError('An unexpected error occurred. Please try again later.');
  } finally {
    // Always hide the loading state, even if an error occurred
    setLoading(false);
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

init();