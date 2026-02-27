import { searchTMDB } from '/scripts/seriesapi.js';

const DETAILS_BASE = '/html/details.html';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w300';

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsContainer = document.getElementById('search-results');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setSearchLoading(loading) {
  if (loading) {
    resultsContainer.innerHTML = `
      <div class="loading-skeleton" aria-hidden="true">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
      <p class="loading-message">Searching...</p>
    `;
    return;
  }
  resultsContainer.innerHTML = '';
}

function setSearchError(message, isServerError = false) {
  resultsContainer.innerHTML = `
    <div class="error-state">
      <p class="error-state-title">${escapeHtml(message)}</p>
      ${isServerError ? '<p class="error-state-text">Check that <code>TMDB_API_KEY</code> is set on the server.</p>' : ''}
    </div>
  `;
}

function setSearchEmpty() {
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">No results found</p>
      <p class="empty-state-text">Try another search term.</p>
    </div>
  `;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const query = input.value.trim();
  if (!query) {
    resultsContainer.innerHTML = '<p class="inline-message">Please enter a search term.</p>';
    return;
  }

  setSearchLoading(true);

  try {
    const results = await searchTMDB(query);

    setSearchLoading(false);

    if (!results || results.length === 0) {
      setSearchEmpty();
      return;
    }

    results.forEach((item, i) => {
      const title = item.title || item.name || 'Untitled';
      const mediaType = item.media_type || 'unknown';
      const date = item.release_date || item.first_air_date || '—';
      const overview = item.overview || 'No synopsis available.';
      const posterPath = item.poster_path ? `${POSTER_BASE}${item.poster_path}` : null;

      const card = document.createElement('div');
      card.classList.add('result-card');
      card.style.animationDelay = `${i * 0.05}s`;

      const posterHtml = posterPath
        ? `<img class="poster-img" src="${posterPath}" alt="${escapeHtml(title)} poster" loading="lazy">`
        : '<div class="no-poster" aria-hidden="true">No image</div>';

      card.innerHTML = `
        <div class="result-card-poster">
          ${posterHtml}
        </div>
        <div class="result-card-body">
          <h3>${escapeHtml(title)}</h3>
          <p class="media-type">${mediaType}</p>
          <p class="date">${escapeHtml(date)}</p>
          <p class="overview">${escapeHtml(overview.length > 100 ? overview.slice(0, 100) + '…' : overview)}</p>
        </div>
      `;

      const cardLink = document.createElement('a');
      cardLink.href = `${DETAILS_BASE}?id=${item.id}&type=${mediaType}`;
      cardLink.classList.add('result-card-link');
      cardLink.appendChild(card);

      resultsContainer.appendChild(cardLink);
    });
  } catch (error) {
    setSearchLoading(false);
    const is502 = error.message && (error.message.includes('TMDB') || error.message.includes('unavailable'));
    setSearchError(error.message || 'Error fetching data. Please try again.', is502);
  }
});
