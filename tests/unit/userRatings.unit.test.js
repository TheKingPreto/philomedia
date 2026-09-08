import {
  MEDIA_TARGET_PATTERN,
  mediaRatingTargetId,
  normalizeMediaRatingValue,
  normalizeQuoteRatingValue,
  normalizeRatingValue,
  ratingsByTargetId,
  toggleRatingValue,
} from '../../public/scripts/domain/userRatings.js';

describe('userRatings', () => {
  test('mediaRatingTargetId composes type and tmdb id', () => {
    expect(mediaRatingTargetId('movie', '157336')).toBe('movie:157336');
    expect(MEDIA_TARGET_PATTERN.test('movie:157336')).toBe(true);
    expect(MEDIA_TARGET_PATTERN.test('tv:1396')).toBe(true);
    expect(MEDIA_TARGET_PATTERN.test('157336')).toBe(false);
  });

  test('quote thumbs accept 1/-1 and up/down aliases', () => {
    expect(normalizeQuoteRatingValue('up')).toBe(1);
    expect(normalizeQuoteRatingValue(1)).toBe(1);
    expect(normalizeQuoteRatingValue('down')).toBe(-1);
    expect(normalizeQuoteRatingValue(-1)).toBe(-1);
    expect(normalizeQuoteRatingValue(5)).toBeNull();
    expect(normalizeQuoteRatingValue('meh')).toBeNull();
  });

  test('media stars are integers from 1 to 5', () => {
    expect(normalizeMediaRatingValue(3)).toBe(3);
    expect(normalizeMediaRatingValue('5')).toBe(5);
    expect(normalizeMediaRatingValue(0)).toBeNull();
    expect(normalizeMediaRatingValue(6)).toBeNull();
    expect(normalizeMediaRatingValue(2.5)).toBeNull();
    expect(normalizeMediaRatingValue(-1)).toBeNull();
  });

  test('normalizeRatingValue dispatches by target type', () => {
    expect(normalizeRatingValue('quote', 'up')).toBe(1);
    expect(normalizeRatingValue('media', 4)).toBe(4);
    expect(normalizeRatingValue('quote', 4)).toBeNull();
    expect(normalizeRatingValue('media', 1)).toBe(1);
    expect(normalizeRatingValue('other', 1)).toBeNull();
  });

  test('toggleRatingValue clears when the same control is clicked again', () => {
    expect(toggleRatingValue(1, 1)).toBeNull();
    expect(toggleRatingValue(1, -1)).toBe(-1);
    expect(toggleRatingValue(4, 4)).toBeNull();
    expect(toggleRatingValue(4, 5)).toBe(5);
    expect(toggleRatingValue(null, 3)).toBe(3);
  });

  test('ratingsByTargetId indexes saved values', () => {
    const map = ratingsByTargetId([
      { targetId: 'movie:1', value: 5 },
      { targetId: '1035', value: -1 },
    ]);

    expect(map.get('movie:1')).toBe(5);
    expect(map.get('1035')).toBe(-1);
  });
});
