import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Lê a chave em tempo de requisição (dotenv já foi carregado pelo server.js)
function getApiKey() {
  return process.env.TMDB_API_KEY;
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
    res.json(data.results);
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

  const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${apiKey}&language=en-US`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB details error');
    const data = await response.json();
    res.json(data);
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
  const { media = 'movie', page = 1 } = req.query;
  try {
    const url = `${TMDB_BASE_URL}/discover/${media}?api_key=${apiKey}&language=en-US&sort_by=vote_average.desc&vote_count.gte=150&page=${encodeURIComponent(page)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB discover error');
    const data = await response.json();
    res.json(data.results.map(item => ({ ...item, media_type: media })));
  } catch (err) {
    console.error('TMDB proxy discover error:', err.message);
    res.status(502).json({ error: 'Failed to fetch discover results from TMDB' });
  }
});

export default router;
