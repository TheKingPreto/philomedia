import { getSession, redirectToLogin } from '/scripts/auth-ui.js';

const DETAILS_BASE = '/html/details.html';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';
const cardStore = new WeakMap();

let cachedLibraryContext = null;
let inflightLibraryContext = null;
let libraryApiPromise = null;

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

function getMediaType(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  if (item.mediaType === 'movie' || item.mediaType === 'tv') return item.mediaType;
  if (item.title) return 'movie';
  if (item.name) return 'tv';
  return 'unknown';
}

function getItemId(item) {
  return String(item.id ?? item.tmdbId ?? '');
}

function getLibraryKey(item) {
  return `${getMediaType(item)}:${getItemId(item)}`;
}

function createEmptyStatus() {
  return {
    inWatchlist: false,
    inFavorites: false,
    inWatched: false,
  };
}

function buildLibraryItem(details, mediaType) {
  return {
    tmdbId: String(details.id ?? details.tmdbId),
    mediaType,
    title: details.title || details.name || 'Untitled',
    posterPath: details.poster_path || details.posterPath || '',
    releaseDate: details.release_date || details.first_air_date || details.releaseDate || '',
    voteAverage: Number(details.vote_average ?? details.voteAverage) || 0,
  };
}

async function getLibraryApi() {
  if (!libraryApiPromise) {
    libraryApiPromise = import('/scripts/library-api.js');
  }

  return libraryApiPromise;
}

function buildStatusMap(library) {
  const statusMap = new Map();

  ['watchlist', 'favorites', 'watched'].forEach(collection => {
    (library?.[collection] || []).forEach(entry => {
      const key = `${entry.mediaType}:${entry.tmdbId}`;
      const current = statusMap.get(key) || createEmptyStatus();

      if (collection === 'watchlist') current.inWatchlist = true;
      if (collection === 'favorites') current.inFavorites = true;
      if (collection === 'watched') current.inWatched = true;

      statusMap.set(key, current);
    });
  });

  return statusMap;
}

async function getLibraryContext({ force = false } = {}) {
  const session = await getSession();

  if (!session.oauthEnabled || !session.authenticated) {
    return {
      session,
      statusMap: new Map(),
    };
  }

  if (!force && cachedLibraryContext) {
    return cachedLibraryContext;
  }

  if (!force && inflightLibraryContext) {
    return inflightLibraryContext;
  }

  inflightLibraryContext = getLibraryApi()
    .then(({ getLibrary }) => getLibrary())
    .then(library => {
      const context = {
        session,
        statusMap: buildStatusMap(library),
      };
      cachedLibraryContext = context;
      return context;
    })
    .catch(() => ({
      session,
      statusMap: new Map(),
    }))
    .finally(() => {
      inflightLibraryContext = null;
    });

  return inflightLibraryContext;
}

export async function primeLibraryContext(library) {
  const session = await getSession();
  cachedLibraryContext = {
    session,
    statusMap: buildStatusMap(library),
  };

  return cachedLibraryContext;
}

function getStatusForItem(context, item) {
  if (!context?.statusMap) return createEmptyStatus();
  return context.statusMap.get(getLibraryKey(item)) || createEmptyStatus();
}

function setContextStatus(item, status) {
  if (!cachedLibraryContext?.statusMap) return;
  cachedLibraryContext.statusMap.set(getLibraryKey(item), {
    ...createEmptyStatus(),
    ...status,
  });
}

function getCollectionState(status, collection) {
  if (collection === 'watchlist') return Boolean(status.inWatchlist);
  if (collection === 'favorites') return Boolean(status.inFavorites);
  if (collection === 'watched') return Boolean(status.inWatched);
  return false;
}

function setActionState(button, {
  active,
  loading,
  idleLabel,
  activeLabel,
  idleSymbol,
  activeSymbol,
}) {
  if (!button) return;

  const label = loading ? `Updating ${button.dataset.libraryAction}` : (active ? activeLabel : idleLabel);

  button.disabled = Boolean(loading);
  button.classList.toggle('is-active', Boolean(active));
  button.classList.toggle('is-loading', Boolean(loading));
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.innerHTML = loading
    ? '<span aria-hidden="true">...</span>'
    : `<span aria-hidden="true">${active ? activeSymbol : idleSymbol}</span>`;
}

