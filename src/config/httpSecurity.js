const DEV_CORS_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * Allowlist explícita. Nunca devolve `*` — credentials: true + wildcard
 * permite qualquer origem usar cookies de sessão.
 *
 * Sem CORS_ORIGIN em produção: CORS desligado (false). A UI é same-origin.
 * Em dev: localhost.
 */
export function resolveCorsOrigin(env = process.env) {
  const raw = String(env.CORS_ORIGIN || '').trim();
  const isProd = env.NODE_ENV === 'production';

  if (raw && raw !== '*') {
    const list = raw.split(',').map(part => part.trim()).filter(Boolean);
    if (!list.length) {
      return isProd ? false : DEV_CORS_ORIGINS;
    }
    return list.length === 1 ? list[0] : list;
  }

  if (isProd) {
    return false;
  }

  return DEV_CORS_ORIGINS;
}

export function buildCorsOptions(env = process.env) {
  return {
    origin: resolveCorsOrigin(env),
    credentials: true,
  };
}

export function buildSessionCookieOptions(env = process.env) {
  return {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  };
}

export function shouldExposeApiDocs(env = process.env) {
  return env.NODE_ENV !== 'production';
}

/**
 * `trust proxy` só quando há reverse proxy de verdade. Em dev local,
 * X-Forwarded-For não pode spoofar o rate limit.
 *
 * TRUST_PROXY=1|true|0|false tem prioridade. Sem a env: ligado só em production.
 */
export function resolveTrustProxy(env = process.env) {
  const raw = String(env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'yes') return 1;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  return env.NODE_ENV === 'production' ? 1 : false;
}

/**
 * Impersonation via x-test-auth-user só com NODE_ENV=test E ALLOW_TEST_AUTH=1.
 * NODE_ENV=test sozinho num host exposto não basta.
 */
export function isTestAuthAllowed(env = process.env) {
  return env.NODE_ENV === 'test' && env.ALLOW_TEST_AUTH === '1';
}
