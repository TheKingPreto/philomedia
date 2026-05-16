/**
 * In NODE_ENV=test, authentication can be satisfied by sending a JSON user fixture:
 *   Header: x-test-auth-user: {"displayName":"T","watchlist":[]}
 * or env TEST_AUTH_USER_JSON with the same payload.
 * This keeps integration tests explicit instead of skipping auth entirely.
 */
function tryAttachTestAuthUser(req) {
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
  if (process.env.NODE_ENV === 'test') {
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
