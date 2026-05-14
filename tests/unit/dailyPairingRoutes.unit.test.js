import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

const mockGetDailyPairing = jest.fn();

await jest.unstable_mockModule('../../src/services/dailyPairingService.js', () => ({
  getDailyPairing: mockGetDailyPairing,
}));

const { default: dailyPairingRoutes } = await import('../../src/routes/dailyPairing.js');

function buildApp() {
  const app = express();
  app.use('/api/daily-pairing', dailyPairingRoutes);
  return app;
}

describe('daily pairing routes', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('GET / forwards limit and offset query params to the service', async () => {
    const app = buildApp();
    mockGetDailyPairing.mockResolvedValueOnce({
      source: 'editorial-calendar',
      results: [],
      offset: 2,
      limit: 3,
      totalWorks: 12,
      hasMore: true,
    });

    const response = await request(app).get('/api/daily-pairing?limit=3&offset=2');

    expect(response.status).toBe(200);
    expect(mockGetDailyPairing).toHaveBeenCalledWith({
      limit: '3',
      offset: '2',
    });
    expect(response.body.offset).toBe(2);
    expect(response.body.limit).toBe(3);
  });

  test('GET / returns 404 when the editorial calendar has no slot', async () => {
    const app = buildApp();
    mockGetDailyPairing.mockResolvedValueOnce(null);

    const response = await request(app).get('/api/daily-pairing');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Daily pairing unavailable.' });
  });

  test('GET / returns 502 when the service throws', async () => {
    const app = buildApp();
    mockGetDailyPairing.mockRejectedValueOnce(new Error('TMDB unavailable'));

    const response = await request(app).get('/api/daily-pairing');

    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'Could not load daily pairing.' });
  });
});
