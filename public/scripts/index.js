import { loadContent } from '/scripts/main.js';

const DETAILS_BASE = '/html/details.html';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w300';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'TMDB n/a';
  return `TMDB ${numeric.toFixed(1)}`;
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
      </div>
      <p class="loading-message">Finding meaningful connections for you...</p>
    `;
  }
}

function renderCards(container, items) {
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No recommendations right now</p>
        <p class="empty-state-text">Make sure <code>TMDB_API_KEY</code> is set on the server, or try the <a href="/html/search.html">search</a>.</p>
      </div>
    `;
    return;
  }

  items.forEach((item, index) => {
    const title = item.title || item.name || 'Untitled';
    const date = item.release_date || item.first_air_date || '-';
    const overview = item.overview || 'No synopsis available.';
    const rating = formatRating(item.vote_average);

    let mediaType = item.media_type;
    if (!mediaType && item.title) mediaType = 'movie';
    if (!mediaType && item.name) mediaType = 'tv';
    if (!mediaType) mediaType = 'unknown';

    const posterPath = item.poster_path ? `${POSTER_BASE}${item.poster_path}` : null;

    const cardLink = document.createElement('a');
    cardLink.href = `${DETAILS_BASE}?id=${item.id}&type=${mediaType}`;
    cardLink.classList.add('result-card-link');

    const card = document.createElement('div');
    card.classList.add('result-card');
    card.style.animationDelay = `${index * 0.05}s`;

    const posterHtml = posterPath
      ? `<img class="poster-img" src="${posterPath}" alt="${escapeHtml(title)} poster" loading="lazy">`
      : '<div class="no-poster" aria-hidden="true">No image</div>';

    card.innerHTML = `
      <div class="result-card-poster">
        ${posterHtml}
      </div>
      <div class="result-card-body">
        <h3>${escapeHtml(title)}</h3>
        <p class="media-type">${escapeHtml(mediaType)} | ${escapeHtml(rating)}</p>
        <p class="date">${escapeHtml(date)}</p>
        <p class="overview">${escapeHtml(overview.length > 100 ? overview.slice(0, 100) + '...' : overview)}</p>
      </div>
    `;

    cardLink.appendChild(card);
    container.appendChild(cardLink);
  });
}

async function init() {
  const quoteTextEl = document.getElementById('quote-text');
  const quoteAuthorEl = document.getElementById('quote-author');
  const highlightsTitleEl = document.getElementById('highlights-title');
  const highlightsContextEl = document.getElementById('highlights-context');
  const highlightsEl = document.getElementById('highlights');

  setLoading(highlightsEl, true);

  try {
    const content = await loadContent();

    quoteTextEl.textContent = `"${content.quote}"`;
    quoteTextEl.setAttribute('aria-busy', 'false');
    quoteAuthorEl.textContent = `- ${content.author}`;
    if (highlightsTitleEl && content.highlightsTitle) {
      highlightsTitleEl.textContent = content.highlightsTitle;
    }
    if (highlightsContextEl && content.highlightsContext) {
      highlightsContextEl.textContent = content.highlightsContext;
    }

    highlightsEl.querySelector('.loading-message')?.remove();
    highlightsEl.querySelector('.loading-skeleton')?.remove();

    renderCards(highlightsEl, content.results);
  } catch (err) {
    console.error(err);
    highlightsEl.innerHTML = `
      <div class="error-state">
        <p class="error-state-title">Something went wrong</p>
        <p class="error-state-text">We couldn't load recommendations. Please try again or use <a href="/html/search.html">search</a>.</p>
      </div>
    `;
  }
}

init();
