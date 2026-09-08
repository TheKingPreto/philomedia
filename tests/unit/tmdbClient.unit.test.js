import { jest } from '@jest/globals';

const mockFetch = jest.fn();

await jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch,
}));

const tmdbClient = await import('../../src/services/tmdbClient.js');

function mockJsonResponse(data, { ok = true, status = 200, headers = {} } = {}) {
  return {
    ok,
    status,
    headers: {
      get: (name) => headers[String(name).toLowerCase()] ?? headers[name] ?? null,
    },
    json: jest.fn().mockResolvedValue(data),
  };
}

describe('tmdbClient', () => {
  beforeEach(() => {
    process.env.TMDB_API_KEY = 'tmdb-test-key';
    process.env.TMDB_WATCH_REGION = 'BR';
    tmdbClient.clearTmdbResponseCache();
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

    expect(results.results).toEqual([
      { id: 1, media_type: 'movie', title: 'Movie', _overviewLocale: 'en', _overviewEn: '' },
      { id: 2, media_type: 'tv', name: 'Series', _overviewLocale: 'en', _overviewEn: '' },
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
      expect.stringContaining('/discover/movie?'),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.anything()
    );
  });

  test('getDiscover forwards sanitized keyword filters', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ results: [] }));

    await tmdbClient.getDiscover('movie', 1, {
      withKeywords: '4565|181324;<script>',
      withoutKeywords: '9715',
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('with_keywords=4565%7C181324');
    expect(url).toContain('without_keywords=9715');
    expect(url).not.toContain('script');
  });

  test('extractTmdbKeywords normalizes movie and tv payloads', () => {
    expect(tmdbClient.extractTmdbKeywords({
      keywords: { keywords: [{ id: 310, name: 'artificial intelligence (a.i.)' }] },
    })).toEqual([{ id: 310, name: 'artificial intelligence (a.i.)' }]);

    expect(tmdbClient.extractTmdbKeywords({
      keywords: { results: [{ id: 4565, name: 'dystopia' }] },
    })).toEqual([{ id: 4565, name: 'dystopia' }]);
  });

  test('sanitizeTmdbIdList keeps OR vs AND and drops junk', () => {
    expect(tmdbClient.sanitizeTmdbIdList('18|878')).toBe('18|878');
    expect(tmdbClient.sanitizeTmdbIdList('18,878')).toBe('18,878');
    expect(tmdbClient.sanitizeTmdbIdList('abc|12foo|310')).toBe('12|310');
    expect(tmdbClient.sanitizeTmdbIdList('')).toBeUndefined();
  });

  test('retries a 429 once and then returns the payload', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({}, { ok: false, status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ id: 1, media_type: 'movie', title: 'Dune' }],
      }));

    const results = await tmdbClient.searchMulti('dune');

    expect(results.results).toEqual([{ id: 1, media_type: 'movie', title: 'Dune', _overviewLocale: 'en', _overviewEn: '' }]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('throws TmdbHttpError with status when the required fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({}, { ok: false, status: 404 })
    );

    await expect(tmdbClient.searchMulti('missing')).rejects.toMatchObject({
      name: 'TmdbHttpError',
      status: 404,
      code: 'tmdb_http_error',
    });
  });

  test('serves a repeated discover from cache', async () => {
    mockFetch.mockResolvedValue(
      mockJsonResponse({ results: [{ id: 7, title: 'Cached' }] })
    );

    const first = await tmdbClient.getDiscover('movie', 1, { withGenres: '18' });
    const second = await tmdbClient.getDiscover('movie', 1, { withGenres: '18' });

    expect(first).toHaveLength(1);
    expect(second).toEqual(first);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(tmdbClient.getTmdbResponseCacheSize()).toBe(1);
  });

  test('throws a helpful error when TMDB_API_KEY is missing', async () => {
    delete process.env.TMDB_API_KEY;

    await expect(tmdbClient.searchMulti('dark')).rejects.toThrow('TMDB_API_KEY is not set.');
  });

  test('searchMulti forwards page', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ results: [] }));

    await tmdbClient.searchMulti('matrix', { page: 2 });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('page=2'),
      expect.anything()
    );
  });

  test('getDiscover forwards watch providers, region, monetization, and crew', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ results: [] }));

    await tmdbClient.getDiscover('movie', 1, {
      withWatchProviders: '8',
      watchRegion: 'BR',
      watchMonetizationTypes: 'flatrate',
      withCrew: '525|8452',
    });

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('with_watch_providers=8');
    expect(url).toContain('watch_region=BR');
    expect(url).toContain('watch_monetization_types=flatrate');
    expect(url).toContain('with_crew=525%7C8452');
  });

  test('getDetails appends reviews, similar, and recommendations', async () => {
    mockFetch
      .mockResolvedValueOnce(
        mockJsonResponse({
          id: 1,
          title: 'Dune',
          reviews: { results: [{ content: 'Great.', iso_639_1: 'en' }] },
          similar: { results: [{ id: 2, title: 'Dune 2' }] },
          recommendations: { results: [{ id: 3, title: 'Arrival' }] },
          keywords: { keywords: [{ id: 490, name: 'philosophy' }] },
        })
      )
      .mockResolvedValueOnce(mockJsonResponse({ results: {} }));

    const result = await tmdbClient.getDetails('1', 'movie');
    const detailsUrl = mockFetch.mock.calls[0][0];

    expect(detailsUrl).toContain('append_to_response=credits%2Ckeywords%2Creviews%2Csimilar%2Crecommendations');
    expect(result.tmdbReviews).toEqual([
      { content: 'Great.', iso_639_1: 'en', language: 'en' },
    ]);
    expect(result.similar[0]).toMatchObject({ id: 2, title: 'Dune 2', media_type: 'movie' });
    expect(result.recommendations[0]).toMatchObject({ id: 3, title: 'Arrival' });
  });

  test('getReviews maps language and falls back when localized list is empty', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({ results: [] }))
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ content: 'Only review', iso_639_1: 'fr' }],
      }));

    const reviews = await tmdbClient.getReviews('1', 'movie', { language: 'pt-BR' });

    expect(reviews).toEqual([
      { content: 'Only review', iso_639_1: 'fr', language: 'fr' },
    ]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test('getTrending maps weekly movie results', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      results: [{ id: 9, title: 'Hot', overview: 'A thoughtful hit.', vote_average: 8.1, genre_ids: [18] }],
    }));

    const results = await tmdbClient.getTrending('movie', 'week');

    expect(results[0]).toMatchObject({ id: 9, media_type: 'movie', title: 'Hot' });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/trending/movie/week?'),
      expect.anything()
    );
  });

  test('searchMulti in pt-BR keeps PT overview and attaches English scoring text', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ id: 1, media_type: 'movie', title: 'Duna', overview: 'Uma equipe atravessa um buraco de minhoca.' }],
      }))
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ id: 1, media_type: 'movie', title: 'Dune', overview: 'A team crosses a wormhole.' }],
      }));

    const results = await tmdbClient.searchMulti('dune', { language: 'pt-BR' });

    expect(results.results[0]).toMatchObject({
      id: 1,
      overview: 'Uma equipe atravessa um buraco de minhoca.',
      _overviewLocale: 'pt',
      _overviewEn: 'A team crosses a wormhole.',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain('language=pt-BR');
  });

  test('searchMulti in pt-BR can skip the English list when the caller is UI-only', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({
      results: [{ id: 1, media_type: 'movie', title: 'Duna', overview: 'PT' }],
    }));

    const results = await tmdbClient.searchMulti('dune', {
      language: 'pt-BR',
      includeEnglishOverview: false,
    });

    expect(results.results[0].overview).toBe('PT');
    expect(results.results[0]._overviewEn).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test('searchMulti in pt-BR reuses cached English overviews by id', async () => {
    mockFetch
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ id: 1, media_type: 'movie', title: 'Duna', overview: 'PT um' }],
      }))
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ id: 1, media_type: 'movie', title: 'Dune', overview: 'EN one' }],
      }))
      .mockResolvedValueOnce(mockJsonResponse({
        results: [{ id: 1, media_type: 'movie', title: 'Duna 2', overview: 'PT dois' }],
      }));

    await tmdbClient.searchMulti('dune', { language: 'pt-BR' });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const second = await tmdbClient.searchMulti('duna', { language: 'pt-BR' });
    expect(second.results[0]._overviewEn).toBe('EN one');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
