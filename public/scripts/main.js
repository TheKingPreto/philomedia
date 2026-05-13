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
const HOME_RESULT_LIMIT = 10;
const DAILY_PAIRING_ENDPOINT = `${API_BASE}/daily-pairing`;
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

const QUOTE_SOURCE_BOOST = {
  custom: 24,
  system: 22,
  database: 20,
  import: 16,
  'database-import': 16,
  'user-submitted': 14,
  wikiquote: 8,
  'wikiquote-en': 8,
  'wikiquote-machine': 5,
};

const GENERIC_QUOTE_PATTERNS = [
  /\b(life|world|people|things|everything|nothing)\s+(is|are)\s+(good|bad|beautiful|important|difficult|simple)\b/i,
  /\b(always|never)\s+(be|do|say|think|remember)\b/i,
  /\b(be yourself|follow your dreams|think positive|never give up)\b/i,
];

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
  hedonism: [18, 35, 10749],
  utilitarianism: [18, 80, 53, 99],
};

const THEME_TEXT_SIGNAL_OVERRIDES = {
  hedonism: [
    'happiness', 'pleasure', 'pain', 'suffering', 'wellbeing', 'well being',
    'desire', 'satisfaction', 'comfort', 'health', 'patient', 'patients',
    'joy', 'misery', 'harm', 'benefit',
  ],
  utilitarianism: [
    'greater good', 'consequence', 'consequences', 'save lives', 'saving lives',
    'lives', 'sacrifice', 'survival', 'patient', 'patients', 'hospital',
    'doctor', 'surgeon', 'medicine', 'crime', 'police', 'detective',
    'criminal', 'criminals', 'justice', 'punishment', 'institution',
    'institutions', 'system', 'policy', 'social', 'drug', 'drugs',
    'murder', 'killer', 'corruption', 'community', 'public',
  ],
  virtue: ['virtue', 'honor', 'honour', 'courage', 'duty', 'character', 'integrity', 'sacrifice'],
  'political-philosophy': ['government', 'state', 'law', 'power', 'institution', 'system', 'policy', 'public'],
  'social-justice': ['justice', 'inequality', 'poverty', 'class', 'rights', 'community', 'system', 'institution'],
  'power-corruption': ['power', 'corruption', 'control', 'authority', 'crime', 'greed', 'ambition'],
  'truth-deception': ['truth', 'lie', 'lies', 'deception', 'secret', 'illusion', 'conspiracy'],
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

function getQuoteText(quoteData) {
  return String(quoteData?.quote ?? quoteData?.quoteText ?? '').trim();
}

function getQuoteAuthor(quoteData) {
  return String(quoteData?.author ?? quoteData?.authorName ?? '').trim();
}

function getQuoteSource(quoteData) {
  return String(quoteData?.source || quoteData?.submissionSource || '').trim().toLowerCase();
}

function scoreQuoteCandidate(quoteData) {
  const quoteText = getQuoteText(quoteData);
  const author = getQuoteAuthor(quoteData);
  if (!quoteText || !author) return -Infinity;

  const explicitThemes = Array.isArray(quoteData.themes)
    ? quoteData.themes.filter(theme => THEME_DATABASE[String(theme).trim().toLowerCase()]).length
    : 0;
  const inferredThemes = analyzeWorkForThemes(quoteText);
  const topThemeScore = inferredThemes[0]?.score || 0;
  const wordCount = quoteText.split(/\s+/).filter(Boolean).length;
  const uniqueWords = new Set(normalizeText(quoteText).split(' ').filter(word => word.length > 3));
  const source = getQuoteSource(quoteData);
  const sourceBoost = QUOTE_SOURCE_BOOST[source] ?? (
    source.startsWith('wikiquote') ? QUOTE_SOURCE_BOOST.wikiquote : 10
  );

  let score = sourceBoost
    + explicitThemes * 10
    + Math.min(34, topThemeScore * 2)
    + Math.min(16, uniqueWords.size * 1.4);

  if (wordCount >= 9 && wordCount <= 34) score += 16;
  if (wordCount < 6) score -= 28;
  if (wordCount > 48) score -= 12;
  if (GENERIC_QUOTE_PATTERNS.some(pattern => pattern.test(quoteText))) score -= 30;
  if (!explicitThemes && inferredThemes.length === 0) score -= 40;

  return score;
}

function normalizeQuoteEntry(entry) {
  return {
    id: entry.legacyId ?? entry._id ?? entry.id ?? null,
    quote: getQuoteText(entry),
    author: getQuoteAuthor(entry),
    themes: Array.isArray(entry.themes) ? entry.themes : [],
    source: getQuoteSource(entry),
    _qualityScore: scoreQuoteCandidate(entry),
  };
}

function selectDailyQuote(quotes) {
  const normalizedQuotes = quotes.map(normalizeQuoteEntry).filter(entry => entry.quote && entry.author);
  if (normalizedQuotes.length === 0) return null;

  const eligibleQuotes = normalizedQuotes.filter(entry => {
    const explicitThemes = Array.isArray(entry.themes) ? entry.themes.length : 0;
    return explicitThemes > 0 || analyzeWorkForThemes(entry.quote).length > 0;
  });

  const pool = (eligibleQuotes.length > 0 ? eligibleQuotes : normalizedQuotes)
    .sort((a, b) => b._qualityScore - a._qualityScore);
  const highQualityPool = pool.filter(entry => entry._qualityScore >= 30);
  const rotationPool = (highQualityPool.length >= 20 ? highQualityPool : pool).slice(0, 120);
  const dailyIndex = hashString(`${getDayKey()}|${DAILY_QUOTE_SALT}`) % rotationPool.length;

  return rotationPool[dailyIndex];
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

function getBalancedPreferredGenres(rankedThemes, limit = 6) {
  const groups = rankedThemes
    .slice(0, 3)
    .map(theme => THEME_GENRE_HINTS[theme] || [])
    .filter(group => group.length > 0);
  const genres = [];

  for (let index = 0; genres.length < limit && index < 4; index += 1) {
    groups.forEach(group => {
      const genre = group[index];
      if (genre && !genres.includes(genre) && genres.length < limit) {
        genres.push(genre);
      }
    });
  }

  return genres;
}

function getThemeGenreFilters(rankedThemes) {
  return rankedThemes
    .slice(0, 3)
    .map(theme => {
      const genres = (THEME_GENRE_HINTS[theme] || []).slice(0, 2);
      return genres.length > 0
        ? { theme, withGenres: genres.join(',') }
        : null;
    })
    .filter(Boolean);
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

  const preferredGenres = getBalancedPreferredGenres(rankedThemes);

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

function getThemeSignals(theme) {
  const databaseSignals = Object.entries(THEME_DATABASE[theme] || {})
    .filter(([, weight]) => weight > 0)
    .map(([keyword]) => keyword);
  const overrideSignals = THEME_TEXT_SIGNAL_OVERRIDES[theme] || [];

  return [...new Set([...databaseSignals, ...overrideSignals])];
}

function countSignalMatches(theme, candidateText) {
  const signals = getThemeSignals(theme);
  if (signals.length === 0) return 0;

  const normalized = normalizeText(candidateText);
  return signals.reduce((total, signal) => {
    const normalizedSignal = normalizeText(signal);
    if (!normalizedSignal) return total;
    return total + (normalized.includes(normalizedSignal) ? 1 : 0);
  }, 0);
}

function scoreThemeSignals(themeWeights, candidateText) {
  let score = 0;

  for (const [theme, sourceWeight] of themeWeights.entries()) {
    const matches = countSignalMatches(theme, candidateText);
    if (matches > 0) {
      score += Math.min(22, matches * 7) * sourceWeight;
    }
  }

  return score;
}

function hasThemeEvidence(theme, candidateWeights, candidateText) {
  if (candidateWeights.get(theme)) return true;
  return countSignalMatches(theme, candidateText) > 0;
}

function scorePrimaryThemeFit(profile, candidateWeights, candidateText) {
  const primaryThemes = profile.themes.slice(0, Math.min(2, profile.themes.length));
  if (primaryThemes.length === 0) {
    return { bonus: 0, penalty: 0, misses: [] };
  }

  const misses = primaryThemes.filter(theme => !hasThemeEvidence(theme, candidateWeights, candidateText));
  const matchedCount = primaryThemes.length - misses.length;

  return {
    bonus: matchedCount === primaryThemes.length ? 18 : matchedCount * 4,
    penalty: misses.reduce((total, theme, index) => total + (index === 0 ? 24 : 16), 0),
    misses,
  };
}

function scoreConceptDriftPenalty(profile, candidateWeights, candidateText) {
  const themes = new Set(profile.themes.slice(0, 2));
  let penalty = 0;

  // Generic guard: a candidate that only touches a tempting adjacent keyword
  // should not satisfy a two-theme philosophical promise.
  if (themes.has('hedonism') && themes.has('utilitarianism')) {
    const hasUtilitarianEvidence = hasThemeEvidence('utilitarianism', candidateWeights, candidateText);
    const hasWellbeingEvidence = hasThemeEvidence('hedonism', candidateWeights, candidateText)
      || /\b(happiness|suffering|pain|harm|benefit|wellbeing|well being|patient|patients|health)\b/i.test(candidateText);
    const isPleasureOnly = /\b(erotic|sexual|desire|affair|seduction|lust)\b/i.test(candidateText)
      && !hasUtilitarianEvidence;

    if (!hasUtilitarianEvidence) penalty += 42;
    if (!hasWellbeingEvidence) penalty += 18;
    if (isPleasureOnly) penalty += 34;
  }

  return penalty;
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
  if (sources.some(source => source.startsWith('movie-theme-') || source.startsWith('tv-theme-'))) score += 9;
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
      const candidateWeights = createWeightMap(analyzeWorkForThemes(context));
      const themeScore = scoreThemeOverlap(profile.themeWeights, context);
      const signalScore = scoreThemeSignals(profile.themeWeights, context);
      const keywordScore = scoreKeywordOverlap(profile.keywords, context);
      const genreScore = scoreGenreHints(profile.preferredGenres, candidate.genre_ids);
      const sourceBoost = scoreSourceBoost(candidate);
      const ratingScore = Math.max(0, Number(candidate.vote_average || 0) - 6) * 1.8;
      const popularityScore = Math.min(6, (Number(candidate.popularity) || 0) / 35);
      const missingOverviewPenalty = candidate.overview ? 0 : 12;
      const primaryThemeFit = scorePrimaryThemeFit(profile, candidateWeights, context);
      const evidenceScore = themeScore + signalScore + keywordScore;
      const weakThemePenalty = themeScore + signalScore < 16 && keywordScore < 8 ? 22 : 0;
      const noThemePenalty = themeScore === 0 && signalScore === 0 && keywordScore === 0 ? 28 : 0;
      const driftPenalty = scoreConceptDriftPenalty(profile, candidateWeights, context);

      return {
        ...candidate,
        _score:
          themeScore * 1.45
          + signalScore
          + keywordScore
          + genreScore
          + sourceBoost
          + ratingScore
          + popularityScore * 0.45
          + primaryThemeFit.bonus
          - missingOverviewPenalty
          - weakThemePenalty
          - noThemePenalty
          - primaryThemeFit.penalty
          - driftPenalty,
        _primaryThemeMisses: primaryThemeFit.misses.length,
        _evidenceScore: evidenceScore,
        _driftPenalty: driftPenalty,
      };
    })
    .sort((a, b) => b._score - a._score);

  const strongMatches = ranked.filter(item => item._score >= 30 && item._primaryThemeMisses === 0);
  const goodMatches = ranked.filter(item =>
    item._score >= 18
    && item._primaryThemeMisses <= 1
    && item._evidenceScore >= 10
    && item._driftPenalty < 42
  );
  const looseMatches = ranked.filter(item =>
    item._score >= 8
    && item._primaryThemeMisses <= 1
    && item._evidenceScore >= 7
    && item._driftPenalty < 34
  );
  const alignedPool = [
    ...strongMatches,
    ...goodMatches.filter(item => !strongMatches.includes(item)),
    ...looseMatches.filter(item => !strongMatches.includes(item) && !goodMatches.includes(item)),
  ];
  const pool = alignedPool.length > 0 ? alignedPool : ranked.slice(0, 3);

  return pool.slice(0, HOME_RESULT_LIMIT);
}

async function getQuoteForHome() {
  try {
    const res = await fetch(`${API_BASE}/quotes/catalog?lang=en`);
    if (!res.ok) throw new Error('Quotes API error');
    const quotes = await res.json();
    if (Array.isArray(quotes) && quotes.length > 0) {
      const selectedQuote = selectDailyQuote(quotes);
      if (selectedQuote) return selectedQuote;
    }
  } catch (e) {
    console.warn('Quote catalog failed, using fallback:', e.message);
  }

  try {
    const res = await fetch(`${API_BASE}/quotes`);
    if (!res.ok) throw new Error('Quotes API error');
    const quotes = await res.json();
    if (Array.isArray(quotes) && quotes.length > 0) {
      const selectedQuote = selectDailyQuote(quotes);
      if (selectedQuote) return selectedQuote;
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

  return selectDailyQuote(allQuotes) || {
    id: null,
    quote: 'Think deeply, watch meaningfully.',
    author: 'PhiloMedia',
    themes: [],
  };
}

function buildDailyPairingUrl({ limit = HOME_RESULT_LIMIT, offset = 0 } = {}) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return `${DAILY_PAIRING_ENDPOINT}?${params.toString()}`;
}

function mapDailyPairingContent(payload) {
  return {
    id: payload.slug || null,
    source: payload.source || 'editorial-calendar',
    quote: payload.quote,
    author: payload.author,
    themes: payload.themes || [],
    highlightsTitle: payload.highlightsTitle || 'In dialogue with today\'s quote',
    highlightsContext: payload.highlightsContext || 'Works selected to resonate with today\'s quote.',
    results: Array.isArray(payload.results) ? payload.results : [],
    totalWorks: Number(payload.totalWorks) || 0,
    returnedWorks: Number(payload.returnedWorks) || 0,
    nextOffset: Number(payload.nextOffset) || 0,
    hasMore: Boolean(payload.hasMore),
  };
}

async function getEditorialDailyContent({ offset = 0, limit = HOME_RESULT_LIMIT } = {}) {
  const res = await fetch(buildDailyPairingUrl({ limit, offset }));
  if (!res.ok) throw new Error('Daily pairing unavailable');

  const payload = await res.json();
  const content = mapDailyPairingContent(payload);
  if (!content.quote || !content.author || content.results.length === 0) {
    throw new Error('Daily pairing incomplete');
  }

  return content;
}

async function getFeaturedMediaForQuote(quoteData) {
  const profile = buildQuoteProfile(quoteData);
  const seed = hashString(`${quoteData.quote}|${quoteData.author}`);
  const genreFilter = profile.preferredGenres.slice(0, 3).join(',');
  const themeGenreFilters = getThemeGenreFilters(profile.themes);

  const moviePopularPage = (seed % 4) + 1;
  const movieRatedPage = (Math.floor(seed / 7) % 4) + 1;
  const tvPopularPage = (Math.floor(seed / 13) % 4) + 1;
  const tvRatedPage = (Math.floor(seed / 17) % 4) + 1;
  const themedMoviePage = (Math.floor(seed / 19) % 5) + 1;
  const themedTvPage = (Math.floor(seed / 23) % 5) + 1;
  const themeDiscoveries = themeGenreFilters.flatMap((filter, index) => {
    const page = ((Math.floor(seed / (29 + index * 6)) + index) % 5) + 1;
    return [
      discoverTMDB('movie', {
        page,
        withGenres: filter.withGenres,
        sortBy: 'vote_average.desc',
      }).then(items => ({ source: `movie-theme-${filter.theme}`, items })),
      discoverTMDB('tv', {
        page,
        withGenres: filter.withGenres,
        sortBy: 'vote_average.desc',
      }).then(items => ({ source: `tv-theme-${filter.theme}`, items })),
    ];
  });

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
      ...themeDiscoveries,
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
  try {
    return await getEditorialDailyContent();
  } catch (error) {
    console.warn('Daily editorial pairing failed, using ranked fallback:', error.message);
  }

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

export async function loadMoreContent(offset, limit = HOME_RESULT_LIMIT) {
  return getEditorialDailyContent({ offset, limit });
}
