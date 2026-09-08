import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const mockSearchMulti = jest.fn();
const mockGetDetails = jest.fn();
const mockGetReviews = jest.fn();
const mockGetDiscover = jest.fn();
const mockGetRecommendations = jest.fn();
const mockGetSimilar = jest.fn();

const mockGetTrending = jest.fn();

await jest.unstable_mockModule('../../src/services/tmdbClient.js', () => ({
  searchMulti: mockSearchMulti,
  getDetails: mockGetDetails,
  getReviews: mockGetReviews,
  getDiscover: mockGetDiscover,
  getRecommendations: mockGetRecommendations,
  getSimilar: mockGetSimilar,
  getTrending: mockGetTrending,
}));

const { default: tmdbRoutes } = await import('../../src/routes/tmdb.js');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tmdb', tmdbRoutes);
  return app;
}

describe('tmdb routes', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('GET /search returns an empty array when query is missing', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/tmdb/search');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(mockSearchMulti).not.toHaveBeenCalled();
  });

  test('GET /search returns TMDB results from the shared client', async () => {
    const app = buildApp();
    mockSearchMulti.mockResolvedValueOnce({
      results: [{ id: 1, media_type: 'movie', title: 'Dune' }],
      page: 1,
      totalPages: 1,
    });

    const response = await request(app).get('/api/tmdb/search?query=dune');

    expect(response.status).toBe(200);
    expect(response.body.results).toEqual([{ id: 1, media_type: 'movie', title: 'Dune' }]);
    expect(mockSearchMulti).toHaveBeenCalledWith('dune', {
      language: 'en-US',
      page: 1,
      includeEnglishOverview: true,
    });
  });

  test('GET /details validates required params before calling the client', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/tmdb/details?id=157336');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Missing id or type' });
    expect(mockGetDetails).not.toHaveBeenCalled();
  });

  test('GET /discover forwards query options to the shared client', async () => {
    const app = buildApp();
    mockGetDiscover.mockResolvedValueOnce([{ id: 42, media_type: 'movie' }]);

    const response = await request(app).get(
      '/api/tmdb/discover?media=tv&page=2&with_genres=18|10765&with_original_language=ja&sort_by=popularity.desc'
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 42, media_type: 'movie' }]);
    expect(mockGetDiscover).toHaveBeenCalledWith('tv', '2', {
      withGenres: '18|10765',
      withKeywords: undefined,
      withoutKeywords: undefined,
      withOriginalLanguage: 'ja',
      withWatchProviders: undefined,
      watchRegion: undefined,
      watchMonetizationTypes: undefined,
      withCrew: undefined,
      sortBy: 'popularity.desc',
      language: 'en-US',
      includeEnglishOverview: true,
    });
  });

  test('GET /discover forwards keyword filters', async () => {
    const app = buildApp();
    mockGetDiscover.mockResolvedValueOnce([]);

    await request(app).get(
      '/api/tmdb/discover?media=movie&with_keywords=4565|181324&without_keywords=9715'
    );

    expect(mockGetDiscover).toHaveBeenCalledWith('movie', 1, expect.objectContaining({
      withKeywords: '4565|181324',
      withoutKeywords: '9715',
    }));
  });

  test('GET /recommendations returns 400 for invalid media type', async () => {
    const app = buildApp();

    const response = await request(app).get('/api/tmdb/recommendations?id=1&type=anime');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'Missing or invalid id or type' });
    expect(mockGetRecommendations).not.toHaveBeenCalled();
  });

  test('GET /similar maps missing API key errors to a 502 response', async () => {
    const app = buildApp();
    mockGetSimilar.mockRejectedValueOnce(new Error('TMDB_API_KEY is not set.'));

    const response = await request(app).get('/api/tmdb/similar?id=1&type=movie');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'TMDB API key not configured' });
  });

  test('GET /similar maps a TMDB 429 to 429', async () => {
    const app = buildApp();
    const rateLimit = new Error('TMDB request failed with status 429.');
    rateLimit.status = 429;
    rateLimit.code = 'tmdb_rate_limited';
    mockGetSimilar.mockRejectedValueOnce(rateLimit);

    const response = await request(app).get('/api/tmdb/similar?id=1&type=movie');

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: 'TMDB rate limit reached. Please try again shortly.',
      code: 'tmdb_rate_limited',
    });
  });

  test('POST /rank-candidates rejects oversized candidate arrays', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/tmdb/rank-candidates')
      .send({
        profile: {
          themes: ['existentialism'],
          themeWeights: { existentialism: 1 },
          keywords: [],
          preferredGenres: [18],
        },
        candidates: Array.from({ length: 101 }, (_, index) => ({
          id: index + 1,
          title: `X${index}`,
          overview: 'y',
          media_type: 'movie',
          genre_ids: [18],
        })),
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Too many candidates/);
  });

  test('POST /rank-candidates returns 400 when profile is missing', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/tmdb/rank-candidates')
      .send({ candidates: [{ id: 1, title: 'X', overview: 'y', media_type: 'movie', genre_ids: [] }] });

    expect(response.status).toBe(400);
  });

  test('GET /search forwards page', async () => {
    const app = buildApp();
    mockSearchMulti.mockResolvedValueOnce([]);

    await request(app).get('/api/tmdb/search?query=dune&page=3');

    expect(mockSearchMulti).toHaveBeenCalledWith('dune', {
      language: 'en-US',
      page: '3',
      includeEnglishOverview: true,
    });
  });

  test('GET /discover forwards watch providers and crew', async () => {
    const app = buildApp();
    mockGetDiscover.mockResolvedValueOnce([]);

    await request(app).get(
      '/api/tmdb/discover?media=movie&with_watch_providers=8&watch_region=BR&watch_monetization_types=flatrate&with_crew=525'
    );

    expect(mockGetDiscover).toHaveBeenCalledWith('movie', 1, expect.objectContaining({
      withWatchProviders: '8',
      watchRegion: 'BR',
      watchMonetizationTypes: 'flatrate',
      withCrew: '525',
    }));
  });

  test('GET /reviews forwards language', async () => {
    const app = buildApp();
    mockGetReviews.mockResolvedValueOnce([]);

    await request(app).get('/api/tmdb/reviews?id=1&type=movie&language=pt-BR');

    expect(mockGetReviews).toHaveBeenCalledWith('1', 'movie', { language: 'pt-BR' });
  });

  test('GET /trending validates media and forwards window', async () => {
    const app = buildApp();
    mockGetTrending.mockResolvedValueOnce([{ id: 1, media_type: 'movie' }]);

    const ok = await request(app).get('/api/tmdb/trending?media=movie&window=week');
    expect(ok.status).toBe(200);
    expect(mockGetTrending).toHaveBeenCalledWith('movie', 'week', {
      language: 'en-US',
      includeEnglishOverview: true,
    });

    const bad = await request(app).get('/api/tmdb/trending?media=person');
    expect(bad.status).toBe(400);
  });
});
