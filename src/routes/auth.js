import { Router } from 'express';
import { body } from 'express-validator';
import passport from 'passport';
import { validateRequest } from '../middleware/requestValidator.js';
import { resolveOAuthCallbackUrl } from '../utils/publicUrl.js';

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
      watchedCount: Array.isArray(user.watched) ? user.watched.length : 0,
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
  (req, res, next) => passport.authenticate('google', {
    callbackURL: resolveOAuthCallbackUrl(req),
    scope: ['profile', 'email'],
  })(req, res, next)
);

authRouter.get(
  '/google/callback',
  ensureOAuthConfigured,
  (req, res, next) => passport.authenticate('google', {
    callbackURL: resolveOAuthCallbackUrl(req),
    failureRedirect: '/html/index.html',
    successRedirect: '/html/library.html',
  })(req, res, next)
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

authRouter.patch(
  '/profile/avatar',
  body('avatarUrl')
    .optional()
    .isString()
    .withMessage('avatarUrl must be a string')
    .isLength({ max: 400000 })
    .withMessage('avatarUrl is too large')
    .custom(value => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return true;
      return /^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i.test(trimmed);
    })
    .withMessage('avatarUrl must be an https URL or a supported image data URL'),
  validateRequest,
  async (req, res, next) => {
    if (!(req.isAuthenticated?.() && req.user)) {
      return res.status(401).json({ message: 'User not authenticated. Please log in.' });
    }

    try {
      req.user.avatarUrl = String(req.body.avatarUrl || '').trim();
      await req.user.save();
      return res.status(200).json(buildSessionPayload(req));
    } catch (error) {
      return next(error);
    }
  }
);

export default authRouter;
