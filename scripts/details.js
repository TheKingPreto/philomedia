/**
 * @file details.js
 * @description Details page controller for PhiloMedia.
 *
 * Quote resolution flow:
 *  1. Curated match (curatedQuoteMatches) — highest quality, zero latency
 *  2. Theme analysis (hermeneutics + THEME_DATABASE) — semantic fallback
 *  3. Random from pool — last resort
 *
 * AI enhancement (on demand):
 *  "✦ Generate with AI" button calls POST /api/ai/quotes/generate/media-context
 *  Gemini receives the TMDB id + type and returns a quote crafted specifically
 *  for that work. The result replaces the current quote with a fade animation
 *  and a visual AI badge.
 */

import { getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
const AI_ENDPOINT     = '/api/ai/quotes/generate/media-context';

// ─── URL Params ───────────────────────────────────────────────────────────────

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return { id: params.get('id'), type: params.get('type') };
}

// ─── Loading overlay ──────────────────────────────────────────────────────────

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

// ─── Details ──────────────────────────────────────────────────────────────────

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

// ─── Quote selection ──────────────────────────────────────────────────────────

async function resolveQuote(id, type, details, allQuotes) {
  if (!allQuotes?.length) return null;

  // 1 — Curated map
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
    const themeProfile = analyzeWorkForThemes(combined);

    let best = null;
    let high = 0;

    for (const quote of allQuotes) {
      const themes = new Set(quote.themes);
      let score = 0;
      for (const tp of themeProfile) {
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
 * Renders a quote into #philosophy-quote with a smooth fade swap.
 * @param {{ text: string, author: string, isAI: boolean, explanation?: string }} opts
 */
function renderQuote({ text, author, isAI = false, explanation = '' }) {
  const section = document.getElementById('philosophy-quote');
  if (!section) return;

  section.style.transition = 'opacity 0.3s ease';
  section.style.opacity    = '0';

  setTimeout(() => {
    setText('quote-text',   `"${text}"`);
    setText('quote-author', `— ${author}`);

    // Clean previous AI additions
    section.querySelectorAll('.quote-ai-badge, .quote-ai-explanation, .quote-ai-error')
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

    // Update button label
    const btn = document.getElementById('ai-generate-btn');
    if (btn) {
      btn.textContent = isAI ? '↺ Regenerate with AI' : '✦ Generate with AI';
      btn.disabled    = false;
    }

    section.style.opacity = '1';
  }, 300);
}

// ─── AI generation ────────────────────────────────────────────────────────────

async function generateAIQuote(id, type) {
  const btn     = document.getElementById('ai-generate-btn');
  const section = document.getElementById('philosophy-quote');
  if (!btn || !section) return;

  btn.disabled    = true;
  btn.textContent = '⏳ Generating...';

  // Clear previous inline errors
  section.querySelectorAll('.quote-ai-error').forEach(el => el.remove());

  try {
    const res = await fetch(AI_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tmdbId: id, mediaType: type }),
    });

    if (res.status === 429) {
      throw new Error('Rate limit reached — up to 30 AI quotes per hour. Try again later.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || 'AI generation failed. Please try again.');
    }

    const data = await res.json();
    const { quoteText, authorName } = data.quote || {};
    if (!quoteText || !authorName) throw new Error('AI returned an incomplete response.');

    renderQuote({
      text:        quoteText,
      author:      authorName,
      isAI:        true,
      explanation: data.explanation || '',
    });

  } catch (err) {
    console.error('[PhiloMedia] AI error:', err.message);

    const errEl = document.createElement('p');
    errEl.className   = 'quote-ai-error';
    errEl.textContent = err.message;
    section.appendChild(errEl);

    btn.textContent = '✦ Generate with AI';
    btn.disabled    = false;
  }
}

// ─── AI button ────────────────────────────────────────────────────────────────

function injectAIButton(id, type) {
  if (document.getElementById('ai-generate-btn')) return;

  const section = document.getElementById('philosophy-quote');
  if (!section) return;

  const btn = document.createElement('button');
  btn.id        = 'ai-generate-btn';
  btn.className = 'btn-ai-generate';
  btn.type      = 'button';
  btn.setAttribute('aria-label', 'Generate a unique philosophical quote with Gemini AI');
  btn.textContent = '✦ Generate with AI';
  btn.addEventListener('click', () => generateAIQuote(id, type));

  section.appendChild(btn);
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

    populateDetails(details);

    const quote = await resolveQuote(id, type, details, allQuotes);
    if (quote) {
      renderQuote({ text: quote.quote, author: quote.author, isAI: false });
    } else {
      setText('quote-text',   'No philosophical quote available for this work.');
      setText('quote-author', '');
    }

    injectAIButton(id, type);

  } catch (err) {
    console.error('[PhiloMedia] Unexpected error:', err);
    showError('An unexpected error occurred. Please try again later.');
  } finally {
    setLoading(false);
  }
}

init();