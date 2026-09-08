import request from 'supertest';
import app from '../server.js';

describe('Basic API endpoints', () => {
  test('GET / should redirect to index page', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toMatch(/index\.html/i);
  });

  test('GET /health should expose process and DB state', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      db: expect.any(String),
      uptime: expect.any(Number),
    });
  });

  test('GET /api-docs/swagger.json should return JSON', async () => {
    const res = await request(app).get('/api-docs/swagger.json');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('openapi');
  });

  test('GET /robots.txt should expose crawl directives', async () => {
    const res = await request(app).get('/robots.txt');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('Disallow: /html/library.html');
    expect(res.text).toContain('Sitemap:');
  });

  test('GET /sitemap.xml should expose public URLs', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml|text\/xml/);
    expect(res.text).toContain('/html/index.html');
    expect(res.text).toContain('/html/philosophers.html');
    expect(res.text).toContain('/html/philosopher.html?slug=socrates');
    expect(res.text).toContain('/html/philosopher.html?slug=isaac-newton');
    expect(res.text).toMatch(/<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/);
  });

  test('GET unknown route should return 404 JSON', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Route not found.');
  });

  test('GET /api/tmdb/search without query should return empty array', async () => {
    const res = await request(app).get('/api/tmdb/search');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /auth should return 503 when OAuth is not configured', async () => {
    const res = await request(app).get('/auth');
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      error: 'Authentication is not configured on this server.',
      oauthEnabled: false,
    });
  });

  test('GET /auth/session should expose unauthenticated session state', async () => {
    const res = await request(app).get('/auth/session');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      authenticated: false,
      oauthEnabled: false,
      user: null,
    });
  });
});
