/**
 * Google Generative AI model id (Gemini).
 * Override with GOOGLE_AI_MODEL in .env when your project pins another revision.
 */
export const GEMINI_MODEL_NAME =
  (process.env.GOOGLE_AI_MODEL && process.env.GOOGLE_AI_MODEL.trim()) || 'gemini-2.0-flash';
