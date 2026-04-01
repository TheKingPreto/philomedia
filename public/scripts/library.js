import { getFirstName, getSession, redirectToLogin, setupAuthUI } from '/scripts/auth-ui.js';
import { getLibrary, removeLibraryItem, saveLibraryItem } from '/scripts/library-api.js';

const DETAILS_BASE = '/html/details.html';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w300';

const MEDIA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

const SORT_FILTERS = [
  { id: 'added', label: 'Recently added' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'recent', label: 'Newest release' },
  { id: 'title', label: 'Title A-Z' },
];

const state = {
  query: '',
  media: 'all',
  sort: 'added',
};

let libraryData = {
  watchlist: [],
  favorites: [],
  watched: [],
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function normalizeText(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function formatRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'TMDB n/a';
  return `TMDB ${numeric.toFixed(1)}`;
}

function getItemKey(item) {
  return `${item.mediaType}:${item.tmdbId}`;
}

function getReleaseTimestamp(item) {
  const timestamp = Date.parse(item.releaseDate || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getAddedTimestamp(item) {
  const timestamp = Date.parse(item.addedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getStatusLookup(library) {
  return {
    watchlist: new Set((library.watchlist || []).map(getItemKey)),
    favorites: new Set((library.favorites || []).map(getItemKey)),
    watched: new Set((library.watched || []).map(getItemKey)),
  };
}

function getStatusForItem(item, lookup) {
  const key = getItemKey(item);
  return {
    inWatchlist: lookup.watchlist.has(key),
    inFavorites: lookup.favorites.has(key),
    inWatched: lookup.watched.has(key),
  };
}

function createStatusBadges(status) {
  const badges = [];

  if (status.inWatchlist) {
    badges.push('<span class="result-status-badge is-watchlist">Watchlist</span>');
  }

  if (status.inFavorites) {
    badges.push('<span class="result-status-badge is-favorite">Favorite</span>');
  }

  if (status.inWatched) {
    badges.push('<span class="result-status-badge is-watched">Watched</span>');
  }

  return badges.join('');
}

function renderAuthPrompt(container, session) {
  const loginAvailable = Boolean(session?.oauthEnabled);

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${loginAvailable ? 'Sign in to use your library' : 'Login unavailable'}</p>
      <p class="empty-state-text">
        ${loginAvailable
          ? 'Use your Google account to save works to your watchlist, favorites, and watched list.'
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

function renderEmptyCollection(container, collectionLabel, hasFilters) {
  const message = hasFilters
    ? `No ${escapeHtml(collectionLabel.toLowerCase())} items match your current filters.`
    : `${escapeHtml(collectionLabel)} will appear here once you start saving titles from the details page or cards.`;

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${hasFilters ? 'Nothing matches these filters' : 'No saved works yet'}</p>
      <p class="empty-state-text">${message}</p>
    </div>
  `;
}

function sortItems(items) {
  const sorted = [...items];

  if (state.sort === 'rating') {
    return sorted.sort((a, b) =>
      (Number(b.voteAverage) || 0) - (Number(a.voteAverage) || 0)
      || getAddedTimestamp(b) - getAddedTimestamp(a)
    );
  }

  if (state.sort === 'recent') {
    return sorted.sort((a, b) =>
      getReleaseTimestamp(b) - getReleaseTimestamp(a)
      || (Number(b.voteAverage) || 0) - (Number(a.voteAverage) || 0)
    );
  }

  if (state.sort === 'title') {
    return sorted.sort((a, b) => a.title.localeCompare(b.title));
  }

  return sorted.sort((a, b) => getAddedTimestamp(b) - getAddedTimestamp(a));
}

function filterItems(items) {
  const normalizedQuery = normalizeText(state.query);

  return items.filter(item => {
    if (state.media !== 'all' && item.mediaType !== state.media) {
      return false;
    }

    if (normalizedQuery && !normalizeText(item.title).includes(normalizedQuery)) {
      return false;
    }

    return true;
  });
}

function renderFilterButtons(container) {
  container.innerHTML = '';

  MEDIA_FILTERS.forEach(filter => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'filter-chip';
    button.dataset.mediaFilter = filter.id;
    button.textContent = filter.label;

    if (filter.id === state.media) {
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.setAttribute('aria-pressed', 'false');
    }

    container.appendChild(button);
  });
}

function createLibraryCard(item, collection, status, handlers) {
  const cardShell = document.createElement('div');
  cardShell.className = 'library-card-shell';

  const link = document.createElement('a');
  link.href = `${DETAILS_BASE}?id=${item.tmdbId}&type=${item.mediaType}`;
  link.className = 'result-card-link';

  const posterHtml = item.posterPath
    ? `<img class="poster-img" src="${POSTER_BASE}${item.posterPath}" alt="${escapeHtml(item.title)} poster" loading="lazy">`
    : '<div class="no-poster" aria-hidden="true">No image</div>';

  link.innerHTML = `
    <div class="result-card">
      <div class="result-card-poster">
        <div class="result-card-statuses" ${createStatusBadges(status) ? '' : 'hidden'}>${createStatusBadges(status)}</div>
        ${posterHtml}
      </div>
      <div class="result-card-body">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="media-type">${escapeHtml(item.mediaType)} | ${escapeHtml(formatRating(item.voteAverage))}</p>
        <p class="date">${escapeHtml(item.releaseDate || '-')}</p>
      </div>
    </div>
  `;

  const actions = document.createElement('div');
  actions.className = 'library-card-actions';

  const watchedButton = document.createElement('button');
  watchedButton.type = 'button';
  watchedButton.className = 'library-card-button';
  watchedButton.textContent = status.inWatched ? 'Remove watched status' : 'Mark as watched';
  watchedButton.classList.toggle('is-active', status.inWatched);
  watchedButton.addEventListener('click', () => handlers.onToggleWatched(item, status.inWatched));

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'library-card-button';
  removeButton.textContent = collection === 'watchlist'
    ? 'Remove from watchlist'
    : collection === 'favorites'
      ? 'Remove from favorites'
      : 'Remove from watched';
  removeButton.addEventListener('click', () => handlers.onRemove(item, collection));

  actions.appendChild(watchedButton);
  actions.appendChild(removeButton);
  cardShell.appendChild(link);
  cardShell.appendChild(actions);
  return cardShell;
}

function renderCollection(container, items, collection, lookup, handlers) {
  container.innerHTML = '';

  const filtered = sortItems(filterItems(items));
  const hasFilters = Boolean(state.query) || state.media !== 'all';

  if (!filtered.length) {
    const label = collection === 'watchlist'
      ? 'Your watchlist'
      : collection === 'favorites'
        ? 'Your favorites'
        : 'Your watched list';
    renderEmptyCollection(container, label, hasFilters);
    return;
  }

  filtered.forEach(item => {
    const status = getStatusForItem(item, lookup);
    container.appendChild(createLibraryCard(item, collection, status, handlers));
  });
}

function renderSortOptions(select) {
  select.innerHTML = '';

  SORT_FILTERS.forEach(filter => {
    const option = document.createElement('option');
    option.value = filter.id;
    option.textContent = filter.label;
    select.appendChild(option);
  });

  select.value = state.sort;
}

async function init() {
  const watchlistGrid = document.getElementById('watchlist-grid');
  const favoritesGrid = document.getElementById('favorites-grid');
  const watchedGrid = document.getElementById('watched-grid');
  const intro = document.getElementById('library-intro');
  const toolbar = document.getElementById('library-toolbar');
  const mediaFilters = document.getElementById('library-media-filters');
  const sortSelect = document.getElementById('library-sort');
  const searchInput = document.getElementById('library-search');
  const clearButton = document.getElementById('clear-library-filters');

  await setupAuthUI();
  const session = await getSession();

  renderFilterButtons(mediaFilters);
  renderSortOptions(sortSelect);

  if (!session.authenticated) {
    intro.textContent = session.oauthEnabled
      ? 'Sign in once and start collecting works that deserve a second look.'
      : 'Google OAuth is not configured yet, so your personal library is unavailable for now.';
    toolbar.hidden = true;
    renderAuthPrompt(watchlistGrid, session);
    favoritesGrid.innerHTML = '';
    watchedGrid.innerHTML = '';
    return;
  }

  intro.textContent = `Signed in as ${getFirstName(session.user.displayName)}. Keep track of what you want to revisit, what stayed with you, and what you have already seen.`;
  toolbar.hidden = false;

  function renderLibraryState() {
    const lookup = getStatusLookup(libraryData);
    const handlers = {
      onRemove: async (item, collection) => {
        await removeLibraryItem(collection, item.tmdbId, item.mediaType);
        await fetchLibraryData();
      },
      onToggleWatched: async (item, isWatched) => {
        if (isWatched) {
          await removeLibraryItem('watched', item.tmdbId, item.mediaType);
        } else {
          await saveLibraryItem('watched', item);
        }
        await fetchLibraryData();
      },
    };

    renderCollection(watchlistGrid, libraryData.watchlist || [], 'watchlist', lookup, handlers);
    renderCollection(favoritesGrid, libraryData.favorites || [], 'favorites', lookup, handlers);
    renderCollection(watchedGrid, libraryData.watched || [], 'watched', lookup, handlers);
  }

  async function fetchLibraryData() {
    libraryData = await getLibrary();
    renderLibraryState();
  }

  mediaFilters.addEventListener('click', event => {
    const button = event.target.closest('button[data-media-filter]');
    if (!button) return;

    state.media = button.dataset.mediaFilter || 'all';
    renderFilterButtons(mediaFilters);
    renderLibraryState();
  });

  sortSelect.addEventListener('change', event => {
    state.sort = event.target.value || 'added';
    renderLibraryState();
  });

  searchInput.addEventListener('input', event => {
    state.query = event.target.value || '';
    renderLibraryState();
  });

  clearButton.addEventListener('click', () => {
    state.query = '';
    state.media = 'all';
    state.sort = 'added';
    searchInput.value = '';
    sortSelect.value = 'added';
    renderFilterButtons(mediaFilters);
    renderLibraryState();
  });

  try {
    await fetchLibraryData();
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
    watchedGrid.innerHTML = '';
  }
}

init();
