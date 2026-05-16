import express from 'express';
import { body } from 'express-validator';
import { isAuthenticated } from '../middleware/authMiddleware.js';
import { validateRequest } from '../middleware/requestValidator.js';
import {
  createPhilosopherSubmission,
  listPhilosopherProfiles,
} from '../controllers/PhilosopherController.js';

const router = express.Router();

const contributionRules = [
  body('name')
    .isString()
    .withMessage('name must be a string')
    .notEmpty()
    .withMessage('name is required')
    .isLength({ max: 120 })
    .withMessage('name must be at most 120 characters'),
  body('period')
    .optional()
    .isString()
    .withMessage('period must be a string')
    .isLength({ max: 160 })
    .withMessage('period must be at most 160 characters'),
  body('summary')
    .optional()
    .isString()
    .withMessage('summary must be a string')
    .isLength({ max: 600 })
    .withMessage('summary must be at most 600 characters'),
  body('focus')
    .optional()
    .isString()
    .withMessage('focus must be a string')
    .isLength({ max: 600 })
    .withMessage('focus must be at most 600 characters'),
  body('originalLanguage')
    .optional()
    .isIn(['en', 'pt'])
    .withMessage('originalLanguage must be en or pt'),
  body('summaryI18n')
    .optional()
    .isObject()
    .withMessage('summaryI18n must be an object'),
  body('summaryI18n.en')
    .optional()
    .isString()
    .isLength({ max: 600 })
    .withMessage('summaryI18n.en must be at most 600 characters'),
  body('summaryI18n.pt')
    .optional()
    .isString()
    .isLength({ max: 600 })
    .withMessage('summaryI18n.pt must be at most 600 characters'),
  body('focusI18n')
    .optional()
    .isObject()
    .withMessage('focusI18n must be an object'),
  body('focusI18n.en')
    .optional()
    .isString()
    .isLength({ max: 600 })
    .withMessage('focusI18n.en must be at most 600 characters'),
  body('focusI18n.pt')
    .optional()
    .isString()
    .isLength({ max: 600 })
    .withMessage('focusI18n.pt must be at most 600 characters'),
  body('portraitUrl')
    .optional()
    .isString()
    .withMessage('portraitUrl must be a string')
    .custom(value => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return true;
      return /^https?:\/\//i.test(trimmed);
    })
    .withMessage('portraitUrl must be an http or https URL'),
  body('wikiTitle')
    .optional()
    .isString()
    .withMessage('wikiTitle must be a string')
    .isLength({ max: 180 })
    .withMessage('wikiTitle must be at most 180 characters'),
  body('aliases')
    .optional()
    .isArray({ max: 10 })
    .withMessage('aliases must be an array'),
  body('aliases.*')
    .optional()
    .isString()
    .withMessage('alias entries must be strings')
    .isLength({ max: 120 })
    .withMessage('each alias must be at most 120 characters'),
  body('quotes')
    .isArray({ min: 1, max: 8 })
    .withMessage('quotes must be an array with 1 to 8 entries'),
  body('quotes.*.quoteText')
    .isString()
    .withMessage('quoteText must be a string')
    .notEmpty()
    .withMessage('quoteText is required')
    .isLength({ max: 500 })
    .withMessage('quoteText must be at most 500 characters'),
  body('quotes.*.themes')
    .optional()
    .isArray({ max: 6 })
    .withMessage('themes must be an array of strings'),
  body('quotes.*.quoteLanguage')
    .optional()
    .isIn(['en', 'pt'])
    .withMessage('quoteLanguage must be en or pt'),
];

router.get('/', listPhilosopherProfiles);

router.post(
  '/',
  isAuthenticated,
  contributionRules,
  validateRequest,
  createPhilosopherSubmission
);

export default router;
