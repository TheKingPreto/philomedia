import { Router } from 'express';
import passport from 'passport';

const authRouter = Router();

function isOAuthEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID) && Boolean(process.env.GOOGLE_CLIENT_SECRET);
}

function serializeSessionUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl || '',
    library: {
      watchlistCount: Array.isArray(user.watchlist) ? user.watchlist.length : 0,
      favoritesCount: Array.isArray(user.favorites) ? user.favorites.length : 0,
    },
  };
}

function buildSessionPayload(req) {
  const authenticated = Boolean(req.isAuthenticated?.() && req.user);

  return {
    authenticated,
    oauthEnabled: isOAuthEnabled(),
    user: authenticated ? serializeSessionUser(req.user) : null,
  };
}

function ensureOAuthConfigured(req, res, next) {
  if (isOAuthEnabled()) {
    return next();
  }

  return res.status(503).json({
    error: 'Authentication is not configured on this server.',
    oauthEnabled: false,
  });
}

authRouter.get('/', (req, res) => {
  if (!isOAuthEnabled()) {
    return res.status(503).json({
      error: 'Authentication is not configured on this server.',
      oauthEnabled: false,
    });
  }

  return res.status(200).json(buildSessionPayload(req));
});

authRouter.get('/session', (req, res) => {
  res.status(200).json(buildSessionPayload(req));
});

authRouter.get(
  '/google',
  ensureOAuthConfigured,
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRouter.get(
  '/google/callback',
  ensureOAuthConfigured,
  passport.authenticate('google', {
    failureRedirect: '/html/index.html',
    successRedirect: '/html/library.html',
  })
);

authRouter.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return next(err);
    }

    req.session?.destroy((sessionError) => {
      if (sessionError) {
        console.error('Session destroy error:', sessionError);
        return next(sessionError);
      }

      res.redirect('/html/index.html');
    });
  });
});

authRouter.get('/profile', (req, res) => {
  if (req.isAuthenticated?.() && req.user) {
    return res.status(200).json(buildSessionPayload(req));
  }

  return res.status(401).json({ message: 'User not authenticated. Please log in.' });
});

export default authRouter;
