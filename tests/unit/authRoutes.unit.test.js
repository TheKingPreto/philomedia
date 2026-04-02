import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import authRouter from '../../src/routes/auth.js';

function buildUser(overrides = {}) {
  return {
    id: 'user-1',
    displayName: 'Test User',
    email: 'test@example.com',
    avatarUrl: '',
    watchlist: [],
    favorites: [],
    watched: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createApp(user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.isAuthenticated = () => Boolean(user);
    req.logout = callback => callback?.();
    req.session = {
      destroy: callback => callback?.(),
    };
    next();
  });
  app.use('/auth', authRouter);
  return app;
}

describe('auth routes', () => {
  const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
  const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalGoogleClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalGoogleClientSecret;
  });

  test('GET /auth/profile returns the authenticated session payload', async () => {
    const app = createApp(buildUser({
      avatarUrl: 'https://example.com/avatar.jpg',
      watchlist: [{ tmdbId: '1', mediaType: 'movie', title: 'One' }],
      favorites: [{ tmdbId: '2', mediaType: 'tv', title: 'Two' }],
      watched: [{ tmdbId: '3', mediaType: 'movie', title: 'Three' }],
    }));

    const response = await request(app).get('/auth/profile');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual(expect.objectContaining({
      displayName: 'Test User',
      email: 'test@example.com',
      avatarUrl: 'https://example.com/avatar.jpg',
      library: {
        watchlistCount: 1,
        favoritesCount: 1,
        watchedCount: 1,
      },
    }));
  });

  test('PATCH /auth/profile/avatar saves a supported image data URL', async () => {
    const user = buildUser();
    const app = createApp(user);

    const response = await request(app)
      .patch('/auth/profile/avatar')
      .send({
        avatarUrl: 'data:image/webp;base64,ZmFrZQ==',
      });

    expect(response.status).toBe(200);
    expect(user.avatarUrl).toBe('data:image/webp;base64,ZmFrZQ==');
    expect(user.save).toHaveBeenCalled();
  });

  test('PATCH /auth/profile/avatar rejects unauthenticated users', async () => {
    const response = await request(createApp())
      .patch('/auth/profile/avatar')
      .send({
        avatarUrl: 'https://example.com/avatar.jpg',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'User not authenticated. Please log in.',
    });
  });

  test('PATCH /auth/profile/avatar validates unsupported avatar URLs', async () => {
    const app = createApp(buildUser());

    const response = await request(app)
      .patch('/auth/profile/avatar')
      .send({
        avatarUrl: 'ftp://example.com/avatar.jpg',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
  });
});
