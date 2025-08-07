// scripts/seriesAPI.js

const proxy = "https://api.allorigins.win/raw?url=";
const apiKey = "SUA_CHAVE_TMDB"; // substitua pela sua chave TMDB
const baseURL = "https://api.themoviedb.org/3";

// Função genérica para buscar na TMDB
async function fetchFromTMDB(endpoint) {
  const url = `${baseURL}${endpoint}&api_key=${apiKey}&language=en-US`;
  try {
    const response = await fetch(proxy + encodeURIComponent(url));
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("TMDB API Error:", error);
    return null;
  }
}

// 🔍 Buscar por nome (pode ser filme, série ou anime)
export async function searchMulti(query) {
  return await fetchFromTMDB(`/search/multi?query=${encodeURIComponent(query)}`);
}

// 🎬 Filmes populares
export async function getPopularMovies() {
  return await fetchFromTMDB(`/movie/popular?page=1`);
}

// 📺 Séries populares
export async function getPopularTV() {
  return await fetchFromTMDB(`/tv/popular?page=1`);
}

// 🎌 Animes populares (TMDB marca como "Animation" + filtro japonês)
export async function getPopularAnime() {
  return await fetchFromTMDB(`/discover/tv?with_genres=16&with_original_language=ja&page=1`);
}

// 📄 Detalhes de um item
export async function getDetails(id, type) {
  // type = "movie" ou "tv"
  return await fetchFromTMDB(`/${type}/${id}?append_to_response=videos,images`);
}
