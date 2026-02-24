import * as AIQuoteGeneratorService from '../services/AIQuoteGeneratorService.js';
import Quote from '../models/Quote.js';
import asyncHandler from '../utils/asyncHandler.js';

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/ai/quotes/generate/theme
 * Gera uma citação filosófica com base em temas do THEME_DATABASE.
 */
export const generateByTheme = asyncHandler(async (req, res) => {
  const { themes, save = false } = req.body;

  const result = await AIQuoteGeneratorService.generateByTheme(themes);

  if (save) {
    const quote = await Quote.create({
      quoteText: result.quoteText,
      authorName: result.authorName,
      themes: result.themes,
      isGenerated: result.isGenerated,
      generationContext: result.generationContext,
    });
    return res.status(201).json({
      quote,
      explanation: result.explanation,
      saved: true,
    });
  }

  return res.status(200).json({
    quote: {
      quoteText: result.quoteText,
      authorName: result.authorName,
      themes: result.themes,
      isGenerated: result.isGenerated,
      generationContext: result.generationContext,
    },
    explanation: result.explanation,
    saved: false,
  });
});

/**
 * POST /api/ai/quotes/generate/philosopher
 * Gera uma citação filosófica no estilo de um filósofo específico.
 */
export const generateByPhilosopher = asyncHandler(async (req, res) => {
  const { philosopher, theme, save = false } = req.body;

  const result = await AIQuoteGeneratorService.generateByPhilosopher(
    philosopher,
    theme
  );

  if (save) {
    const quote = await Quote.create({
      quoteText: result.quoteText,
      authorName: result.authorName,
      themes: result.themes,
      isGenerated: result.isGenerated,
      generationContext: result.generationContext,
    });
    return res.status(201).json({
      quote,
      explanation: result.explanation,
      saved: true,
    });
  }

  return res.status(200).json({
    quote: {
      quoteText: result.quoteText,
      authorName: result.authorName,
      themes: result.themes,
      isGenerated: result.isGenerated,
      generationContext: result.generationContext,
    },
    explanation: result.explanation,
    saved: false,
  });
});

/**
 * POST /api/ai/quotes/generate/media-context
 * Gera uma citação inspirada no contexto da obra (detalhes + reviews TMDB).
 * Opcional: suggestMatches usa embeddings para sugerir outras obras que combinam com a citação.
 */
export const generateByMediaContext = asyncHandler(async (req, res) => {
  const { tmdbId, mediaType, save = false, suggestMatches = false } = req.body;

  const result = await AIQuoteGeneratorService.generateByMediaContext(
    tmdbId,
    mediaType,
    { suggestMatches }
  );

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
    const quote = await Quote.create({
      quoteText: result.quoteText,
      authorName: result.authorName,
      themes: result.themes,
      isGenerated: result.isGenerated,
      generationContext: result.generationContext,
    });
    payload.quote = quote;
    payload.saved = true;
    return res.status(201).json(payload);
  }

  return res.status(200).json(payload);
});

/**
 * GET /api/ai/quotes/themes
 * Retorna a lista de temas válidos disponíveis para geração.
 */
export const listValidThemes = asyncHandler(async (req, res) => {
  const themes = AIQuoteGeneratorService.getValidThemes();
  res.status(200).json({ themes, total: themes.length });
});