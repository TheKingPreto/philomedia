import fetch from 'node-fetch';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_WATCH_REGION = process.env.TMDB_WATCH_REGION || 'BR';
const VALID_MEDIA_TYPES = new Set(['movie', 'tv']);
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_RETRIES = 2;
const RESPONSE_CACHE_TTL_MS = 15 * 60 * 1000;
const RESPONSE_CACHE_MAX = 400;

const responseCache = new Map();

export class TmdbHttpError extends Error {
  constructor(status, message, { timeout = false } = {}) {
    super(message || (timeout
      ? 'TMDB request timed out.'
      : `TMDB request failed with status ${status}.`));
    this.name = 'TmdbHttpError';
    this.status = status;
    this.code = timeout
      ? 'tmdb_timeout'
      : (status === 429 ? 'tmdb_rate_limited' : 'tmdb_http_error');
  }
}

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is not set.');
  }

  return key;
}

function buildTMDBUrl(path, params = {}, { includeLanguage = true, language = DEFAULT_LANGUAGE } = {}) {
  const searchParams = new URLSearchParams({
    api_key: getApiKey(),
    ...params,
  });

  if (includeLanguage && !searchParams.has('language')) {
    searchParams.set('language', language || DEFAULT_LANGUAGE);
  }

  return `${TMDB_BASE_URL}${path}?${searchParams.toString()}`;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function retryDelayMs(response, attempt) {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(400 * 2 ** attempt, 2000);
}

function cacheKey(path, params, options) {
  return JSON.stringify({
    path,
    params,
    language: options.includeLanguage === false ? '' : (options.language || DEFAULT_LANGUAGE),
  });
}

function getCachedResponse(key) {
  const entry = responseCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value;
}

function setCachedResponse(key, value) {
  if (responseCache.size >= RESPONSE_CACHE_MAX && !responseCache.has(key)) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey !== undefined) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { value, expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS });
}

export function clearTmdbResponseCache() {
  responseCache.clear();
}

export function getTmdbResponseCacheSize() {
  return responseCache.size;
}

async function fetchTMDBResponse(path, params, options) {
  const url = buildTMDBUrl(path, params, {
    includeLanguage: options.includeLanguage !== false,
    language: options.language || DEFAULT_LANGUAGE,
  });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;

    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (error) {
      clearTimeout(timer);
      if (error?.name === 'AbortError') {
        throw new TmdbHttpError(504, 'TMDB request timed out.', { timeout: true });
      }
      throw error;
    }
    clearTimeout(timer);

    if (response.status === 429 && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(response, attempt));
      continue;
    }

    return response;
  }

  throw new TmdbHttpError(429);
}

async function fetchTMDBJson(path, params = {}, options = {}) {
  const key = cacheKey(path, params, options);
  const cached = getCachedResponse(key);
  if (cached !== undefined) return cached;

  const response = await fetchTMDBResponse(path, params, options);
  if (!response.ok) {
    throw new TmdbHttpError(response.status);
  }

  const data = await response.json();
  setCachedResponse(key, data);
  return data;
}

async function fetchOptionalTMDBJson(path, params = {}, options = {}) {
  const key = cacheKey(path, params, options);
  const cached = getCachedResponse(key);
  if (cached !== undefined) return cached;

  try {
    const response = await fetchTMDBResponse(path, params, options);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn('[PhiloMedia] TMDB rate limit after retries:', path);
      }
      return null;
    }

    const data = await response.json();
    setCachedResponse(key, data);
    return data;
  } catch (error) {
    if (error?.code === 'tmdb_timeout') {
      console.warn('[PhiloMedia] TMDB timeout:', path);
      return null;
    }
    throw error;
  }
}

function extractWatchProviders(payload, region = DEFAULT_WATCH_REGION) {
  const regionData = payload?.results?.[region];
  if (!regionData) return null;

  const providers =
    regionData.flatrate
    || regionData.free
    || regionData.ads
    || [];

  if (!Array.isArray(providers) || providers.length === 0) {
    return null;
  }

  return {
    region,
    link: regionData.link || '',
    providers: providers.map(provider => ({
      provider_id: provider.provider_id,
      provider_name: provider.provider_name,
      logo_path: provider.logo_path || null,
    })),
  };
}

/**
 * Movie: `{ keywords: { keywords: [...] } }`.
 * TV:    `{ keywords: { results: [...] } }`.
 */
export function extractTmdbKeywords(details) {
  if (Array.isArray(details?.tmdbKeywords) && details.tmdbKeywords.length) {
    return details.tmdbKeywords
      .map(item => ({ id: item.id, name: String(item.name || '').trim() }))
      .filter(item => item.id && item.name);
  }

  const payload = details?.keywords;
  const list = Array.isArray(payload?.keywords)
    ? payload.keywords
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload)
        ? payload
        : [];

  return list
    .map(item => ({
      id: item?.id,
      name: String(item?.name || '').trim(),
    }))
    .filter(item => item.id && item.name);
}

