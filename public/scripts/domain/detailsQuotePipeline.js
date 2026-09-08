import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import {
  getCuratedPhilosophicalProfile,
  scoreCuratedRelatedAffinity,
} from '/scripts/curatedPhilosophicalProfiles.js';
import { THEME_GENRE_HINTS } from '/scripts/domain/themeGenreHints.js';
import { normalizeText } from '/scripts/ui/viewHelpers.js';
import {
  AUTHOR_LENS_MAP,
  DECENT_POOL_SIZE,
  DETAILS_RELATED_WORKS_LIMIT,
  GENERIC_QUOTE_PATTERNS,
  GENRE_SIGNAL_WEIGHT,
  MIN_DECENT_SCORE,
  MIN_DECENT_THEME_SCORE,
  MIN_DECENT_TOKEN_SCORE,
  MIN_STRONG_THEME_SCORE,
  MIN_STRONG_TOKEN_SCORE,
  NOISE_WORDS,
  POOL_BIAS_EXPONENT,
  QUOTE_SOURCE_BOOST,
  STRONG_POOL_SIZE,
  WEAK_POOL_SIZE,
} from './detailsPageConfig.js';
import { getDisplayDate, getDisplayTitle, getYear } from './detailsMediaHelpers.js';

/** Inverso de THEME_GENRE_HINTS: id de género TMDB → temas que ele sugere. */
const GENRE_THEME_INDEX = (() => {
  const index = new Map();

  Object.entries(THEME_GENRE_HINTS || {}).forEach(([theme, hint]) => {
    const genreIds = Array.isArray(hint)
      ? hint
      : [...(hint?.movie || []), ...(hint?.tv || [])];

    new Set(genreIds).forEach(genreId => {
      const themes = index.get(genreId) || [];
      themes.push(theme);
      index.set(genreId, themes);
    });
  });

  return index;
})();

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

export function extractTmdbKeywordNames(details) {
  if (Array.isArray(details?.tmdbKeywords) && details.tmdbKeywords.length) {
    return details.tmdbKeywords
      .map(item => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean);
  }

  const payload = details?.keywords;
  const list = Array.isArray(payload?.keywords)
    ? payload.keywords
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload)
        ? payload
        : [];

  return list
    .map(item => (typeof item === 'string' ? item : item?.name))
    .filter(Boolean);
}

export const PREFERRED_REVIEW_LANGUAGES = ['en', 'pt'];

export function getReviewLanguage(review) {
  return String(review?.iso_639_1 || review?.language || '').trim().toLowerCase().slice(0, 2);
}

/**
 * Prefere EN/PT; se não houver nenhum, mantém o fallback (não apaga o único sinal útil).
 */
export function preferReviewsByLanguage(reviews = [], preferred = PREFERRED_REVIEW_LANGUAGES) {
  const list = Array.isArray(reviews) ? reviews.filter(review => review?.content) : [];
  if (!list.length) return [];
  const preferredSet = new Set(preferred);
  const preferredOnes = list.filter(review => preferredSet.has(getReviewLanguage(review)));
  return preferredOnes.length ? preferredOnes : list;
}

