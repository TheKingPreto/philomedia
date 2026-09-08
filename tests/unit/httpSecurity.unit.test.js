import express from 'express';
import request from 'supertest';
import {
  buildCorsOptions,
  buildSessionCookieOptions,
  isTestAuthAllowed,
  resolveCorsOrigin,
  resolveTrustProxy,
  shouldExposeApiDocs,
} from '../../src/config/httpSecurity.js';
import { isAuthenticated, isRequestAuthenticated } from '../../src/middleware/authMiddleware.js';

describe('http security helpers', () => {
  test('dev without CORS_ORIGIN uses localhost, never *', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'development' })).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
    expect(buildCorsOptions({ NODE_ENV: 'test' }).credentials).toBe(true);
    expect(buildCorsOptions({ NODE_ENV: 'test' }).origin).not.toBe('*');
  });

  test('production without CORS_ORIGIN disables CORS instead of *', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toBe(false);
  });

  test('CORS_ORIGIN=* is treated as missing, never wildcard + credentials', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'production', CORS_ORIGIN: '*' })).toBe(false);
    expect(resolveCorsOrigin({ NODE_ENV: 'development', CORS_ORIGIN: '*' })).toEqual([
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]);
  });

  test('CORS_ORIGIN allowlist is honored', () => {
    expect(resolveCorsOrigin({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://philomedia.example, https://www.philomedia.example',
    })).toEqual([
      'https://philomedia.example',
      'https://www.philomedia.example',
    ]);
  });

  test('session cookie is httpOnly with secure+lax in production', () => {
    expect(buildSessionCookieOptions({ NODE_ENV: 'development' })).toEqual({
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });
    expect(buildSessionCookieOptions({ NODE_ENV: 'production' })).toEqual({
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
  });

  test('trust proxy is off in local dev and on in production unless overridden', () => {
    expect(resolveTrustProxy({ NODE_ENV: 'development' })).toBe(false);
    expect(resolveTrustProxy({ NODE_ENV: 'test' })).toBe(false);
    expect(resolveTrustProxy({ NODE_ENV: 'production' })).toBe(1);
    expect(resolveTrustProxy({ NODE_ENV: 'development', TRUST_PROXY: '1' })).toBe(1);
    expect(resolveTrustProxy({ NODE_ENV: 'production', TRUST_PROXY: '0' })).toBe(false);
  });

  test('API docs are off in production', () => {
    expect(shouldExposeApiDocs({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldExposeApiDocs({ NODE_ENV: 'test' })).toBe(true);
    expect(shouldExposeApiDocs({ NODE_ENV: 'development' })).toBe(true);
  });

  test('test auth requires ALLOW_TEST_AUTH=1 in addition to NODE_ENV=test', () => {
    expect(isTestAuthAllowed({ NODE_ENV: 'test' })).toBe(false);
    expect(isTestAuthAllowed({ NODE_ENV: 'test', ALLOW_TEST_AUTH: '1' })).toBe(true);
    expect(isTestAuthAllowed({ NODE_ENV: 'production', ALLOW_TEST_AUTH: '1' })).toBe(false);
  });
});

describe('test auth header', () => {
  const originalFlag = process.env.ALLOW_TEST_AUTH;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = originalFlag;
  });

  function buildApp() {
    const app = express();
    app.get('/protected', isAuthenticated, (req, res) => {
      res.json({ ok: true, name: req.user?.displayName });
    });
    return app;
  }

  test('x-test-auth-user is ignored without ALLOW_TEST_AUTH', async () => {
    delete process.env.ALLOW_TEST_AUTH;
    const response = await request(buildApp())
      .get('/protected')
      .set('x-test-auth-user', '{"displayName":"Impostor"}');

    expect(response.status).toBe(401);
  });

  test('x-test-auth-user works when ALLOW_TEST_AUTH=1', async () => {
    process.env.ALLOW_TEST_AUTH = '1';
    const response = await request(buildApp())
      .get('/protected')
      .set('x-test-auth-user', '{"displayName":"Fixture"}');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, name: 'Fixture' });
  });

  test('isRequestAuthenticated follows the same flag', () => {
    delete process.env.ALLOW_TEST_AUTH;
    const req = {
      get: () => '{"displayName":"X"}',
      isAuthenticated: () => false,
    };
    expect(isRequestAuthenticated(req)).toBe(false);

    process.env.ALLOW_TEST_AUTH = '1';
    expect(isRequestAuthenticated(req)).toBe(true);
  });
});
