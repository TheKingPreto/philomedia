/**
 * @file details.js
 * @description Details page controller for PhiloMedia.
 *
 * ── Quote resolution strategy (progressive enhancement) ──────────────────────
 *
 *  Phase 1 — Instant (< 50ms):
 *    Show the best available static quote immediately so the page never blocks.
 *    Priority: curated match → theme analysis → random fallback.
 *
 *  Phase 2 — Background (2-5s, non-blocking):
 *    Silently call POST /api/ai/quotes/generate/media-context in background.
 *    When Gemini responds, fade-swap the quote and show the AI badge.
 *    If the call fails (rate limit, network, etc.) the static quote stays —
 *    the user never sees an error for something they didn't ask for.
 *
 *  This is the standard pattern used by Netflix, Spotify, etc.:
 *  show something great immediately, then silently upgrade it.
 */

import { getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
const AI_ENDPOINT     = '/api/ai/quotes/generate/media-context';

// Delay before triggering AI generation — lets the page settle visually first
const AI_TRIGGER_DELAY_MS = 800;

// ─── URL Params ───────────────────────────────────────────────────────────────

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return { id: params.get('id'), type: params.get('type') };
}

// ─── Loading overlay (page-level) ────────────────────────────────────────────

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

// ─── Error state ──────────────────────────────────────────────────────────────

function showError(message) {
  setLoading(false);
  document.getElementById('details-container')
    ?.querySelectorAll('.details-poster, .details-info')
    .forEach(el => { el.style.display = 'none'; });

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
    <a href="/html/index.html" class="btn-back">← Back to Home</a>
  `;
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Details population ───────────────────────────────────────────────────────

function populateDetails(details) {
  document.title = `${details.title || details.name || 'Details'} — PhiloMedia`;

  const img = document.getElementById('details-image');
  if (img) {
    if (details.poster_path) {
      img.src = `${TMDB_IMAGE_BASE}${details.poster_path}`;
      img.alt = `Poster of ${details.title || details.name}`;
    } else {
      img.classList.add('no-poster');
      img.alt = 'No poster available';
    }
  }

  setText('details-title',    details.title || details.name || 'Unknown');
  setText('details-meta',     `Release: ${details.release_date || details.first_air_date || 'Unknown'}`);
  setText('details-overview', details.overview || 'No overview available.');
}

// ─── Static quote resolution ──────────────────────────────────────────────────

async function resolveStaticQuote(id, type, details, allQuotes) {
  if (!allQuotes?.length) return null;

  // 1 — Curated match (highest quality)
  const curatedId = curatedQuoteMatches[id];
  if (curatedId) {
    const match = allQuotes.find(q => q.id === curatedId);
    if (match) return match;
  }

  // 2 — Theme analysis
  try {
    const reviews    = await getReviewsFromTMDB(id, type).catch(() => []);
    const reviewText = Array.isArray(reviews) ? reviews.map(r => r.content || '').join(' ') : '';
    const combined   = `${details.overview || ''} ${reviewText}`.trim();
    const profile    = analyzeWorkForThemes(combined);

    let best = null, high = 0;
    for (const quote of allQuotes) {
      const themes = new Set(quote.themes);
      let score = 0;
      for (const tp of profile) {
        if (themes.has(tp.theme) && tp.score > score) score = tp.score;
      }
      if (score > high) { high = score; best = quote; }
    }
    if (best) return best;
  } catch (err) {
    console.warn('[PhiloMedia] Theme analysis failed:', err.message);
  }

  // 3 — Random fallback
  return allQuotes[Math.floor(Math.random() * allQuotes.length)];
}

// ─── Quote renderer ───────────────────────────────────────────────────────────

/**
 * Renders a quote with a smooth fade-swap animation.
 * Safe to call at any time — cleans up previous AI additions automatically.
 *
 * @param {{ text: string, author: string, isAI?: boolean, explanation?: string }} opts
 */
function renderQuote({ text, author, isAI = false, explanation = '' }) {
  const section = document.getElementById('philosophy-quote');
  if (!section) return;

  section.style.transition = 'opacity 0.35s ease';
  section.style.opacity    = '0';

  setTimeout(() => {
    setText('quote-text',   `"${text}"`);
    setText('quote-author', `— ${author}`);

    // Remove any previous AI-injected elements
    section.querySelectorAll('.quote-ai-badge, .quote-ai-explanation')
      .forEach(el => el.remove());

    if (isAI) {
      const badge = document.createElement('div');
      badge.className   = 'quote-ai-badge';
      badge.textContent = 'Generated by Gemini AI';
      section.appendChild(badge);

      if (explanation) {
        const expl = document.createElement('p');
        expl.className   = 'quote-ai-explanation';
        expl.textContent = explanation;
        section.appendChild(expl);
      }
    }

    section.style.opacity = '1';
  }, 350);
}

// ─── AI background enhancement ───────────────────────────────────────────────

/**
 * Fires the Gemini generation in the background after a short delay.
 * Completely silent on failure — the static quote remains untouched.
 *
 * @param {string} id
 * @param {string} type
 */
function scheduleAIEnhancement(id, type) {
  setTimeout(async () => {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tmdbId: id, mediaType: type }),
      });

      // On rate limit or server error, fail silently — static quote stays
      if (!res.ok) {
        console.info(
          `[PhiloMedia] AI enhancement skipped (${res.status}) — static quote retained.`
        );
        return;
      }

      const data = await res.json();
      const { quoteText, authorName } = data.quote || {};

      if (!quoteText || !authorName) return;

      renderQuote({
        text:        quoteText,
        author:      authorName,
        isAI:        true,
        explanation: data.explanation || '',
      });

    } catch (err) {
      // Network error, timeout, etc. — fail silently
      console.info('[PhiloMedia] AI enhancement unavailable:', err.message);
    }
  }, AI_TRIGGER_DELAY_MS);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { id, type } = getQueryParams();

  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    showError('Invalid or missing media identifier. Please go back and try again.');
    return;
  }

  setLoading(true);

  try {
    const [details, allQuotes] = await Promise.all([
      getDetailsFromTMDB(id, type).catch(() => null),
      getQuotes().catch(() => []),
    ]);

    if (!details) {
      showError('Could not load media details. The service may be temporarily unavailable.');
      return;
    }

    // Phase 1 — populate everything instantly
    populateDetails(details);

    const staticQuote = await resolveStaticQuote(id, type, details, allQuotes);
    if (staticQuote) {
      renderQuote({ text: staticQuote.quote, author: staticQuote.author });
    } else {
      setText('quote-text',   'No philosophical quote available for this work.');
      setText('quote-author', '');
    }

    // Phase 2 — silently upgrade to AI in background
    scheduleAIEnhancement(id, type);

  } catch (err) {
    console.error('[PhiloMedia] Unexpected error:', err);
    showError('An unexpected error occurred. Please try again later.');
  } finally {
    setLoading(false);
  }
}

init();