import { collectDailyPairingWorkEntries, collectSitemapEntries } from '../../src/services/sitemapUrls.js';

describe('sitemap curated URLs', () => {
  test('includes thinkers and unique daily-pairing works, not a TMDB dump', () => {
    const entries = collectSitemapEntries();
    const paths = entries.map(entry => entry.path);

    expect(paths).toContain('/html/index.html');
    expect(paths).toContain('/html/philosophers.html');
    expect(paths.some(path => path.includes('philosopher.html?slug=socrates'))).toBe(true);
    expect(paths.some(path => path.includes('details.html?id='))).toBe(true);

    const workCount = collectDailyPairingWorkEntries().length;
    expect(workCount).toBeGreaterThan(0);
    expect(workCount).toBeLessThan(5000);
  });

  test('deduplicates pairing works by media type and id', () => {
    const works = collectDailyPairingWorkEntries([
      { works: [{ tmdbId: '550', mediaType: 'movie' }, { tmdbId: '550', mediaType: 'movie' }] },
      { works: [{ tmdbId: '550', mediaType: 'movie' }, { tmdbId: '1396', mediaType: 'tv' }] },
    ]);

    expect(works).toEqual([
      { path: '/html/details.html?id=550&type=movie', changefreq: 'weekly', priority: '0.6' },
      { path: '/html/details.html?id=1396&type=tv', changefreq: 'weekly', priority: '0.6' },
    ]);
  });
});
