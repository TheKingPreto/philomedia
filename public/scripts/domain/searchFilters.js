/**
 * IDs oficiais do vocabulário de keywords do TMDB, conferidos via
 * GET /search/keyword. `with_keywords` no discover usa `|` (OR).
 */
import { LENS_CATALOG, LENS_CREW_DIRECTORS } from './lensCatalog.js';

export { LENS_CREW_DIRECTORS } from './lensCatalog.js';

export function getLensKeywordQuery(lens) {
  const ids = (lens?.tmdbKeywords || [])
    .map(item => Number(item?.id))
    .filter(id => Number.isInteger(id) && id > 0);
  return ids.join('|');
}

export function getLensExcludeKeywordQuery(lens) {
  const ids = (lens?.tmdbExcludeKeywords || [])
    .map(item => Number(item?.id))
    .filter(id => Number.isInteger(id) && id > 0);
  return ids.join('|');
}

/** Termos para scoring de texto: keywords livres + nomes canônicos do TMDB. */
export function getLensTextKeywords(lens) {
  const named = (lens?.tmdbKeywords || []).map(item => item?.name).filter(Boolean);
  return [...new Set([...(lens?.keywords || []), ...named])];
}

export function getLensCrewQuery(lens) {
  const lensId = lens?.id;
  if (!lensId) return '';
  const ids = LENS_CREW_DIRECTORS
    .filter(director => Array.isArray(director.lenses) && director.lenses.includes(lensId))
    .map(director => Number(director.id))
    .filter(id => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].join('|');
}

function normalizeKeywordToken(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Keywords TMDB já appendadas no details (`tmdbKeywords`) ou no payload cru.
 * Discover da 1ª leva em geral não traz isso; o ranking só usa o campo quando existe.
 */
export function extractItemTmdbKeywords(item) {
  if (!item || typeof item !== 'object') return [];

  if (Array.isArray(item.tmdbKeywords) && item.tmdbKeywords.length) {
    return item.tmdbKeywords
      .map(entry => ({
        id: Number(entry?.id) || 0,
        name: String(entry?.name || '').trim(),
      }))
      .filter(entry => entry.id > 0 || entry.name);
  }

  const payload = item.keywords;
  const list = Array.isArray(payload?.keywords)
    ? payload.keywords
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload)
        ? payload
        : [];

  return list
    .map(entry => ({
      id: Number(typeof entry === 'object' ? entry?.id : 0) || 0,
      name: String(typeof entry === 'string' ? entry : (entry?.name || '')).trim(),
    }))
    .filter(entry => entry.id > 0 || entry.name);
}

export function itemHasLensKeywordHit(item, lens) {
  const itemKeywords = extractItemTmdbKeywords(item);
  if (!itemKeywords.length || !lens) return false;

  const lensIds = new Set(
    (lens.tmdbKeywords || [])
      .map(entry => Number(entry?.id))
      .filter(id => Number.isInteger(id) && id > 0)
  );
  const lensNames = new Set(getLensTextKeywords(lens).map(normalizeKeywordToken).filter(Boolean));

  return itemKeywords.some((entry) => {
    if (entry.id && lensIds.has(entry.id)) return true;
    const name = normalizeKeywordToken(entry.name);
    return Boolean(name) && lensNames.has(name);
  });
}

/**
 * Opções de /discover para uma lente. Sem gêneros: o pool já vem
 * tematicamente pré-filtrado pela curadoria do TMDB.
 */
export function buildLensKeywordDiscoverOptions(lens, extras = {}) {
  const options = { ...extras };
  const withKeywords = getLensKeywordQuery(lens);
  if (withKeywords) options.withKeywords = withKeywords;
  const withoutKeywords = getLensExcludeKeywordQuery(lens);
  if (withoutKeywords) options.withoutKeywords = withoutKeywords;
  return options;
}

/**
 * 2ª leva de discover: `with_crew` reforça a lente, não substitui keywords.
 * TMDB ANDa parâmetros no mesmo request — por isso crew vai numa leva à parte.
 */
export function buildLensCrewDiscoverOptions(lens, extras = {}) {
  const options = { ...extras };
  const withCrew = getLensCrewQuery(lens);
  if (withCrew) options.withCrew = withCrew;
  const withoutKeywords = getLensExcludeKeywordQuery(lens);
  if (withoutKeywords) options.withoutKeywords = withoutKeywords;
  return options;
}

