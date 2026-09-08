import { DAILY_PAIRINGS } from '../data/dailyPairings.js';
import { resolveEditorialQuoteForLocale } from './editorialQuoteResolve.js';
import * as tmdbClient from './tmdbClient.js';

const DEFAULT_TIME_ZONE = process.env.DAILY_PAIRING_TIME_ZONE || 'America/Sao_Paulo';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;
const SUPPLEMENT_MINIMUM = 10;
const SUPPLEMENT_EXTRA_MARGIN = 4;
const mediaCache = new Map();
const MEDIA_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MEDIA_CACHE_MAX = 200;
/** @type {Map<string, Array<{ tmdbId: string, mediaType: string, _supplemental?: boolean }>>} */
const supplementalWorksByDayKey = new Map();

const THEME_GENRE_MAP = {
  identity: { movie: [18, 9648, 878], tv: [18, 9648, 10765] },
  power: { movie: [18, 80, 10752], tv: [18, 80, 10768] },
  truth: { movie: [9648, 53, 878], tv: [9648, 80, 10765] },
  ethics: { movie: [18, 12, 10752], tv: [18, 10759, 16] },
  time: { movie: [9648, 878, 18], tv: [9648, 18, 10765] },
  culture: { movie: [878, 9648, 53], tv: [10765, 9648, 18] },
  justice: { movie: [18, 80, 99], tv: [18, 80, 10768] },
  love: { movie: [10749, 18], tv: [18, 10766] },
};

function clampInteger(value, { min, max, fallback }) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function getDateParts(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
  };
}

function getDayOfYear(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone);
  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);

  return Math.floor((current - start) / 86400000) + 1;
}

