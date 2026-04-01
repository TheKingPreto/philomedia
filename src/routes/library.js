import express from 'express';
import { body, param, query } from 'express-validator';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/requestValidator.js';

const router = express.Router();
const VALID_COLLECTIONS = new Set(['watchlist', 'favorites', 'watched']);

function toPlainItem(entry) {
  return {
    tmdbId: entry.tmdbId,
    mediaType: entry.mediaType,
    title: entry.title,
    posterPath: entry.posterPath || '',
    releaseDate: entry.releaseDate || '',
    voteAverage: Number(entry.voteAverage) || 0,
    addedAt: entry.addedAt,
  };
}

function hasLibraryEntry(items = [], tmdbId, mediaType) {
  return items.some(item => item.tmdbId === tmdbId && item.mediaType === mediaType);
}

function buildLibraryPayload(user) {
  const watchlist = (user.watchlist || [])
    .map(toPlainItem)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  const favorites = (user.favorites || [])
    .map(toPlainItem)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
  const watched = (user.watched || [])
    .map(toPlainItem)
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  return {
    watchlist,
    favorites,
    watched,
    counts: {
      watchlist: watchlist.length,
      favorites: favorites.length,
      watched: watched.length,
    },
  };
}

function buildStatusPayload(user, tmdbId, mediaType) {
  return {
    inWatchlist: hasLibraryEntry(user.watchlist, tmdbId, mediaType),
    inFavorites: hasLibraryEntry(user.favorites, tmdbId, mediaType),
    inWatched: hasLibraryEntry(user.watched, tmdbId, mediaType),
  };
}

const saveItemRules = [
  body('tmdbId')
    .isString()
    .withMessage('tmdbId must be a string')
    .notEmpty()
    .withMessage('tmdbId is required')
    .isLength({ max: 20 })
    .withMessage('tmdbId must be at most 20 characters'),
  body('mediaType')
    .isIn(['movie', 'tv'])
    .withMessage('mediaType must be "movie" or "tv"'),
  body('title')
    .isString()
    .withMessage('title must be a string')
    .notEmpty()
    .withMessage('title is required')
    .isLength({ max: 200 })
    .withMessage('title must be at most 200 characters'),
  body('posterPath')
    .optional()
    .isString()
    .withMessage('posterPath must be a string'),
  body('releaseDate')
    .optional()
    .isString()
    .withMessage('releaseDate must be a string'),
  body('voteAverage')
    .optional()
    .isFloat({ min: 0, max: 10 })
    .withMessage('voteAverage must be a number between 0 and 10'),
];

const statusRules = [
  query('tmdbId')
    .isString()
    .withMessage('tmdbId must be a string')
    .notEmpty()
    .withMessage('tmdbId is required'),
  query('mediaType')
    .isIn(['movie', 'tv'])
    .withMessage('mediaType must be "movie" or "tv"'),
];

const entryParamRules = [
  param('collection')
    .isIn(['watchlist', 'favorites', 'watched'])
    .withMessage('collection must be "watchlist", "favorites", or "watched"'),
  param('mediaType')
    .isIn(['movie', 'tv'])
    .withMessage('mediaType must be "movie" or "tv"'),
  param('tmdbId')
    .isString()
    .withMessage('tmdbId must be a string')
    .notEmpty()
    .withMessage('tmdbId is required'),
];

router.get('/library', isAuthenticated, (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required. Please log in to perform this action.',
    });
  }

  return res.status(200).json(buildLibraryPayload(req.user));
});

router.get('/library/status', isAuthenticated, statusRules, validateRequest, (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      message: 'Authentication required. Please log in to perform this action.',
    });
  }

  const { tmdbId, mediaType } = req.query;
  return res.status(200).json(buildStatusPayload(req.user, String(tmdbId), String(mediaType)));
});

router.post(
  '/library/:collection',
  isAuthenticated,
  param('collection')
    .isIn(['watchlist', 'favorites', 'watched'])
    .withMessage('collection must be "watchlist", "favorites", or "watched"'),
  saveItemRules,
  validateRequest,
  async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required. Please log in to perform this action.',
      });
    }

    const collection = req.params.collection;
    if (!VALID_COLLECTIONS.has(collection)) {
      return res.status(400).json({ message: 'Invalid library collection.' });
    }

    try {
      const item = {
        tmdbId: req.body.tmdbId,
        mediaType: req.body.mediaType,
        title: req.body.title,
        posterPath: req.body.posterPath || '',
        releaseDate: req.body.releaseDate || '',
        voteAverage: Number(req.body.voteAverage) || 0,
      };

      const existing = req.user[collection].find(entry =>
        entry.tmdbId === item.tmdbId && entry.mediaType === item.mediaType
      );

      if (existing) {
        existing.title = item.title;
        existing.posterPath = item.posterPath;
        existing.releaseDate = item.releaseDate;
        existing.voteAverage = item.voteAverage;
      } else {
        req.user[collection].unshift({
          ...item,
          addedAt: new Date(),
        });
      }

      await req.user.save();

      return res.status(existing ? 200 : 201).json({
        saved: true,
        collection,
        item,
        status: buildStatusPayload(req.user, item.tmdbId, item.mediaType),
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.delete(
  '/library/:collection/:mediaType/:tmdbId',
  isAuthenticated,
  entryParamRules,
  validateRequest,
  async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'Authentication required. Please log in to perform this action.',
      });
    }

    const { collection, mediaType, tmdbId } = req.params;

    try {
      const originalLength = req.user[collection].length;
      req.user[collection] = req.user[collection].filter(entry =>
        !(entry.tmdbId === tmdbId && entry.mediaType === mediaType)
      );
      const removed = req.user[collection].length !== originalLength;

      if (removed) {
        await req.user.save();
      }

      return res.status(200).json({
        removed,
        collection,
        status: buildStatusPayload(req.user, tmdbId, mediaType),
      });
    } catch (error) {
      return next(error);
    }
  }
);

export default router;
