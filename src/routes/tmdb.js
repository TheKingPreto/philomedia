import express from 'express';
import * as tmdbClient from '../services/tmdbClient.js';

const router = express.Router();
const VALID_MEDIA_TYPES = new Set(['movie', 'tv']);

function isConfiguredError(error) {
  return error?.message?.includes('TMDB_API_KEY');
}

function handleTMDBError(res, error, logLabel, clientMessage) {
  console.error(logLabel, error.message);

  if (isConfiguredError(error)) {
    return res.status(502).json({ error: 'TMDB API key not configured' });
  }

  return res.status(502).json({ error: clientMessage });
}

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  try {
    const results = await tmdbClient.searchMulti(String(query));
    res.json(results);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy search error:', 'Failed to fetch from TMDB');
  }
});

router.get('/details', async (req, res) => {
  const { id, type } = req.query;
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return res.status(400).json({ message: 'Missing id or type' });
  }

  try {
    const details = await tmdbClient.getDetails(String(id), String(type));
    res.json(details);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy details error:', 'Failed to fetch details from TMDB');
  }
});

router.get('/reviews', async (req, res) => {
  const { id, type } = req.query;
  if (!id || !type) return res.json([]);

  try {
    const reviews = await tmdbClient.getReviews(String(id), String(type));
    res.json(reviews);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy reviews error:', 'Failed to fetch reviews from TMDB');
  }
});

router.get('/discover', async (req, res) => {
  const {
    media = 'movie',
    page = 1,
    with_genres,
    with_original_language,
    sort_by = 'vote_average.desc',
  } = req.query;

  try {
    const results = await tmdbClient.getDiscover(String(media), page, {
      withGenres: with_genres ? String(with_genres) : undefined,
      withOriginalLanguage: with_original_language ? String(with_original_language) : undefined,
      sortBy: String(sort_by),
    });
    res.json(results);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy discover error:', 'Failed to fetch discover results from TMDB');
  }
});

router.get('/recommendations', async (req, res) => {
  const { id, type } = req.query;
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return res.status(400).json({ message: 'Missing or invalid id or type' });
  }

  try {
    const results = await tmdbClient.getRecommendations(String(id), String(type));
    res.json(results);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy recommendations error:', 'Failed to fetch recommendations from TMDB');
  }
});

router.get('/similar', async (req, res) => {
  const { id, type } = req.query;
  if (!id || !VALID_MEDIA_TYPES.has(type)) {
    return res.status(400).json({ message: 'Missing or invalid id or type' });
  }

  try {
    const results = await tmdbClient.getSimilar(String(id), String(type));
    res.json(results);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy similar error:', 'Failed to fetch similar results from TMDB');
  }
});

export default router;