function mapMediaSummary(item, mediaType, { language = DEFAULT_LANGUAGE } = {}) {
  const overviewLocale = String(language || DEFAULT_LANGUAGE).toLowerCase().startsWith('pt')
    ? 'pt'
    : 'en';
  return {
    id: item.id,
    title: item.title ?? item.name,
    name: item.name ?? item.title,
    overview: item.overview || '',
    media_type: mediaType,
    poster_path: item.poster_path || null,
    release_date: item.release_date || null,
    first_air_date: item.first_air_date || null,
    vote_average: item.vote_average || 0,
    vote_count: item.vote_count || 0,
    popularity: item.popularity || 0,
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    original_language: item.original_language || '',
    origin_country: Array.isArray(item.origin_country) ? item.origin_country : [],
    _overviewLocale: overviewLocale,
    ...(overviewLocale === 'en' ? { _overviewEn: item.overview || '' } : {}),
  };
}

function isPortugueseLanguage(language) {
  return String(language || '').toLowerCase().startsWith('pt');
}

function mergeEnglishOverviews(displayItems, englishItems) {
  const byId = new Map((englishItems || []).map(item => [String(item.id), item]));
  return (displayItems || []).map(item => {
    const english = byId.get(String(item.id));
    const overviewEn = english?.overview || item._overviewEn || '';
    return overviewEn ? { ...item, _overviewEn: overviewEn } : item;
  });
}

export function mapTmdbReviews(results = []) {
  return (Array.isArray(results) ? results : []).map(review => ({
    content: review?.content || '',
    iso_639_1: review?.iso_639_1 || '',
    language: review?.iso_639_1 || review?.language || '',
  })).filter(review => review.content);
}

function mapAppendedSummaries(payload, mediaType, language, limit) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results.slice(0, limit).map(item => mapMediaSummary(item, mediaType, { language }));
}

/**
 * Lista de IDs TMDB para with_keywords / without_keywords / with_genres.
 * Só dígitos; `|` = OR, `,` = AND. Qualquer outro caractere cai fora.
 */
export function sanitizeTmdbIdList(raw, { maxIds = 20 } = {}) {
  if (raw == null) return undefined;
  const source = String(raw).trim();
  if (!source) return undefined;

  const ids = source
    .split(/[,|]/)
    .map((part) => {
      const match = part.trim().match(/^(\d{1,10})/);
      return match ? match[1] : null;
    })
    .filter(Boolean)
    .slice(0, maxIds);

  if (!ids.length) return undefined;
  return ids.join(source.includes('|') ? '|' : ',');
}

function assertValidMediaType(type) {
  if (!VALID_MEDIA_TYPES.has(type)) {
    throw new Error('Invalid media type. Use "movie" or "tv".');
  }
}

export async function searchMulti(query, { language = DEFAULT_LANGUAGE, page = 1 } = {}) {
  if (!query) return [];

  const data = await fetchTMDBJson('/search/multi', {
    query,
    page: String(page || 1),
    include_adult: 'false',
  }, { language });

  const overviewLocale = String(language || DEFAULT_LANGUAGE).toLowerCase().startsWith('pt')
    ? 'pt'
    : 'en';

  const results = Array.isArray(data.results)
    ? data.results
      .filter(item => VALID_MEDIA_TYPES.has(item.media_type))
      .map(item => ({
        ...item,
        _overviewLocale: overviewLocale,
        ...(overviewLocale === 'en' ? { _overviewEn: item.overview || '' } : {}),
      }))
    : [];

  if (overviewLocale === 'pt' && results.length) {
    const englishData = await fetchTMDBJson('/search/multi', {
      query,
      page: String(page || 1),
      include_adult: 'false',
    }, { language: DEFAULT_LANGUAGE });
    const englishResults = Array.isArray(englishData.results) ? englishData.results : [];
    return {
      results: mergeEnglishOverviews(results, englishResults),
      page: Number(data.page) || Number(page) || 1,
      totalPages: Number(data.total_pages) || 1,
    };
  }

  return {
    results,
    page: Number(data.page) || Number(page) || 1,
    totalPages: Number(data.total_pages) || 1,
  };
}

const DETAILS_APPEND = 'credits,keywords,reviews,similar,recommendations';

export async function getDetails(id, type, { language = DEFAULT_LANGUAGE } = {}) {
  if (!id) {
    throw new Error('Missing TMDB id.');
  }

  assertValidMediaType(type);

  const [details, watchProvidersPayload] = await Promise.all([
    fetchTMDBJson(`/${type}/${id}`, { append_to_response: DETAILS_APPEND }, { language }),
    fetchOptionalTMDBJson(`/${type}/${id}/watch/providers`, {}, { includeLanguage: false, language }),
  ]);

  return {
    ...details,
    tmdbKeywords: extractTmdbKeywords(details),
    tmdbReviews: mapTmdbReviews(details?.reviews?.results),
    similar: mapAppendedSummaries(details?.similar, type, language, 8),
    recommendations: mapAppendedSummaries(details?.recommendations, type, language, 12),
    watchProviders: watchProvidersPayload
      ? extractWatchProviders(watchProvidersPayload)
      : null,
  };
}

