/**
 * In NODE_ENV=test AND ALLOW_TEST_AUTH=1, authentication can be satisfied by
 * sending a JSON user fixture:
 *   Header: x-test-auth-user: {"displayName":"T","watchlist":[]}
 * or env TEST_AUTH_USER_JSON with the same payload.
 * NODE_ENV=test alone on an exposed host is not enough.
 */
import { isTestAuthAllowed } from '../config/httpSecurity.js';
import { FORBIDDEN_MESSAGE, isAdmin } from '../utils/resourceAccess.js';

function tryAttachTestAuthUser(req) {
  if (!isTestAuthAllowed()) {
    return 'missing';
  }
  const raw =
    req.get?.('x-test-auth-user')
    || process.env.TEST_AUTH_USER_JSON;

  if (!raw || typeof raw !== 'string') {
    return 'missing';
  }

  try {
    req.user = JSON.parse(raw);
    req.isAuthenticated = () => true;
    return 'ok';
  } catch {
    return 'invalid';
  }
}

export const isAuthenticated = (req, res, next) => {
  if (isTestAuthAllowed()) {
    const outcome = tryAttachTestAuthUser(req);
    if (outcome === 'invalid') {
      return res.status(500).json({
        message: 'Invalid test auth JSON (use x-test-auth-user header or TEST_AUTH_USER_JSON).',
      });
    }
    if (outcome === 'ok') {
      return next();
    }
  }

  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  res.status(401).json({
    message: 'Authentication required. Please log in to perform this action.',
  });
};

/**
 * Versão sem efeito de resposta, para rotas públicas que só precisam de saber
 * se há sessão — caso do `save` nos endpoints de IA, abertos a anônimos mas
 * que não podem escrever no banco sem login.
 */
export const isRequestAuthenticated = (req) => {
  if (isTestAuthAllowed() && tryAttachTestAuthUser(req) === 'ok') {
    return true;
  }

  return Boolean(req.isAuthenticated && req.isAuthenticated());
};

export const requireAdmin = (req, res, next) => {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ message: FORBIDDEN_MESSAGE });
  }
  return next();
};
