import { loadContent } from '/philomedia/scripts/main.js';

async function init() {
  const quoteTextEl = document.getElementById('quote-text');
  const quoteAuthorEl = document.getElementById('quote-author');
  const highlightsEl = document.getElementById('highlights');

  highlightsEl.innerHTML = '<p>Finding meaningful connections for you...</p>';

  try {
    const content = await loadContent();

    quoteTextEl.textContent = `"${content.quote}"`;
    quoteAuthorEl.textContent = `— ${content.author}`;

    highlightsEl.innerHTML = '';

    if (!content.results || content.results.length === 0) {
      highlightsEl.innerHTML = '<p>No specific recommendations found for this quote. Explore our search!</p>';
      return;
    }

    content.results.forEach(item => {
      const title = item.title || item.name || 'Untitled';
      const date = item.release_date || item.first_air_date || 'Unknown date';
      const overview = item.overview || 'No synopsis available.';
      
      const mediaType = item.media_type || 'unknown';

      const posterPath = item.poster_path
        ? `https://image.tmdb.org/t/p/w300${item.poster_path}`
        : 'images/no-image.png';

      const cardLink = document.createElement('a');
      cardLink.href = `details.html?id=${item.id}&type=${mediaType}`;
      cardLink.classList.add('result-card-link'); 

      const card = document.createElement('div');
      card.classList.add('result-card');
      
      card.innerHTML = `
        <img src="${posterPath}" alt="Poster of ${title}" loading="lazy">
        <h3>${title}</h3>
        <p class="media-type">Type: ${mediaType}</p>
        <p>Date: ${date}</p>
        <p class="overview">${overview.length > 100 ? overview.slice(0, 100) + '...' : overview}</p>
      `;

      cardLink.appendChild(card);
      highlightsEl.appendChild(cardLink);
    });

  } catch (error) {
    highlightsEl.innerHTML = '<p>Sorry, something went wrong while loading recommendations. Please try again later.</p>';
  }
}

init();