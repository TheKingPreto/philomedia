import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import ratingRoutes from '../../src/routes/ratings.js';
import Rating from '../../src/models/Rating.js';

const OWNER_ID = '507f1f77bcf86cd799439011';

function buildUser(overrides = {}) {
  return {
    _id: OWNER_ID,
    displayName: 'Test User',
    ...overrides,
  };
}

function createApp(user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.isAuthenticated = () => Boolean(user);
    next();
  });
  app.use('/api/me', ratingRoutes);
  return app;
}

function mockFind(docs) {
  const lean = jest.fn().mockResolvedValue(docs);
  const sort = jest.fn().mockReturnValue({ lean });
  jest.spyOn(Rating, 'find').mockReturnValue({ sort });
  return { sort, lean };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('rating routes', () => {
  test('GET /api/me/ratings returns 401 when there is no authenticated user', async () => {
    const response = await request(createApp()).get('/api/me/ratings');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'Authentication required. Please log in to perform this action.',
    });
  });

  test('GET /api/me/ratings returns 401 when the session user has no id', async () => {
    const response = await request(createApp({ displayName: 'No id' })).get('/api/me/ratings');

    expect(response.status).toBe(401);
  });

  test('GET /api/me/ratings lists only the current user\'s ratings', async () => {
    mockFind([
      {
        targetType: 'quote',
        targetId: '1035',
        value: 1,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      },
    ]);

    const response = await request(createApp(buildUser())).get('/api/me/ratings');

    expect(response.status).toBe(200);
    expect(Rating.find).toHaveBeenCalledWith({ userId: OWNER_ID });
    expect(response.body.ratings).toEqual([
      expect.objectContaining({
        targetType: 'quote',
        targetId: '1035',
        value: 1,
      }),
    ]);
  });

  test('GET /api/me/ratings ignores a userId query and stays scoped to the owner', async () => {
    mockFind([]);

    const response = await request(createApp(buildUser()))
      .get('/api/me/ratings?userId=507f1f77bcf86cd799439099&targetType=media');

    expect(response.status).toBe(200);
    expect(Rating.find).toHaveBeenCalledWith({
      userId: OWNER_ID,
      targetType: 'media',
    });
  });

  test('PUT /api/me/ratings creates a quote thumb for the owner', async () => {
    jest.spyOn(Rating, 'findOne').mockResolvedValue(null);
    jest.spyOn(Rating, 'create').mockResolvedValue({
      targetType: 'quote',
      targetId: '1035',
      value: 1,
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
    });

    const response = await request(createApp(buildUser()))
      .put('/api/me/ratings')
      .send({
        targetType: 'quote',
        targetId: '1035',
        value: 'up',
        userId: '507f1f77bcf86cd799439099',
        voteAverage: 9.1,
      });

    expect(response.status).toBe(201);
    expect(Rating.create).toHaveBeenCalledWith({
      userId: OWNER_ID,
      targetType: 'quote',
      targetId: '1035',
      value: 1,
    });
    expect(response.body.created).toBe(true);
    expect(response.body.rating.value).toBe(1);
  });

  test('POST /api/me/ratings updates an existing media star rating', async () => {
    const existing = {
      targetType: 'media',
      targetId: 'movie:157336',
      value: 3,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Rating, 'findOne').mockResolvedValue(existing);

    const response = await request(createApp(buildUser()))
      .post('/api/me/ratings')
      .send({
        targetType: 'media',
        targetId: 'movie:157336',
        value: 5,
      });

    expect(response.status).toBe(200);
    expect(existing.value).toBe(5);
    expect(existing.save).toHaveBeenCalled();
    expect(response.body.created).toBe(false);
    expect(response.body.rating.value).toBe(5);
  });

  test('PUT /api/me/ratings rejects a 1–5 star value on a quote', async () => {
    const response = await request(createApp(buildUser()))
      .put('/api/me/ratings')
      .send({
        targetType: 'quote',
        targetId: '1035',
        value: 5,
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
  });

  test('PUT /api/me/ratings rejects a thumb value on media', async () => {
    const response = await request(createApp(buildUser()))
      .put('/api/me/ratings')
      .send({
        targetType: 'media',
        targetId: 'movie:157336',
        value: -1,
      });

    expect(response.status).toBe(400);
  });

  test('PUT /api/me/ratings rejects an invalid media targetId', async () => {
    const response = await request(createApp(buildUser()))
      .put('/api/me/ratings')
      .send({
        targetType: 'media',
        targetId: '157336',
        value: 4,
      });

    expect(response.status).toBe(400);
  });

  test('DELETE /api/me/ratings removes the owner\'s rating and never another user\'s', async () => {
    jest.spyOn(Rating, 'findOneAndDelete').mockResolvedValue({
      targetType: 'quote',
      targetId: '1035',
      value: -1,
    });

    const response = await request(createApp(buildUser()))
      .delete('/api/me/ratings?targetType=quote&targetId=1035');

    expect(response.status).toBe(200);
    expect(response.body.removed).toBe(true);
    expect(Rating.findOneAndDelete).toHaveBeenCalledWith({
      userId: OWNER_ID,
      targetType: 'quote',
      targetId: '1035',
    });
  });

  test('DELETE /api/me/ratings returns removed false when nothing matches', async () => {
    jest.spyOn(Rating, 'findOneAndDelete').mockResolvedValue(null);

    const response = await request(createApp(buildUser()))
      .delete('/api/me/ratings?targetType=media&targetId=movie:550');

    expect(response.status).toBe(200);
    expect(response.body.removed).toBe(false);
  });
});
