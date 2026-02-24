/**
 * Wraps async route handlers so rejected promises are passed to Express error middleware.
 * @param {Function} fn - Async (req, res, next) handler
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
