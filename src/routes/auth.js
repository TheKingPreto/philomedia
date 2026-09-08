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

export const MAX_AVATAR_DECODED_BYTES = 80 * 1024;
export const MAX_HTTPS_AVATAR_URL_LENGTH = 2048;

export function decodedDataUrlBytes(value) {
  const match = String(value || '').match(/^data:image\/(?:png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const b64 = match[1].replace(/\s/g, '');
  const padding = (b64.match(/=+$/) || [''])[0].length;
  return Math.max(0, Math.floor((b64.length * 3) / 4) - padding);
}

function isAllowedAvatarUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return true;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.length <= MAX_HTTPS_AVATAR_URL_LENGTH;
  }
  const decoded = decodedDataUrlBytes(trimmed);
  return decoded != null && decoded <= MAX_AVATAR_DECODED_BYTES;
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

function destroySessionAndFinish(req, res, next) {
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
}

authRouter.get('/logout', (req, res) => {
  res.setHeader('Allow', 'POST');
  res.status(405).json({ error: 'Use POST /auth/logout to end the session.' });
});

authRouter.post('/logout', (req, res, next) => {
  destroySessionAndFinish(req, res, next);
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
    .custom(value => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return true;
      return /^(https?:\/\/|data:image\/(?:png|jpe?g|webp|gif);base64,)/i.test(trimmed);
    })
    .withMessage('avatarUrl must be an https URL or a supported image data URL')
    .custom(value => isAllowedAvatarUrl(value))
    .withMessage(`avatarUrl decoded size must be at most ${MAX_AVATAR_DECODED_BYTES} bytes`),
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
