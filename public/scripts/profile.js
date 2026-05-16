import {
  getFirstName,
  getSession,
  redirectToLogin,
  refreshSession,
  setupAuthUI,
} from '/scripts/auth-ui.js';
import { getLibrary } from '/scripts/library-api.js';
import { t } from '/scripts/services/i18n.js';
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
  if (!Number.isFinite(timestamp)) return t('profile.recently');

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
    watchlist: t('profile.activity_watchlist'),
    favorites: t('profile.activity_favorites'),
    watched: t('profile.activity_watched'),
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
      <p class="empty-state-title">${escapeHtml(loginAvailable ? t('profile.sign_in_title') : t('profile.oauth_unavailable_title'))}</p>
      <p class="empty-state-text">
        ${escapeHtml(loginAvailable ? t('profile.sign_in_text') : t('profile.oauth_unavailable_text'))}
      </p>
      ${loginAvailable ? '<button type="button" class="library-cta-button" id="profile-login-button">Sign in</button>' : ''}
    </div>
  `;

  const loginButton = document.getElementById('profile-login-button');
  if (loginButton) {
    loginButton.textContent = t('profile.sign_in_button');
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
    setAvatarFeedback(elements, t('profile.avatar_uploading'), 'muted');

    try {
      const avatarUrl = await resizeAvatarFile(file);
      const payload = await updateAvatarOnServer(avatarUrl);
      const session = payload?.user ? await refreshSession() : await refreshSession();
      const nextUser = session.user || user;

      renderAvatar(elements.avatar, nextUser);
      updateAvatarControls(nextUser, elements);
      setAvatarFeedback(elements, t('profile.avatar_updated'), 'success');
    } catch (error) {
      setAvatarFeedback(elements, error.message || t('profile.avatar_error'), 'error');
    } finally {
      elements.fileInput.value = '';
      setAvatarPending(elements, false);
    }
  });

  elements.removeButton.addEventListener('click', async () => {
    setAvatarPending(elements, true);
    setAvatarFeedback(elements, t('profile.avatar_removing'), 'muted');

    try {
      const payload = await updateAvatarOnServer('');
      const session = payload?.user ? await refreshSession() : await refreshSession();
      const nextUser = session.user || user;

      renderAvatar(elements.avatar, nextUser);
      updateAvatarControls(nextUser, elements);
      setAvatarFeedback(elements, t('profile.avatar_removed'), 'success');
    } catch (error) {
      setAvatarFeedback(elements, error.message || t('profile.avatar_remove_error'), 'error');
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
      label: t('profile.stat_watchlist'),
      value: library?.counts?.watchlist || 0,
      caption: t('profile.stat_watchlist_caption'),
    },
    {
      label: t('profile.stat_favorites'),
      value: library?.counts?.favorites || 0,
      caption: t('profile.stat_favorites_caption'),
    },
    {
      label: t('profile.stat_watched'),
      value: library?.counts?.watched || 0,
      caption: t('profile.stat_watched_caption'),
    },
    {
      label: t('profile.stat_unique'),
      value: buildUniqueCount(library),
      caption: t('profile.stat_unique_caption'),
    },
  ];

  container.innerHTML = '';
  stats.forEach(stat => container.appendChild(createStatCard(stat)));
}

function renderActivity(container, items) {
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p class="empty-state-title">${escapeHtml(t('profile.no_activity_title'))}</p>
        <p class="empty-state-text">${escapeHtml(t('profile.no_activity_text'))}</p>
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
      : `<div class="activity-poster activity-poster-fallback" aria-hidden="true">${escapeHtml(t('profile.no_image'))}</div>`;

    entry.innerHTML = `
      <div class="activity-poster-wrap">${poster}</div>
      <div class="activity-copy">
        <span class="activity-kicker">${escapeHtml(item.actionLabel)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.mediaType)} | ${escapeHtml(item.releaseDate || t('profile.date_unavailable'))}</p>
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
      label: t('profile.overview_watchlist'),
      count: library?.counts?.watchlist || 0,
      description: t('profile.overview_watchlist_desc'),
      href: '/html/library.html#watchlist-section',
    },
    {
      label: t('profile.overview_favorites'),
      count: library?.counts?.favorites || 0,
      description: t('profile.overview_favorites_desc'),
      href: '/html/library.html#favorites-section',
    },
    {
      label: t('profile.overview_watched'),
      count: library?.counts?.watched || 0,
      description: t('profile.overview_watched_desc'),
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

  name.textContent = t('profile.title_with_name', { name: getFirstName(session.user.displayName) });
  email.textContent = session.user.email || '';
  summary.textContent = t('profile.library_summary');
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
        <p class="error-state-title">${escapeHtml(t('profile.error_stats_title'))}</p>
        <p class="error-state-text">${escapeHtml(t('profile.error_stats_text'))}</p>
      </div>
    `;
    activity.innerHTML = '';
    overview.innerHTML = '';
  }
}

init();
