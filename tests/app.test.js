import request from 'supertest';
import app from '../server.js';

describe('Basic API endpoints', () => {
  test('GET / should return welcome message', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Welcome to the PhiloMedia REST API/i);
  });

  test('GET /api-docs/swagger.json should return JSON', async () => {
    const res = await request(app).get('/api-docs/swagger.json');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('openapi');
  });

  test('GET unknown route should return 404 JSON', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });

  test('GET /api/tmdb/search without query should return empty array', async () => {
    const res = await request(app).get('/api/tmdb/search');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
