/**
 * @file Client-side cache for theme-lens TMDB discovery pools (per lens id).
 */

const lensDiscoveryCache = new Map();

export function hasLensDiscoveryPool(lensId) {
  return lensDiscoveryCache.has(lensId);
}

export function getLensDiscoveryPool(lensId) {
  const pool = lensDiscoveryCache.get(lensId);
  if (!Array.isArray(pool)) return [];
  return pool.map(item => ({ ...item }));
}

export function setLensDiscoveryPool(lensId, items) {
  if (!lensId || !Array.isArray(items) || items.length === 0) return;
  lensDiscoveryCache.set(lensId, items.map(item => ({ ...item })));
}

export function refreshLensDiscoveryPoolIfCached(lensId, items) {
  if (!lensId || !hasLensDiscoveryPool(lensId) || !Array.isArray(items)) return;
  lensDiscoveryCache.set(lensId, items.map(item => ({ ...item })));
}