function getDateKey(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const { year, month, day } = getDateParts(date, timeZone);
  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

function normalizeWorkKey(work) {
  return `${work.mediaType}:${work.tmdbId}`;
}

function dedupeWorks(works = []) {
  const seen = new Set();
  return works.filter(work => {
    if (!work?.tmdbId || !['movie', 'tv'].includes(work.mediaType)) return false;
    const key = normalizeWorkKey(work);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapDetailsToSummary(details, mediaType, { language = 'en-US' } = {}) {
  const overviewLocale = String(language || 'en-US').toLowerCase().startsWith('pt')
    ? 'pt'
    : 'en';
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
    vote_count: details.vote_count || 0,
    popularity: details.popularity || 0,
    genre_ids: Array.isArray(details.genres)
      ? details.genres.map(genre => genre?.id).filter(Boolean)
      : [],
    original_language: details.original_language || '',
    origin_country: Array.isArray(details.origin_country) ? details.origin_country : [],
    _overviewLocale: overviewLocale,
  };
}

async function getMediaSummary(work, language = 'en-US') {
  const cacheKey = `${normalizeWorkKey(work)}:${language}`;
  const now = Date.now();
  const cached = mediaCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  if (mediaCache.size >= MEDIA_CACHE_MAX && !mediaCache.has(cacheKey)) {
    const oldestKey = mediaCache.keys().next().value;
    if (oldestKey !== undefined) mediaCache.delete(oldestKey);
  }

  const promise = tmdbClient.getDetails(work.tmdbId, work.mediaType, { language })
    .then(details => mapDetailsToSummary(details, work.mediaType, { language }))
    .catch(() => null);

  mediaCache.set(cacheKey, { promise, expiresAt: now + MEDIA_CACHE_TTL_MS });
  return promise;
}

function getThemeGenresForEntry(entry) {
  const contextLower = String(entry?.context || '').toLowerCase();
  for (const [bucket, genres] of Object.entries(THEME_GENRE_MAP)) {
    if (contextLower.includes(bucket)) return genres;
  }
  return { movie: [18], tv: [18] };
}

async function supplementWithDiscovery(entry, existingIds, needed) {
  if (needed <= 0) return [];

  const genres = getThemeGenresForEntry(entry);
  const movieGenres = genres.movie.join(',');
  const tvGenres = genres.tv.join(',');

  const [movies, series] = await Promise.all([
    tmdbClient.getDiscover('movie', 1, {
      withGenres: movieGenres,
      sortBy: 'vote_average.desc',
      voteCountGte: 500,
    }).catch(() => []),
    tmdbClient.getDiscover('tv', 1, {
      withGenres: tvGenres,
      sortBy: 'vote_average.desc',
      voteCountGte: 200,
    }).catch(() => []),
  ]);

  const existingSet = new Set(existingIds.map(id => String(id)));
  const supplemental = [];
  let mi = 0;
  let si = 0;

  while (supplemental.length < needed && (mi < movies.length || si < series.length)) {
    if (mi < movies.length) {
      const m = movies[mi];
      mi += 1;
      if (m?.id != null && !existingSet.has(String(m.id))) {
        existingSet.add(String(m.id));
        supplemental.push({
          tmdbId: String(m.id),
          mediaType: 'movie',
          _supplemental: true,
        });
      }
    }
    if (si < series.length && supplemental.length < needed) {
      const s = series[si];
      si += 1;
      if (s?.id != null && !existingSet.has(String(s.id))) {
        existingSet.add(String(s.id));
        supplemental.push({
          tmdbId: String(s.id),
          mediaType: 'tv',
          _supplemental: true,
        });
      }
    }
  }

  return supplemental;
}

async function getCachedOrFetchSupplemental(entry, dateKey, slug, curatedWorks, supplementalNeeded) {
  if (supplementalNeeded <= 0) return [];

  const cacheKey = `${dateKey}:${slug}`;
  const curatedIds = curatedWorks.map(w => w.tmdbId);
  const fetchCount = supplementalNeeded + SUPPLEMENT_EXTRA_MARGIN;

  if (!supplementalWorksByDayKey.has(cacheKey)) {
    const list = await supplementWithDiscovery(entry, curatedIds, fetchCount);
    supplementalWorksByDayKey.set(cacheKey, list);
  }

  return supplementalWorksByDayKey.get(cacheKey) || [];
}

export function getPairingForDate(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  if (DAILY_PAIRINGS.length === 0) return null;

  const dayOfYear = getDayOfYear(date, timeZone);
  const index = (dayOfYear - 1) % DAILY_PAIRINGS.length;

  return {
    entry: DAILY_PAIRINGS[index],
    dayOfYear,
    dateKey: getDateKey(date, timeZone),
    index,
  };
}

export async function getDailyPairing({
  date = new Date(),
  limit = DEFAULT_LIMIT,
  offset = 0,
  timeZone = DEFAULT_TIME_ZONE,
  locale = 'en',
} = {}) {
  const selected = getPairingForDate(date, timeZone);
  if (!selected) return null;

  const curatedWorks = dedupeWorks(selected.entry.works);
  const supplementalNeeded = Math.max(0, SUPPLEMENT_MINIMUM - curatedWorks.length);
  let allWorks = curatedWorks;

  if (supplementalNeeded > 0) {
    const supplemental = await getCachedOrFetchSupplemental(
      selected.entry,
      selected.dateKey,
      selected.entry.slug,
      curatedWorks,
      supplementalNeeded,
    );
    allWorks = dedupeWorks([...curatedWorks, ...supplemental]);
  }

  const safeOffset = clampInteger(offset, {
    min: 0,
    max: Math.max(0, allWorks.length),
    fallback: 0,
  });
  const safeLimit = clampInteger(limit, {
    min: 1,
    max: MAX_LIMIT,
    fallback: DEFAULT_LIMIT,
  });
  const slice = allWorks.slice(safeOffset, safeOffset + safeLimit);
  const tmdbLanguage = locale === 'pt' ? 'pt-BR' : 'en-US';
  const results = (await Promise.all(slice.map(work => getMediaSummary(work, tmdbLanguage)))).filter(Boolean);
  const nextOffset = safeOffset + slice.length;
  const englishQuote = String(selected.entry.quote || '').trim();
  const displayQuote = await resolveEditorialQuoteForLocale(
    { quote: englishQuote, author: selected.entry.author },
    locale,
  );

  return {
    source: 'editorial-calendar',
    calendarSize: DAILY_PAIRINGS.length,
    dateKey: selected.dateKey,
    dayOfYear: selected.dayOfYear,
    slug: selected.entry.slug,
    quote: displayQuote,
    quote_en: englishQuote,
    author: selected.entry.author,
    themes: selected.entry.themes,
    highlightsTitle: 'In dialogue with today\'s quote',
    highlightsContext: selected.entry.context,
    results,
    offset: safeOffset,
    limit: safeLimit,
    returnedWorks: results.length,
    totalWorks: allWorks.length,
    nextOffset,
    hasMore: nextOffset < allWorks.length,
  };
}

export function clearDailyPairingCache() {
  mediaCache.clear();
  supplementalWorksByDayKey.clear();
}
