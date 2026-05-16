import { getDetailsFromTMDB } from '/scripts/seriesapi.js';
import { getUiLocale, normalizeUiLocale } from '/scripts/services/uiLocale.js';

const overviewCache = new Map();

function getMediaType(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  if (item.mediaType === 'movie' || item.mediaType === 'tv') return item.mediaType;
  if (item.title) return 'movie';
  if (item.name) return 'tv';
  return null;
}

async function fetchPortugueseOverview(item) {
  const mediaType = getMediaType(item);
  const id = item.id ?? item.tmdbId;
  if (!mediaType || id == null) return '';

  const cacheKey = `${mediaType}:${id}`;
  if (overviewCache.has(cacheKey)) {
    return overviewCache.get(cacheKey);
  }

  try {
    const details = await getDetailsFromTMDB(id, mediaType);
    const overview = String(details?.overview || '').trim();
    overviewCache.set(cacheKey, overview);
    return overview;
  } catch {
    overviewCache.set(cacheKey, '');
    return '';
  }
}

/**
 * Mantém o pool de obras do catálogo EN, mas substitui sinopses visíveis em PT-BR.
 */
export async function localizeItemOverviews(items, locale = getUiLocale()) {
  if (normalizeUiLocale(locale) !== 'pt' || !Array.isArray(items) || !items.length) {
    return items;
  }

  return Promise.all(items.map(async (item) => {
    const overview = await fetchPortugueseOverview(item);
    return overview ? { ...item, overview } : item;
  }));
}
