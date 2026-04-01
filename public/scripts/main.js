/**
 * Home page content:
 * 1) pick a quote
 * 2) infer its philosophical profile
 * 3) gather TMDB candidates, prioritizing curated and thematic matches
 * 4) rank works by thematic affinity to the quote
 */

import { analyzeWorkForThemes } from '/scripts/hermeneutics.js';
import { curatedQuoteMatches } from '/scripts/curatedmatches.js';
import { THEME_DATABASE } from '/scripts/themedatabase.js';
import { discoverTMDB, getDetailsFromTMDB } from '/scripts/seriesapi.js';

const API_BASE = '/api';
const HOME_RESULT_LIMIT = 12;
const DAILY_QUOTE_SALT = 'philomedia-daily-quote';
const CURATED_TV_IDS = new Set([
  '1396', '1399', '1402', '1668', '2316', '4607', '1418', '60735', '1429',
  '60625', '19885', '63174', '119051', '71446', '57243', '1104', '456',
  '1438', '70523', '1424', '1408', '62560', '1407', '1991', '9322', '43865',
  '88751', '128', '46260', '46298', '395',
]);

const KEYWORD_STOPWORDS = new Set([
  'about', 'after', 'alone', 'among', 'around', 'being', 'between', 'beyond',
  'choice', 'choices', 'emotion', 'feelings', 'freedom', 'future', 'good',
  'great', 'human', 'humanity', 'ignorance', 'journey', 'knowledge', 'life',
  'lives', 'meaning', 'moral', 'morality', 'nature', 'other', 'people',
  'person', 'power', 'reason', 'reality', 'society', 'story', 'struggle',
  'their', 'there', 'these', 'those', 'through', 'truth', 'virtue', 'world',
  'wrong',
]);

const THEME_GENRE_HINTS = {
  'war-and-conflict': [10752, 10768, 18, 28, 10759],
  suffering: [18, 9648, 10749],
  tragedy: [18, 9648],
  'heros-journey': [12, 28, 10759, 14],
  virtue: [12, 18, 10759],
  existentialism: [18, 878, 9648],
  'self-knowledge': [18, 9648],
  'consciousness-ai': [878, 9648, 18],
  alienation: [18, 9648, 878],
  stoicism: [18, 12, 28, 10759],
  'utopia-dystopia': [878, 9648, 10765],
  'power-corruption': [18, 80, 10759, 10768],
  'social-justice': [18, 80, 99, 10768],
  'political-philosophy': [18, 80, 99, 10768],
  'truth-deception': [9648, 53, 80],
  epistemology: [9648, 53, 878],
  'memory-time': [9648, 878, 18],
  romanticism: [10749, 18],
  aesthetics: [16, 18, 10402],
  humanism: [18, 12],
  'anti-hero': [80, 18, 10759],
};

