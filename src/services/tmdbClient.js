/**
 * Cliente TMDB para uso interno no backend (detalhes, reviews, discover).
 * Usa TMDB_API_KEY do ambiente. Não depende das rotas HTTP.
 */
import fetch from 'node-fetch';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is not set. Add it to your .env file.');
  }
  return key;
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
  const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${getApiKey()}&language=en-US&append_to_response=credits`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB details error: ${response.status}`);
  }
  return response.json();
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

/**
 * Lista obras para sugestão de matches (discover).
 * @param {string} media - 'movie' ou 'tv'
 * @param {number} page
 * @returns {Promise<Array<{ id: number, title?: string, name?: string, overview?: string, media_type: string }>>}
 */
export async function getDiscover(media = 'movie', page = 1) {
  const url = `${TMDB_BASE_URL}/discover/${media}?api_key=${getApiKey()}&language=en-US&sort_by=vote_average.desc&vote_count.gte=150&page=${page}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  const results = (data.results || []).map((item) => ({
    id: item.id,
    title: item.title ?? item.name,
    name: item.name ?? item.title,
    overview: item.overview || '',
    media_type: media,
    poster_path: item.poster_path || null,
  }));
  return results;
}
