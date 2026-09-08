import request from 'supertest';
import app from '../../server.js';

const SOME_ID = '507f1f77bcf86cd799439033';

describe('AI generation endpoints require a session', () => {
  test('POST /generate/theme returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/ai/quotes/generate/theme')
      .send({ themes: ['stoicism'] });

    expect(res.status).toBe(401);
  });

  test('POST /generate/philosopher returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/ai/quotes/generate/philosopher')
      .send({ philosopher: 'Seneca' });

    expect(res.status).toBe(401);
  });

  test('POST /generate/media-context returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/ai/quotes/generate/media-context')
      .send({ tmdbId: '157336', mediaType: 'movie' });

    expect(res.status).toBe(401);
  });

  test('POST /generate/media-context accepts a test session', async () => {
    const originalFlag = process.env.ALLOW_TEST_AUTH;
    process.env.ALLOW_TEST_AUTH = '1';

    const res = await request(app)
      .post('/api/ai/quotes/generate/media-context')
      .set('x-test-auth-user', '{"_id":"507f1f77bcf86cd799439011","displayName":"Fixture"}')
      .send({ tmdbId: '157336', mediaType: 'movie' });

    if (originalFlag === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = originalFlag;

    expect(res.status).not.toBe(401);
  });
});

describe('Ratings require a session', () => {
  test('GET /api/me/ratings returns 401 without auth', async () => {
    const res = await request(app).get('/api/me/ratings');
    expect(res.status).toBe(401);
  });

  test.each(['put', 'post', 'delete'])('%s /api/me/ratings returns 401 without auth', async (method) => {
    const res = await request(app)[method]('/api/me/ratings').send({
      targetType: 'quote',
      targetId: '1035',
      value: 1,
    });

    expect(res.status).toBe(401);
  });
});

describe('Quote and Match mutations require a session', () => {
  test.each([
    ['put', '/api/quotes'],
    ['delete', '/api/quotes'],
    ['post', '/api/quotes'],
    ['put', '/api/matches'],
    ['delete', '/api/matches'],
    ['post', '/api/matches'],
  ])('%s %s returns 401 without auth', async (method, base) => {
    const path = method === 'post' ? base : `${base}/${SOME_ID}`;
    const res = await request(app)[method](path).send({});

    expect(res.status).toBe(401);
  });
});
