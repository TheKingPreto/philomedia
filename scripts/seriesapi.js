const TMDB_API_KEY = "533ed5abff49d090b3b19005b04ccea7";
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function searchTMDB(query) {
  if (!query) return [];
  const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error fetching TMDB search');
  const data = await response.json();
  return data.results;
}

export async function getDetailsFromTMDB(id, type) {
  if (!id || !type || (type !== 'movie' && type !== 'tv')) {
    throw new Error('Invalid parameters for getting details');
  }
  const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch details from TMDB');
  return response.json();
}

export async function getReviewsFromTMDB(id, type) {
  if (!id || !type) return [];
  const url = `${TMDB_BASE_URL}/${type}/${id}/reviews?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
  const response = await fetch(url);
  if (!response.ok) {
    console.error('Failed to fetch reviews for', id);
    return [];
  }
  const data = await response.json();
  return data.results;
}

export async function discoverDiverseWorks() {
  const randomPage = Math.floor(Math.random() * 50) + 1;
  const movieUrl = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=vote_average.desc&vote_count.gte=150&page=${randomPage}`;
  const tvUrl = `${TMDB_BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&language=en-US&sort_by=vote_average.desc&vote_count.gte=150&page=${randomPage}`;

  try {
    const [movieResponse, tvResponse] = await Promise.all([fetch(movieUrl), fetch(tvUrl)]);
    if (!movieResponse.ok || !tvResponse.ok) {
        throw new Error('One of the discover API calls failed');
    }
    const movieData = await movieResponse.json();
    const tvData = await tvResponse.json();

    const movies = movieData.results.map(item => ({ ...item, media_type: 'movie' }));
    const tvShows = tvData.results.map(item => ({ ...item, media_type: 'tv' }));
    
    return [...movies, ...tvShows];
  } catch (error) {
    return [];
  }
}
