import { validationResult } from 'express-validator';

/**
 * Shared middleware that checks express-validator results and short-circuits
 * with a 400 response if any validation errors were found.
 * Used by all routes to keep validation logic DRY.
 */
export const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};