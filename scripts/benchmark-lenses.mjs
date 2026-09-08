/**
 * One-shot TMDB lens benchmark (alienation, self-knowledge, humanism).
 * Uses TMDB_API_KEY from .env. Prints pool size, overview hit, keyword hit,
 * unique top-5 titles, and max lenses overlapping a title.
 *
 * Usage: node scripts/benchmark-lenses.mjs
 */
import 'dotenv/config';
import { LENS_FILTERS, getLensKeywordQuery, getLensTextKeywords } from '../public/scripts/domain/searchFilters.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TARGET_IDS = ['alienation', 'self-knowledge', 'humanism'];
const SAMPLE_DETAILS = 12;

function getApiKey() {
  const key = process.env.TMDB_API_KEY;
  if (!key) {
    throw new Error('TMDB_API_KEY is not set.');
  }
  return key;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tmdbGet(path, params = {}) {
  const search = new URLSearchParams({ api_key: getApiKey(), language: 'en-US', ...params });
  const response = await fetch(`${TMDB_BASE_URL}${path}?${search}`);
  if (response.status === 429) {
    await sleep(1200);
    return tmdbGet(path, params);
  }
  if (!response.ok) {
    throw new Error(`TMDB ${path} failed with ${response.status}`);
  }
  return response.json();
}

function normalize(text) {
  return String(text || '').toLowerCase();
}

function uniqueKey(item, media) {
  return `${media}:${item.id}`;
}

function extractKeywordList(details) {
  const payload = details?.keywords;
  const list = Array.isArray(payload?.keywords)
    ? payload.keywords
    : Array.isArray(payload?.results)
      ? payload.results
      : [];
  return list.map(entry => ({
    id: Number(entry?.id) || 0,
    name: String(entry?.name || '').trim(),
  })).filter(entry => entry.id || entry.name);
}

function overviewHitsLens(overview, lens) {
  const text = normalize(overview);
  if (!text) return false;
  return getLensTextKeywords(lens).some(term => text.includes(normalize(term)));
}

function keywordsHitLens(keywords, lens) {
  const ids = new Set((lens.tmdbKeywords || []).map(item => Number(item.id)));
  const names = new Set(getLensTextKeywords(lens).map(normalize));
  return keywords.some(entry => ids.has(entry.id) || names.has(normalize(entry.name)));
}

async function discoverLensPool(lens) {
  const withKeywords = getLensKeywordQuery(lens);
  const mediaTypes = ['movie', 'tv'];
  const sorts = ['vote_average.desc', 'popularity.desc'];
  const merged = new Map();

  for (const media of mediaTypes) {
    for (const sortBy of sorts) {
      const data = await tmdbGet(`/discover/${media}`, {
        with_keywords: withKeywords,
        sort_by: sortBy,
        'vote_count.gte': '120',
        page: '1',
      });
      for (const item of data.results || []) {
        merged.set(uniqueKey(item, media), { ...item, media_type: media });
      }
      await sleep(80);
    }
  }

  return [...merged.values()];
}

async function sampleDetails(pool) {
  const sample = pool
    .slice()
    .sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0))
    .slice(0, SAMPLE_DETAILS);

  const detailed = [];
  for (const item of sample) {
    const details = await tmdbGet(`/${item.media_type}/${item.id}`, {
      append_to_response: 'keywords',
    });
    detailed.push({
      ...item,
      overview: details.overview || item.overview || '',
      tmdbKeywords: extractKeywordList(details),
    });
    await sleep(80);
  }
  return detailed;
}

function maxLensesOnTitle(item) {
  let count = 0;
  for (const lens of LENS_FILTERS) {
    const keywordHit = keywordsHitLens(item.tmdbKeywords || [], lens);
    const textHit = overviewHitsLens(item.overview, lens);
    if (keywordHit || textHit) count += 1;
  }
  return count;
}

function pct(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

async function main() {
  const rows = [];

  for (const id of TARGET_IDS) {
    const lens = LENS_FILTERS.find(item => item.id === id);
    const pool = await discoverLensPool(lens);
    const detailed = await sampleDetails(pool);
    const overviewHits = detailed.filter(item => overviewHitsLens(item.overview, lens)).length;
    const keywordHits = detailed.filter(item => keywordsHitLens(item.tmdbKeywords, lens)).length;
    const eitherHits = detailed.filter(item =>
      overviewHitsLens(item.overview, lens) || keywordsHitLens(item.tmdbKeywords, lens)
    ).length;
    const top5 = pool
      .slice()
      .sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0))
      .slice(0, 5)
      .map(item => item.title || item.name);
    const maxLenses = detailed.reduce((max, item) => Math.max(max, maxLensesOnTitle(item)), 0);

    rows.push({
      lens: id,
      pool: pool.length,
      sample: detailed.length,
      overviewHit: pct(overviewHits, detailed.length),
      keywordHit: pct(keywordHits, detailed.length),
      eitherHit: pct(eitherHits, detailed.length),
      top5: top5.join(' · '),
      maxLenses,
    });
  }

  console.log('\nLens benchmark (TMDB discover keywords, page 1 movie+tv rated/popular)\n');
  console.log('| Lens | Pool | Overview hit | Keyword hit | Synopsis OR keywords | Top-5 | Max lenses/title |');
  console.log('| --- | ---: | ---: | ---: | ---: | --- | ---: |');
  for (const row of rows) {
    console.log(
      `| ${row.lens} | ${row.pool} | ${row.overviewHit} | ${row.keywordHit} | ${row.eitherHit} | ${row.top5} | ${row.maxLenses} |`
    );
  }
  console.log(`\nSample size for hit rates: up to ${SAMPLE_DETAILS} details per lens (append keywords).\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