function applyCardState(shell, status, session) {
  const actionRow = shell.querySelector('.result-card-actions');
  const watchlistButton = shell.querySelector('[data-library-action="watchlist"]');
  const favoriteButton = shell.querySelector('[data-library-action="favorites"]');
  const watchedButton = shell.querySelector('[data-library-action="watched"]');
  const enableLibraryActions = shell.dataset.enableLibraryActions === 'true';

  if (!actionRow) return;

  if (!enableLibraryActions || !session?.oauthEnabled) {
    actionRow.hidden = true;
    return;
  }

  actionRow.hidden = false;

  setActionState(watchlistButton, {
    active: status.inWatchlist,
    loading: false,
    idleLabel: 'Add to watchlist',
    activeLabel: 'Remove from watchlist',
    idleSymbol: '+',
    activeSymbol: '-',
  });

  setActionState(favoriteButton, {
    active: status.inFavorites,
    loading: false,
    idleLabel: 'Add to favorites',
    activeLabel: 'Remove from favorites',
    idleSymbol: '&#9734;',
    activeSymbol: '&#9733;',
  });

  if (watchedButton) {
    setActionState(watchedButton, {
      active: status.inWatched,
      loading: false,
      idleLabel: 'Mark as watched',
      activeLabel: 'Remove watched status',
      idleSymbol: '&#10003;',
      activeSymbol: '&#10003;',
    });
  }
}

function syncMatchingCards(item, status, session) {
  const key = getLibraryKey(item);
  document.querySelectorAll(`.media-card-shell[data-library-key="${key}"]`).forEach(shell => {
    applyCardState(shell, status, session);
  });
}

async function handleCollectionToggle(shell, collection) {
  const stored = cardStore.get(shell);
  if (!stored) return;

  const { item } = stored;
  const context = await getLibraryContext();

  if (!context.session.oauthEnabled) {
    return;
  }

  if (!context.session.authenticated) {
    redirectToLogin();
    return;
  }

  const currentStatus = getStatusForItem(context, item);
  const button = shell.querySelector(`[data-library-action="${collection}"]`);
  const isActive = getCollectionState(currentStatus, collection);

  setActionState(button, {
    active: isActive,
    loading: true,
    idleLabel:
      collection === 'watchlist'
        ? 'Add to watchlist'
        : collection === 'favorites'
          ? 'Add to favorites'
          : 'Mark as watched',
    activeLabel:
      collection === 'watchlist'
        ? 'Remove from watchlist'
        : collection === 'favorites'
          ? 'Remove from favorites'
          : 'Remove watched status',
    idleSymbol:
      collection === 'watchlist'
        ? '+'
        : collection === 'favorites'
          ? '&#9734;'
          : '&#10003;',
    activeSymbol:
      collection === 'watchlist'
        ? '-'
        : collection === 'favorites'
          ? '&#9733;'
          : '&#10003;',
  });

  try {
    const { removeLibraryItem, saveLibraryItem } = await getLibraryApi();
    const payload = isActive
      ? await removeLibraryItem(collection, item.tmdbId, item.mediaType)
      : await saveLibraryItem(collection, item);

    const nextStatus = payload.status || currentStatus;
    setContextStatus(item, nextStatus);
    syncMatchingCards(item, nextStatus, context.session);
    await stored.onStatusChange?.({
      item,
      status: nextStatus,
      collection,
    });
  } catch (error) {
    applyCardState(shell, currentStatus, context.session);
  }
}

function bindLibraryActions(shell) {
  if (shell.dataset.libraryBound === 'true') return;
  shell.dataset.libraryBound = 'true';

  shell.querySelectorAll('[data-library-action]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      handleCollectionToggle(shell, button.dataset.libraryAction).catch(() => {});
    });
  });
}

