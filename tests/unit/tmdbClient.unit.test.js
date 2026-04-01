import { jest } from '@jest/globals';

const mockFetch = jest.fn();

await jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch,
}));

const tmdbClient = await import('../../src/services/tmdbClient.js');

function mockJsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
  };
}

describe('tmdbClient', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = 'tmdb-test-key';
    process.env.TMDB_WATCH_REGION = 'BR';
    jest.clearAllMocks();
  });

  test('searchMulti filters out unsupported media types', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          { id: 1, media_type: 'movie', title: 'Movie' },
          { id: 2, media_type: 'tv', name: 'Series' },
          { id: 3, media_type: 'person', name: 'Actor' },
        ],
      })
    );

    const results = await tmdbClient.searchMulti('interstellar');

    expect(results).toEqual([
      { id: 1, media_type: 'movie', title: 'Movie' },
      { id: 2, media_type: 'tv', name: 'Series' },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('getDetails merges watch providers into the payload', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse({
          id: 157336,
          title: 'Interstellar',
          overview: 'A team crosses a wormhole.',
          credits: { crew: [] },
        })
      )
      .mockResolvedValueOnce(
        mockJsonResponse({
          results: {
            BR: {
              link: 'https://www.themoviedb.org/movie/157336/watch',
              flatrate: [
                {
                  provider_id: 8,
                  provider_name: 'Netflix',
                  logo_path: '/logo.png',
                },
              ],
            },
          },
        })
      );

    const result = await tmdbClient.getDetails('157336', 'movie');

    expect(result).toMatchObject({
      id: 157336,
      title: 'Interstellar',
      watchProviders: {
        region: 'BR',
        link: 'https://www.themoviedb.org/movie/157336/watch',
        providers: [
          {
            provider_id: 8,
            provider_name: 'Netflix',
            logo_path: '/logo.png',
          },
        ],
      },
    });
  });

  test('getReviews returns an empty array when the upstream response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({}, { ok: false, status: 500 })
    );

    const reviews = await tmdbClient.getReviews('157336', 'movie');

    expect(reviews).toEqual([]);
  });

  test('getDiscover maps summary fields needed by the frontend', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({
        results: [
          {
            id: 42,
            title: 'Arrival',
            overview: 'A linguist meets visitors.',
            poster_path: '/arrival.jpg',
            release_date: '2016-11-11',
            vote_average: 7.9,
            vote_count: 19000,
            popularity: 34.5,
            genre_ids: [18, 878],
            original_language: 'en',
          },
        ],
      })
    );

    const results = await tmdbClient.getDiscover('movie', 2, {
      withGenres: '18|878',
      withOriginalLanguage: 'en',
      sortBy: 'popularity.desc',
    });

    expect(results).toEqual([
      expect.objectContaining({
        id: 42,
        media_type: 'movie',
        title: 'Arrival',
        vote_average: 7.9,
        vote_count: 19000,
        popularity: 34.5,
        genre_ids: [18, 878],
      }),
    ]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/discover/movie?')
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('page=2')
    );
  });

  test('throws a helpful error when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY;

    await expect(tmdbClient.searchMulti('dark')).rejects.toThrow('TMDB_API_KEY is not set.');
  });
});
