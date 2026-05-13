import { jest } from '@jest/globals';

const mockGetDetails = jest.fn();

await jest.unstable_mockModule('../../src/services/tmdbClient.js', () => ({
  getDetails: mockGetDetails,
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
});
