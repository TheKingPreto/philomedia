import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import libraryRoutes from '../../src/routes/library.js';

function buildUser(overrides = {}) {
  return {
    displayName: 'Test User',
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
    next();
  });
  app.use('/api/me', libraryRoutes);
  return app;
}

describe('library routes', () => {
  test('GET /api/me/library returns 401 when there is no authenticated user', async () => {
    const response = await request(createApp()).get('/api/me/library');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'Authentication required. Please log in to perform this action.',
    });
  });

  test('GET /api/me/library returns all saved collections for the current user', async () => {
    const app = createApp(buildUser({
      watchlist: [
        {
          tmdbId: '157336',
          mediaType: 'movie',
          title: 'Interstellar',
          addedAt: new Date('2026-04-01T12:00:00Z'),
        },
      ],
      favorites: [
        {
          tmdbId: '1396',
          mediaType: 'tv',
          title: 'Breaking Bad',
          addedAt: new Date('2026-04-02T12:00:00Z'),
        },
      ],
      watched: [
        {
          tmdbId: '550',
          mediaType: 'movie',
          title: 'Fight Club',
          addedAt: new Date('2026-04-03T12:00:00Z'),
        },
      ],
    }));

    const response = await request(app).get('/api/me/library');

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({ watchlist: 1, favorites: 1, watched: 1 });
    expect(response.body.watchlist[0]).toEqual(
      expect.objectContaining({
        tmdbId: '157336',
        mediaType: 'movie',
        title: 'Interstellar',
      })
    );
    expect(response.body.watched[0]).toEqual(
      expect.objectContaining({
        tmdbId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
      })
    );
  });

  test('GET /api/me/library/status returns booleans for a saved item', async () => {
    const app = createApp(buildUser({
      watchlist: [
        { tmdbId: '157336', mediaType: 'movie', title: 'Interstellar', addedAt: new Date() },
      ],
      favorites: [],
      watched: [
        { tmdbId: '157336', mediaType: 'movie', title: 'Interstellar', addedAt: new Date() },
      ],
    }));

    const response = await request(app).get('/api/me/library/status?tmdbId=157336&mediaType=movie');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      inWatchlist: true,
      inFavorites: false,
      inWatched: true,
    });
  });

  test('POST /api/me/library/watchlist adds a new item and persists the user', async () => {
    const user = buildUser();
    const app = createApp(user);

    const response = await request(app)
      .post('/api/me/library/watchlist')
      .send({
        tmdbId: '157336',
        mediaType: 'movie',
        title: 'Interstellar',
        posterPath: '/poster.jpg',
        releaseDate: '2014-11-05',
        voteAverage: 8.7,
      });

    expect(response.status).toBe(201);
    expect(user.watchlist).toHaveLength(1);
    expect(user.save).toHaveBeenCalled();
    expect(response.body.status).toEqual({
      inWatchlist: true,
      inFavorites: false,
      inWatched: false,
    });
  });

  test('POST /api/me/library/watched adds a watched item and returns watched status', async () => {
    const user = buildUser();
    const app = createApp(user);

    const response = await request(app)
      .post('/api/me/library/watched')
      .send({
        tmdbId: '550',
        mediaType: 'movie',
        title: 'Fight Club',
      });

    expect(response.status).toBe(201);
    expect(user.watched).toHaveLength(1);
    expect(response.body.status).toEqual({
      inWatchlist: false,
      inFavorites: false,
      inWatched: true,
    });
  });

  test('POST /api/me/library/favorites updates an existing saved item without duplicating it', async () => {
    const user = buildUser({
      favorites: [
        {
          tmdbId: '1396',
          mediaType: 'tv',
          title: 'Breaking Bad',
          posterPath: '',
          releaseDate: '2008-01-20',
          voteAverage: 9.0,
          addedAt: new Date(),
        },
      ],
    });
    const app = createApp(user);

    const response = await request(app)
      .post('/api/me/library/favorites')
      .send({
        tmdbId: '1396',
        mediaType: 'tv',
        title: 'Breaking Bad Remastered',
        posterPath: '/bb.jpg',
        releaseDate: '2008-01-20',
        voteAverage: 9.1,
      });

    expect(response.status).toBe(200);
    expect(user.favorites).toHaveLength(1);
    expect(user.favorites[0].title).toBe('Breaking Bad Remastered');
  });

  test('DELETE /api/me/library/watchlist/:mediaType/:tmdbId removes a saved item', async () => {
    const user = buildUser({
      watchlist: [
        { tmdbId: '157336', mediaType: 'movie', title: 'Interstellar', addedAt: new Date() },
      ],
    });
    const app = createApp(user);

    const response = await request(app).delete('/api/me/library/watchlist/movie/157336');

    expect(response.status).toBe(200);
    expect(response.body.removed).toBe(true);
    expect(user.watchlist).toHaveLength(0);
    expect(user.save).toHaveBeenCalled();
  });

  test('DELETE /api/me/library/watched/:mediaType/:tmdbId removes watched status', async () => {
    const user = buildUser({
      watched: [
        { tmdbId: '550', mediaType: 'movie', title: 'Fight Club', addedAt: new Date() },
      ],
    });
    const app = createApp(user);

    const response = await request(app).delete('/api/me/library/watched/movie/550');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      removed: true,
      collection: 'watched',
      status: {
        inWatchlist: false,
        inFavorites: false,
        inWatched: false,
      },
    });
    expect(user.watched).toHaveLength(0);
  });

  test('POST /api/me/library/watchlist validates required payload fields', async () => {
    const app = createApp(buildUser());

    const response = await request(app)
      .post('/api/me/library/watchlist')
      .send({
        tmdbId: '157336',
        mediaType: 'movie',
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
  });
});
