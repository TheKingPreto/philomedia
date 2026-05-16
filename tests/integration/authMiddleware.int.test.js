import request from 'supertest';
import app from '../../server.js';

describe('auth middleware in test environment', () => {
  test('POST /api/quotes returns 401 without test auth fixture', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .send({ quoteText: 'x', authorName: 'y' });

    expect(res.status).toBe(401);
  });
});