function normalizeText(text) {
  if (!text) return '';

  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function formatThemeLabel(theme) {
  return theme
    .split('-')
    .map(part => (part === 'ai' ? 'AI' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getThemeKeywords(theme, limit = 3) {
  return Object.entries(THEME_DATABASE[theme] || {})
    .filter(([keyword, weight]) => weight > 0 && keyword.length >= 5 && !KEYWORD_STOPWORDS.has(keyword))
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([keyword]) => keyword)
    .slice(0, limit);
}

function createWeightMap(entries, explicitThemes = []) {
  const weights = new Map();

  explicitThemes.forEach((theme, index) => {
    if (!theme) return;
    weights.set(theme, (weights.get(theme) || 0) + Math.max(18, 36 - index * 5));
  });

  entries.forEach(({ theme, score }, index) => {
    weights.set(theme, (weights.get(theme) || 0) + score * 10 + Math.max(0, 12 - index));
  });

  const ranked = [...weights.entries()]
    .sort((a, b) => b[1] - a[1]);

  const total = ranked.reduce((sum, [, score]) => sum + score, 0) || 1;

  return new Map(
    ranked
      .slice(0, 6)
      .map(([theme, score]) => [theme, score / total])
  );
}

function buildQuoteProfile(quoteData) {
  const explicitThemes = Array.isArray(quoteData.themes)
    ? quoteData.themes
        .map(theme => String(theme).trim().toLowerCase())
        .filter(theme => THEME_DATABASE[theme])
    : [];

  const inferredThemes = analyzeWorkForThemes(quoteData.quote || '');
  const themeWeights = createWeightMap(inferredThemes, explicitThemes);
  const rankedThemes = [...themeWeights.keys()];

  const keywords = [...new Set(
    rankedThemes
      .slice(0, 3)
      .flatMap(theme => getThemeKeywords(theme, 2))
  )].slice(0, 4);

  const preferredGenres = [...new Set(
    rankedThemes
      .slice(0, 3)
      .flatMap(theme => THEME_GENRE_HINTS[theme] || [])
  )];

  return {
    themes: rankedThemes,
    themeWeights,
    keywords,
    preferredGenres,
  };
}

function scoreThemeOverlap(themeWeights, candidateText) {
  if (!themeWeights.size) return 0;

  const candidateWeights = createWeightMap(analyzeWorkForThemes(candidateText));
  let score = 0;

  for (const [theme, sourceWeight] of themeWeights.entries()) {
    const candidateWeight = candidateWeights.get(theme);
    if (candidateWeight) {
      score += sourceWeight * candidateWeight * 140;
    }
  }

  return score;
}

function scoreKeywordOverlap(keywords, candidateText) {
  if (!keywords.length) return 0;

  const normalized = normalizeText(candidateText);
  let score = 0;

  keywords.forEach((keyword, index) => {
    if (normalized.includes(normalizeText(keyword))) {
      score += Math.max(4, 15 - index * 2.5);
    }
  });

  return score;
}

function scoreGenreHints(preferredGenres, candidateGenres) {
  if (!preferredGenres.length || !Array.isArray(candidateGenres) || candidateGenres.length === 0) {
    return 0;
  }

  const preferredSet = new Set(preferredGenres);
  const overlap = candidateGenres.filter(genre => preferredSet.has(genre)).length;
  return overlap * 5;
}

function scoreSourceBoost(candidate) {
  const sources = Array.isArray(candidate._sources) ? candidate._sources : [];
  let score = 0;

  if (sources.includes('curated')) score += 28;
  if (sources.includes('movie-themed') || sources.includes('tv-themed')) score += 11;
  if (sources.includes('movie-rated') || sources.includes('tv-rated')) score += 6;
  if (sources.includes('movie-popular') || sources.includes('tv-popular')) score += 2;

  return score;
}

function mergeCandidateBuckets(buckets) {
  const merged = new Map();

  buckets.forEach(({ source, items }) => {
    (items || []).forEach(item => {
      if (!item || item.id == null) return;

      const mediaType = item.media_type || (item.title ? 'movie' : 'tv');
      if (mediaType !== 'movie' && mediaType !== 'tv') return;

      const key = `${mediaType}:${item.id}`;
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, {
          ...item,
          media_type: mediaType,
          _sources: [source],
        });
        return;
      }

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
        _sources: [...new Set([...(existing._sources || []), source])],
      });
    });
  });

  return [...merged.values()];
}

function mapDetailsToCandidate(details, mediaType) {
  return {
    id: details.id,
    title: details.title ?? details.name,
    name: details.name ?? details.title,
    overview: details.overview || '',
    media_type: mediaType,
    poster_path: details.poster_path || null,
    release_date: details.release_date || null,
    first_air_date: details.first_air_date || null,
    vote_average: details.vote_average || 0,
    popularity: details.popularity || 0,
    genre_ids: Array.isArray(details.genres)
      ? details.genres.map(genre => genre?.id).filter(Boolean)
      : [],
    original_language: details.original_language || '',
    origin_country: Array.isArray(details.origin_country) ? details.origin_country : [],
  };
}

