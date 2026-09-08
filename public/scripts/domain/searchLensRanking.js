/**
 * @file Search-page lens scoring and TMDB result annotation (browser domain).
 */

import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { scoringOverview } from '/scripts/services/tmdbOverviewI18n.js';
import {
  getCuratedPhilosophicalProfile,
  scoreCuratedProfileForLens,
} from '/scripts/curatedPhilosophicalProfiles.js';
import {
  extractItemTmdbKeywords,
  getLensTextKeywords,
  itemHasLensKeywordHit,
  LENS_FILTERS,
} from '/scripts/domain/searchFilters.js';
import { normalizeText } from '/scripts/ui/viewHelpers.js';

export const LENS_GENRE_OVERLAP_MIN_HERM = 8;
export const ACTION_GENRE_ID = 28;

export function getMediaType(item) {
  if (item.media_type === 'movie' || item.media_type === 'tv') return item.media_type;
  if (item.title) return 'movie';
  if (item.name) return 'tv';
  return 'unknown';
}

export function annotateResult(item, index) {
  const mediaType = getMediaType(item);
  const title = item.title || item.name || 'Untitled';
  const overview = scoringOverview(item);
  const tmdbKeywords = extractItemTmdbKeywords(item);
  const keywordText = tmdbKeywords.map(entry => entry.name).filter(Boolean).join(' ');
  const textContext = `${title} ${overview} ${keywordText}`.trim();
  const themeMatches = analyzeWorkForThemes(textContext);

  return {
    ...item,
    media_type: mediaType,
    tmdbKeywords,
    _searchIndex: index,
    _themeMatches: themeMatches,
    _themeIds: themeMatches.map(match => match.theme),
    _normalizedContext: normalizeText(textContext),
    _philosophicalProfile: getCuratedPhilosophicalProfile(item.id),
  };
}

export function annotateResults(results) {
  return (results || [])
    .map((item, index) => annotateResult(item, index))
    .filter(item => item.media_type === 'movie' || item.media_type === 'tv');
}

export function mergeResultsByIdentity(items) {
  const merged = new Map();

  items.forEach((item, index) => {
    if (!item || item.id == null) return;

    const mediaType = getMediaType(item);
    if (mediaType !== 'movie' && mediaType !== 'tv') return;

    const key = `${mediaType}:${item.id}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...item,
        media_type: mediaType,
        _searchIndex: index,
      });
      return;
    }

    const mergedKeywords = [
      ...extractItemTmdbKeywords(existing),
      ...extractItemTmdbKeywords(item),
    ];
    const seenKeyword = new Set();
    const tmdbKeywords = mergedKeywords.filter((entry) => {
      const keyId = entry.id || normalizeText(entry.name);
      if (!keyId || seenKeyword.has(keyId)) return false;
      seenKeyword.add(keyId);
      return true;
    });

    merged.set(key, {
      ...existing,
      ...item,
      media_type: mediaType,
      overview: existing.overview || item.overview || '',
      poster_path: existing.poster_path || item.poster_path || null,
      vote_average: Math.max(Number(existing.vote_average) || 0, Number(item.vote_average) || 0),
      popularity: Math.max(Number(existing.popularity) || 0, Number(item.popularity) || 0),
      genre_ids: Array.isArray(existing.genre_ids) && existing.genre_ids.length > 0
        ? existing.genre_ids
        : (item.genre_ids || []),
      tmdbKeywords,
      _searchIndex: Math.min(existing._searchIndex ?? index, index),
    });
  });

  return annotateResults([...merged.values()]);
}

export function scoreLensAffinity(item, lens) {
  if (!lens) return 0;

  const prof = item._philosophicalProfile || getCuratedPhilosophicalProfile(item.id);
  const lensCurated = scoreCuratedProfileForLens(prof, lens);
  if (lensCurated.excluded) {
    return 0;
  }

  const themeSet = new Set(item._themeIds || []);
  const normalized = item._normalizedContext || '';
  const genreIds = Array.isArray(item.genre_ids) ? item.genre_ids : [];
  const preferredGenres = item.media_type === 'tv'
    ? (lens.tvGenres || [])
    : (lens.movieGenres || []);
  const lensThemeSet = new Set(lens.themes || []);
  const hermLensScore = (item._themeMatches || [])
    .filter(m => lensThemeSet.has(m.theme))
    .reduce((sum, m) => sum + m.score, 0);

  let score = 0;
  let hasKeywordHit = false;

  lens.themes.forEach((theme, index) => {
    if (themeSet.has(theme)) {
      score += Math.max(12, 24 - index * 4);
    }
  });

  const textKeywords = getLensTextKeywords(lens);
  textKeywords.forEach((keyword, index) => {
    if (normalized.includes(normalizeText(keyword))) {
      hasKeywordHit = true;
      score += Math.max(4, 12 - index * 1.5);
    }
  });

  if (itemHasLensKeywordHit(item, lens)) {
    hasKeywordHit = true;
    score += 10;
  }

  const profileHasLensTag = prof?.philosophicalTags?.some(t => lensThemeSet.has(t)) ?? false;
  const allowGenreOverlap =
    hermLensScore >= LENS_GENRE_OVERLAP_MIN_HERM ||
    hasKeywordHit ||
    profileHasLensTag;

  if (preferredGenres.length && genreIds.length) {
    const lensGenreSet = new Set(preferredGenres);
    const overlap = genreIds.filter(genreId => lensGenreSet.has(genreId)).length;
    if (overlap > 0 && allowGenreOverlap) {
      const isActionHeavy = genreIds.includes(ACTION_GENRE_ID);
      const dampenConsciousnessAction =
        lens.id === 'consciousness-ai' && isActionHeavy && hermLensScore < 12;
      const perGenre = dampenConsciousnessAction ? 2 : 5;
      score += overlap * perGenre;
    }
  }

  const weakTextSignal =
    !hasKeywordHit &&
    hermLensScore < LENS_GENRE_OVERLAP_MIN_HERM &&
    !profileHasLensTag &&
    lensCurated.bonus === 0;
  if (weakTextSignal) {
    score += Math.max(0, Number(item.vote_average || 0) - 6) * 0.35;
    score += Math.min(2, (Number(item.popularity) || 0) / 120);
  } else {
    score += Math.max(0, Number(item.vote_average || 0) - 6) * 1.5;
    score += Math.min(5, (Number(item.popularity) || 0) / 45);
  }

  score += lensCurated.bonus;

  return score;
}

/**
 * Cruza trending comercial com overlap de lentes — não é dump cru nem o pareamento diário.
 */
export function rankTrendingByLensOverlap(items, lenses = LENS_FILTERS, { minScore = 8, limit = 10 } = {}) {
  return annotateResults(items)
    .map((item) => {
      let bestScore = 0;
      let bestLensId = '';
      lenses.forEach((lens) => {
        const score = scoreLensAffinity(item, lens);
        if (score > bestScore) {
          bestScore = score;
          bestLensId = lens.id;
        }
      });
      return {
        ...item,
        _lensOverlapScore: bestScore,
        _bestLensId: bestLensId,
      };
    })
    .filter(item => item._lensOverlapScore >= minScore)
    .sort((a, b) =>
      b._lensOverlapScore - a._lensOverlapScore
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
    )
    .slice(0, limit);
}