export function buildSourceContext(details, reviews = []) {
  const preferredReviews = preferReviewsByLanguage(reviews);
  const parts = [
    getDisplayTitle(details),
    details.overview || '',
    Array.isArray(details.genres) ? details.genres.map(genre => genre?.name).filter(Boolean).join(' ') : '',
    extractTmdbKeywordNames(details).join(' '),
    preferredReviews.map(review => review.content || '').join(' '),
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

/**
 * Os pesos de uma citação não dependem da obra aberta, mas eram recalculados
 * uma vez por citação em `scoreQuoteThemeAlignment` e outra em
 * `scoreQuoteQuality`. O catálogo é limitado a algumas centenas de entradas,
 * então cabe inteiro em memória.
 */
const quoteThemeWeightCache = new Map();

export function clearQuoteScoringCache() {
  quoteThemeWeightCache.clear();
}

export function buildQuoteThemeWeights(quote, limit = 6) {
  const quoteText = getQuoteTextForRanking(quote);
  const cacheKey = `${quote?.id ?? quoteText}|${limit}`;
  const cached = quoteThemeWeightCache.get(cacheKey);
  if (cached) return cached;

  const explicitThemes = Array.isArray(quote.themes)
    ? quote.themes.map(theme => String(theme || '').trim().toLowerCase()).filter(Boolean)
    : [];
  const inferredWeights = createThemeWeightMap(analyzeWorkForThemes(quoteText), limit);
  const weights = new Map(inferredWeights);

  explicitThemes.forEach((theme, index) => {
    weights.set(theme, (weights.get(theme) || 0) + Math.max(0.18, 0.42 - index * 0.06));
  });

  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const total = ranked.reduce((sum, [, score]) => sum + score, 0) || 1;
  const normalized = new Map(ranked.map(([theme, score]) => [theme, score / total]));

  quoteThemeWeightCache.set(cacheKey, normalized);
  return normalized;
}

/**
 * Géneros TMDB rendem um perfil temático grosseiro mas sempre disponível —
 * ao contrário das reviews, que faltam justamente nas obras menos populares.
 */
export function buildGenreThemeWeights(details, mediaType) {
  const genreIds = Array.isArray(details?.genres)
    ? details.genres.map(genre => genre?.id).filter(Boolean)
    : (Array.isArray(details?.genre_ids) ? details.genre_ids : []);

  if (genreIds.length === 0) return new Map();

  const counts = new Map();
  genreIds.forEach(genreId => {
    (GENRE_THEME_INDEX.get(genreId) || []).forEach(theme => {
      counts.set(theme, (counts.get(theme) || 0) + 1);
    });
  });

  // Séries e filmes partilham o mesmo índice; o tipo só afina o desempate.
  if (mediaType === 'tv') {
    counts.forEach((count, theme) => {
      const hint = THEME_GENRE_HINTS?.[theme];
      const tvGenres = Array.isArray(hint) ? hint : (hint?.tv || []);
      if (tvGenres.some(genreId => genreIds.includes(genreId))) {
        counts.set(theme, count + 0.5);
      }
    });
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0) || 1;
  return new Map([...counts.entries()].map(([theme, count]) => [theme, count / total]));
}

/**
 * Combina o sinal textual (sinopse + reviews) com o sinal de género, para que
 * obras sem review ainda tenham um perfil temático utilizável.
 */
export function buildSourceThemeWeights(details, reviews, mediaType, limit = 8) {
  const textWeights = createThemeWeightMap(
    analyzeWorkForThemes(buildSourceContext(details, reviews)),
    limit
  );
  const genreWeights = buildGenreThemeWeights(details, mediaType);

  if (genreWeights.size === 0) return textWeights;

  const combined = new Map(textWeights);
  genreWeights.forEach((weight, theme) => {
    combined.set(theme, (combined.get(theme) || 0) + weight * GENRE_SIGNAL_WEIGHT);
  });

  const ranked = [...combined.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  const total = ranked.reduce((sum, [, weight]) => sum + weight, 0) || 1;
  return new Map(ranked.map(([theme, weight]) => [theme, weight / total]));
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

/**
 * FNV-1a seguido do finalizador do MurmurHash3. A mistura final é essencial:
 * sem ela, ids TMDB próximos (que é o caso ao navegar entre obras
 * relacionadas) produzem hashes quase iguais e caem todos no mesmo índice do
 * lote, recriando a repetição de citações que esta selecção resolve.
 */
export function hashString(value) {
  const text = String(value);
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  hash ^= hash >>> 15;
  hash = Math.imul(hash, 2246822507);
  hash ^= hash >>> 13;

  return hash >>> 0;
}

export function scoreQuoteForSource(sourceThemeWeights, sourceTokens, quote) {
  const themeScore = scoreQuoteThemeAlignment(sourceThemeWeights, quote);
  const tokenScore = scoreQuoteTokenAlignmentGrouped(sourceTokens, quote);
  const authorScore = scoreQuoteAuthorLens(sourceThemeWeights, quote);
  const qualityScore = scoreQuoteQuality(quote);

  return {
    ...quote,
    _score: themeScore * 1.8 + tokenScore + authorScore + qualityScore * 0.45,
    _themeScore: themeScore,
    _tokenScore: tokenScore,
    _authorScore: authorScore,
  };
}

export function rankQuotesForSource(quotes, sourceThemeWeights, sourceTokens) {
  return quotes
    .map(normalizeQuoteEntry)
    .filter(quote => quote.quote && quote.author)
    .map(quote => scoreQuoteForSource(sourceThemeWeights, sourceTokens, quote))
    .sort((a, b) => b._score - a._score);
}

/**
 * Um mesmo autor costuma ocupar várias posições do topo, o que estreitaria o
 * lote na prática. Além disso, os cortes de camada são estreitos e muitas
 * vezes deixam passar uma ou duas citações apenas — nesse caso o lote é
 * completado com as melhores seguintes do ranking, que continua ordenado por
 * relevância para a obra.
 */
function buildAuthorDiversePool(tierQuotes, rankedQuotes, size) {
  const seenAuthors = new Set();
  const pool = [];

  const push = quote => {
    const authorKey = normalizeAuthor(getQuoteAuthor(quote));
    if (seenAuthors.has(authorKey)) return;
    seenAuthors.add(authorKey);
    pool.push(quote);
  };

  for (const quote of tierQuotes) {
    if (pool.length >= size) break;
    push(quote);
  }

  for (const quote of rankedQuotes) {
    if (pool.length >= size) break;
    push(quote);
  }

  return pool;
}

/**
 * A confiança do ranking define o tamanho do lote elegível, não uma escolha
 * única: quanto mais fraca a evidência, mais largo o lote, para que obras
 * distintas não convirjam todas para a mesma citação.
 */
export function resolveQuoteCandidatePool(rankedQuotes) {
  const strong = rankedQuotes.filter(quote =>
    quote._themeScore >= MIN_STRONG_THEME_SCORE
    && quote._tokenScore >= MIN_STRONG_TOKEN_SCORE
  );
  if (strong.length > 0) {
    return {
      tier: 'strong',
      pool: buildAuthorDiversePool(strong, rankedQuotes, STRONG_POOL_SIZE),
    };
  }

  const decent = rankedQuotes.filter(quote =>
    quote._score >= MIN_DECENT_SCORE
    && quote._themeScore >= MIN_DECENT_THEME_SCORE
    && quote._tokenScore >= MIN_DECENT_TOKEN_SCORE
  );
  if (decent.length > 0) {
    return {
      tier: 'decent',
      pool: buildAuthorDiversePool(decent, rankedQuotes, DECENT_POOL_SIZE),
    };
  }

  return {
    tier: 'weak',
    pool: buildAuthorDiversePool(rankedQuotes, rankedQuotes, WEAK_POOL_SIZE),
  };
}

/**
 * Escolhe dentro do lote por hash da obra: estável entre visitas à mesma
 * página, mas distinto entre obras diferentes. A curva de potência enviesa a
 * escolha para o início do lote, que está ordenado por relevância, sem nunca
 * excluir o resto — variedade sem abrir mão da qualidade do par.
 */
export function selectPoolIndex(hash, poolSize) {
  if (poolSize <= 1) return 0;

  const uniform = (hash % 10000) / 10000;
  const biased = uniform ** POOL_BIAS_EXPONENT;
  return Math.min(poolSize - 1, Math.floor(biased * poolSize));
}

/**
 * Extension point for quote thumbs (user ratings). Ranking does not use
 * ratings yet — fold `ratingsByQuoteId` (quoteId → 1 | -1) into pool order
 * here when that weight is calibrated. Until then this is a documented no-op.
 */
export function applyQuoteRatingBias(rankedQuotes, _ratingsByQuoteId) {
  return rankedQuotes;
}

export function selectQuoteForMedia(rankedQuotes, mediaKey, ratingsByQuoteId) {
  const ranked = applyQuoteRatingBias(rankedQuotes, ratingsByQuoteId);
  if (!Array.isArray(ranked) || ranked.length === 0) return null;

  const { tier, pool } = resolveQuoteCandidatePool(ranked);
  if (pool.length === 0) return null;

  const selected = pool[selectPoolIndex(hashString(mediaKey), pool.length)];
  return { ...selected, _tier: tier, _poolSize: pool.length };
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
