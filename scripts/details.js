import { getDetailsFromTMDB } from './seriesAPI.js'; // você cria essa função

import { getPhilosophyQuoteForText } from './quotesAPI.js'; // função que recebe texto e retorna frase relacionada

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    type: params.get('type'),
  };
}

async function init() {
  const { id, type } = getQueryParams();
  const detailsContainer = document.getElementById('details-container');
  const quoteText = document.getElementById('quote-text');
  const quoteAuthor = document.getElementById('quote-author');

  if (!id || !type) {
    detailsContainer.textContent = 'Invalid item selected.';
    return;
  }

  detailsContainer.textContent = 'Loading details...';

  try {
    const details = await getDetailsFromTMDB(id, type);

    detailsContainer.innerHTML = `
      <h2>${details.title || details.name}</h2>
      <img src="https://image.tmdb.org/t/p/w400${details.poster_path}" alt="${details.title || details.name} poster" />
      <p><strong>Release date:</strong> ${details.release_date || details.first_air_date || 'Unknown'}</p>
      <p><strong>Overview:</strong> ${details.overview || 'No overview available.'}</p>
    `;

    // Agora pega uma frase filosófica relacionada — por exemplo, buscando por palavras-chave na sinopse
    const quote = await getPhilosophyQuoteForText(details.overview || '');

    if (quote) {
      quoteText.textContent = `"${quote.quote}"`;
      quoteAuthor.textContent = `— ${quote.author}`;
    } else {
      quoteText.textContent = 'No related philosophical quote found.';
      quoteAuthor.textContent = '';
    }
  } catch (error) {
    detailsContainer.textContent = 'Error loading details.';
    console.error(error);
  }
}

init();
