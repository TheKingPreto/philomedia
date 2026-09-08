import { rankCandidates } from '../domain/mediaRanking/mediaRankCore.js';

export const MAX_RANK_CANDIDATES = 100;

/**
 * Rehydrates a quote profile from JSON (Map themeWeights).
 * @param {unknown} body
 * @returns {import('../types/jsdoc-shared.js').QuoteProfile|null}
 */
export function reviveQuoteProfile(body) {
  if (!body?.profile) return null;
  const profile = body.profile;
  const raw = profile.themeWeights;
  const themeWeights = raw instanceof Map
    ? raw
    : new Map(
      Array.isArray(raw)
        ? raw
        : Object.entries(typeof raw === 'object' && raw !== null ? raw : {}),
    );
  return {
    themes: Array.isArray(profile.themes) ? profile.themes : [],
    themeWeights,
    keywords: Array.isArray(profile.keywords) ? profile.keywords : [],
    preferredGenres: Array.isArray(profile.preferredGenres) ? profile.preferredGenres : [],
  };
}

/**
 * @param {unknown} body
 * @returns {{ ok: true, results: unknown[] } | { ok: false, status: number, error: string }}
 */
export function rankCandidatesFromBody(body) {
  const { candidates, limit } = body || {};
  const profile = reviveQuoteProfile(body);
  if (!profile || !Array.isArray(candidates) || candidates.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'Expected JSON body { profile: { themes, themeWeights, keywords, preferredGenres }, candidates: [...], limit?: number }.',
    };
  }

  if (candidates.length > MAX_RANK_CANDIDATES) {
    return {
      ok: false,
      status: 400,
      error: `Too many candidates. Maximum is ${MAX_RANK_CANDIDATES}.`,
    };
  }

  try {
    const max = Math.min(50, Math.max(1, Number(limit) || 10));
    const results = rankCandidates(profile, candidates, max);
    return { ok: true, results };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('rank-candidates ranking error:', message);
    return {
      ok: false,
      status: 500,
      error: process.env.NODE_ENV === 'production'
        ? 'Ranking failed.'
        : message,
    };
  }
}
