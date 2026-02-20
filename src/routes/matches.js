import express from 'express';
import { body, param } from 'express-validator';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/requestValidator.js';
import {
  getAllMatches,
  getMatchById,
  createMatch,
  updateMatch,
  deleteMatch,
} from '../controllers/MatchController.js';

const router = express.Router();

// ─── Validation rule sets ────────────────────────────────────────────────────

const matchIdParam = [
  param('id').isMongoId().withMessage('Invalid match id'),
];

const createMatchRules = [
  body('tmdbId')
    .isString().withMessage('tmdbId must be a string')
    .notEmpty().withMessage('tmdbId is required'),
  body('quoteId')
    .isMongoId().withMessage('quoteId must be a valid ObjectId'),
  body('mediaType')
    .optional()
    .isIn(['movie', 'tv', 'anime', 'unknown']).withMessage('Invalid mediaType'),
];

const updateMatchRules = [
  param('id').isMongoId().withMessage('Invalid match id'),
  body('tmdbId')
    .optional()
    .isString().withMessage('tmdbId must be a string')
    .notEmpty().withMessage('tmdbId cannot be empty'),
  body('quoteId')
    .optional()
    .isMongoId().withMessage('quoteId must be a valid ObjectId'),
  body('mediaType')
    .optional()
    .isIn(['movie', 'tv', 'anime', 'unknown']).withMessage('Invalid mediaType'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: Returns all matches.
 *     tags: [Matches]
 *     responses:
 *       200:
 *         description: List of matches returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Match'
 *       500:
 *         description: Error retrieving matches.
 */
router.get('/', getAllMatches);

/**
 * @swagger
 * /api/matches/{id}:
 *   get:
 *     summary: Returns a match by ID.
 *     tags: [Matches]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     responses:
 *       200:
 *         description: Match returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Match not found.
 *       500:
 *         description: Error retrieving match.
 */
router.get('/:id', matchIdParam, validateRequest, getMatchById);

/**
 * @swagger
 * /api/matches:
 *   post:
 *     summary: Creates a new match.
 *     tags: [Matches]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Match'
 *     responses:
 *       201:
 *         description: Match created successfully.
 *       400:
 *         description: Invalid match data.
 *       401:
 *         description: Authentication required.
 *       500:
 *         description: Error creating match.
 */
router.post('/', isAuthenticated, createMatchRules, validateRequest, createMatch);

/**
 * @swagger
 * /api/matches/{id}:
 *   put:
 *     summary: Updates a match by ID.
 *     tags: [Matches]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Match'
 *     responses:
 *       200:
 *         description: Match updated successfully.
 *       400:
 *         description: Invalid match data.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Match not found.
 *       500:
 *         description: Error updating match.
 */
router.put('/:id', isAuthenticated, updateMatchRules, validateRequest, updateMatch);

/**
 * @swagger
 * /api/matches/{id}:
 *   delete:
 *     summary: Deletes a match by ID.
 *     tags: [Matches]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     responses:
 *       200:
 *         description: Match deleted successfully.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Match not found.
 *       500:
 *         description: Error deleting match.
 */
router.delete('/:id', isAuthenticated, matchIdParam, validateRequest, deleteMatch);

export default router;