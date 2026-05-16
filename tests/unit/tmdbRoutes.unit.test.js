import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const mockSearchMulti = jest.fn();
const mockGetDetails = jest.fn();
const mockGetReviews = jest.fn();
const mockGetDiscover = jest.fn();
const mockGetRecommendations = jest.fn();
const mockGetSimilar = jest.fn();

await jest.unstable_mockModule('../../src/services/tmdbClient.js', () => ({
  searchMulti: mockSearchMulti,
  getDetails: mockGetDetails,
  getReviews: mockGetReviews,
  getDiscover: mockGetDiscover,
  getRecommendations: mockGetRecommendations,
  getSimilar: mockGetSimilar,
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
    mockSearchMulti.mockResolvedValueOnce([{ id: 1, media_type: 'movie', title: 'Dune' }]);

    const response = await request(app).get('/api/tmdb/search?query=dune');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, media_type: 'movie', title: 'Dune' }]);
    expect(mockSearchMulti).toHaveBeenCalledWith('dune', { language: 'en-US' });
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
      withOriginalLanguage: 'ja',
      sortBy: 'popularity.desc',
      language: 'en-US',
    });
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

  test('POST /rank-candidates returns 400 when profile is missing', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/tmdb/rank-candidates')
      .send({ candidates: [{ id: 1, title: 'X', overview: 'y', media_type: 'movie', genre_ids: [] }] });

    expect(response.status).toBe(400);
  });
});
