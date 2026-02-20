import express from 'express';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

// Load .env except during tests to avoid dotenv tips in test output
if (process.env.NODE_ENV !== 'test') {
  dotenv.config();
}

const router = express.Router();
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

if (!TMDB_API_KEY) {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('TMDB_API_KEY is not set. TMDB proxy endpoints will fail.');
  }
}

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  const url = `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(query)}&page=1&include_adult=false`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB search error');
    const data = await response.json();
    res.json(data.results);
  } catch (err) {
    console.error('TMDB proxy search error:', err.message);
    res.status(502).json({ message: 'Failed to fetch from TMDB' });
  }
});

router.get('/details', async (req, res) => {
  const { id, type } = req.query;
  if (!id || !type) return res.status(400).json({ message: 'Missing id or type' });

  const url = `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=en-US`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB details error');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('TMDB proxy details error:', err.message);
    res.status(502).json({ message: 'Failed to fetch details from TMDB' });
  }
});

router.get('/reviews', async (req, res) => {
  const { id, type } = req.query;
  if (!id || !type) return res.json([]);

  const url = `${TMDB_BASE_URL}/${type}/${id}/reviews?api_key=${TMDB_API_KEY}&language=en-US&page=1`;
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
    res.json([]);
  }
});

router.get('/discover', async (req, res) => {
  const { media = 'movie', page = 1 } = req.query;
  try {
    const url = `${TMDB_BASE_URL}/discover/${media}?api_key=${TMDB_API_KEY}&language=en-US&sort_by=vote_average.desc&vote_count.gte=150&page=${encodeURIComponent(page)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('TMDB discover error');
    const data = await response.json();
    res.json(data.results.map(item => ({ ...item, media_type: media })));
  } catch (err) {
    console.error('TMDB proxy discover error:', err.message);
    res.status(502).json([]);
  }
});

export default router;
