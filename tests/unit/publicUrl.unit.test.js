import {
  getDefaultOAuthCallbackUrl,
  getPublicBaseUrl,
  resolveOAuthCallbackUrl,
} from '../../src/utils/publicUrl.js';

function buildReq({ host, forwardedHost, forwardedProto, protocol = 'http' } = {}) {
  const headers = new Map(Object.entries({
    ...(host ? { host } : {}),
    ...(forwardedHost ? { 'x-forwarded-host': forwardedHost } : {}),
    ...(forwardedProto ? { 'x-forwarded-proto': forwardedProto } : {}),
  }));

  return {
    protocol,
    get(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

function restoreEnv(key, value) {
  if (typeof value === 'undefined') {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

describe('public URL helpers', () => {
  const originalCallbackUrl = process.env.GOOGLE_CALLBACK_URL;
  const originalPublicSiteUrl = process.env.PUBLIC_SITE_URL;

  afterEach(() => {
    restoreEnv('GOOGLE_CALLBACK_URL', originalCallbackUrl);
    restoreEnv('PUBLIC_SITE_URL', originalPublicSiteUrl);
  });

  test('resolves OAuth callback from request host when configured callback is localhost', () => {
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
    delete process.env.PUBLIC_SITE_URL;

    const req = buildReq({
      host: 'internal:10000',
      forwardedHost: 'philomedia.example',
      forwardedProto: 'https',
    });

    expect(resolveOAuthCallbackUrl(req)).toBe('https://philomedia.example/auth/google/callback');
  });

  test('keeps localhost OAuth callback for local requests', () => {
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/auth/google/callback';
    delete process.env.PUBLIC_SITE_URL;

    const req = buildReq({ host: 'localhost:3000' });

    expect(resolveOAuthCallbackUrl(req)).toBe('http://localhost:3000/auth/google/callback');
  });

  test('honors explicit non-local OAuth callback URLs', () => {
    process.env.GOOGLE_CALLBACK_URL = 'https://auth.example.com/auth/google/callback';
    process.env.PUBLIC_SITE_URL = 'https://philomedia.example';

    const req = buildReq({ host: 'localhost:3000' });

    expect(resolveOAuthCallbackUrl(req)).toBe('https://auth.example.com/auth/google/callback');
  });

  test('ignores local PUBLIC_SITE_URL override for remote OAuth requests', () => {
    delete process.env.GOOGLE_CALLBACK_URL;
    process.env.PUBLIC_SITE_URL = 'http://localhost:3000';

    const req = buildReq({
      host: 'philomedia.example',
      forwardedProto: 'https',
    });

    expect(resolveOAuthCallbackUrl(req)).toBe('https://philomedia.example/auth/google/callback');
  });

  test('uses PUBLIC_SITE_URL for non-OAuth public links when configured', () => {
    delete process.env.GOOGLE_CALLBACK_URL;
    process.env.PUBLIC_SITE_URL = 'https://philomedia.example/';

    const req = buildReq({ host: 'localhost:3000' });

    expect(getPublicBaseUrl(req)).toBe('https://philomedia.example');
    expect(getDefaultOAuthCallbackUrl()).toBe('https://philomedia.example/auth/google/callback');
  });
});
