import { TMDB_API_KEY } from './config.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

export async function searchTMDB(query) {
  if (!query) return [];
  const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Error fetching TMDB');
  const data = await response.json();
  return data.results;
}

export async function getDetailsFromTMDB(id, type) {
  if (!id || !type) throw new Error('Invalid parameters');
  let endpoint = '';
  if (type === 'movie') endpoint = 'movie';
  else if (type === 'tv') endpoint = 'tv';
  else throw new Error('Invalid media type');
  const url = `${TMDB_BASE_URL}/${endpoint}/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch details');
  return response.json();
}

