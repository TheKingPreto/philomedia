/**
 * Google Generative AI model id (Gemini).
 * Override with GOOGLE_AI_MODEL in .env when your project pins another revision.
 */
export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

export const GEMINI_MODEL_NAME =
  (process.env.GOOGLE_AI_MODEL && process.env.GOOGLE_AI_MODEL.trim()) ||
  GEMINI_DEFAULT_MODEL;

/**
 * Models tried (in order) when the primary hits quota or is unavailable.
 * Duplicates of GEMINI_MODEL_NAME are skipped at runtime.
 */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];
