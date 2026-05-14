import { jest } from '@jest/globals';

const mockGetDetails = jest.fn();
const mockGetDiscover = jest.fn();

await jest.unstable_mockModule('../../src/services/tmdbClient.js', () => ({
  getDetails: mockGetDetails,
  getDiscover: mockGetDiscover,
}));

const {
  clearDailyPairingCache,
  getDailyPairing,
  getPairingForDate,
} = await import('../../src/services/dailyPairingService.js');

describe('daily pairing service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearDailyPairingCache();
    let discoverId = 900_000;
    mockGetDiscover.mockImplementation((media, _page, _opts) => Promise.resolve(
      Array.from({ length: 12 }, () => {
        discoverId += 1;
        return {
          id: discoverId,
          title: media === 'movie' ? `Discover ${discoverId}` : undefined,
          name: media === 'tv' ? `Discover ${discoverId}` : undefined,
          overview: 'discover',
          media_type: media,
          poster_path: null,
          release_date: media === 'movie' ? '2019-01-01' : null,
          first_air_date: media === 'tv' ? '2019-01-01' : null,
          vote_average: 7.5,
          vote_count: 600,
          popularity: 40,
          genre_ids: [18],
          original_language: 'en',
          origin_country: ['US'],
        };
      }),
    ));
    mockGetDetails.mockImplementation((id, type) => Promise.resolve({
      id: Number(id),
      title: type === 'movie' ? `Movie ${id}` : undefined,
      name: type === 'tv' ? `Series ${id}` : undefined,
      overview: `Overview for ${id}`,
      poster_path: '/poster.jpg',
      release_date: type === 'movie' ? '2020-01-01' : null,
      first_air_date: type === 'tv' ? '2020-01-01' : null,
      vote_average: 8,
      vote_count: 200,
      popularity: 25,
      genres: [{ id: 18 }],
      original_language: 'en',
      origin_country: ['US'],
    }));
  });

  test('selects a deterministic editorial slot for the day', () => {
    const first = getPairingForDate(new Date('2026-01-01T12:00:00Z'));
    const second = getPairingForDate(new Date('2026-01-01T23:00:00Z'));

    expect(first.entry.slug).toBe(second.entry.slug);
    expect(first.dayOfYear).toBe(1);
    expect(first.dateKey).toBe('2026-01-01');
  });

  test('hydrates only the requested page of works', async () => {
    const result = await getDailyPairing({
      date: new Date('2026-01-01T12:00:00Z'),
      limit: 2,
      offset: 1,
    });

    expect(result.source).toBe('editorial-calendar');
    expect(result.results).toHaveLength(2);
    expect(result.offset).toBe(1);
    expect(result.nextOffset).toBe(3);
    expect(result.hasMore).toBe(true);
    expect(mockGetDetails).toHaveBeenCalledTimes(2);
  });

  test('caps frontend pages at ten works', async () => {
    const result = await getDailyPairing({
      date: new Date('2026-01-01T12:00:00Z'),
      limit: 50,
      offset: 0,
    });

    expect(result.results.length).toBeLessThanOrEqual(10);
    expect(result.limit).toBe(10);
  });

  test('extends editorial list with discover when curated works are below the minimum', async () => {
    const date = new Date('2026-01-01T12:00:00Z');
    const result = await getDailyPairing({ date, limit: 10, offset: 0 });

    expect(result.totalWorks).toBeGreaterThanOrEqual(10);
    expect(mockGetDiscover).toHaveBeenCalledTimes(2);
    expect(mockGetDiscover).toHaveBeenCalledWith(
      'movie',
      1,
      expect.objectContaining({
        withGenres: expect.any(String),
        sortBy: 'vote_average.desc',
        voteCountGte: 500,
      }),
    );
    expect(mockGetDiscover).toHaveBeenCalledWith(
      'tv',
      1,
      expect.objectContaining({
        sortBy: 'vote_average.desc',
        voteCountGte: 200,
      }),
    );
  });

  test('does not refetch discover for the same calendar day while cache is warm', async () => {
    const date = new Date('2026-01-01T12:00:00Z');
    await getDailyPairing({ date, limit: 10, offset: 0 });
    const discoverCallsAfterFirst = mockGetDiscover.mock.calls.length;

    await getDailyPairing({ date, limit: 5, offset: 5 });
    expect(mockGetDiscover.mock.calls.length).toBe(discoverCallsAfterFirst);
  });

  test('clearDailyPairingCache allows discover to run again for the same day', async () => {
    const date = new Date('2026-01-01T12:00:00Z');
    await getDailyPairing({ date, limit: 10, offset: 0 });
    const discoverCallsAfterFirst = mockGetDiscover.mock.calls.length;

    clearDailyPairingCache();
    await getDailyPairing({ date, limit: 10, offset: 0 });
    expect(mockGetDiscover.mock.calls.length).toBeGreaterThan(discoverCallsAfterFirst);
  });

  test('reports hasMore across pages using curated plus supplemental length', async () => {
    const date = new Date('2026-01-01T12:00:00Z');
    const first = await getDailyPairing({ date, limit: 4, offset: 0 });
    expect(first.hasMore).toBe(true);
    expect(first.nextOffset).toBe(4);

    const lastOffset = Math.max(0, first.totalWorks - 3);
    const tail = await getDailyPairing({ date, limit: 10, offset: lastOffset });
    expect(tail.offset).toBe(lastOffset);
    expect(tail.hasMore).toBe(false);
    expect(tail.nextOffset).toBe(tail.offset + tail.results.length);
  });
});
