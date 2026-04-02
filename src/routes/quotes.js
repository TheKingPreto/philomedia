import express from 'express';
import { body, param } from 'express-validator';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/requestValidator.js';
import {
  getAllQuotes,
  getQuoteCatalog,
  getQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
} from '../controllers/QuoteController.js';

const router = express.Router();

// ─── Validation rule sets ────────────────────────────────────────────────────

const quoteIdParam = [
  param('id').isMongoId().withMessage('Invalid quote id'),
];

const createQuoteRules = [
  body('quoteText')
    .isString().withMessage('quoteText must be a string')
    .notEmpty().withMessage('quoteText is required')
    .isLength({ max: 500 }).withMessage('quoteText max 500 chars'),
  body('authorName')
    .isString().withMessage('authorName must be a string')
    .notEmpty().withMessage('authorName is required')
    .isLength({ max: 100 }).withMessage('authorName max 100 chars'),
  body('themes')
    .optional()
    .isArray().withMessage('themes must be an array of strings'),
];

const updateQuoteRules = [
  param('id').isMongoId().withMessage('Invalid quote id'),
  body('quoteText')
    .optional()
    .isString().withMessage('quoteText must be a string')
    .isLength({ max: 500 }).withMessage('quoteText max 500 chars'),
  body('authorName')
    .optional()
    .isString().withMessage('authorName must be a string')
    .isLength({ max: 100 }).withMessage('authorName max 100 chars'),
  body('themes')
    .optional()
    .isArray().withMessage('themes must be an array of strings'),
];

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/quotes:
 *   get:
 *     summary: Returns all quotes.
 *     tags: [Quotes]
 *     responses:
 *       200:
 *         description: List of quotes returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Quote'
 *       500:
 *         description: Error retrieving quotes.
 */
router.get('/', getAllQuotes);

router.get('/catalog', getQuoteCatalog);

/**
 * @swagger
 * /api/quotes/{id}:
 *   get:
 *     summary: Returns a quote by ID.
 *     tags: [Quotes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID
 *     responses:
 *       200:
 *         description: Quote returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Quote'
 *       404:
 *         description: Quote not found.
 *       500:
 *         description: Error retrieving quote.
 */
router.get('/:id', quoteIdParam, validateRequest, getQuoteById);

/**
 * @swagger
 * /api/quotes:
 *   post:
 *     summary: Creates a new quote.
 *     tags: [Quotes]
 *     security:
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Quote'
 *     responses:
 *       201:
 *         description: Quote created successfully.
 *       400:
 *         description: Invalid quote data.
 *       401:
 *         description: Authentication required.
 *       500:
 *         description: Error creating quote.
 */
router.post('/', isAuthenticated, createQuoteRules, validateRequest, createQuote);

/**
 * @swagger
 * /api/quotes/{id}:
 *   put:
 *     summary: Updates a quote by ID.
 *     tags: [Quotes]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Quote'
 *     responses:
 *       200:
 *         description: Quote updated successfully.
 *       400:
 *         description: Invalid quote data.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Quote not found.
 *       500:
 *         description: Error updating quote.
 */
router.put('/:id', isAuthenticated, updateQuoteRules, validateRequest, updateQuote);

/**
 * @swagger
 * /api/quotes/{id}:
 *   delete:
 *     summary: Deletes a quote by ID.
 *     tags: [Quotes]
 *     security:
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quote ID
 *     responses:
 *       200:
 *         description: Quote deleted successfully.
 *       401:
 *         description: Authentication required.
 *       404:
 *         description: Quote not found.
 *       500:
 *         description: Error deleting quote.
 */
router.delete('/:id', isAuthenticated, quoteIdParam, validateRequest, deleteQuote);

export default router;
