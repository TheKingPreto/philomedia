import { getFirstName, getSession, redirectToLogin, setupAuthUI } from '/scripts/auth-ui.js';
import { getLibrary } from '/scripts/library-api.js';
import { listRatings } from '/scripts/ratings-api.js';
import { createMediaCard, hydrateMediaCards, primeLibraryContext } from '/scripts/media-card.js';
import { mediaRatingTargetId, ratingsByTargetId } from '/scripts/domain/userRatings.js';
import { t } from '/scripts/services/i18n.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';

const MEDIA_FILTERS = [
  { id: 'all', labelKey: 'library.media.all' },
  { id: 'movie', labelKey: 'library.media.movie' },
  { id: 'tv', labelKey: 'library.media.tv' },
];

const SORT_FILTERS = [
  { id: 'added', labelKey: 'library.sort.added' },
  { id: 'rating', labelKey: 'library.sort.rating' },
  { id: 'mine', labelKey: 'library.sort.mine' },
  { id: 'recent', labelKey: 'library.sort.recent' },
  { id: 'title', labelKey: 'library.sort.title' },
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

function getReleaseTimestamp(item) {
  const timestamp = Date.parse(item.releaseDate || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getAddedTimestamp(item) {
  const timestamp = Date.parse(item.addedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getCollectionLabel(collection) {
  if (collection === 'watchlist') return t('library.label_watchlist');
  if (collection === 'favorites') return t('library.label_favorites');
  return t('library.label_watched');
}

function renderAuthPrompt(container, session) {
  const loginAvailable = Boolean(session?.oauthEnabled);

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${escapeHtml(loginAvailable ? t('library.sign_in_title') : t('library.oauth_unavailable_title'))}</p>
      <p class="empty-state-text">
        ${escapeHtml(loginAvailable ? t('library.sign_in_text') : t('library.oauth_unavailable_text'))}
      </p>
      ${loginAvailable ? '<button type="button" class="library-cta-button" id="library-login-button">Sign in</button>' : ''}
    </div>
  `;

  const loginButton = document.getElementById('library-login-button');
  if (loginButton) {
    loginButton.textContent = t('nav.login');
    loginButton.addEventListener('click', redirectToLogin);
  }
}

function renderEmptyCollection(container, collection, hasFilters) {
  const collectionLabel = getCollectionLabel(collection);
  const message = hasFilters
    ? t('library.empty_filtered', { collection: collectionLabel })
    : t('library.empty_collection', { collection: collectionLabel });

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${escapeHtml(hasFilters ? t('library.empty_filters_title') : t('library.empty_collection_title'))}</p>
      <p class="empty-state-text">${escapeHtml(message)}</p>
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

  if (state.sort === 'mine') {
    return sorted.sort((a, b) =>
      (Number(b.userRating) || 0) - (Number(a.userRating) || 0)
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
    button.textContent = t(filter.labelKey);

    if (filter.id === state.media) {
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
    } else {
      button.setAttribute('aria-pressed', 'false');
    }

    container.appendChild(button);
  });
}

function renderCollection(container, items, collection, onStatusChange) {
  container.innerHTML = '';

  const filtered = sortItems(filterItems(items));
  const hasFilters = Boolean(state.query) || state.media !== 'all';

  if (!filtered.length) {
    renderEmptyCollection(container, collection, hasFilters);
    return;
  }

  const fragment = document.createDocumentFragment();

  filtered.forEach((item, index) => {
    fragment.appendChild(createMediaCard({
      id: item.tmdbId,
      title: item.title,
      media_type: item.mediaType,
      poster_path: item.posterPath,
      release_date: item.releaseDate,
      vote_average: item.voteAverage,
      userRating: item.userRating,
    }, {
      index,
      showOverview: false,
      enableWatchedAction: true,
      onStatusChange,
    }));
  });

  container.appendChild(fragment);
  hydrateMediaCards(container).catch(() => {});
}

function renderSortOptions(select) {
  select.innerHTML = '';

  SORT_FILTERS.forEach(filter => {
    const option = document.createElement('option');
    option.value = filter.id;
    option.textContent = t(filter.labelKey);
    select.appendChild(option);
  });

  select.value = state.sort;
}

async function init() {
  setupLanguageChrome();
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
      ? t('library.intro_sign_in')
      : t('library.intro_oauth_off');
    toolbar.hidden = true;
    renderAuthPrompt(watchlistGrid, session);
    favoritesGrid.innerHTML = '';
    watchedGrid.innerHTML = '';
    return;
  }

  intro.textContent = t('library.intro_signed_in', {
    name: getFirstName(session.user.displayName),
  });
  toolbar.hidden = false;

  function renderLibraryState() {
    const handleStatusChange = async () => {
      await fetchLibraryData();
    };

    renderCollection(watchlistGrid, libraryData.watchlist || [], 'watchlist', handleStatusChange);
    renderCollection(favoritesGrid, libraryData.favorites || [], 'favorites', handleStatusChange);
    renderCollection(watchedGrid, libraryData.watched || [], 'watched', handleStatusChange);
  }

  async function fetchLibraryData() {
    libraryData = await getLibrary();
    const ratingPayload = await listRatings({ targetType: 'media' }).catch(() => ({ ratings: [] }));
    const ratingMap = ratingsByTargetId(ratingPayload.ratings || []);

    ['watchlist', 'favorites', 'watched'].forEach(collection => {
      libraryData[collection] = (libraryData[collection] || []).map(item => ({
        ...item,
        userRating: ratingMap.get(mediaRatingTargetId(item.mediaType, item.tmdbId)) ?? null,
      }));
    });

    await primeLibraryContext(libraryData);
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
      ? t('library.error_session')
      : t('library.error_load');

    watchlistGrid.innerHTML = `
      <div class="error-state">
        <p class="error-state-title">${escapeHtml(t('library.error_title'))}</p>
        <p class="error-state-text">${escapeHtml(message)}</p>
      </div>
    `;
    favoritesGrid.innerHTML = '';
    watchedGrid.innerHTML = '';
  }
}

init();
