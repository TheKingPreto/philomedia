/**
 * @file details.js
 * @description Details page controller for PhiloMedia.
 *
 * Quote strategy:
 * 1) Render static philosophical quote immediately (curated → thematic → random)
 * 2) Silently append an AI interpretive layer below (non-blocking)
 */

import { getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w400';
const AI_ENDPOINT = '/api/ai/quotes/generate/media-context';
const AI_TRIGGER_DELAY_MS = 800;

// ─── URL Params ───────────────────────────────────────────────────────────────

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    type: params.get('type'),
  };
}

// ─── Loading Overlay ──────────────────────────────────────────────────────────

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

function showError(message) {
  setLoading(false);

  document.getElementById('details-container')
    ?.querySelectorAll('.details-poster, .details-info')
    .forEach(el => (el.style.display = 'none'));

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

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Details Population ───────────────────────────────────────────────────────

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

  setText('details-title', details.title || details.name || 'Unknown');
  setText(
    'details-meta',
    `Release: ${details.release_date || details.first_air_date || 'Unknown'}`
  );
  setText('details-overview', details.overview || 'No overview available.');
}

// ─── Static Quote Resolution ──────────────────────────────────────────────────

async function resolveStaticQuote(id, type, details, allQuotes) {
  if (!allQuotes?.length) return null;

  // 1) Curated match
  const curatedId = curatedQuoteMatches[id];
  if (curatedId) {
    const match = allQuotes.find(q => q.id === curatedId);
    if (match) return match;
  }

  // 2) Thematic analysis
  try {
    const reviews = await getReviewsFromTMDB(id, type).catch(() => []);
    const reviewText = Array.isArray(reviews)
      ? reviews.map(r => r.content || '').join(' ')
      : '';

    const combined = `${details.overview || ''} ${reviewText}`.trim();
    const profile = analyzeWorkForThemes(combined);

    let best = null;
    let highScore = 0;

    for (const quote of allQuotes) {
      const themes = new Set(quote.themes);
      let score = 0;

      for (const tp of profile) {
        if (themes.has(tp.theme) && tp.score > score) {
          score = tp.score;
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

  // 3) Random fallback
  return allQuotes[Math.floor(Math.random() * allQuotes.length)];
}

// ─── Quote Renderers ──────────────────────────────────────────────────────────

// Static (foundation)
function renderStaticQuote({ text, author }) {
  const container = document.getElementById('static-quote');
  if (!container) return;

  const textEl = container.querySelector('.quote-text');
  const authorEl = container.querySelector('.quote-author');

  if (!textEl || !authorEl) return;

  textEl.textContent = `"${text}"`;
  authorEl.textContent = `— ${author}`;
}

// AI Expansion (append-only)
function renderAIExpansion({ text, author, explanation }) {
  const container = document.getElementById('ai-quote-container');
  if (!container) return;

  container.innerHTML = ''; // remove placeholder

  const block = document.createElement('div');
  block.className = 'ai-quote-block';

  block.innerHTML = `
    <div class="ai-badge">AI interpretive reading</div>
    <p class="ai-quote-text">"${text}"</p>
    <span class="ai-quote-author">— ${author}</span>
    ${explanation ? `<p class="ai-quote-explanation">${explanation}</p>` : ''}
  `;

  container.appendChild(block);

  // força reflow → garante animação
  block.getBoundingClientRect();

  block.classList.add('visible');
}

// ─── AI Background Enhancement ───────────────────────────────────────────────

function renderAIPlaceholder() {
  const container = document.getElementById('ai-quote-container');
  if (!container) return;

  container.innerHTML = `
    <div class="ai-placeholder visible">
      <span class="ai-thinking-dot"></span>
      <span>AI interpretive reading in progress…</span>
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

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  const { id, type } = getQueryParams();

  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    showError('Invalid or missing media identifier.');
    return;
  }

  setLoading(true);

  try {
    const [details, allQuotes] = await Promise.all([
      getDetailsFromTMDB(id, type).catch(() => null),
      getQuotes().catch(() => []),
    ]);

    if (!details) {
      showError('Could not load media details.');
      return;
    }

    // Phase 1 — instant render
    populateDetails(details);

    const staticQuote = await resolveStaticQuote(
      id,
      type,
      details,
      allQuotes
    );

    if (staticQuote) {
      renderStaticQuote({
        text: staticQuote.quote,
        author: staticQuote.author,
      });
    } else {
      setText('quote-text', 'No philosophical quote available.');
      setText('quote-author', '');
    }

    // Phase 2 — background AI layer
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