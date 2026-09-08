import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';
import { MAX_PORTRAIT_BYTES } from '../src/services/remoteAssetProxy.js';

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

  test('CORS default allowlist never reflects an unknown origin', async () => {
    const allowed = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const blocked = await request(app)
      .get('/health')
      .set('Origin', 'https://evil.example');
    expect(blocked.headers['access-control-allow-origin']).not.toBe('*');
    expect(blocked.headers['access-control-allow-origin']).not.toBe('https://evil.example');
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
    expect(res.text).toContain('/html/details.html?id=');
    expect(res.text).toContain('type=');
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

  test('GET /html/details.html is served as HTML with absolute canonical', async () => {
    const res = await request(app).get('/html/details.html?id=550&type=movie');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('rel="canonical"');
    expect(res.text).toContain('og:title');
  });

  test('GET /api/assets/portrait returns 413 when the upstream body is too large', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name) => (String(name).toLowerCase() === 'content-length'
          ? String(MAX_PORTRAIT_BYTES + 10)
          : 'image/jpeg'),
      },
      body: { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => {} }) },
      arrayBuffer: async () => Buffer.alloc(0),
    });

    const res = await request(app).get(
      '/api/assets/portrait?src=https://upload.wikimedia.org/wikipedia/commons/a.jpg'
    );

    fetchSpy.mockRestore();
    expect(res.statusCode).toBe(413);
  });

  test('CSP no longer opens philosophersapi or Wikipedia to the browser', async () => {
    const res = await request(app).get('/health');
    const csp = res.headers['content-security-policy'] || '';
    expect(csp).toContain("img-src 'self' data: https://image.tmdb.org");
    expect(csp).not.toContain('philosophersapi.com');
    expect(csp).not.toContain('wikipedia.org');
    expect(csp).not.toContain('upload.wikimedia.org');
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
