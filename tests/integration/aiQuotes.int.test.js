import request from 'supertest';
import app from '../../server.js';

const TEST_USER = JSON.stringify({
  _id: '507f1f77bcf86cd799439011',
  displayName: 'Fixture',
});

describe('AI Quotes routes (validation and GET /themes)', () => {
  const originalFlag = process.env.ALLOW_TEST_AUTH;

  beforeAll(() => {
    process.env.ALLOW_TEST_AUTH = '1';
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = originalFlag;
  });

  function postMediaContext() {
    return request(app)
      .post('/api/ai/quotes/generate/media-context')
      .set('x-test-auth-user', TEST_USER);
  }

  describe('POST /api/ai/quotes/generate/media-context', () => {
    test('returns 401 when there is no session', async () => {
      const res = await request(app)
        .post('/api/ai/quotes/generate/media-context')
        .send({ tmdbId: '157336', mediaType: 'movie' });
      expect(res.status).toBe(401);
    });

    test('returns 400 when tmdbId is missing', async () => {
      const res = await postMediaContext().send({ mediaType: 'movie' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    test('returns 400 when mediaType is missing', async () => {
      const res = await postMediaContext().send({ tmdbId: '157336' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    test('returns 400 when mediaType is invalid', async () => {
      const res = await postMediaContext().send({ tmdbId: '157336', mediaType: 'anime' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    test('returns 400 when tmdbId is empty string', async () => {
      const res = await postMediaContext().send({ tmdbId: '', mediaType: 'movie' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/ai/quotes/themes', () => {
    test('returns 200 with themes and total', async () => {
      const res = await request(app).get('/api/ai/quotes/themes');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('themes');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.themes)).toBe(true);
      expect(res.body.total).toBe(res.body.themes.length);
    });
  });
});
