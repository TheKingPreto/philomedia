/**
 * @file Re-rank a short list of search/lens candidates using TMDB user reviews as extra text signal.
 */

import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { getReviewsFromTMDB } from '/scripts/seriesapi.js';
import { getLensTextKeywords } from '/scripts/domain/searchFilters.js';
import { preferReviewsByLanguage } from '/scripts/domain/detailsQuotePipeline.js';
import { normalizeText } from '/scripts/ui/viewHelpers.js';

export const REVIEW_RERANK_LIMIT = 6;
export const REVIEW_CONTEXT_LIMIT = 4500;

const reviewContextCache = new Map();

export function buildReviewContext(reviews = []) {
  return preferReviewsByLanguage(reviews)
    .map(review => review?.content || '')
    .filter(Boolean)
    .slice(0, 3)
    .join(' ')
    .slice(0, REVIEW_CONTEXT_LIMIT);
}

export function scoreLensTextAffinity(text, lens) {
  if (!lens || !text) return 0;

  const normalized = normalizeText(text);
  const themeMatches = analyzeWorkForThemes(text);
  const themeSet = new Set(themeMatches.map(match => match.theme));
  let score = 0;

  lens.themes.forEach((theme, index) => {
    if (themeSet.has(theme)) {
      score += Math.max(10, 22 - index * 4);
    }
  });

  getLensTextKeywords(lens).forEach((keyword, index) => {
    if (normalized.includes(normalizeText(keyword))) {
      score += Math.max(3, 9 - index * 1.1);
    }
  });

  return score;
}

export async function getReviewContextForItem(item) {
  const cacheKey = `${item.media_type}:${item.id}`;
  if (reviewContextCache.has(cacheKey)) {
    return reviewContextCache.get(cacheKey);
  }

  const reviews = await getReviewsFromTMDB(item.id, item.media_type).catch(() => []);
  const context = buildReviewContext(reviews);
  reviewContextCache.set(cacheKey, context);
  return context;
}

/**
 * @param {object[]} items
 * @param {object} lens
 * @param {{ getPriorityScore: (item: object) => number }} options
 */
export async function rerankLensSelectionWithReviews(items, lens, { getPriorityScore }) {
  const leadItems = items.slice(0, REVIEW_RERANK_LIMIT);
  const tailItems = items.slice(REVIEW_RERANK_LIMIT);

  const rerankedLead = await Promise.all(
    leadItems.map(async item => {
      const reviewContext = await getReviewContextForItem(item);
      const reviewScore = scoreLensTextAffinity(reviewContext, lens);
      const combinedScore =
        getPriorityScore(item)
        + reviewScore * 1.15
        + (reviewContext ? 2 : 0);

      return {
        ...item,
        _reviewScore: reviewScore,
        _combinedLensScore: combinedScore,
      };
    })
  );

  const preservedTail = tailItems.map(item => ({
    ...item,
    _reviewScore: item._reviewScore || 0,
    _combinedLensScore: getPriorityScore(item),
  }));

  return [...rerankedLead, ...preservedTail].sort((a, b) =>
    b._combinedLensScore - a._combinedLensScore
    || b._reviewScore - a._reviewScore
    || getPriorityScore(b) - getPriorityScore(a)
    || a._searchIndex - b._searchIndex
  );
}
