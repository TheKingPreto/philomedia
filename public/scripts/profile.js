import {
  getFirstName,
  getSession,
  redirectToLogin,
  refreshSession,
  setupAuthUI,
} from '/scripts/auth-ui.js';
import { getLibrary } from '/scripts/library-api.js';
import { setupLanguageChrome } from '/scripts/ui/languageChrome.js';

const DETAILS_BASE = '/html/details.html';
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';
const AVATAR_ENDPOINT = '/auth/profile/avatar';
const AVATAR_SIZE = 320;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function formatRelativeDate(dateValue) {
  const timestamp = Date.parse(dateValue || '');
  if (!Number.isFinite(timestamp)) return 'Recently';

  const diffMs = Date.now() - timestamp;
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;

  const diffYears = Math.floor(diffMonths / 12);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
}

function buildInitials(displayName = '') {
  const parts = displayName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'PM';
  return parts.map(part => part[0].toUpperCase()).join('');
}

function buildUniqueCount(library) {
  const keys = new Set();

  ['watchlist', 'favorites', 'watched'].forEach(collection => {
    (library?.[collection] || []).forEach(item => {
      keys.add(`${item.mediaType}:${item.tmdbId}`);
    });
  });

  return keys.size;
}

function buildActivityFeed(library) {
  const labels = {
    watchlist: 'Added to watchlist',
    favorites: 'Favorited',
    watched: 'Marked as watched',
  };

  return ['watchlist', 'favorites', 'watched']
    .flatMap(collection =>
      (library?.[collection] || []).map(item => ({
        ...item,
        collection,
        actionLabel: labels[collection],
      }))
    )
    .sort((a, b) => Date.parse(b.addedAt || '') - Date.parse(a.addedAt || ''))
    .slice(0, 8);
}

function renderAuthPrompt(container, session) {
  const loginAvailable = Boolean(session?.oauthEnabled);

  container.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${loginAvailable ? 'Sign in to view your profile' : 'Login unavailable'}</p>
      <p class="empty-state-text">
        ${loginAvailable
          ? 'Use your Google account to unlock your personal profile, stats, and recent library activity.'
          : 'Google OAuth is not configured on this server yet.'}
      </p>
      ${loginAvailable ? '<button type="button" class="library-cta-button" id="profile-login-button">Sign in with Google</button>' : ''}
    </div>
  `;

  const loginButton = document.getElementById('profile-login-button');
  if (loginButton) {
    loginButton.addEventListener('click', redirectToLogin);
  }
}

function renderAvatarFallback(container, user) {
  container.innerHTML = '';

  const fallback = document.createElement('span');
  fallback.className = 'profile-avatar-fallback';
  fallback.textContent = buildInitials(user.displayName);
  container.appendChild(fallback);
}

function renderAvatar(container, user) {
  const avatarUrl = String(user.avatarUrl || '').trim();
  if (!avatarUrl) {
    renderAvatarFallback(container, user);
    return;
  }

  container.innerHTML = '';

  const image = document.createElement('img');
  image.src = avatarUrl;
  image.alt = `${user.displayName} profile picture`;
  image.className = 'profile-avatar-image';
  image.addEventListener('error', () => {
    renderAvatarFallback(container, user);
  }, { once: true });
  container.appendChild(image);
}

function updateAvatarControls(user, elements) {
  elements.removeButton.hidden = !String(user.avatarUrl || '').trim();
}

async function updateAvatarOnServer(avatarUrl) {
  const response = await fetch(AVATAR_ENDPOINT, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ avatarUrl }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Could not update avatar.');
  }

  return payload;
}

function loadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not process that image.'));
    image.src = source;
  });
}

async function resizeAvatarFile(file) {
  const source = await loadFileAsDataUrl(file);
  const image = await loadImage(source);
  const cropSize = Math.min(image.width, image.height);
  const sx = Math.max(0, Math.floor((image.width - cropSize) / 2));
  const sy = Math.max(0, Math.floor((image.height - cropSize) / 2));

  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable in this browser.');
  }

  context.drawImage(
    image,
    sx,
    sy,
    cropSize,
    cropSize,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );

  return canvas.toDataURL('image/webp', 0.86);
}

function setAvatarFeedback(elements, message, tone = 'muted') {
  elements.feedback.textContent = message;
  elements.feedback.dataset.tone = tone;
}

function setAvatarPending(elements, isPending) {
  elements.uploadButton.disabled = isPending;
  elements.removeButton.disabled = isPending;
}

function setupAvatarEditor(user, elements) {
  updateAvatarControls(user, elements);

  elements.uploadButton.addEventListener('click', () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', async event => {
    const [file] = [...(event.target.files || [])];
    if (!file) return;

    setAvatarPending(elements, true);
    setAvatarFeedback(elements, 'Uploading and processing your photo...', 'muted');

    try {
      const avatarUrl = await resizeAvatarFile(file);
      const payload = await updateAvatarOnServer(avatarUrl);
      const session = payload?.user ? await refreshSession() : await refreshSession();
      const nextUser = session.user || user;

      renderAvatar(elements.avatar, nextUser);
      updateAvatarControls(nextUser, elements);
      setAvatarFeedback(elements, 'Photo updated.', 'success');
    } catch (error) {
      setAvatarFeedback(elements, error.message || 'Could not update your photo.', 'error');
    } finally {
      elements.fileInput.value = '';
      setAvatarPending(elements, false);
    }
  });

  elements.removeButton.addEventListener('click', async () => {
    setAvatarPending(elements, true);
    setAvatarFeedback(elements, 'Removing photo...', 'muted');

    try {
      const payload = await updateAvatarOnServer('');
      const session = payload?.user ? await refreshSession() : await refreshSession();
      const nextUser = session.user || user;

      renderAvatar(elements.avatar, nextUser);
      updateAvatarControls(nextUser, elements);
      setAvatarFeedback(elements, 'Photo removed. Initials are back in place.', 'success');
    } catch (error) {
      setAvatarFeedback(elements, error.message || 'Could not remove your photo.', 'error');
    } finally {
      setAvatarPending(elements, false);
    }
  });
}

function createStatCard({ label, value, caption }) {
  const card = document.createElement('div');
  card.className = 'profile-stat-card';
  card.innerHTML = `
    <span class="profile-stat-label">${escapeHtml(label)}</span>
    <strong class="profile-stat-value">${escapeHtml(formatCount(value))}</strong>
    <p class="profile-stat-caption">${escapeHtml(caption)}</p>
  `;
  return card;
}

function renderStats(container, library) {
  const stats = [
    {
      label: 'Watchlist',
      value: library?.counts?.watchlist || 0,
      caption: 'Works you want to revisit soon.',
    },
    {
      label: 'Favorites',
      value: library?.counts?.favorites || 0,
      caption: 'Titles that stayed with you most.',
    },
    {
      label: 'Watched',
      value: library?.counts?.watched || 0,
      caption: 'Works already experienced.',
    },
    {
      label: 'Unique works',
      value: buildUniqueCount(library),
      caption: 'Distinct films and series across your library.',
    },
  ];

  container.innerHTML = '';
  stats.forEach(stat => container.appendChild(createStatCard(stat)));
}

function renderActivity(container, items) {
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">No activity yet</p>
        <p class="empty-state-text">Start saving works and this timeline will begin to tell your story.</p>
      </div>
    `;
    return;
  }

  const list = document.createElement('div');
  list.className = 'activity-list';

  items.forEach(item => {
    const entry = document.createElement('a');
    entry.href = `${DETAILS_BASE}?id=${item.tmdbId}&type=${item.mediaType}`;
    entry.className = 'activity-item';

    const poster = item.posterPath
      ? `<img class="activity-poster" src="${POSTER_BASE}${item.posterPath}" alt="${escapeHtml(item.title)} poster" loading="lazy">`
      : '<div class="activity-poster activity-poster-fallback" aria-hidden="true">No image</div>';

    entry.innerHTML = `
      <div class="activity-poster-wrap">${poster}</div>
      <div class="activity-copy">
        <span class="activity-kicker">${escapeHtml(item.actionLabel)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.mediaType)} | ${escapeHtml(item.releaseDate || 'Date unavailable')}</p>
      </div>
      <span class="activity-age">${escapeHtml(formatRelativeDate(item.addedAt))}</span>
    `;

    list.appendChild(entry);
  });

  container.innerHTML = '';
  container.appendChild(list);
}

