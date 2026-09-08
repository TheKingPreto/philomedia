import { getDetailsFromTMDB } from '/scripts/seriesapi.js';
import { getUiLocale, normalizeUiLocale } from '/scripts/services/uiLocale.js';

const overviewCache = new Map();

const PORTUGUESE_MARKERS = [
  ' não ', ' voce ', ' você ', ' para ', ' porque ', ' quando ',
  ' uma ', ' umas ', ' está ', ' esse ', ' essa ', 'ção', 'ões',
];

function getMediaType(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  if (item.mediaType === 'movie' || item.mediaType === 'tv') return item.mediaType;
  if (item.title) return 'movie';
  if (item.name) return 'tv';
  return null;
}

function looksPortuguese(text) {
  const value = ` ${String(text || '').toLowerCase()} `;
  return PORTUGUESE_MARKERS.some(marker => value.includes(marker));
}

function itemAlreadyLocalized(item, locale) {
  if (!item?.overview) return false;
  if (item._overviewLocale === locale) return true;
  if (locale === 'pt' && looksPortuguese(item.overview)) return true;
  return false;
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
 * Não refetch se o item já veio com overview no locale (append/details/discover PT).
 */
export async function localizeItemOverviews(items, locale = getUiLocale()) {
  const loc = normalizeUiLocale(locale);
  if (loc !== 'pt' || !Array.isArray(items) || !items.length) {
    return items;
  }

  return Promise.all(items.map(async (item) => {
    if (itemAlreadyLocalized(item, 'pt')) {
      return item._overviewLocale ? item : { ...item, _overviewLocale: 'pt' };
    }

    const overview = await fetchPortugueseOverview(item);
    return overview ? { ...item, overview, _overviewLocale: 'pt' } : item;
  }));
}
