import {
  buildLensCrewDiscoverJobs,
  buildLensPrimaryDiscoverJobs,
  isLensDiscoverPoolShort,
} from '../../public/scripts/domain/searchLensDiscover.js';
import { getLensById } from '../../public/scripts/domain/searchFilters.js';

describe('lens first-paint discover', () => {
  test('plans one keyword discover per media type and never reviews', () => {
    const lens = getLensById('epistemology');
    const jobs = buildLensPrimaryDiscoverJobs(lens, { page: 1 });

    expect(jobs).toHaveLength(2);
    expect(jobs.map(job => job.mediaType).sort()).toEqual(['movie', 'tv']);
    expect(jobs.every(job => job.options.withKeywords)).toBe(true);
    expect(JSON.stringify(jobs)).not.toMatch(/review/i);
  });

  test('keeps crew off the first paint', () => {
    const lens = getLensById('epistemology');
    const primary = buildLensPrimaryDiscoverJobs(lens);
    const crew = buildLensCrewDiscoverJobs(lens);

    expect(primary.every(job => !job.options.withCrew)).toBe(true);
    expect(crew.length === 0 || crew.every(job => job.options.withCrew)).toBe(true);
  });

  test('marks a tiny pool as short so crew can run as fallback', () => {
    expect(isLensDiscoverPoolShort([])).toBe(true);
    expect(isLensDiscoverPoolShort([
      { media_type: 'movie' },
      { media_type: 'movie' },
      { media_type: 'tv' },
    ])).toBe(true);
    expect(isLensDiscoverPoolShort(
      Array.from({ length: 10 }, () => ({ media_type: 'movie' }))
        .concat(Array.from({ length: 10 }, () => ({ media_type: 'tv' })))
    )).toBe(false);
  });
});