function renderOverview(container, library) {
  const collections = [
    {
      label: 'Watchlist',
      count: library?.counts?.watchlist || 0,
      description: 'Return to the works you have queued for later.',
      href: '/html/library.html#watchlist-section',
    },
    {
      label: 'Favorites',
      count: library?.counts?.favorites || 0,
      description: 'Open the pieces that resonate most with you.',
      href: '/html/library.html#favorites-section',
    },
    {
      label: 'Watched',
      count: library?.counts?.watched || 0,
      description: 'Keep track of what you have already experienced.',
      href: '/html/library.html#watched-section',
    },
  ];

  container.innerHTML = collections.map(collection => `
    <a href="${collection.href}" class="profile-overview-card">
      <span class="profile-overview-label">${escapeHtml(collection.label)}</span>
      <strong class="profile-overview-value">${escapeHtml(formatCount(collection.count))}</strong>
      <p class="profile-overview-description">${escapeHtml(collection.description)}</p>
    </a>
  `).join('');
}

async function init() {
  setupLanguageChrome();
  const gate = document.getElementById('profile-gate');
  const content = document.getElementById('profile-content');
  const name = document.getElementById('profile-name');
  const email = document.getElementById('profile-email');
  const summary = document.getElementById('profile-summary');
  const avatar = document.getElementById('profile-avatar');
  const uploadButton = document.getElementById('avatar-upload-button');
  const removeButton = document.getElementById('avatar-remove-button');
  const fileInput = document.getElementById('avatar-file-input');
  const feedback = document.getElementById('avatar-feedback');
  const stats = document.getElementById('profile-stats');
  const activity = document.getElementById('profile-activity');
  const overview = document.getElementById('profile-overview');

  await setupAuthUI();
  const session = await getSession();

  if (!session.authenticated || !session.user) {
    content.hidden = true;
    gate.hidden = false;
    renderAuthPrompt(gate, session);
    return;
  }

  gate.hidden = true;
  content.hidden = false;

  name.textContent = `${getFirstName(session.user.displayName)}'s profile`;
  email.textContent = session.user.email || '';
  summary.textContent = 'A quick portrait of how your personal library is evolving across saved works, favorites, and watched titles.';
  renderAvatar(avatar, session.user);
  setupAvatarEditor(session.user, {
    avatar,
    uploadButton,
    removeButton,
    fileInput,
    feedback,
  });

  try {
    const library = await getLibrary();
    renderStats(stats, library);
    renderActivity(activity, buildActivityFeed(library));
    renderOverview(overview, library);
  } catch (error) {
    stats.innerHTML = `
      <div class="error-state">
        <p class="error-state-title">Could not load profile stats</p>
        <p class="error-state-text">Your session is active, but the library data is unavailable right now.</p>
      </div>
    `;
    activity.innerHTML = '';
    overview.innerHTML = '';
  }
}

init();
