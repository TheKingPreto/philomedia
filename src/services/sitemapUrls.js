import { DAILY_PAIRINGS } from '../data/dailyPairings.js';
import { PHILOSOPHER_AUTHORS } from '../../public/scripts/domain/philosopherAuthors.js';

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

export function collectSitemapEntries() {
  const thinkers = PHILOSOPHER_AUTHORS.map(author => ({
    path: `/html/philosopher.html?slug=${encodeURIComponent(author.slug)}`,
    changefreq: 'weekly',
    priority: '0.7',
  }));

  return [
    ...STATIC_PAGES,
    ...thinkers,
    ...collectDailyPairingWorkEntries(),
  ];
}
