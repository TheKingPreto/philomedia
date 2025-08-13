import { getDetailsFromTMDB, getReviewsFromTMDB } from './seriesapi.js';
import { getQuotes } from './philosophersapi.js';
import { analyzeWorkForThemes } from './hermeneutics.js';
import { curatedQuoteMatches } from './curatedmatches.js';

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
      getDetailsFromTMDB(id, type),
      getQuotes()
    ]);

    detailsContainer.innerHTML = `
    <div class="details-poster">
      <img src="https://image.tmdb.org/t/p/w400${details.poster_path}" alt="Poster of ${details.title || details.name}">
    </div>
    <div class="details-info">
      <h2>${details.title || details.name}</h2>
      <p><strong>Release Date:</strong> ${details.release_date || details.first_air_date || 'Unknown'}</p>
      <p>${details.overview || 'No overview available.'}</p>
    </div>
  `;

    let bestQuote = null;

    const curatedQuoteId = curatedQuoteMatches[id];

    if (curatedQuoteId) {
      bestQuote = allQuotes.find(q => q.id === curatedQuoteId);
    } else {
      const reviews = await getReviewsFromTMDB(id, type);
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

    if (bestQuote) {
      quoteText.textContent = `"${bestQuote.quote}"`;
      quoteAuthor.textContent = `— ${bestQuote.author}`;
    } else {
      quoteText.textContent = 'No directly related philosophical quote was found.';
      quoteAuthor.textContent = '';
    }
  } catch (error) {
    detailsContainer.innerHTML = '<h2>Error</h2><p>Could not load details. Please try again later.</p>';
  }
}

init();