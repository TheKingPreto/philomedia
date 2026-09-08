import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DAILY_PAIRINGS } from '../data/dailyPairings.js';
import { PHILOSOPHER_AUTHORS } from '../../public/scripts/domain/philosopherAuthors.js';
import { CURATED_TV_IDS } from '../../public/scripts/domain/curatedTvIds.js';

const curatedQuoteMatches = JSON.parse(
  readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/data/curatedMatches.json'),
    'utf8'
  )
);

const STATIC_PAGES = [
  { path: '/html/index.html', changefreq: 'daily', priority: '1.0' },
  { path: '/html/search.html', changefreq: 'weekly', priority: '0.9' },
  { path: '/html/philosophers.html', changefreq: 'weekly', priority: '0.9' },
];

export function collectDailyPairingWorkEntries(pairings = DAILY_PAIRINGS) {
  const seen = new Set();
  const works = [];

  pairings.forEach(pairing => {
    (pairing.works || []).forEach(work => {
      const id = String(work?.tmdbId || '').trim();
      const mediaType = work?.mediaType === 'tv' ? 'tv' : 'movie';
      if (!id) return;

      const key = `${mediaType}:${id}`;
      if (seen.has(key)) return;
      seen.add(key);

      works.push({
        path: `/html/details.html?id=${encodeURIComponent(id)}&type=${encodeURIComponent(mediaType)}`,
        changefreq: 'weekly',
        priority: '0.6',
      });
    });
  });

  return works;
}

export function collectCuratedCatalogWorkEntries() {
  const seen = new Set();
  const works = [];

  const push = (id, mediaType) => {
    const tmdbId = String(id || '').trim();
    const type = mediaType === 'tv' ? 'tv' : 'movie';
    if (!tmdbId) return;
    const key = `${type}:${tmdbId}`;
    if (seen.has(key)) return;
    seen.add(key);
    works.push({
      path: `/html/details.html?id=${encodeURIComponent(tmdbId)}&type=${encodeURIComponent(type)}`,
      changefreq: 'weekly',
      priority: '0.55',
    });
  };

  Object.keys(curatedQuoteMatches || {}).forEach(id => {
    push(id, CURATED_TV_IDS.has(String(id)) ? 'tv' : 'movie');
  });

  CURATED_TV_IDS.forEach(id => push(id, 'tv'));

  return works;
}

export function collectSitemapEntries() {
  const thinkers = PHILOSOPHER_AUTHORS.map(author => ({
    path: `/html/philosopher.html?slug=${encodeURIComponent(author.slug)}`,
    changefreq: 'weekly',
    priority: '0.7',
  }));

  const pairingWorks = collectDailyPairingWorkEntries();
  const pairingKeys = new Set(
    pairingWorks.map(entry => entry.path)
  );
  const extraWorks = collectCuratedCatalogWorkEntries()
    .filter(entry => !pairingKeys.has(entry.path));

  return [
    ...STATIC_PAGES,
    ...thinkers,
    ...pairingWorks,
    ...extraWorks,
  ];
}