function buildCuratedMatchIndex() {
  const matchIndex = new Map();

  Object.entries(curatedQuoteMatches).forEach(([tmdbId, quoteId]) => {
    const key = String(quoteId);
    const current = matchIndex.get(key) || [];
    current.push(String(tmdbId));
    matchIndex.set(key, current);
  });

  return matchIndex;
}

const CURATED_MATCH_INDEX = buildCuratedMatchIndex();

async function resolveCuratedCandidate(tmdbId) {
  const mediaType = CURATED_TV_IDS.has(String(tmdbId)) ? 'tv' : 'movie';
  const details = await getDetailsFromTMDB(tmdbId, mediaType);
  return mapDetailsToCandidate(details, mediaType);
}

async function getCuratedCandidatesForQuote(quoteId) {
  if (quoteId == null) return [];

  const tmdbIds = CURATED_MATCH_INDEX.get(String(quoteId)) || [];
  if (tmdbIds.length === 0) return [];

  const results = await Promise.all(
    tmdbIds
      .slice(0, 6)
      .map(id => resolveCuratedCandidate(id).catch(() => null))
  );

  return results.filter(Boolean);
}

function rankCandidates(profile, candidates) {
  const ranked = candidates
    .map(candidate => {
      const context = `${candidate.title || candidate.name || ''} ${candidate.overview || ''}`.trim();
      const themeScore = scoreThemeOverlap(profile.themeWeights, context);
      const keywordScore = scoreKeywordOverlap(profile.keywords, context);
      const genreScore = scoreGenreHints(profile.preferredGenres, candidate.genre_ids);
      const sourceBoost = scoreSourceBoost(candidate);
      const ratingScore = Math.max(0, Number(candidate.vote_average || 0) - 6) * 1.8;
      const popularityScore = Math.min(6, (Number(candidate.popularity) || 0) / 35);
      const missingOverviewPenalty = candidate.overview ? 0 : 12;
      const weakThemePenalty = themeScore < 12 && keywordScore < 8 ? 28 : 0;
      const noThemePenalty = themeScore === 0 && keywordScore === 0 ? 18 : 0;

      return {
        ...candidate,
        _score:
          themeScore * 1.35
          + keywordScore
          + genreScore
          + sourceBoost
          + ratingScore
          + popularityScore
          - missingOverviewPenalty
          - weakThemePenalty
          - noThemePenalty,
      };
    })
    .sort((a, b) => b._score - a._score);

  const strongMatches = ranked.filter(item => item._score >= 26);
  return (strongMatches.length >= 6 ? strongMatches : ranked).slice(0, HOME_RESULT_LIMIT);
}

async function getQuoteForHome() {
  try {
    const res = await fetch(`${API_BASE}/quotes`);
    if (!res.ok) throw new Error('Quotes API error');
    const quotes = await res.json();
    if (Array.isArray(quotes) && quotes.length > 0) {
      const eligibleQuotes = quotes.filter(q => {
        const quoteText = q.quoteText || q.quote || '';
        const explicitThemes = Array.isArray(q.themes) ? q.themes.length : 0;
        return quoteText.trim() && (explicitThemes > 0 || analyzeWorkForThemes(quoteText).length > 0);
      });

      const pool = eligibleQuotes.length > 0 ? eligibleQuotes : quotes;
      const dailyIndex = hashString(`${getDayKey()}|${DAILY_QUOTE_SALT}`) % pool.length;
      const q = pool[dailyIndex];
      return {
        id: q.legacyId ?? q._id ?? q.id ?? null,
        quote: q.quoteText || q.quote,
        author: q.authorName || q.author,
        themes: q.themes || [],
      };
    }
  } catch (e) {
    console.warn('Local quotes failed, using fallback:', e.message);
  }

  const { getQuotes } = await import('/scripts/philosophersapi.js');
  const allQuotes = await getQuotes();
  if (allQuotes.length === 0) {
    return {
      id: null,
      quote: 'Think deeply, watch meaningfully.',
      author: 'PhiloMedia',
      themes: [],
    };
  }

  const eligibleQuotes = allQuotes.filter(q => {
    const quoteText = q.quote || '';
    const explicitThemes = Array.isArray(q.themes) ? q.themes.length : 0;
    return quoteText.trim() && (explicitThemes > 0 || analyzeWorkForThemes(quoteText).length > 0);
  });

  const pool = eligibleQuotes.length > 0 ? eligibleQuotes : allQuotes;
  const dailyIndex = hashString(`${getDayKey()}|${DAILY_QUOTE_SALT}`) % pool.length;
  const q = pool[dailyIndex];

  return {
    id: q.id ?? null,
    quote: q.quote,
    author: q.author,
    themes: q.themes || [],
  };
}

