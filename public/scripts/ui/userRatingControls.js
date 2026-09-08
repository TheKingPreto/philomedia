import { getSession, redirectToLogin } from '/scripts/auth-ui.js';
import { t } from '/scripts/services/i18n.js';
import { deleteRating, getRating, upsertRating } from '/scripts/ratings-api.js';
import {
  QUOTE_RATING_DOWN,
  QUOTE_RATING_UP,
  mediaRatingTargetId,
  toggleRatingValue,
} from '/scripts/domain/userRatings.js';

const STAR_PATH = 'M12 3.15 14.47 8.7l6.13.54-4.66 4.02 1.4 6.02L12 16.5l-5.34 2.78 1.4-6.02L3.4 9.24l6.13-.54Z';
const THUMB_PATH = 'M8.25 21H5.4A1.4 1.4 0 0 1 4 19.6V11h4.25V21Zm11.4-9.35c.72 0 1.28.7 1.14 1.4l-1.38 6.05A1.9 1.9 0 0 1 17.56 21H10.5V10.15l1.72-4.9A1.6 1.6 0 0 1 13.72 4c.84 0 1.5.74 1.38 1.57L14.7 10h4.95Z';

function svgIcon(path, { rotate = false } = {}) {
  const rotation = rotate ? ' transform="rotate(180 12 12)"' : '';
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="${path}"${rotation}/></svg>`;
}

function setHint(el, message) {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    return;
  }
  el.hidden = false;
  el.textContent = message;
}

async function requireAuthToPersist(session, hintEl) {
  if (session.authenticated) return true;

  if (session.oauthEnabled) {
    redirectToLogin();
    return false;
  }

  setHint(hintEl, t('details.rating_login_unavailable'));
  return false;
}

function starLabel(stars) {
  return stars === 1
    ? t('details.star_label_one')
    : t('details.star_label_many', { count: stars });
}

export function paintStarButtons(container, value) {
  container.querySelectorAll('[data-star-value]').forEach(button => {
    const starValue = Number(button.dataset.starValue);
    const on = Number.isFinite(value) && starValue <= value;
    button.classList.toggle('is-on', on);
    button.setAttribute('aria-pressed', String(on));
  });
}

export function paintThumbButtons(upButton, downButton, value) {
  const upActive = value === QUOTE_RATING_UP;
  const downActive = value === QUOTE_RATING_DOWN;

  if (upButton) {
    upButton.classList.toggle('is-active', upActive);
    upButton.setAttribute('aria-pressed', String(upActive));
  }

  if (downButton) {
    downButton.classList.toggle('is-active', downActive);
    downButton.setAttribute('aria-pressed', String(downActive));
  }
}

export async function mountMediaStarRating({
  container,
  hintEl,
  mediaType,
  tmdbId,
}) {
  if (!container) return;

  const targetId = mediaRatingTargetId(mediaType, tmdbId);
  container.replaceChildren();
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', t('details.your_rating'));

  for (let stars = 1; stars <= 5; stars += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'star-rating-button';
    button.dataset.starValue = String(stars);
    button.setAttribute('aria-label', starLabel(stars));
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = svgIcon(STAR_PATH);
    container.appendChild(button);
  }

  const session = await getSession();
  let currentValue = null;
  let busy = false;

  if (session.authenticated) {
    const saved = await getRating('media', targetId).catch(() => null);
    currentValue = saved?.value ?? null;
  } else {
    setHint(hintEl, t('details.rating_sign_in'));
  }

  paintStarButtons(container, currentValue);

  container.addEventListener('click', async event => {
    const button = event.target.closest('[data-star-value]');
    if (!button || busy) return;

    if (!(await requireAuthToPersist(session, hintEl))) return;

    const clicked = Number(button.dataset.starValue);
    const nextValue = toggleRatingValue(currentValue, clicked);
    busy = true;
    container.querySelectorAll('button').forEach(el => { el.disabled = true; });

    try {
      if (nextValue === null) {
        await deleteRating({ targetType: 'media', targetId });
        currentValue = null;
      } else {
        await upsertRating({ targetType: 'media', targetId, value: nextValue });
        currentValue = nextValue;
      }
      setHint(hintEl, '');
      paintStarButtons(container, currentValue);
    } catch {
      setHint(hintEl, t('details.rating_error'));
    } finally {
      busy = false;
      container.querySelectorAll('button').forEach(el => { el.disabled = false; });
    }
  });
}

export async function mountQuoteThumbRating({
  container,
  upButton,
  downButton,
  hintEl,
  quoteId,
}) {
  if (!container || !upButton || !downButton) return;

  if (!quoteId) {
    container.hidden = true;
    return;
  }

  const targetId = String(quoteId);
  container.hidden = false;
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', t('details.quote_feedback_label'));

  upButton.innerHTML = svgIcon(THUMB_PATH);
  downButton.innerHTML = svgIcon(THUMB_PATH, { rotate: true });
  upButton.setAttribute('aria-label', t('details.quote_helpful'));
  downButton.setAttribute('aria-label', t('details.quote_not_helpful'));
  upButton.title = t('details.quote_helpful');
  downButton.title = t('details.quote_not_helpful');

  const session = await getSession();
  let currentValue = null;
  let busy = false;

  if (session.authenticated) {
    const saved = await getRating('quote', targetId).catch(() => null);
    currentValue = saved?.value ?? null;
  } else {
    setHint(hintEl, t('details.quote_rating_sign_in'));
  }

  paintThumbButtons(upButton, downButton, currentValue);

  async function handleClick(clickedValue) {
    if (busy) return;
    if (!(await requireAuthToPersist(session, hintEl))) return;

    const nextValue = toggleRatingValue(currentValue, clickedValue);
    busy = true;
    upButton.disabled = true;
    downButton.disabled = true;

    try {
      if (nextValue === null) {
        await deleteRating({ targetType: 'quote', targetId });
        currentValue = null;
      } else {
        await upsertRating({ targetType: 'quote', targetId, value: nextValue });
        currentValue = nextValue;
      }
      setHint(hintEl, '');
      paintThumbButtons(upButton, downButton, currentValue);
    } catch {
      setHint(hintEl, t('details.rating_error'));
    } finally {
      busy = false;
      upButton.disabled = false;
      downButton.disabled = false;
    }
  }

  upButton.addEventListener('click', () => {
    handleClick(QUOTE_RATING_UP).catch(() => {});
  });
  downButton.addEventListener('click', () => {
    handleClick(QUOTE_RATING_DOWN).catch(() => {});
  });
}
