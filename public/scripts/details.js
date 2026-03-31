/**
 * @file details.js
 * @description Details page controller for PhiloMedia.
 *
 * Quote strategy:
 * 1) Render a static philosophical quote immediately (curated -> thematic -> random)
 * 2) Silently append an AI interpretive layer below (non-blocking)
 */

import { getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';

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

function getDisplayTitle(details) {
  return details.title || details.name || 'Unknown';
}

function formatYear(dateString) {
  if (!dateString) return 'Unknown year';

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return String(date.getFullYear());
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
    return 'Not rated yet';
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
    return joinNames(details.created_by, 'name', 3) || 'Not available';
  }

  const directors = Array.isArray(details.credits?.crew)
    ? details.credits.crew.filter(person => person?.job === 'Director')
    : [];

  return joinNames(directors, 'name', 3) || 'Not available';
}

function getStudio(details, type) {
  const source =
    type === 'tv' && Array.isArray(details.networks) && details.networks.length > 0
      ? details.networks
      : details.production_companies;

  return joinNames(source, 'name', 3) || 'Not available';
}

function getGenres(details) {
  return joinNames(details.genres, 'name', 4) || 'Not available';
}

function renderFacts(details, type) {
  const container = document.getElementById('details-facts');
  if (!container) return;

  const creatorLabel = type === 'tv' ? 'Creator' : 'Director';
  const studioLabel = type === 'tv' ? 'Network' : 'Studio';
  const facts = [
    { label: 'TMDB rating', value: formatRating(details) },
    { label: creatorLabel, value: getCreativeLead(details, type) },
    { label: studioLabel, value: getStudio(details, type) },
    { label: 'Genres', value: getGenres(details) },
  ].filter(fact => fact.value);

  container.innerHTML = '';

  facts.forEach(fact => {
    const card = document.createElement('div');
    card.className = 'detail-fact';

    const label = document.createElement('span');
    label.className = 'detail-fact-label';
    label.textContent = fact.label;

    const value = document.createElement('strong');
    value.className = 'detail-fact-value';
    value.textContent = fact.value;

    card.append(label, value);
    container.appendChild(card);
  });
}

function populateDetails(details, type) {
  document.title = `${getDisplayTitle(details)} - PhiloMedia`;

  const img = document.getElementById('details-image');
  if (img) {
    if (details.poster_path) {
      img.src = `${TMDB_IMAGE_BASE}${details.poster_path}`;
      img.alt = `Poster of ${getDisplayTitle(details)}`;
      img.classList.remove('no-poster');
    } else {
      img.removeAttribute('src');
      img.classList.add('no-poster');
      img.alt = 'No poster available';
    }
  }

  const mediaLabel = type === 'tv' ? 'Series' : 'Movie';
  const releaseDate = type === 'tv' ? details.first_air_date : details.release_date;

  setText('details-title', getDisplayTitle(details));
  setText(
    'details-meta',
    `${mediaLabel} | ${formatYear(releaseDate)} | ${formatRuntime(details, type)}`
  );
  renderFacts(details, type);
  setText('details-overview', details.overview || 'No overview available.');
}

async function resolveStaticQuote(id, type, details, allQuotes) {
  if (!allQuotes?.length) return null;

  const curatedId = curatedQuoteMatches[id];
  if (curatedId) {
    const match = allQuotes.find(quote => String(quote.id) === String(curatedId));
    if (match) return match;
  }

  try {
    const reviews = await getReviewsFromTMDB(id, type).catch(() => []);
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
  authorEl.textContent = `- ${author}`;
}

function renderAIExpansion({ text, author, explanation }) {
  const container = document.getElementById('ai-quote-container');
  if (!container) return;

  container.innerHTML = '';

  const block = document.createElement('div');
  block.className = 'ai-quote-block';

  block.innerHTML = `
    <div class="ai-badge">AI interpretive reading</div>
    <p class="ai-quote-text">"${text}"</p>
    <span class="ai-quote-author">- ${author}</span>
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

    populateDetails(details, type);

    const staticQuote = await resolveStaticQuote(id, type, details, allQuotes);

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