async function getFeaturedMediaForQuote(quoteData) {
  const profile = buildQuoteProfile(quoteData);
  const seed = hashString(`${quoteData.quote}|${quoteData.author}`);
  const genreFilter = profile.preferredGenres.slice(0, 3).join(',');

  const moviePopularPage = (seed % 4) + 1;
  const movieRatedPage = (Math.floor(seed / 7) % 4) + 1;
  const tvPopularPage = (Math.floor(seed / 13) % 4) + 1;
  const tvRatedPage = (Math.floor(seed / 17) % 4) + 1;
  const themedMoviePage = (Math.floor(seed / 19) % 5) + 1;
  const themedTvPage = (Math.floor(seed / 23) % 5) + 1;

  const [curatedCandidates, buckets] = await Promise.all([
    getCuratedCandidatesForQuote(quoteData.id).catch(() => []),
    Promise.all([
      discoverTMDB('movie', { page: moviePopularPage, sortBy: 'popularity.desc' }).then(items => ({ source: 'movie-popular', items })),
      discoverTMDB('movie', { page: movieRatedPage, sortBy: 'vote_average.desc' }).then(items => ({ source: 'movie-rated', items })),
      discoverTMDB('tv', { page: tvPopularPage, sortBy: 'popularity.desc' }).then(items => ({ source: 'tv-popular', items })),
      discoverTMDB('tv', { page: tvRatedPage, sortBy: 'vote_average.desc' }).then(items => ({ source: 'tv-rated', items })),
      genreFilter
        ? discoverTMDB('movie', {
            page: themedMoviePage,
            withGenres: genreFilter,
            sortBy: 'vote_average.desc',
          }).then(items => ({ source: 'movie-themed', items }))
        : Promise.resolve({ source: 'movie-themed', items: [] }),
      genreFilter
        ? discoverTMDB('tv', {
            page: themedTvPage,
            withGenres: genreFilter,
            sortBy: 'vote_average.desc',
          }).then(items => ({ source: 'tv-themed', items }))
        : Promise.resolve({ source: 'tv-themed', items: [] }),
    ]),
  ]);

  const candidates = mergeCandidateBuckets([
    { source: 'curated', items: curatedCandidates },
    ...buckets,
  ]);

  return {
    results: rankCandidates(profile, candidates),
    profile,
  };
}

function buildHighlightsContext(profile) {
  if (!profile || !Array.isArray(profile.themes) || profile.themes.length === 0) {
    return 'Works selected to resonate with today\'s quote.';
  }

  const themes = profile.themes.slice(0, 2).map(formatThemeLabel);

  if (themes.length === 1) {
    return `Works chosen for their affinity with ${themes[0]}.`;
  }

  return `Works chosen for their affinity with ${themes[0]} and ${themes[1]}.`;
}

export async function loadContent() {
  const quoteData = await getQuoteForHome();
  const { results, profile } = await getFeaturedMediaForQuote(quoteData);

  return {
    id: quoteData.id,
    quote: quoteData.quote,
    author: quoteData.author,
    themes: profile.themes,
    highlightsTitle: 'In dialogue with today\'s quote',
    highlightsContext: buildHighlightsContext(profile),
    results: Array.isArray(results) ? results : [],
  };
}
