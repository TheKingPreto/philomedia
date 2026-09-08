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

  test('POST /generate/media-context stays public for anonymous readers', async () => {
    const res = await request(app)
      .post('/api/ai/quotes/generate/media-context')
      .send({ tmdbId: '157336', mediaType: 'movie' });

    expect(res.status).not.toBe(401);
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
