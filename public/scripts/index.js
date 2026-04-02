import { loadContent } from '/scripts/main.js';
import { setupAuthUI } from '/scripts/auth-ui.js';
import { renderMediaCards } from '/scripts/media-card.js';
import { getDisplayAuthorName, getPhilosopherUrlByAuthor } from '/scripts/philosopher-data.js';

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

function renderQuoteAuthor(container, author) {
  if (!container) return;

  const displayName = getDisplayAuthorName(author);
  const url = getPhilosopherUrlByAuthor(author);

  container.textContent = '';

  if (!url) {
    container.textContent = `- ${displayName}`;
    return;
  }

  const link = document.createElement('a');
  link.href = url;
  link.textContent = `- ${displayName}`;
  container.appendChild(link);
}

async function init() {
  setupAuthUI().catch(() => {});

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
    renderQuoteAuthor(quoteAuthorEl, content.author);
    if (highlightsTitleEl && content.highlightsTitle) {
      highlightsTitleEl.textContent = content.highlightsTitle;
    }
    if (highlightsContextEl && content.highlightsContext) {
      highlightsContextEl.textContent = content.highlightsContext;
    }

    highlightsEl.querySelector('.loading-message')?.remove();
    highlightsEl.querySelector('.loading-skeleton')?.remove();

    if (!content.results || content.results.length === 0) {
      highlightsEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-title">No recommendations right now</p>
          <p class="empty-state-text">Make sure <code>TMDB_API_KEY</code> is set on the server, or try the <a href="/html/search.html">search</a>.</p>
        </div>
      `;
      return;
    }

    renderMediaCards(highlightsEl, content.results, {
      overviewLength: 100,
    });
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
