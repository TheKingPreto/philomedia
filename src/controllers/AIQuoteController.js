import * as AIQuoteGeneratorService from '../services/AIQuoteGeneratorService.js';
import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';

/**
 * POST /api/ai/quotes/generate/theme
 */
export const generateByTheme = asyncHandler(async (req, res) => {
  const { themes, save = false } = req.body;

  const result = await AIQuoteGeneratorService.generateByTheme(themes);

  // IA falhou silenciosamente
  if (!result.quoteText || !result.authorName) {
    return res.status(204).end();
  }

  const payload = {
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

  if (save) {
    const quote = await Quote.create(payload.quote);
    payload.quote = quote;
    payload.saved = true;
    return res.status(201).json(payload);
  }

  return res.status(200).json(payload);
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

  if (!result.quoteText || !result.authorName) {
    return res.status(204).end();
  }

  const payload = {
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

  if (save) {
    const quote = await Quote.create(payload.quote);
    payload.quote = quote;
    payload.saved = true;
    return res.status(201).json(payload);
  }

  return res.status(200).json(payload);
});

/**
 * POST /api/ai/quotes/generate/media-context
 */
export const generateByMediaContext = asyncHandler(async (req, res) => {
  const { tmdbId, mediaType, save = false, suggestMatches = false } = req.body;

  const result = await AIQuoteGeneratorService.generateByMediaContext(
    tmdbId,
    mediaType,
    { suggestMatches }
  );

  // ✅ decisão HTTP fica AQUI
  if (!result.quoteText || !result.authorName) {
    return res.status(204).end();
  }

  const payload = {
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

  if (result.suggestedMatches) {
    payload.suggestedMatches = result.suggestedMatches;
  }

  if (save) {
    const quote = await Quote.create(payload.quote);
    payload.quote = quote;
    payload.saved = true;
    return res.status(201).json(payload);
  }

  return res.status(200).json(payload);
});

/**
 * GET /api/ai/quotes/themes
 */
export const listValidThemes = asyncHandler(async (req, res) => {
  const themes = AIQuoteGeneratorService.getValidThemes();
  res.status(200).json({ themes, total: themes.length });
});