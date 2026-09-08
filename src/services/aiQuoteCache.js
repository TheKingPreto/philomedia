/**
 * @file aiQuoteCache.js
 * @description Cache em memória das leituras de IA por obra.
 *
 * O endpoint de media-context é público, porque a leitura de IA é mostrada a
 * visitantes anônimos. Sem cache, cada requisição repetida sobre o mesmo título
 * custava uma chamada ao Gemini, o que tornava trivial esgotar a cota. Com
 * cache, o custo passa a ser proporcional ao número de títulos distintos.
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;

const store = new Map();

export function buildAiQuoteCacheKey({ tmdbId, mediaType, locale, suggestMatches }) {
  return [tmdbId, mediaType, locale, suggestMatches ? 'matches' : 'plain']
    .map(String)
    .join('::');
}

export function getCachedAiQuote(key, { now = Date.now() } = {}) {
  const entry = store.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= now) {
    store.delete(key);
    return null;
  }

  // Reinsere para que a entrada mais antiga fique sempre no início do Map.
  store.delete(key);
  store.set(key, entry);

  return entry.value;
}

export function setCachedAiQuote(key, value, { ttlMs = DEFAULT_TTL_MS, now = Date.now() } = {}) {
  if (store.size >= MAX_ENTRIES && !store.has(key)) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }

  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function clearAiQuoteCache() {
  store.clear();
}

export function getAiQuoteCacheSize() {
  return store.size;
}
