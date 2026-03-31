/**
 * Cliente TMDB para uso interno no backend (detalhes, reviews, discover).
 * Usa TMDB_API_KEY do ambiente. Não depende das rotas HTTP.
 */
import fetch from 'node-fetch';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_WATCH_REGION = process.env.TMDB_WATCH_REGION || 'BR';

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is not set. Add it to your .env file.');
  }
  return key;
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
    popularity: item.popularity || 0,
    genre_ids: Array.isArray(item.genre_ids) ? item.genre_ids : [],
    original_language: item.original_language || '',
    origin_country: Array.isArray(item.origin_country) ? item.origin_country : [],
  };
}

/**
 * Busca detalhes de um filme ou série.
 * @param {string} id - TMDB id
 * @param {string} type - 'movie' ou 'tv'
 * @returns {Promise<object>} - resposta da API TMDB (title/name, overview, credits, etc.)
 */
export async function getDetails(id, type) {
  if (!id || !type || !['movie', 'tv'].includes(type)) {
    throw new Error('Invalid id or type. Use type "movie" or "tv".');
  }
  const apiKey = getApiKey();
  const detailsUrl = `${TMDB_BASE_URL}/${type}/${id}?api_key=${apiKey}&language=en-US&append_to_response=credits`;
  const watchProvidersUrl = `${TMDB_BASE_URL}/${type}/${id}/watch/providers?api_key=${apiKey}`;
  const [detailsResponse, watchProvidersResponse] = await Promise.all([
    fetch(detailsUrl),
    fetch(watchProvidersUrl),
  ]);

  if (!detailsResponse.ok) {
    throw new Error(`TMDB details error: ${detailsResponse.status}`);
  }

  const details = await detailsResponse.json();
  const watchProviders = watchProvidersResponse.ok
    ? extractWatchProviders(await watchProvidersResponse.json())
    : null;

  return {
    ...details,
    watchProviders,
  };
}

/**
 * Busca reviews de um filme ou série.
 * @param {string} id - TMDB id
 * @param {string} type - 'movie' ou 'tv'
 * @returns {Promise<Array<{ content: string }>>} - lista de reviews (content)
 */
export async function getReviews(id, type) {
  if (!id || !type || !['movie', 'tv'].includes(type)) {
    return [];
  }
  const url = `${TMDB_BASE_URL}/${type}/${id}/reviews?api_key=${getApiKey()}&language=en-US&page=1`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results || []).map((r) => ({ content: r.content || '' }));
}

export async function getSimilar(id, type) {
  if (!id || !type || !['movie', 'tv'].includes(type)) {
    return [];
  }

  const url = `${TMDB_BASE_URL}/${type}/${id}/similar?api_key=${getApiKey()}&language=en-US&page=1`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data.results)
    ? data.results.slice(0, 8).map(item => mapMediaSummary(item, type))
    : [];
}

export async function getRecommendations(id, type) {
  if (!id || !type || !['movie', 'tv'].includes(type)) {
    return [];
  }

  const url = `${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${getApiKey()}&language=en-US&page=1`;
  const response = await fetch(url);
  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data.results)
    ? data.results.slice(0, 12).map(item => mapMediaSummary(item, type))
    : [];
}

/**
 * Lista obras para sugestão de matches (discover).
 * @param {string} media - 'movie' ou 'tv'
 * @param {number} page
 * @returns {Promise<Array<{ id: number, title?: string, name?: string, overview?: string, media_type: string }>>}
 */
export async function getDiscover(media = 'movie', page = 1, options = {}) {
  const params = new URLSearchParams({
    api_key: getApiKey(),
    language: 'en-US',
    sort_by: options.sortBy || 'vote_average.desc',
    'vote_count.gte': String(options.voteCountGte || 120),
    page: String(page),
  });

  if (options.withGenres) params.set('with_genres', options.withGenres);
  if (options.withOriginalLanguage) {
    params.set('with_original_language', options.withOriginalLanguage);
  }

  const url = `${TMDB_BASE_URL}/discover/${media}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return (data.results || []).map(item => mapMediaSummary(item, media));
}
