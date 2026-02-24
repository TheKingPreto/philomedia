const API_BASE = '/api/tmdb';

export async function searchTMDB(query) {
  if (!query) return [];
  const url = `${API_BASE}/search?query=${encodeURIComponent(query)}`;
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = (data && data.error) || (data && data.message) || 'Search unavailable';
    throw new Error(msg);
  }
  return Array.isArray(data) ? data : (data.results || []);
}

export async function getDetailsFromTMDB(id, type) {
  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    throw new Error('Invalid parameters for getting details');
  }
  const url = `${API_BASE}/details?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch details from TMDB');
  return response.json();
}

export async function getReviewsFromTMDB(id, type) {
  if (!id || !type) return [];
  const url = `${API_BASE}/reviews?id=${encodeURIComponent(id)}&type=${encodeURIComponent(type)}`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch reviews for', id);
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