export function buildLensGenreDiscoverOptions(lens, mediaType, extras = {}) {
  const genres = mediaType === 'tv' ? lens?.tvGenres : lens?.movieGenres;
  const options = { ...extras };
  if (Array.isArray(genres) && genres.length) {
    options.withGenres = genres.join('|');
  }
  const withoutKeywords = getLensExcludeKeywordQuery(lens);
  if (withoutKeywords) options.withoutKeywords = withoutKeywords;
  return options;
}

/** Philosophical lens presets for the search page (themes, keywords, TMDB genre hints). */
export const LENS_FILTERS = LENS_CATALOG;

export const MEDIA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

export const RATING_FILTERS = [
  { id: 'any', label: 'Any rating', min: 0 },
  { id: '7plus', label: '7+ TMDB', min: 7 },
  { id: '8plus', label: '8+ TMDB', min: 8 },
];

export const SORT_FILTERS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'recent', label: 'Newest' },
  { id: 'popularity', label: 'Most popular' },
];

/** Região padrão alinhada ao app (`TMDB_WATCH_REGION=BR`). */
export const DEFAULT_WATCH_REGION = 'BR';

/** Conjunto curto curado para o Brasil. `any` = sem filtro de provedor. */
export const WATCH_PROVIDER_FILTERS = [
  { id: 'any', label: 'Any service', providerId: null },
  { id: 'netflix', label: 'Netflix', providerId: 8 },
  { id: 'prime', label: 'Prime Video', providerId: 119 },
  { id: 'disney', label: 'Disney+', providerId: 337 },
  { id: 'max', label: 'Max', providerId: 1899 },
  { id: 'globoplay', label: 'Globoplay', providerId: 307 },
  { id: 'paramount', label: 'Paramount+', providerId: 531 },
  { id: 'appletv', label: 'Apple TV', providerId: 350 },
];

export function getWatchProviderFilterById(providerId) {
  return WATCH_PROVIDER_FILTERS.find(filter => filter.id === providerId) || WATCH_PROVIDER_FILTERS[0];
}

export function buildWatchProviderDiscoverExtras(providerFilterId, extras = {}) {
  const provider = getWatchProviderFilterById(providerFilterId);
  if (!provider?.providerId) return { ...extras };
  return {
    ...extras,
    withWatchProviders: String(provider.providerId),
    watchRegion: extras.watchRegion || DEFAULT_WATCH_REGION,
    watchMonetizationTypes: extras.watchMonetizationTypes || 'flatrate',
  };
}

export function getLensById(lensId) {
  return LENS_FILTERS.find(lens => lens.id === lensId) || null;
}

export function getRatingFilterById(ratingId) {
  return RATING_FILTERS.find(filter => filter.id === ratingId) || RATING_FILTERS[0];
}

/** Short set shown by default on the search page; the rest sit behind “see all”. */
export const FEATURED_LENS_IDS = Object.freeze([
  'epistemology',
  'power-corruption',
  'alienation',
  'consciousness-ai',
  'freedom-choice',
]);

export function isFeaturedLensId(lensId) {
  return FEATURED_LENS_IDS.includes(lensId);
}

export function isLensChipVisible(lensId, { expanded = false, activeLensId = 'all' } = {}) {
  if (expanded || isFeaturedLensId(lensId)) return true;
  return Boolean(lensId) && lensId !== 'all' && lensId === activeLensId;
}

export function partitionLensFilters(lenses = LENS_FILTERS) {
  const featured = FEATURED_LENS_IDS
    .map(id => lenses.find(lens => lens.id === id))
    .filter(Boolean);
  const rest = lenses.filter(lens => !FEATURED_LENS_IDS.includes(lens.id));
  return { featured, rest };
}

function withQueryParam(search, key, value, emptyValues = ['all', '']) {
  const raw = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(raw);

  if (value && !emptyValues.includes(value)) {
    params.set(key, value);
  } else {
    params.delete(key);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Write or drop `lens` while preserving every other query param.
 * @param {string} search `location.search` (`?a=1&lens=x` or `a=1`)
 * @param {string} lensId lens id, or `'all'` / `''` to remove
 */
export function withLensQueryParam(search, lensId) {
  return withQueryParam(search, 'lens', lensId);
}

export function withProviderQueryParam(search, providerId) {
  return withQueryParam(search, 'provider', providerId, ['any', 'all', '']);
}
