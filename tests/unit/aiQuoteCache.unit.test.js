import {
  buildAiQuoteCacheKey,
  clearAiQuoteCache,
  getAiQuoteCacheSize,
  getCachedAiQuote,
  setCachedAiQuote,
} from '../../src/services/aiQuoteCache.js';

beforeEach(() => {
  clearAiQuoteCache();
});

describe('buildAiQuoteCacheKey', () => {
  test('separates media, locale and match mode', () => {
    const base = { tmdbId: '157336', mediaType: 'movie', locale: 'en' };

    expect(buildAiQuoteCacheKey(base)).toBe(buildAiQuoteCacheKey({ ...base }));
    expect(buildAiQuoteCacheKey(base)).not.toBe(
      buildAiQuoteCacheKey({ ...base, locale: 'pt' })
    );
    expect(buildAiQuoteCacheKey(base)).not.toBe(
      buildAiQuoteCacheKey({ ...base, mediaType: 'tv' })
    );
    expect(buildAiQuoteCacheKey(base)).not.toBe(
      buildAiQuoteCacheKey({ ...base, suggestMatches: true })
    );
  });

  test('treats numeric and string tmdbId as the same media', () => {
    expect(buildAiQuoteCacheKey({ tmdbId: 157336, mediaType: 'movie', locale: 'en' }))
      .toBe(buildAiQuoteCacheKey({ tmdbId: '157336', mediaType: 'movie', locale: 'en' }));
  });
});

describe('cache behaviour', () => {
  test('returns the stored value on a second read', () => {
    setCachedAiQuote('k', { quoteText: 'A' });
    expect(getCachedAiQuote('k')).toEqual({ quoteText: 'A' });
  });

  test('returns null for an unknown key', () => {
    expect(getCachedAiQuote('missing')).toBeNull();
  });

  test('expires entries after the TTL', () => {
    const now = 1_000_000;
    setCachedAiQuote('k', { quoteText: 'A' }, { ttlMs: 1000, now });

    expect(getCachedAiQuote('k', { now: now + 999 })).not.toBeNull();
    expect(getCachedAiQuote('k', { now: now + 1001 })).toBeNull();
    expect(getAiQuoteCacheSize()).toBe(0);
  });

  test('evicts the oldest entry once the cap is reached', () => {
    for (let i = 0; i < 520; i += 1) {
      setCachedAiQuote(`k${i}`, { quoteText: String(i) });
    }

    expect(getAiQuoteCacheSize()).toBeLessThanOrEqual(500);
    expect(getCachedAiQuote('k0')).toBeNull();
    expect(getCachedAiQuote('k519')).not.toBeNull();
  });

  test('a re-read refreshes recency so hot entries survive eviction', () => {
    setCachedAiQuote('hot', { quoteText: 'hot' });

    for (let i = 0; i < 499; i += 1) {
      setCachedAiQuote(`k${i}`, { quoteText: String(i) });
      getCachedAiQuote('hot');
    }
    setCachedAiQuote('overflow', { quoteText: 'overflow' });

    expect(getCachedAiQuote('hot')).not.toBeNull();
  });
});
