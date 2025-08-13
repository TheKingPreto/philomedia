import { searchTMDB } from './seriesapi.js';

const form = document.getElementById('search-form');
const input = document.getElementById('search-input');
const resultsContainer = document.getElementById('search-results');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const query = input.value.trim();
  if (!query) {
    resultsContainer.textContent = 'Please enter a search term.';
    return;
  }

  resultsContainer.textContent = 'Searching...';

  try {
    const results = await searchTMDB(query);

    if (!results || results.length === 0) {
      resultsContainer.textContent = 'No results found.';
      return;
    }

    resultsContainer.innerHTML = '';

    results.forEach(item => {
      const title = item.title || item.name || 'Untitled';
      const mediaType = item.media_type || 'unknown';
      const date = item.release_date || item.first_air_date || 'Unknown date';
      const overview = item.overview || 'No synopsis available.';
      const posterPath = item.poster_path 
        ? `https://image.tmdb.org/t/p/w200${item.poster_path}` 
        : 'images/no-image.png';

      const card = document.createElement('div');
      card.classList.add('result-card');

      card.innerHTML = `
        <img src="${posterPath}" alt="Poster of ${title}" />
        <h3>${title}</h3>
        <p class="media-type">Type: ${mediaType}</p>
        <p>Date: ${date}</p>
        <p class="overview">${overview.length > 100 ? overview.slice(0, 100) + '...' : overview}</p>
      `;

      const cardLink = document.createElement('a');
      cardLink.href = `details.html?id=${item.id}&type=${mediaType}`;
      cardLink.classList.add('result-card-link');
      cardLink.appendChild(card);

      resultsContainer.appendChild(cardLink);
    });
  } catch (error) {
    resultsContainer.textContent = 'Error fetching data. Please try again later.';
  }
});
