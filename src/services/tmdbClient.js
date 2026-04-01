import fetch from 'node-fetch';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_LANGUAGE = 'en-US';
const DEFAULT_WATCH_REGION = process.env.TMDB_WATCH_REGION || 'BR';
const VALID_MEDIA_TYPES = new Set(['movie', 'tv']);

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is not set.');
  }

  return key;
}

function buildTMDBUrl(path, params = {}, { includeLanguage = true } = {}) {
  const searchParams = new URLSearchParams({
    api_key: getApiKey(),
    ...params,
  });

  if (includeLanguage && !searchParams.has('language')) {
    searchParams.set('language', DEFAULT_LANGUAGE);
  }

  return `${TMDB_BASE_URL}${path}?${searchParams.toString()}`;
}

async function fetchTMDBJson(path, params = {}, options = {}) {
  const response = await fetch(buildTMDBUrl(path, params, options));
  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}.`);
  }

  return response.json();
}

async function fetchOptionalTMDBJson(path, params = {}, options = {}) {
  const response = await fetch(buildTMDBUrl(path, params, options));
  if (!response.ok) {
    return null;
  }

  return response.json();
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

function mapMediaSummary(item, mediaType) {
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
  };
}

function assertValidMediaType(type) {
  if (!VALID_MEDIA_TYPES.has(type)) {
    throw new Error('Invalid media type. Use "movie" or "tv".');
  }
}

export async function searchMulti(query) {
  if (!query) return [];

  const data = await fetchTMDBJson('/search/multi', {
    query,
    page: '1',
    include_adult: 'false',
  });

  return Array.isArray(data.results)
    ? data.results.filter(item => VALID_MEDIA_TYPES.has(item.media_type))
    : [];
}

export async function getDetails(id, type) {
  if (!id) {
    throw new Error('Missing TMDB id.');
  }

  assertValidMediaType(type);

  const [details, watchProvidersPayload] = await Promise.all([
    fetchTMDBJson(`/${type}/${id}`, { append_to_response: 'credits' }),
    fetchOptionalTMDBJson(`/${type}/${id}/watch/providers`, {}, { includeLanguage: false }),
  ]);

  return {
    ...details,
    watchProviders: watchProvidersPayload
      ? extractWatchProviders(watchProvidersPayload)
      : null,
  };
}

export async function getReviews(id, type) {
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return [];
  }

  const data = await fetchOptionalTMDBJson(`/${type}/${id}/reviews`, { page: '1' });
  if (!data) return [];

  return (data.results || []).map(review => ({
    content: review.content || '',
  }));
}

export async function getSimilar(id, type) {
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return [];
  }

  const data = await fetchOptionalTMDBJson(`/${type}/${id}/similar`, { page: '1' });
  return Array.isArray(data?.results)
    ? data.results.slice(0, 8).map(item => mapMediaSummary(item, type))
    : [];
}

export async function getRecommendations(id, type) {
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return [];
  }

  const data = await fetchOptionalTMDBJson(`/${type}/${id}/recommendations`, { page: '1' });
  return Array.isArray(data?.results)
    ? data.results.slice(0, 12).map(item => mapMediaSummary(item, type))
    : [];
}

export async function getDiscover(media = 'movie', page = 1, options = {}) {
  const data = await fetchOptionalTMDBJson(`/discover/${media}`, {
    sort_by: options.sortBy || 'vote_average.desc',
    'vote_count.gte': String(options.voteCountGte || 120),
    page: String(page),
    ...(options.withGenres ? { with_genres: options.withGenres } : {}),
    ...(options.withOriginalLanguage ? { with_original_language: options.withOriginalLanguage } : {}),
  });

  return Array.isArray(data?.results)
    ? data.results.map(item => mapMediaSummary(item, media))
    : [];
}