export function createMediaCard(item, {
  index = 0,
  overviewLength = 110,
  showOverview = true,
  enableLibraryActions = true,
  enableWatchedAction = false,
  onStatusChange = null,
  philosopherSlug = '',
} = {}) {
  const title = item.title || item.name || 'Untitled';
  const mediaType = getMediaType(item);
  const date = item.release_date || item.first_air_date || item.releaseDate || '-';
  const overview = item.overview || 'No synopsis available.';
  const rating = formatRating(item.vote_average);
  const posterPath = item.poster_path || item.posterPath;
  const posterUrl = posterPath ? `${POSTER_BASE}${posterPath}` : null;
  const itemId = getItemId(item);

  const shell = document.createElement('div');
  shell.className = 'media-card-shell';
  shell.dataset.libraryKey = `${mediaType}:${itemId}`;
  shell.dataset.enableLibraryActions = String(Boolean(enableLibraryActions));

  const detailsParams = new URLSearchParams({
    id: itemId,
    type: mediaType,
  });
  const fromSlug = String(philosopherSlug || '').trim();
  if (fromSlug) {
    detailsParams.set('from', 'philosopher');
    detailsParams.set('philosopher', fromSlug);
  }

  const cardLink = document.createElement('a');
  cardLink.href = `${DETAILS_BASE}?${detailsParams.toString()}`;
  cardLink.classList.add('result-card-link');

  const card = document.createElement('div');
  card.classList.add('result-card');
  card.style.animationDelay = `${index * 0.05}s`;

  const posterHtml = posterUrl
    ? `<img class="poster-img" src="${posterUrl}" alt="${escapeHtml(title)} poster" loading="lazy" decoding="async" width="185" height="278">`
    : '<div class="no-poster" aria-hidden="true">No image</div>';

  card.innerHTML = `
    <div class="result-card-poster">
      ${posterHtml}
    </div>
    <div class="result-card-body">
      <h3>${escapeHtml(title)}</h3>
      <p class="media-type">${escapeHtml(mediaType)} | ${escapeHtml(rating)}</p>
      <p class="date">${escapeHtml(date)}</p>
      ${showOverview ? `<p class="overview">${escapeHtml(overview.length > overviewLength ? `${overview.slice(0, overviewLength)}...` : overview)}</p>` : ''}
    </div>
  `;

  cardLink.appendChild(card);
  shell.appendChild(cardLink);

  const actionRow = document.createElement('div');
  actionRow.className = `result-card-actions${enableWatchedAction ? ' has-watched-action' : ''}`;
  actionRow.hidden = true;
  actionRow.innerHTML = `
    <button type="button" class="result-card-action result-card-action-watchlist" data-library-action="watchlist" aria-label="Add to watchlist" title="Add to watchlist"><span aria-hidden="true">+</span></button>
    ${enableWatchedAction
      ? '<button type="button" class="result-card-action result-card-action-watched" data-library-action="watched" aria-label="Mark as watched" title="Mark as watched"><span aria-hidden="true">&#10003;</span></button>'
      : ''}
    <button type="button" class="result-card-action result-card-action-favorite" data-library-action="favorites" aria-label="Add to favorites" title="Add to favorites"><span aria-hidden="true">&#9734;</span></button>
  `;
  shell.appendChild(actionRow);

  const libraryItem = buildLibraryItem({
    ...item,
    id: item.id ?? item.tmdbId,
    poster_path: item.poster_path ?? item.posterPath,
    release_date: item.release_date ?? item.releaseDate,
    vote_average: item.vote_average ?? item.voteAverage,
  }, mediaType);

  cardStore.set(shell, { item: libraryItem, onStatusChange });
  return shell;
}

export async function hydrateMediaCards(container) {
  const shells = [...container.querySelectorAll('.media-card-shell')];
  if (!shells.length) return;

  const context = await getLibraryContext();

  shells.forEach(shell => {
    bindLibraryActions(shell);
    const stored = cardStore.get(shell);
    if (!stored) return;

    const status = getStatusForItem(context, stored.item);
    applyCardState(shell, status, context.session);
  });
}

export function renderMediaCards(container, items, options = {}) {
  container.innerHTML = '';

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    fragment.appendChild(createMediaCard(item, {
      ...options,
      index,
    }));
  });

  container.appendChild(fragment);
  hydrateMediaCards(container).catch(() => {});
}