export async function getReviews(id, type, { language } = {}) {
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return [];
  }

  if (language) {
    const localized = await fetchOptionalTMDBJson(`/${type}/${id}/reviews`, { page: '1' }, { language });
    const localizedReviews = mapTmdbReviews(localized?.results);
    if (localizedReviews.length) return localizedReviews;
  }

  const data = await fetchOptionalTMDBJson(`/${type}/${id}/reviews`, { page: '1' }, { includeLanguage: false });
  if (!data) return [];
  return mapTmdbReviews(data.results);
}

export async function getSimilar(id, type, { language = DEFAULT_LANGUAGE } = {}) {
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return [];
  }

  const data = await fetchOptionalTMDBJson(`/${type}/${id}/similar`, { page: '1' }, { language });
  return Array.isArray(data?.results)
    ? data.results.slice(0, 8).map(item => mapMediaSummary(item, type, { language }))
    : [];
}

export async function getRecommendations(id, type, { language = DEFAULT_LANGUAGE } = {}) {
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return [];
  }

  const data = await fetchOptionalTMDBJson(`/${type}/${id}/recommendations`, { page: '1' }, { language });
  return Array.isArray(data?.results)
    ? data.results.slice(0, 12).map(item => mapMediaSummary(item, type, { language }))
    : [];
}

export async function getDiscover(media = 'movie', page = 1, options = {}) {
  const language = options.language || DEFAULT_LANGUAGE;
  const withGenres = sanitizeTmdbIdList(options.withGenres);
  const withKeywords = sanitizeTmdbIdList(options.withKeywords);
  const withoutKeywords = sanitizeTmdbIdList(options.withoutKeywords);
  const withWatchProviders = sanitizeTmdbIdList(options.withWatchProviders);
  const withCrew = sanitizeTmdbIdList(options.withCrew);
  const watchRegion = String(options.watchRegion || (withWatchProviders ? DEFAULT_WATCH_REGION : '')).trim();
  const watchMonetizationTypes = String(options.watchMonetizationTypes || '').trim();

  const discoverParams = {
    sort_by: options.sortBy || 'vote_average.desc',
    'vote_count.gte': String(options.voteCountGte || 120),
    page: String(page),
    ...(withGenres ? { with_genres: withGenres } : {}),
    ...(withKeywords ? { with_keywords: withKeywords } : {}),
    ...(withoutKeywords ? { without_keywords: withoutKeywords } : {}),
    ...(withWatchProviders ? { with_watch_providers: withWatchProviders } : {}),
    ...(withWatchProviders && watchRegion ? { watch_region: watchRegion } : {}),
    ...(withWatchProviders && watchMonetizationTypes
      ? { watch_monetization_types: watchMonetizationTypes }
      : {}),
    ...(withCrew ? { with_crew: withCrew } : {}),
    ...(options.withOriginalLanguage ? { with_original_language: options.withOriginalLanguage } : {}),
  };

  const data = await fetchOptionalTMDBJson(`/discover/${media}`, discoverParams, { language });
  const items = Array.isArray(data?.results)
    ? data.results.map(item => mapMediaSummary(item, media, { language }))
    : [];

  if (!isPortugueseLanguage(language) || !items.length) return items;

  const englishData = await fetchOptionalTMDBJson(`/discover/${media}`, discoverParams, {
    language: DEFAULT_LANGUAGE,
  });
  const englishItems = Array.isArray(englishData?.results)
    ? englishData.results.map(item => mapMediaSummary(item, media, { language: DEFAULT_LANGUAGE }))
    : [];
  return mergeEnglishOverviews(items, englishItems);
}

export async function getTrending(media = 'movie', window = 'week', { language = DEFAULT_LANGUAGE } = {}) {
  assertValidMediaType(media);
  const timeWindow = window === 'day' ? 'day' : 'week';
  const data = await fetchOptionalTMDBJson(`/trending/${media}/${timeWindow}`, {}, { language });
  const items = Array.isArray(data?.results)
    ? data.results.map(item => mapMediaSummary(item, media, { language }))
    : [];

  if (!isPortugueseLanguage(language) || !items.length) return items;

  const englishData = await fetchOptionalTMDBJson(`/trending/${media}/${timeWindow}`, {}, {
    language: DEFAULT_LANGUAGE,
  });
  const englishItems = Array.isArray(englishData?.results)
    ? englishData.results.map(item => mapMediaSummary(item, media, { language: DEFAULT_LANGUAGE }))
    : [];
  return mergeEnglishOverviews(items, englishItems);
}
