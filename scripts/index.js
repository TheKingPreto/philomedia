import { loadContent } from 'scripts/main.js';

async function init() {
  const content = await loadContent();

  const quoteEl = document.getElementById('quote-text');
  const authorEl = document.getElementById('quote-author');
  const highlightsEl = document.getElementById('highlights');

  quoteEl.textContent = `"${content.quote}"`;
  authorEl.textContent = `— ${content.author}`;

  highlightsEl.innerHTML = '';

  if (content.results.length === 0) {
    highlightsEl.textContent = 'No recommendations found.';
    return;
  }

  content.results.slice(0, 10).forEach(item => {
    const title = item.title || item.name || 'Untitled';
    const mediaType = item.media_type || 'unknown';
    const date = item.release_date || item.first_air_date || 'Unknown date';
    const overview = item.overview || 'No synopsis available.';
    const posterPath = item.poster_path
      ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
      : 'images/no-image.png';

    const card = document.createElement('div');
    card.classList.add('result-card');

    card.innerHTML = `
      <img src="${posterPath}" alt="Poster of ${title}" />
      <h3>${title}</h3>
      <p class="media-type">Type: ${mediaType}</p>
      <p>Date: ${date}</p>
      <p class="overview">${overview.length > 150 ? overview.slice(0, 150) + '...' : overview}</p>
    `;

    highlightsEl.appendChild(card);
  });
}

init();
