/**
 * User ratings are a separate entity from TMDB `voteAverage`.
 * Quote: thumb up/down stored as 1 / -1.
 * Media: integer stars 1–5.
 */

export const QUOTE_RATING_UP = 1;
export const QUOTE_RATING_DOWN = -1;
export const MEDIA_RATING_MIN = 1;
export const MEDIA_RATING_MAX = 5;
export const MEDIA_TARGET_PATTERN = /^(movie|tv):\d{1,20}$/;
export const TARGET_ID_PATTERN = /^[A-Za-z0-9:_-]{1,80}$/;

export function mediaRatingTargetId(mediaType, tmdbId) {
  return `${mediaType}:${tmdbId}`;
}

export function isValidMediaTargetId(targetId) {
  return MEDIA_TARGET_PATTERN.test(String(targetId || ''));
}

export function isValidTargetId(targetId) {
  return TARGET_ID_PATTERN.test(String(targetId || ''));
}

export function normalizeQuoteRatingValue(value) {
  if (value === 'up' || value === QUOTE_RATING_UP || value === '1') {
    return QUOTE_RATING_UP;
  }
  if (value === 'down' || value === QUOTE_RATING_DOWN || value === '-1') {
    return QUOTE_RATING_DOWN;
  }
  return null;
}

export function normalizeMediaRatingValue(value) {
  const numeric = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : Number(value);

  if (!Number.isInteger(numeric) || numeric < MEDIA_RATING_MIN || numeric > MEDIA_RATING_MAX) {
    return null;
  }

  return numeric;
}

export function normalizeRatingValue(targetType, value) {
  if (targetType === 'quote') return normalizeQuoteRatingValue(value);
  if (targetType === 'media') return normalizeMediaRatingValue(value);
  return null;
}

/** Clicking the active control again clears the rating. */
export function toggleRatingValue(currentValue, nextValue) {
  if (currentValue === nextValue) return null;
  return nextValue;
}

export function ratingsByTargetId(ratings = []) {
  const map = new Map();
  ratings.forEach(rating => {
    if (rating?.targetId) {
      map.set(String(rating.targetId), rating.value);
    }
  });
  return map;
}
