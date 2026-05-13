import { DAILY_PAIRINGS } from '../data/dailyPairings.js';
import * as tmdbClient from './tmdbClient.js';

const DEFAULT_TIME_ZONE = process.env.DAILY_PAIRING_TIME_ZONE || 'America/Sao_Paulo';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 10;
const mediaCache = new Map();

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

function mapDetailsToSummary(details, mediaType) {
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
  };
}

async function getMediaSummary(work) {
  const cacheKey = normalizeWorkKey(work);
  if (!mediaCache.has(cacheKey)) {
    mediaCache.set(cacheKey, tmdbClient.getDetails(work.tmdbId, work.mediaType)
      .then(details => mapDetailsToSummary(details, work.mediaType))
      .catch(() => null));
  }

  return mediaCache.get(cacheKey);
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
} = {}) {
  const selected = getPairingForDate(date, timeZone);
  if (!selected) return null;

  const allWorks = dedupeWorks(selected.entry.works);
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
  const results = (await Promise.all(slice.map(getMediaSummary))).filter(Boolean);
  const nextOffset = safeOffset + slice.length;

  return {
    source: 'editorial-calendar',
    calendarSize: DAILY_PAIRINGS.length,
    dateKey: selected.dateKey,
    dayOfYear: selected.dayOfYear,
    slug: selected.entry.slug,
    quote: selected.entry.quote,
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
}
