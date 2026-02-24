import express from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/requestValidator.js';
import {
  generateByTheme,
  generateByPhilosopher,
  generateByMediaContext,
  listValidThemes,
} from '../controllers/AIQuoteController.js';

const router = express.Router();

// ─── Rate limiter específico para endpoints de IA ────────────────────────────
// Muito mais restritivo que o global — chamadas de IA têm custo real.
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30,                   // 30 gerações por hora por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many AI generation requests. You can generate up to 30 quotes per hour.',
  },
});

router.use(aiLimiter);

// ─── Regras de validação ──────────────────────────────────────────────────────

const generateByThemeRules = [
  body('themes')
    .isArray({ min: 1, max: 5 })
    .withMessage('themes must be an array with 1 to 5 items'),
  body('themes.*')
    .isString()
    .withMessage('Each theme must be a string')
    .isLength({ max: 100 })
    .withMessage('Each theme must be at most 100 characters'),
  body('save')
    .optional()
    .isBoolean()
    .withMessage('save must be a boolean'),
];

const generateByPhilosopherRules = [
  body('philosopher')
    .isString()
    .withMessage('philosopher must be a string')
    .notEmpty()
    .withMessage('philosopher is required')
    .isLength({ max: 100 })
    .withMessage('philosopher must be at most 100 characters'),
  body('theme')
    .optional()
    .isString()
    .withMessage('theme must be a string')
    .isLength({ max: 100 })
    .withMessage('theme must be at most 100 characters'),
  body('save')
    .optional()
    .isBoolean()
    .withMessage('save must be a boolean'),
];

const generateByMediaContextRules = [
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
  body('save')
    .optional()
    .isBoolean()
    .withMessage('save must be a boolean'),
  body('suggestMatches')
    .optional()
    .isBoolean()
    .withMessage('suggestMatches must be a boolean'),
];

// ─── Rotas ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/ai/quotes/themes:
 *   get:
 *     summary: Returns all valid philosophical themes available for generation.
 *     tags: [AI Quotes]
 *     responses:
 *       200:
 *         description: List of valid themes returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 themes:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["existentialism", "stoicism", "virtue"]
 *                 total:
 *                   type: integer
 *                   example: 40
 */
router.get('/themes', listValidThemes);

/**
 * @swagger
 * /api/ai/quotes/generate/theme:
 *   post:
 *     summary: Generates an original philosophical quote based on themes.
 *     tags: [AI Quotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateByThemeRequest'
 *     responses:
 *       200:
 *         description: Quote generated successfully (not saved).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIQuoteResponse'
 *       201:
 *         description: Quote generated and saved to database.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIQuoteResponse'
 *       400:
 *         description: Validation error or invalid themes.
 *       429:
 *         description: Too many requests.
 *       500:
 *         description: AI generation failed.
 */
router.post(
  '/generate/theme',
  generateByThemeRules,
  validateRequest,
  generateByTheme
);

/**
 * @swagger
 * /api/ai/quotes/generate/philosopher:
 *   post:
 *     summary: Generates an original philosophical quote in the style of a specific philosopher.
 *     tags: [AI Quotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateByPhilosopherRequest'
 *     responses:
 *       200:
 *         description: Quote generated successfully (not saved).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIQuoteResponse'
 *       201:
 *         description: Quote generated and saved to database.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIQuoteResponse'
 *       400:
 *         description: Validation error.
 *       429:
 *         description: Too many requests.
 *       500:
 *         description: AI generation failed.
 */
router.post(
  '/generate/philosopher',
  generateByPhilosopherRules,
  validateRequest,
  generateByPhilosopher
);

/**
 * @swagger
 * /api/ai/quotes/generate/media-context:
 *   post:
 *     summary: Generates a philosophical quote inspired by a film or TV show (TMDB details + reviews).
 *     tags: [AI Quotes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tmdbId, mediaType]
 *             properties:
 *               tmdbId:
 *                 type: string
 *                 description: TMDB ID of the movie or TV show
 *               mediaType:
 *                 type: string
 *                 enum: [movie, tv]
 *               save:
 *                 type: boolean
 *                 default: false
 *               suggestMatches:
 *                 type: boolean
 *                 default: false
 *                 description: If true, uses embeddings to suggest other media that match the generated quote
 *     responses:
 *       200:
 *         description: Quote generated (optionally with suggestedMatches).
 *       201:
 *         description: Quote generated and saved to database.
 *       400:
 *         description: Validation error or missing tmdbId/mediaType.
 *       429:
 *         description: Too many requests.
 *       502:
 *         description: TMDB or AI generation failed.
 */
router.post(
  '/generate/media-context',
  generateByMediaContextRules,
  validateRequest,
  generateByMediaContext
);

export default router;