import express from 'express';
import * as tmdbClient from '../services/tmdbClient.js';
import { postRankCandidates } from '../controllers/TmdbRankingController.js';

const router = express.Router();
const VALID_MEDIA_TYPES = new Set(['movie', 'tv']);

function resolveTmdbLanguage(req) {
  const raw = String(req.query.language || 'en-US').trim();
  return raw.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en-US';
}

function isConfiguredError(error) {
  return error?.message?.includes('TMDB_API_KEY');
}

function handleTMDBError(res, error, logLabel, clientMessage) {
  console.error(logLabel, error.message);

  if (isConfiguredError(error)) {
    return res.status(502).json({ error: 'TMDB API key not configured' });
  }

  if (error?.code === 'tmdb_rate_limited' || error?.status === 429) {
    return res.status(429).json({
      error: 'TMDB rate limit reached. Please try again shortly.',
      code: 'tmdb_rate_limited',
    });
  }

  if (error?.code === 'tmdb_timeout' || error?.status === 504) {
    return res.status(504).json({
      error: 'TMDB request timed out.',
      code: 'tmdb_timeout',
    });
  }

  if (error?.status === 404) {
    return res.status(404).json({ error: 'Not found on TMDB.' });
  }

  return res.status(502).json({ error: clientMessage });
}

router.get('/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.json([]);

  try {
    const results = await tmdbClient.searchMulti(String(query), {
      language: resolveTmdbLanguage(req),
    });
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
    const details = await tmdbClient.getDetails(String(id), String(type), {
      language: resolveTmdbLanguage(req),
    });
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
    with_keywords,
    without_keywords,
    with_original_language,
    sort_by = 'vote_average.desc',
  } = req.query;

  try {
    const results = await tmdbClient.getDiscover(String(media), page, {
      withGenres: with_genres ? String(with_genres) : undefined,
      withKeywords: with_keywords ? String(with_keywords) : undefined,
      withoutKeywords: without_keywords ? String(without_keywords) : undefined,
      withOriginalLanguage: with_original_language ? String(with_original_language) : undefined,
      sortBy: String(sort_by),
      language: resolveTmdbLanguage(req),
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
    const results = await tmdbClient.getRecommendations(String(id), String(type), {
      language: resolveTmdbLanguage(req),
    });
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
    const results = await tmdbClient.getSimilar(String(id), String(type), {
      language: resolveTmdbLanguage(req),
    });
    res.json(results);
  } catch (error) {
    handleTMDBError(res, error, 'TMDB proxy similar error:', 'Failed to fetch similar results from TMDB');
  }
});

/**
 * @swagger
 * /api/tmdb/rank-candidates:
 *   post:
 *     summary: Rank TMDB-style candidates for a serialized quote profile
 *     description: >
 *       Applies the same thematic / genre / keyword scoring as the PhiloMedia home pipeline
 *       (`rankCandidates` in `src/domain/mediaRanking/mediaRankCore.js`). Send a quote profile
 *       built client-side or by `buildQuoteProfile`, plus merged TMDB candidates (see `mergeCandidateBuckets`).
 *     tags: [TMDB]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RankCandidatesRequest'
 *           examples:
 *             minimal:
 *               summary: One movie candidate
 *               value:
 *                 profile:
 *                   themes: ['existentialism', 'self-knowledge']
 *                   themeWeights:
 *                     existentialism: 0.55
 *                     self-knowledge: 0.45
 *                   keywords: ['freedom', 'identity']
 *                   preferredGenres: [18, 9648]
 *                 candidates:
 *                   - id: 157336
 *                     title: Interstellar
 *                     overview: Explorers travel through a wormhole in space...
 *                     media_type: movie
 *                     genre_ids: [12, 18, 878]
 *                     vote_average: 8.6
 *                     popularity: 120.5
 *                     _sources: ['movie-popular']
 *                 limit: 5
 *     responses:
 *       200:
 *         description: Ranked candidates with internal score fields.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RankCandidatesResponse'
 *       400:
 *         description: Missing profile or empty candidates.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       500:
 *         description: Ranking threw an unexpected error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
router.post('/rank-candidates', postRankCandidates);

export default router;
