import express from 'express';
import { body, query } from 'express-validator';
import Rating from '../models/Rating.js';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/requestValidator.js';
import asyncHandler from '../utils/asyncHandler.js';
import { pickAllowedFields } from '../utils/resourceAccess.js';
import {
  isValidMediaTargetId,
  isValidTargetId,
  normalizeRatingValue,
} from '../../public/scripts/domain/userRatings.js';

const router = express.Router();

const RATING_WRITE_FIELDS = ['targetType', 'targetId', 'value'];
const AUTH_REQUIRED_MESSAGE = 'Authentication required. Please log in to perform this action.';

function ownerIdFromUser(user) {
  return String(user?._id ?? user?.id ?? '');
}

function requireOwnerId(req, res) {
  const ownerId = ownerIdFromUser(req.user);
  if (!ownerId) {
    res.status(401).json({ message: AUTH_REQUIRED_MESSAGE });
    return null;
  }
  return ownerId;
}

function toPlainRating(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    targetType: raw.targetType,
    targetId: raw.targetId,
    value: raw.value,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function isValidTargetIdForType(targetType, targetId) {
  if (!isValidTargetId(targetId)) return false;
  if (targetType === 'media') return isValidMediaTargetId(targetId);
  if (targetType === 'quote') return true;
  return false;
}

const upsertRules = [
  body('targetType')
    .isIn(['media', 'quote'])
    .withMessage('targetType must be "media" or "quote"'),
  body('targetId')
    .isString()
    .withMessage('targetId must be a string')
    .trim()
    .notEmpty()
    .withMessage('targetId is required')
    .isLength({ max: 80 })
    .withMessage('targetId must be at most 80 characters')
    .custom((targetId, { req }) => isValidTargetIdForType(req.body?.targetType, targetId))
    .withMessage('targetId is invalid for this targetType'),
  body('value')
    .exists()
    .withMessage('value is required')
    .custom((value, { req }) => normalizeRatingValue(req.body?.targetType, value) !== null)
    .withMessage('value is invalid for this targetType'),
];

const filterRules = [
  query('targetType')
    .optional()
    .isIn(['media', 'quote'])
    .withMessage('targetType must be "media" or "quote"'),
  query('targetId')
    .optional()
    .isString()
    .withMessage('targetId must be a string')
    .trim()
    .notEmpty()
    .withMessage('targetId cannot be empty')
    .isLength({ max: 80 })
    .withMessage('targetId must be at most 80 characters')
    .custom(isValidTargetId)
    .withMessage('targetId is invalid'),
];

const deleteRules = [
  query('targetType')
    .isIn(['media', 'quote'])
    .withMessage('targetType must be "media" or "quote"'),
  query('targetId')
    .isString()
    .withMessage('targetId must be a string')
    .trim()
    .notEmpty()
    .withMessage('targetId is required')
    .isLength({ max: 80 })
    .withMessage('targetId must be at most 80 characters')
    .custom((targetId, { req }) => isValidTargetIdForType(req.query?.targetType, targetId))
    .withMessage('targetId is invalid for this targetType'),
];

/**
 * @swagger
 * /api/me/ratings:
 *   get:
 *     summary: Lists the current user's ratings.
 *     tags: [Ratings]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: targetType
 *         schema:
 *           type: string
 *           enum: [media, quote]
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ratings owned by the current user.
 *       401:
 *         description: Authentication required.
 */
router.get('/ratings', isAuthenticated, filterRules, validateRequest, asyncHandler(async (req, res) => {
  const ownerId = requireOwnerId(req, res);
  if (!ownerId) return;

  const filter = { userId: ownerId };
  if (req.query.targetType) filter.targetType = req.query.targetType;
  if (req.query.targetId) filter.targetId = String(req.query.targetId);

  const docs = await Rating.find(filter).sort({ updatedAt: -1 }).lean();
  return res.status(200).json({ ratings: docs.map(toPlainRating) });
}));

/**
 * @swagger
 * /api/me/ratings:
 *   put:
 *     summary: Creates or updates a rating for the current user.
 *     tags: [Ratings]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetType, targetId, value]
 *             properties:
 *               targetType:
 *                 type: string
 *                 enum: [media, quote]
 *               targetId:
 *                 type: string
 *               value:
 *                 description: Quote thumbs are 1/-1 (or up/down); media stars are 1–5.
 *     responses:
 *       200:
 *         description: Existing rating updated.
 *       201:
 *         description: Rating created.
 *       401:
 *         description: Authentication required.
 */
async function upsertRating(req, res) {
  const ownerId = requireOwnerId(req, res);
  if (!ownerId) return;

  const payload = pickAllowedFields(req.body, RATING_WRITE_FIELDS);
  const targetType = payload.targetType;
  const targetId = String(payload.targetId || '').trim();
  const value = normalizeRatingValue(targetType, payload.value);

  if (!targetType || !targetId || value === null) {
    return res.status(400).json({ message: 'Invalid rating payload.' });
  }

  const selector = { userId: ownerId, targetType, targetId };
  const existing = await Rating.findOne(selector);

  if (existing) {
    existing.value = value;
    await existing.save();
    return res.status(200).json({ rating: toPlainRating(existing), created: false });
  }

  try {
    const created = await Rating.create({
      userId: ownerId,
      targetType,
      targetId,
      value,
    });
    return res.status(201).json({ rating: toPlainRating(created), created: true });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const raced = await Rating.findOneAndUpdate(
      selector,
      { $set: { value } },
      { new: true, runValidators: true }
    );
    return res.status(200).json({ rating: toPlainRating(raced), created: false });
  }
}

router.put('/ratings', isAuthenticated, upsertRules, validateRequest, asyncHandler(upsertRating));
router.post('/ratings', isAuthenticated, upsertRules, validateRequest, asyncHandler(upsertRating));

/**
 * @swagger
 * /api/me/ratings:
 *   delete:
 *     summary: Removes a rating owned by the current user.
 *     tags: [Ratings]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: targetType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [media, quote]
 *       - in: query
 *         name: targetId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Whether a rating was removed.
 *       401:
 *         description: Authentication required.
 */
router.delete('/ratings', isAuthenticated, deleteRules, validateRequest, asyncHandler(async (req, res) => {
  const ownerId = requireOwnerId(req, res);
  if (!ownerId) return;

  const targetType = req.query.targetType;
  const targetId = String(req.query.targetId || '').trim();
  const deleted = await Rating.findOneAndDelete({
    userId: ownerId,
    targetType,
    targetId,
  });

  return res.status(200).json({
    removed: Boolean(deleted),
    targetType,
    targetId,
  });
}));

export default router;
