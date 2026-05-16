import { rankCandidatesFromBody } from '../services/mediaRankingService.js';

/**
 * POST /api/tmdb/rank-candidates
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function postRankCandidates(req, res) {
  const outcome = rankCandidatesFromBody(req.body);
  if (!outcome.ok) {
    if (outcome.status === 500) {
      console.error('rank-candidates error:', outcome.error);
      return res.status(500).json({ error: 'Ranking failed.' });
    }
    return res.status(outcome.status).json({ error: outcome.error });
  }
  return res.json({ results: outcome.results });
}
