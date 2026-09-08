import * as AIQuoteGeneratorService from '../services/AIQuoteGeneratorService.js';
import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';
import { isRequestAuthenticated } from '../middleware/authMiddleware.js';
import {
  buildAiQuoteCacheKey,
  getCachedAiQuote,
  setCachedAiQuote,
} from '../services/aiQuoteCache.js';

const UNAUTHENTICATED_SAVE_MESSAGE =
  'Authentication required to persist a generated quote.';

function buildGeneratedQuotePayload(result) {
  return {
    quote: {
      quoteText: result.quoteText,
      authorName: result.authorName,
      themes: result.themes,
      isGenerated: result.isGenerated,
      generationContext: result.generationContext,
    },
    explanation: result.explanation,
    saved: false,
  };
}

async function respondWithGeneratedQuote(req, res, result, { save = false } = {}) {
  if (!result.quoteText || !result.authorName) {
    return res.status(200).json({
      available: false,
      reason: result.generationContext?.failed ? 'generation_failed' : 'empty',
      explanation: '',
    });
  }

  const payload = buildGeneratedQuotePayload(result);

  if (result.suggestedMatches) {
    payload.suggestedMatches = result.suggestedMatches;
  }

  if (save) {
    if (!isRequestAuthenticated(req)) {
      return res.status(401).json({ message: UNAUTHENTICATED_SAVE_MESSAGE });
    }

    const quote = await Quote.create({
      ...payload.quote,
      submittedBy: req.user?._id ?? null,
    });
    payload.quote = quote;
    payload.saved = true;
    return res.status(201).json(payload);
  }

  return res.status(200).json(payload);
}

/**
 * POST /api/ai/quotes/generate/theme
 */
export const generateByTheme = asyncHandler(async (req, res) => {
  const { themes, save = false } = req.body;
  const result = await AIQuoteGeneratorService.generateByTheme(themes);
  return respondWithGeneratedQuote(req, res, result, { save });
});

/**
 * POST /api/ai/quotes/generate/philosopher
 */
export const generateByPhilosopher = asyncHandler(async (req, res) => {
  const { philosopher, theme, save = false } = req.body;
  const result = await AIQuoteGeneratorService.generateByPhilosopher(
    philosopher,
    theme
  );
  return respondWithGeneratedQuote(req, res, result, { save });
});

/**
 * POST /api/ai/quotes/generate/media-context
 */
export const generateByMediaContext = asyncHandler(async (req, res) => {
  const { tmdbId, mediaType, save = false, suggestMatches = false, locale = 'en' } = req.body;

  if (!process.env.GOOGLE_AI_API_KEY) {
    return res.status(503).json({
      error: 'AI interpretation is not configured on this server.',
      code: 'ai_not_configured',
    });
  }

  const cacheKey = buildAiQuoteCacheKey({ tmdbId, mediaType, locale, suggestMatches });
  const cached = getCachedAiQuote(cacheKey);
  if (cached) {
    return respondWithGeneratedQuote(req, res, cached, { save });
  }

  try {
    const result = await AIQuoteGeneratorService.generateByMediaContext(
      String(tmdbId),
      mediaType,
      { suggestMatches, locale }
    );

    if (result?.quoteText && result?.authorName) {
      setCachedAiQuote(cacheKey, result);
    }

    return respondWithGeneratedQuote(req, res, result, { save });
  } catch (error) {
    console.error('[PhiloMedia] AI media-context error:', error.message);
    if (error.code === 'ai_quota_exceeded') {
      return res.status(503).json({
        error: 'AI interpretation quota exceeded. Try again later or set GOOGLE_AI_MODEL to another Gemini model.',
        code: 'ai_quota_exceeded',
      });
    }
    return res.status(502).json({
      error: 'AI interpretation failed.',
      code: 'ai_generation_failed',
    });
  }
});

/**
 * GET /api/ai/quotes/themes
 */
export const listValidThemes = asyncHandler(async (req, res) => {
  const themes = AIQuoteGeneratorService.getValidThemes();
  res.status(200).json({ themes, total: themes.length });
});
