import { getDetailsFromTMDB, getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getQuotes } from '/scripts/philosophersapi.js';
import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    id: params.get('id'),
    type: params.get('type'),
  };
}

async function init() {
  const detailsContainer = document.getElementById('details-container');
  const quoteText = document.getElementById('quote-text');
  const quoteAuthor = document.getElementById('quote-author');

  const { id, type } = getQueryParams();

  if (!id || !type) {
    detailsContainer.innerHTML = '<h2>Error</h2><p>Invalid or unspecified item.</p>';
    return;
  }

  detailsContainer.innerHTML = '<p>Loading details...</p>';

  try {
    const [details, allQuotes] = await Promise.all([
      getDetailsFromTMDB(id, type).catch(() => null),
      getQuotes().catch(() => [])
    ]);

    if (!details) {
      detailsContainer.innerHTML = '<h2>Error</h2><p>Could not load details. Please try again later.</p>';
      return;
    }

    // Atualiza o poster no elemento correto
    const posterImg = document.getElementById('details-image');
    if (posterImg) {
      if (details.poster_path) {
        posterImg.src = `https://image.tmdb.org/t/p/w400${details.poster_path}`;
        posterImg.alt = `Poster of ${details.title || details.name}`;
      } else {
        posterImg.src = '';
        posterImg.alt = 'No poster available';
      }
    }

    // Atualiza os demais campos
    const titleElem = document.getElementById('details-title');
    if (titleElem) titleElem.textContent = details.title || details.name || 'Unknown';
    const metaElem = document.getElementById('details-meta');
    if (metaElem) metaElem.textContent = `Release Date: ${details.release_date || details.first_air_date || 'Unknown'}`;
    const overviewElem = document.getElementById('details-overview');
    if (overviewElem) overviewElem.textContent = details.overview || 'No overview available.';

    let bestQuote = null;

    const curatedQuoteId = curatedQuoteMatches[id];

    if (curatedQuoteId) {
      bestQuote = allQuotes.find(q => q.id === curatedQuoteId);
    } else {
      const reviews = await getReviewsFromTMDB(id, type).catch(() => []);
      const combinedText = (details.overview || '') + ' ' + reviews.map(r => r.content).join(' ');
      const workThemeProfile = analyzeWorkForThemes(combinedText);

      let highestScore = 0;
      for (const quote of allQuotes) {
        const quoteThemes = new Set(quote.themes);
        let strongestConnectionScore = 0;

        if (workThemeProfile.length > 0 && quoteThemes.size > 0) {
          workThemeProfile.forEach(themeProfile => {
            if (quoteThemes.has(themeProfile.theme)) {
              if (themeProfile.score > strongestConnectionScore) {
                strongestConnectionScore = themeProfile.score;
              }
            }
          });
        }

        if (strongestConnectionScore > highestScore) {
          highestScore = strongestConnectionScore;
          bestQuote = quote;
        }
      }
    }

    // Fallback: se ainda não encontrou nada forte, usa uma quote aleatória
    if (!bestQuote && allQuotes.length > 0) {
      bestQuote = allQuotes[Math.floor(Math.random() * allQuotes.length)];
    }

    if (bestQuote) {
      quoteText.textContent = `"${bestQuote.quote}"`;
      quoteAuthor.textContent = `— ${bestQuote.author}`;
    } else {
      quoteText.textContent = 'No philosophical quote available for this work.';
      quoteAuthor.textContent = '';
    }
  } catch (error) {
    detailsContainer.innerHTML = '<h2>Error</h2><p>Could not load details. Please try again later.</p>';
  }
}

// ...existing code...

// Função para buscar quotes da API e exibir de forma paginada
async function fetchAndDisplayQuotes(page = 1, pageSize = 5, filter = '') {
  const responseContainer = document.getElementById('response');
  if (!responseContainer) return;
  responseContainer.innerHTML = '<p>Carregando quotes...</p>';
  try {
    const res = await fetch('https://corsproxy.io/?https%3A%2F%2Fphilosophersapi.com%2Fapi%2Fquotes');
    const quotes = await res.json();
    let filteredQuotes = quotes;
    if (filter) {
      filteredQuotes = quotes.filter(q => q.author.toLowerCase().includes(filter.toLowerCase()) || (q.themes && q.themes.some(t => t.toLowerCase().includes(filter.toLowerCase()))));
    }
    const totalPages = Math.ceil(filteredQuotes.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageQuotes = filteredQuotes.slice(start, end);
    responseContainer.innerHTML = '';
    pageQuotes.forEach((quote, idx) => {
      const quoteDiv = document.createElement('div');
      quoteDiv.className = 'quote-summary';
      quoteDiv.innerHTML = `
        <strong>${quote.author}</strong>: "${quote.quote.substring(0, 80)}${quote.quote.length > 80 ? '...' : ''}"
        <button onclick="this.nextElementSibling.style.display='block';this.style.display='none'">ver mais</button>
        <div style="display:none;">${quote.quote}<br><em>${quote.themes ? quote.themes.join(', ') : ''}</em></div>
      `;
      responseContainer.appendChild(quoteDiv);
    });
    // Paginação
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination';
    paginationDiv.innerHTML = `
      <button ${page === 1 ? 'disabled' : ''} onclick="window.fetchAndDisplayQuotes(${page - 1}, ${pageSize}, document.getElementById('quote-filter').value)">Anterior</button>
      <span> Página ${page} de ${totalPages} </span>
      <button ${page === totalPages ? 'disabled' : ''} onclick="window.fetchAndDisplayQuotes(${page + 1}, ${pageSize}, document.getElementById('quote-filter').value)">Próxima</button>
    `;
    responseContainer.appendChild(paginationDiv);
  } catch (e) {
    responseContainer.innerHTML = '<p>Erro ao carregar quotes.</p>';
  }
}

// Filtro e botão limpar
window.fetchAndDisplayQuotes = fetchAndDisplayQuotes;
document.addEventListener('DOMContentLoaded', () => {
  const responseContainer = document.getElementById('response');
  if (responseContainer) {
    // Filtro
    const filterInput = document.createElement('input');
    filterInput.id = 'quote-filter';
    filterInput.placeholder = 'Filtrar por autor ou tema';
    filterInput.oninput = () => fetchAndDisplayQuotes(1, 5, filterInput.value);
    responseContainer.parentNode.insertBefore(filterInput, responseContainer);
    // Botão limpar
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Limpar aba response';
    clearBtn.onclick = () => responseContainer.innerHTML = '';
    responseContainer.parentNode.insertBefore(clearBtn, responseContainer);
    fetchAndDisplayQuotes();
  }
});
init();