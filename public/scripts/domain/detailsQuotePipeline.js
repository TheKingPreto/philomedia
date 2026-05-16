import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import {
  getCuratedPhilosophicalProfile,
  scoreCuratedRelatedAffinity,
} from '/scripts/curatedPhilosophicalProfiles.js';
import { normalizeText } from '/scripts/ui/viewHelpers.js';
import {
  AUTHOR_LENS_MAP,
  DETAILS_RELATED_WORKS_LIMIT,
  GENERIC_QUOTE_PATTERNS,
  NOISE_WORDS,
  QUOTE_SOURCE_BOOST,
} from './detailsPageConfig.js';
import { getDisplayDate, getDisplayTitle, getYear } from './detailsMediaHelpers.js';

export function getQuoteText(quote) {
  return String(quote?.quote ?? quote?.quoteText ?? '').trim();
}

/** Texto estável para ranquear citações (independente do idioma da UI). */
export function getQuoteTextForRanking(quote) {
  return String(
    quote?.quote_en
    ?? quote?.quote_original
    ?? quote?.quote
    ?? quote?.quoteText
    ?? ''
  ).trim();
}

export function getQuoteAuthor(quote) {
  return String(quote?.author ?? quote?.authorName ?? '').trim();
}

export function getQuoteSource(quote) {
  return String(quote?.source || quote?.submissionSource || '').trim().toLowerCase();
}

function normalizeAuthor(author) {
  return String(author || '')
    .toLowerCase()
    .replace(/[^a-z\u00C0-\u017F]+/g, ' ')
    .trim();
}

export function scoreQuoteAuthorLens(sourceWeights, quote) {
  const authorKey = normalizeAuthor(getQuoteAuthor(quote)).split(' ')[0];
  const lensThemes = AUTHOR_LENS_MAP[authorKey];
  if (!Array.isArray(lensThemes) || lensThemes.length === 0) return 0;

  let score = 0;
  for (const [theme, sourceWeight] of sourceWeights.entries()) {
    if (lensThemes.includes(theme)) {
      score += sourceWeight * 10;
    }
  }

  return score;
}

