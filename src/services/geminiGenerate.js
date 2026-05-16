import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_FALLBACK_MODELS, GEMINI_MODEL_NAME } from '../config/geminiModel.js';

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not set.');
  }
  return new GoogleGenerativeAI(apiKey);
}

export function isGeminiQuotaError(error) {
  const msg = String(error?.message || error || '');
  return /429|too many requests|quota exceeded|resource_exhausted/i.test(msg);
}

function isGeminiModelUnavailableError(error) {
  const msg = String(error?.message || error || '');
  return /404|not found|is not supported|invalid model/i.test(msg);
}

function shouldTryNextModel(error) {
  return isGeminiQuotaError(error) || isGeminiModelUnavailableError(error);
}

function resolveModelChain() {
  const chain = [GEMINI_MODEL_NAME, ...GEMINI_FALLBACK_MODELS];
  return [...new Set(chain.map((m) => m.trim()).filter(Boolean))];
}

/**
 * @param {string} prompt
 * @param {import('@google/generative-ai').GenerationConfig} generationConfig
 * @returns {Promise<{ text: string, model: string }>}
 */
export async function generateGeminiText(prompt, generationConfig) {
  const genAI = getGeminiClient();
  const models = resolveModelChain();
  let lastError = null;

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
      const result = await model.generateContent(prompt);
      const rawText = await Promise.resolve(result.response.text());
      return { text: String(rawText).trim(), model: modelName };
    } catch (error) {
      lastError = error;
      if (!shouldTryNextModel(error)) {
        throw error;
      }
    }
  }

  const err = new Error(
    lastError?.message || 'Gemini API quota exceeded for all configured models.'
  );
  err.code = 'ai_quota_exceeded';
  throw err;
}
