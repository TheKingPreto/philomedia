/**
 * Shared in-memory caches for TMDB discover/search (used by search + philosopher pages).
 */
import { discoverTMDB, searchTMDB } from '/scripts/seriesapi.js';

const discoverRequestCache = new Map();
const searchRequestCache = new Map();

export function buildTmdbRequestCacheKey(prefix, payload) {
  return `${prefix}:${JSON.stringify(payload)}`;
}

export async function discoverTMDBCached(media, options = {}) {
  const cacheKey = buildTmdbRequestCacheKey('discover', { media, ...options });

  if (!discoverRequestCache.has(cacheKey)) {
    discoverRequestCache.set(
      cacheKey,
      discoverTMDB(media, options).catch((error) => {
        discoverRequestCache.delete(cacheKey);
        throw error;
      }),
    );
  }

  const result = await discoverRequestCache.get(cacheKey);
  if (!Array.isArray(result) || result.length === 0) {
    discoverRequestCache.delete(cacheKey);
  }
  return Array.isArray(result) ? result : [];
}

export async function searchTMDBCached(query) {
  const trimmedQuery = String(query || '').trim();
  if (!trimmedQuery) return [];

  const cacheKey = buildTmdbRequestCacheKey('search', { query: trimmedQuery.toLowerCase() });

  if (!searchRequestCache.has(cacheKey)) {
    searchRequestCache.set(
      cacheKey,
      searchTMDB(trimmedQuery).catch((error) => {
        searchRequestCache.delete(cacheKey);
        throw error;
      }),
    );
  }

  const result = await searchRequestCache.get(cacheKey);
  return Array.isArray(result) ? result : [];
}
