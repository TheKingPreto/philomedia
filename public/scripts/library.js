import { getFirstName, getSession, redirectToLogin, setupAuthUI } from '/scripts/auth-ui.js';
import { getLibrary, removeLibraryItem } from '/scripts/library-api.js';

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

function renderAuthPrompt(container, session) {
  const loginAvailable = Boolean(session?.oauthEnabled);

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${loginAvailable ? 'Sign in to use your library' : 'Login unavailable'}</p>
      <p class="empty-state-text">
        ${loginAvailable
          ? 'Use your Google account to save works to your watchlist and favorites.'
          : 'Google OAuth is not configured on this server yet.'}
      </p>
      ${loginAvailable ? '<button type="button" class="library-cta-button" id="library-login-button">Sign in with Google</button>' : ''}
    </div>
  `;

  const loginButton = document.getElementById('library-login-button');
  if (loginButton) {
    loginButton.addEventListener('click', redirectToLogin);
  }
}

function renderEmptyCollection(container, title) {
  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">No saved works yet</p>
      <p class="empty-state-text">${escapeHtml(title)} will appear here once you start saving titles from the details page.</p>
    </div>
  `;
}

function createLibraryCard(item, collection, onRemove) {
  const mediaType = item.mediaType;
  const cardShell = document.createElement('div');
  cardShell.className = 'library-card-shell';

  const link = document.createElement('a');
  link.href = `${DETAILS_BASE}?id=${item.tmdbId}&type=${mediaType}`;
  link.className = 'result-card-link';

  const posterHtml = item.posterPath
    ? `<img class="poster-img" src="${POSTER_BASE}${item.posterPath}" alt="${escapeHtml(item.title)} poster" loading="lazy">`
    : '<div class="no-poster" aria-hidden="true">No image</div>';

  link.innerHTML = `
    <div class="result-card">
      <div class="result-card-poster">
        ${posterHtml}
      </div>
      <div class="result-card-body">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="media-type">${escapeHtml(mediaType)} | ${escapeHtml(formatRating(item.voteAverage))}</p>
        <p class="date">${escapeHtml(item.releaseDate || '-')}</p>
      </div>
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'library-card-actions';

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'library-card-button';
  removeButton.textContent = collection === 'watchlist' ? 'Remove from watchlist' : 'Remove from favorites';
  removeButton.addEventListener('click', () => onRemove(item));

  actions.appendChild(removeButton);
  cardShell.appendChild(link);
  cardShell.appendChild(actions);
  return cardShell;
}

function renderCollection(container, items, collection, onRemove) {
  container.innerHTML = '';

  if (!items.length) {
    renderEmptyCollection(container, collection === 'watchlist' ? 'Your watchlist' : 'Your favorites');
    return;
  }

  items.forEach(item => {
    container.appendChild(createLibraryCard(item, collection, onRemove));
  });
}

async function init() {
  const watchlistGrid = document.getElementById('watchlist-grid');
  const favoritesGrid = document.getElementById('favorites-grid');
  const intro = document.getElementById('library-intro');

  await setupAuthUI();
  const session = await getSession();

  if (!session.authenticated) {
    intro.textContent = session.oauthEnabled
      ? 'Sign in once and start collecting works that deserve a second look.'
      : 'Google OAuth is not configured yet, so your personal library is unavailable for now.';
    renderAuthPrompt(watchlistGrid, session);
    favoritesGrid.innerHTML = '';
    return;
  }

  intro.textContent = `Signed in as ${getFirstName(session.user.displayName)}. Keep track of what you want to revisit and what already resonates most.`;

  async function renderLibraryState() {
    const library = await getLibrary();

    renderCollection(watchlistGrid, library.watchlist, 'watchlist', async item => {
      await removeLibraryItem('watchlist', item.tmdbId, item.mediaType);
      await renderLibraryState();
    });

    renderCollection(favoritesGrid, library.favorites, 'favorites', async item => {
      await removeLibraryItem('favorites', item.tmdbId, item.mediaType);
      await renderLibraryState();
    });
  }

  try {
    await renderLibraryState();
  } catch (error) {
    const message = error.status === 401
      ? 'Your session expired. Please sign in again.'
      : 'We could not load your library right now.';

    watchlistGrid.innerHTML = `
      <div class="error-state">
        <p class="error-state-title">Something went wrong</p>
        <p class="error-state-text">${escapeHtml(message)}</p>
      </div>
    `;
    favoritesGrid.innerHTML = '';
  }
}

init();
