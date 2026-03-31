import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const DEFAULT_WATCH_REGION = process.env.TMDB_WATCH_REGION || 'BR';

// Lê a chave em tempo de requisição (dotenv já foi carregado pelo server.js)
function getApiKey() {
  return process.env.TMDB_API_KEY;
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

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  const apiKey = getApiKey();
  if (!apiKey) return res.status(502).json({ error: 'TMDB API key not configured' });

  const url = `${TMDB_BASE_URL}/search/multi?api_key=${apiKey}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB search error');
    const data = await response.json();
    const results = Array.isArray(data.results)
      ? data.results.filter(item => ['movie', 'tv'].includes(item.media_type))
      : [];
    res.json(results);
  } catch (err) {
    console.error('TMDB proxy search error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from TMDB' });
  }
});

router.get('/details', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(502).json({ error: 'TMDB API key not configured' });
  const { id, type } = req.query;
  if (!id || !type) return res.status(400).json({ message: 'Missing id or type' });

  const detailsUrl = `${TMDB_BASE_URL}/${type}/${id}?api_key=${apiKey}&language=en-US&append_to_response=credits`;
  const watchProvidersUrl = `${TMDB_BASE_URL}/${type}/${id}/watch/providers?api_key=${apiKey}`;
  try {
    const [detailsResponse, watchProvidersResponse] = await Promise.all([
      fetch(detailsUrl),
      fetch(watchProvidersUrl),
    ]);

    if (!detailsResponse.ok) throw new Error('TMDB details error');

    const details = await detailsResponse.json();
    const watchProviders = watchProvidersResponse.ok
      ? extractWatchProviders(await watchProvidersResponse.json())
      : null;

    res.json({
      ...details,
      watchProviders,
    });
  } catch (err) {
    console.error('TMDB proxy details error:', err.message);
    res.status(502).json({ error: 'Failed to fetch details from TMDB' });
  }
});

router.get('/reviews', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(502).json({ error: 'TMDB API key not configured' });
  const { id, type } = req.query;
  if (!id || !type) return res.json([]);

  const url = `${TMDB_BASE_URL}/${type}/${id}/reviews?api_key=${apiKey}&language=en-US&page=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('TMDB reviews non-ok response for', id);
      return res.json([]);
    }
    const data = await response.json();
    res.json(data.results || []);
  } catch (err) {
    console.error('TMDB proxy reviews error:', err.message);
    res.status(502).json({ error: 'Failed to fetch reviews from TMDB' });
  }
});

router.get('/discover', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(502).json({ error: 'TMDB API key not configured' });
  const {
    media = 'movie',
    page = 1,
    with_genres,
    with_original_language,
    sort_by = 'vote_average.desc',
  } = req.query;
  try {
    const params = new URLSearchParams({
      api_key: apiKey,
      language: 'en-US',
      sort_by: String(sort_by),
      'vote_count.gte': '120',
      page: String(page),
    });

    if (with_genres) params.set('with_genres', String(with_genres));
    if (with_original_language) {
      params.set('with_original_language', String(with_original_language));
    }

    const url = `${TMDB_BASE_URL}/discover/${media}?${params.toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB discover error');
    const data = await response.json();
    res.json((data.results || []).map(item => mapMediaSummary(item, media)));
  } catch (err) {
    console.error('TMDB proxy discover error:', err.message);
    res.status(502).json({ error: 'Failed to fetch discover results from TMDB' });
  }
});

router.get('/recommendations', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(502).json({ error: 'TMDB API key not configured' });
  const { id, type } = req.query;
  if (!id || !type || !['movie', 'tv'].includes(type)) {
    return res.status(400).json({ message: 'Missing or invalid id or type' });
  }

  const url = `${TMDB_BASE_URL}/${type}/${id}/recommendations?api_key=${apiKey}&language=en-US&page=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB recommendations error');
    const data = await response.json();
    const results = Array.isArray(data.results)
      ? data.results.slice(0, 12).map(item => mapMediaSummary(item, type))
      : [];
    res.json(results);
  } catch (err) {
    console.error('TMDB proxy recommendations error:', err.message);
    res.status(502).json({ error: 'Failed to fetch recommendations from TMDB' });
  }
});

router.get('/similar', async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) return res.status(502).json({ error: 'TMDB API key not configured' });
  const { id, type } = req.query;
  if (!id || !type || !['movie', 'tv'].includes(type)) {
    return res.status(400).json({ message: 'Missing or invalid id or type' });
  }

  const url = `${TMDB_BASE_URL}/${type}/${id}/similar?api_key=${apiKey}&language=en-US&page=1`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB similar error');
    const data = await response.json();
    const results = Array.isArray(data.results)
      ? data.results.slice(0, 8).map(item => mapMediaSummary(item, type))
      : [];
    res.json(results);
  } catch (err) {
    console.error('TMDB proxy similar error:', err.message);
    res.status(502).json({ error: 'Failed to fetch similar results from TMDB' });
  }
});

export default router;