export function extractSalientTokens(text, limit = 10) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const counts = new Map();

  normalized.split(' ').forEach(token => {
    if (!token || token.length < 4) return;
    if (/^\d+$/.test(token)) return;
    if (NOISE_WORDS.has(token)) return;

    counts.set(token, (counts.get(token) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token)
    .slice(0, limit);
}

export function extractSalientTokenGroups(text, coreLimit = 4, contextLimit = 6) {
  const tokens = extractSalientTokens(text, coreLimit + contextLimit);
  return {
    core: tokens.slice(0, coreLimit),
    context: tokens.slice(coreLimit),
  };
}

export function scoreQuoteTokenAlignmentGrouped(sourceTokens, quote) {
  if (!sourceTokens || (!sourceTokens.core.length && !sourceTokens.context.length)) return 0;

  const quoteTokens = new Set(extractSalientTokens(`${getQuoteTextForRanking(quote)} ${(quote.themes || []).join(' ')}`, 18));
  let score = 0;
  let coreMatches = 0;
  let contextMatches = 0;

  sourceTokens.core.forEach(token => {
    if (quoteTokens.has(token)) {
      score += 10;
      coreMatches += 1;
    }
  });

  sourceTokens.context.forEach(token => {
    if (quoteTokens.has(token)) {
      score += 4;
      contextMatches += 1;
    }
  });

  if (coreMatches === 0 && contextMatches < 3) {
    score -= 10;
  }

  return score;
}

export function buildSourceContext(details, reviews = []) {
  const parts = [
    getDisplayTitle(details),
    details.overview || '',
    Array.isArray(details.genres) ? details.genres.map(genre => genre?.name).filter(Boolean).join(' ') : '',
    Array.isArray(reviews) ? reviews.map(review => review.content || '').join(' ') : '',
  ].filter(Boolean);

  return parts.join(' ').trim();
}

export function buildSearchQuery(details, reviews) {
  const contextTokens = extractSalientTokens(buildSourceContext(details, reviews), 6);
  const titleTokens = extractSalientTokens(getDisplayTitle(details), 2);
  const queryTokens = [...new Set([...contextTokens, ...titleTokens])].slice(0, 4);
  return queryTokens.join(' ');
}

export function createThemeWeightMap(themeScores, limit = 6) {
  const topThemes = themeScores.slice(0, limit);
  const total = topThemes.reduce((sum, item) => sum + item.score, 0) || 1;
  return new Map(topThemes.map(item => [item.theme, item.score / total]));
}

export function buildQuoteThemeWeights(quote, limit = 6) {
  const explicitThemes = Array.isArray(quote.themes)
    ? quote.themes.map(theme => String(theme || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const inferredWeights = createThemeWeightMap(analyzeWorkForThemes(getQuoteTextForRanking(quote)), limit);
  const weights = new Map(inferredWeights);

  explicitThemes.forEach((theme, index) => {
    weights.set(theme, (weights.get(theme) || 0) + Math.max(0.18, 0.42 - index * 0.06));
  });

  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const total = ranked.reduce((sum, [, score]) => sum + score, 0) || 1;
  return new Map(ranked.map(([theme, score]) => [theme, score / total]));
}

export function scoreQuoteThemeAlignment(sourceWeights, quote) {
  const quoteWeights = buildQuoteThemeWeights(quote);
  let score = 0;

  for (const [theme, sourceWeight] of sourceWeights.entries()) {
    const quoteWeight = quoteWeights.get(theme);
    if (quoteWeight) {
      score += sourceWeight * quoteWeight * 120;
    }
  }

  return score;
}

export function scoreQuoteQuality(quote) {
  const quoteText = getQuoteTextForRanking(quote);
  const author = getQuoteAuthor(quote);
  if (!quoteText || !author) return -Infinity;

  const source = getQuoteSource(quote);
  const sourceBoost = QUOTE_SOURCE_BOOST[source] ?? (
    source.startsWith('wikiquote') ? QUOTE_SOURCE_BOOST.wikiquote : 10
  );
  const wordCount = quoteText.split(/\s+/).filter(Boolean).length;
  const uniqueWords = new Set(normalizeText(quoteText).split(' ').filter(word => word.length > 3));
  const themeCount = buildQuoteThemeWeights(quote, 4).size;

  let score = sourceBoost + Math.min(15, uniqueWords.size * 1.2) + themeCount * 6;

  if (wordCount >= 8 && wordCount <= 36) score += 16;
  if (wordCount < 5) score -= 24;
  if (wordCount > 55) score -= 14;
  if (GENERIC_QUOTE_PATTERNS.some(pattern => pattern.test(quoteText))) score -= 28;

  return score;
}

export function normalizeQuoteEntry(quote) {
  return {
    id: quote?.legacyId ?? quote?._id ?? quote?.id ?? null,
    quote: getQuoteText(quote),
    author: getQuoteAuthor(quote),
    themes: Array.isArray(quote?.themes) ? quote.themes : [],
    source: getQuoteSource(quote),
    originalLanguage: quote?.originalLanguage,
    quote_original: quote?.quote_original,
    quote_en: quote?.quote_en,
    quote_pt: quote?.quote_pt,
  };
}

export function buildQuoteFallbackKey(details, quote) {
  return `${getDisplayTitle(details)}|${quote.id ?? ''}|${quote.quote}|${quote.author}`;
}

function scoreThemeAlignment(sourceWeights, candidateText) {
  if (!sourceWeights.size) return 0;

  const candidateThemes = analyzeWorkForThemes(candidateText);
  const candidateWeights = createThemeWeightMap(candidateThemes);

  let score = 0;
  for (const [theme, sourceWeight] of sourceWeights.entries()) {
    const candidateWeight = candidateWeights.get(theme);
    if (candidateWeight) {
      score += sourceWeight * candidateWeight * 100;
    }
  }

  return score;
}

function scoreTokenAlignment(sourceTokens, candidateText) {
  if (!sourceTokens.length) return 0;

  const candidateTokens = new Set(extractSalientTokens(candidateText, 16));
  let score = 0;

  sourceTokens.forEach((token, index) => {
    if (candidateTokens.has(token)) {
      score += Math.max(3, 12 - index * 1.4);
    }
  });

  return score;
}

function scoreGenreAlignment(sourceGenreIds, candidateGenreIds) {
  if (!sourceGenreIds.length || !Array.isArray(candidateGenreIds) || candidateGenreIds.length === 0) {
    return 0;
  }

  const sourceGenreSet = new Set(sourceGenreIds);
  const overlap = candidateGenreIds.filter(id => sourceGenreSet.has(id)).length;
  if (!overlap) return 0;

  return (overlap / sourceGenreIds.length) * 16;
}

function scoreYearAlignment(sourceDate, candidateDate) {
  const sourceY = getYear(sourceDate);
  const candidateY = getYear(candidateDate);

  if (!sourceY || !candidateY) return 0;

  const delta = Math.abs(sourceY - candidateY);
  return Math.max(0, 8 - delta * 0.5);
}

function scoreLocaleAlignment(details, candidate) {
  let score = 0;

  if (details.original_language && candidate.original_language === details.original_language) {
    score += 6;
  }

  if (Array.isArray(details.origin_country) && Array.isArray(candidate.origin_country)) {
    const sameCountry = details.origin_country.some(country => candidate.origin_country.includes(country));
    if (sameCountry) score += 4;
  }

  return score;
}

function scoreSourceBoost(candidate) {
  const sources = Array.isArray(candidate._sources) ? candidate._sources : [];
  let boost = 0;

  if (sources.includes('recommendation')) boost += 12;
  if (sources.includes('similar')) boost += 8;
  if (sources.includes('search')) boost += 7;
  if (sources.includes('discover')) boost += 4;

  return boost;
}

export function mergeCandidateBuckets(buckets, currentId, type) {
  const merged = new Map();

  buckets.forEach(({ items, source }) => {
    (items || []).forEach(item => {
      if (!item || item.id == null || String(item.id) === String(currentId)) return;
      if (item.media_type && item.media_type !== type) return;

      const existing = merged.get(String(item.id));
      if (!existing) {
        merged.set(String(item.id), {
          ...item,
          _sources: [source],
        });
        return;
      }

      const mergedSources = [...new Set([...(existing._sources || []), source])];
      merged.set(String(item.id), {
        ...existing,
        ...item,
        overview: existing.overview || item.overview || '',
        poster_path: existing.poster_path || item.poster_path || null,
        vote_average: Math.max(Number(existing.vote_average) || 0, Number(item.vote_average) || 0),
        popularity: Math.max(Number(existing.popularity) || 0, Number(item.popularity) || 0),
        _sources: mergedSources,
      });
    });
  });

  return [...merged.values()];
}

export function rankRelatedCandidates(details, reviews, candidates, currentMediaId) {
  const sourceContext = buildSourceContext(details, reviews);
  const sourceThemeWeights = createThemeWeightMap(analyzeWorkForThemes(sourceContext), 6);
  const sourceTokens = extractSalientTokens(sourceContext, 10);
  const sourceGenreIds = Array.isArray(details.genres)
    ? details.genres.map(genre => genre?.id).filter(Boolean)
    : [];
  const sourceDate = getDisplayDate(details);
  const sourceProfile = getCuratedPhilosophicalProfile(String(currentMediaId));

  const ranked = candidates
    .map(candidate => {
      const candidateContext = `${candidate.title || candidate.name || ''} ${candidate.overview || ''}`.trim();
      const themeScore = scoreThemeAlignment(sourceThemeWeights, candidateContext);
      const tokenScore = scoreTokenAlignment(sourceTokens, candidateContext);
      const genreScore = scoreGenreAlignment(sourceGenreIds, candidate.genre_ids);
      const localeScore = scoreLocaleAlignment(details, candidate);
      const yearScore = scoreYearAlignment(sourceDate, getDisplayDate(candidate));
      const sourceBoost = scoreSourceBoost(candidate);
      const ratingScore = Math.max(0, Number(candidate.vote_average || 0) - 6) * 1.4;
      const popularityScore = Math.min(8, (Number(candidate.popularity) || 0) / 35);
      const weakMatchPenalty = themeScore < 14 && tokenScore < 10 ? 18 : 0;
      const noOverviewPenalty = candidate.overview ? 0 : 10;
      const curatedAffinity = scoreCuratedRelatedAffinity(
        sourceProfile,
        getCuratedPhilosophicalProfile(String(candidate.id)),
        sourceThemeWeights,
      );

      const score =
        themeScore * 1.3
        + tokenScore
        + genreScore
        + localeScore
        + yearScore
        + sourceBoost
        + ratingScore
        + popularityScore
        + curatedAffinity
        - weakMatchPenalty
        - noOverviewPenalty;

      return {
        ...candidate,
        _score: score,
      };
    })
    .sort((a, b) => b._score - a._score);

  const strongMatches = ranked.filter(candidate => candidate._score >= 24);
  return (strongMatches.length >= 3 ? strongMatches : ranked).slice(0, DETAILS_RELATED_WORKS_LIMIT);
}
