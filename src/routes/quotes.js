import express from 'express';
import Quote from '../models/Quote.js';
import { isAuthenticated } from '../../middleware/authMiddleware.js';
import { body, param, validationResult } from 'express-validator';

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * @swagger
 * /api/quotes:
 *  get:
 *    summary: Returns all quotes.
 *    tags: [Quotes]
 *    responses:
 *      200:
 *        description: List of quotes returned successfully.
 *    content:
 *      application/json:
 *        schema:
 *          type: array
 *      items:
 *        $ref: '#/components/schemas/Quote'
 *      500:
 *        description: Error retrieving quotes.
 */

/**
 * @swagger
 * /api/quotes:
 *  post:
 *    summary: Creates a new quote.
 *    tags: [Quotes]
 *    security:
 *      - CookieAuth: []
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            $ref: '#/components/schemas/Quote'
 *    responses:
 *      201:
 *        description: Quote created successfully.
 *      400:
 *        description: Invalid quote data.
 *      401:
 *        description: Authentication required.
 *      500:
 *        description: Error creating quote.
 */

/**
 * @swagger
 * /api/quotes/{id}:
 *  get:
 *    summary: Returns a quote by ID.
 *    tags: [Quotes]
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *        description: Quote ID
 *    content:
 *      application/json:
 *        schema:
 *          $ref: '#/components/schemas/Quote'
 *    responses:
 *      200:
 *        description: Quote returned successfully.
 *      404:
 *        description: Quote not found.
 *      500:
 *        description: Error retrieving quote.
 */

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
 *       404:
 *         description: Quote not found.
 *       400:
 *         description: Invalid quote data.
 *       401:
 *         description: Authentication required.
 *       500:
 *         description: Error updating quote.
 */

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
 *       404:
 *         description: Quote not found.
 *       401:
 *         description: Authentication required.
 *       500:
 *         description: Error deleting quote.
 */

router.get('/', async (req, res) => {
  try {
    const quotes = await Quote.find();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', param('id').isMongoId().withMessage('Invalid quote id'), validateRequest, async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post(
  '/',
  isAuthenticated,
  [
    body('quoteText').isString().notEmpty().withMessage('quoteText is required').isLength({ max: 500 }).withMessage('quoteText max 500 chars'),
    body('authorName').isString().notEmpty().withMessage('authorName is required').isLength({ max: 100 }).withMessage('authorName max 100 chars'),
    body('themes').optional().isArray().withMessage('themes must be an array of strings'),
  ],
  validateRequest,
  async (req, res) => {
    const quote = new Quote(req.body);
    try {
      const newQuote = await quote.save();
      res.status(201).json(newQuote);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.put(
  '/:id',
  isAuthenticated,
  [
    param('id').isMongoId().withMessage('Invalid quote id'),
    body('quoteText').optional().isString().isLength({ max: 500 }).withMessage('quoteText max 500 chars'),
    body('authorName').optional().isString().isLength({ max: 100 }).withMessage('authorName max 100 chars'),
    body('themes').optional().isArray().withMessage('themes must be an array of strings'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const updatedQuote = await Quote.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      if (!updatedQuote) return res.status(404).json({ message: 'Quote not found' });
      res.json(updatedQuote);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.delete('/:id', isAuthenticated, param('id').isMongoId().withMessage('Invalid quote id'), validateRequest, async (req, res) => {
  try {
    const deletedQuote = await Quote.findByIdAndDelete(req.params.id);
    if (!deletedQuote) return res.status(404).json({ message: 'Quote not found' });
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
