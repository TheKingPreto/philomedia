import request from 'supertest';
import app from '../../server.js';

const TEST_USER = JSON.stringify({
  _id: '507f1f77bcf86cd799439011',
  displayName: 'Fixture',
});

describe('philosopher contribution ownership (x-test-auth-user)', () => {
  const originalFlag = process.env.ALLOW_TEST_AUTH;

  beforeAll(() => {
    process.env.ALLOW_TEST_AUTH = '1';
  });

  afterAll(() => {
    if (originalFlag === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = originalFlag;
  });

  test('POST /api/philosophers returns 401 without a session', async () => {
    const res = await request(app)
      .post('/api/philosophers')
      .send({
        name: 'A Community Thinker',
        quotes: [{ quoteText: 'A short original line for the archive.' }],
      });

    expect(res.status).toBe(401);
  });

  test('POST /api/philosophers with test auth cannot overwrite a curated thinker', async () => {
    const res = await request(app)
      .post('/api/philosophers')
      .set('x-test-auth-user', TEST_USER)
      .send({
        name: 'Socrates',
        quotes: [{ quoteText: 'The unexamined life is not worth living.' }],
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({ slug: 'socrates' }));
  });
});
