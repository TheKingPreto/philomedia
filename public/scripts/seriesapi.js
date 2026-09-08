import { getTmdbLanguage } from '/scripts/services/uiLocale.js';

const API_BASE = '/api/tmdb';

function withLanguage(params = new URLSearchParams()) {
  params.set('language', getTmdbLanguage());
  return params;
}

export async function searchTMDB(query, { page = 1, language } = {}) {
  if (!query) return [];
  const params = withLanguage(new URLSearchParams({ query, page: String(page || 1) }));
  if (language) params.set('language', language);
  const url = `${API_BASE}/search?${params.toString()}`;
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data && data.error) || (data && data.message) || 'Search unavailable';
    throw new Error(msg);
  }
  const results = Array.isArray(data) ? data : (data.results || []);
  results.totalPages = Number(data.total_pages) || Number(data.totalPages) || 0;
  results.page = Number(data.page) || Number(page) || 1;
  return results;
}

export async function getDetailsFromTMDB(id, type) {
  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    throw new Error('Invalid parameters for getting details');
  }
  const params = withLanguage(new URLSearchParams({
    id: String(id),
    type: String(type),
  }));
  const url = `${API_BASE}/details?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch details from TMDB');
  return response.json();
}

export async function getReviewsFromTMDB(id, type) {
  if (!id || !type) return [];
  const params = withLanguage(new URLSearchParams({ id: String(id), type: String(type) }));
  const url = `${API_BASE}/reviews?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch reviews for', id);
    return [];
  }
  return response.json();
}

export async function getSimilarFromTMDB(id, type) {
  if (!id || !type || (type !== 'movie' && type !== 'tv')) return [];
  const params = withLanguage(new URLSearchParams({ id: String(id), type: String(type) }));
  const url = `${API_BASE}/similar?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch similar works for', id);
    return [];
  }
  return response.json();
}

export async function getRecommendationsFromTMDB(id, type) {
  if (!id || !type || (type !== 'movie' && type !== 'tv')) return [];
  const params = withLanguage(new URLSearchParams({ id: String(id), type: String(type) }));
  const url = `${API_BASE}/recommendations?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch recommendations for', id);
    return [];
  }
  return response.json();
}

export async function discoverTMDB(media, options = {}) {
  if (!media || (media !== 'movie' && media !== 'tv')) return [];

  const params = withLanguage(new URLSearchParams({
    media,
    page: String(options.page || 1),
  }));

  if (options.withGenres) params.set('with_genres', options.withGenres);
  if (options.withKeywords) params.set('with_keywords', options.withKeywords);
  if (options.withoutKeywords) params.set('without_keywords', options.withoutKeywords);
  if (options.withWatchProviders) params.set('with_watch_providers', options.withWatchProviders);
  if (options.watchRegion) params.set('watch_region', options.watchRegion);
  if (options.watchMonetizationTypes) {
    params.set('watch_monetization_types', options.watchMonetizationTypes);
  }
  if (options.withCrew) params.set('with_crew', options.withCrew);
  if (options.withOriginalLanguage) {
    params.set('with_original_language', options.withOriginalLanguage);
  }
  if (options.sortBy) params.set('sort_by', options.sortBy);
  if (options.language) params.set('language', options.language);

  const response = await fetch(`${API_BASE}/discover?${params.toString()}`);
  if (!response.ok) {
    console.error('Failed to discover works for', media);
    return [];
  }

  return response.json();
}

export async function discoverDiverseWorks() {
  const randomPage = Math.floor(Math.random() * 50) + 1;
  try {
    const [movieData, tvData] = await Promise.all([
      fetch(`${API_BASE}/discover?media=movie&page=${randomPage}`),
      fetch(`${API_BASE}/discover?media=tv&page=${randomPage}`)
    ]);

    const movies = movieData.ok ? await movieData.json() : [];
    const tvShows = tvData.ok ? await tvData.json() : [];

    const moviesMapped = (movies || []).map(item => ({ ...item, media_type: 'movie' }));
    const tvMapped = (tvShows || []).map(item => ({ ...item, media_type: 'tv' }));

    return [...moviesMapped, ...tvMapped];
  } catch (error) {
    return [];
  }
}

export async function getTrendingFromTMDB(media, { window = 'week', language } = {}) {
  if (!media || (media !== 'movie' && media !== 'tv')) return [];
  const params = withLanguage(new URLSearchParams({
    media,
    window,
  }));
  if (language) params.set('language', language);
  const response = await fetch(`${API_BASE}/trending?${params.toString()}`);
  if (!response.ok) {
    console.error('Failed to fetch trending for', media);
    return [];
  }
  return response.json();
}
