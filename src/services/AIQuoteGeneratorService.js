import { GoogleGenerativeAI } from '@google/generative-ai';
import { THEME_DATABASE } from '../../public/scripts/themedatabase.js';
import * as tmdbClient from './tmdbClient.js';
import { GEMINI_MODEL_NAME } from '../config/geminiModel.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_OUTPUT_TOKENS = 2048;
const VALID_THEMES = Object.keys(THEME_DATABASE);

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /forget\s+(everything|all|your|the)/i,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+(a\s+)?different/i,
  /system\s*:/i,
  /\[INST\]/i,
  /<\|.*?\|>/i,
];

const VALID_TMDB_MEDIA_TYPES = new Set(['movie', 'tv']);

async function buildSuggestedMatches(tmdbId, mediaType) {
  const [recs, similar] = await Promise.all([
    tmdbClient.getRecommendations(tmdbId, mediaType),
    tmdbClient.getSimilar(tmdbId, mediaType),
  ]);

  const merged = new Map();
  for (const item of [...recs, ...similar]) {
    const id = String(item.id);
    if (!merged.has(id)) {
      merged.set(id, {
        tmdbId: id,
        mediaType: item.media_type || mediaType,
        title: item.title || item.name || '',
      });
    }
  }

  return [...merged.values()].slice(0, 12);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeInput(input, fieldName = 'input') {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = input.trim().slice(0, 200);

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error(`Invalid ${fieldName}: contains disallowed content.`);
    }
  }

  return trimmed;
}

function validateThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error('At least one theme is required.');
  }

  const valid = themes
    .map((t) => sanitizeInput(t, 'theme').toLowerCase())
    .filter((t) => VALID_THEMES.includes(t));

  if (valid.length === 0) {
    throw new Error(`No valid themes provided.`);
  }

  return valid;
}

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not set.');
  }
  return new GoogleGenerativeAI(apiKey);
}

async function callGemini(prompt) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL_NAME,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

function parseAIResponse(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    if (!parsed.quoteText || !parsed.authorName) return null;

    return {
      quoteText: parsed.quoteText.trim().slice(0, 500),
      authorName: parsed.authorName.trim().slice(0, 100),
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      explanation:
        typeof parsed.explanation === 'string'
          ? parsed.explanation.trim()
          : '',
    };
  } catch {
    return null;
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function enrichThemesForPrompt(validThemes) {
  return validThemes
    .map((t) => {
      const keys = Object.keys(THEME_DATABASE[t] || {}).slice(0, 8).join(', ');
      return keys ? `${t} (${keys})` : t;
    })
    .join('; ');
}

// ─── Services ────────────────────────────────────────────────────────────────

export async function generateByTheme(themes) {
  const validThemes = validateThemes(themes);
  const enriched = enrichThemesForPrompt(validThemes);

  const prompt = `
Create an original philosophical quote inspired by these themes:
${enriched}

Respond ONLY with valid JSON:
{
  "quoteText": "",
  "authorName": "",
  "themes": [],
  "explanation": ""
}
`;

  const rawText = await callGemini(prompt);
  const parsed = parseAIResponse(rawText);

  if (!parsed) {
    return {
      quoteText: null,
      authorName: null,
      themes: [],
      explanation: '',
      isGenerated: false,
      generationContext: {
        mode: 'by-theme',
        inputThemes: validThemes,
        model: GEMINI_MODEL_NAME,
        failed: true,
        generatedAt: new Date(),
      },
    };
  }

  return {
    ...parsed,
    isGenerated: true,
    generationContext: {
      mode: 'by-theme',
      inputThemes: validThemes,
      model: GEMINI_MODEL_NAME,
      generatedAt: new Date(),
    },
  };
}

export async function generateByPhilosopher(philosopher, theme) {
  const name = sanitizeInput(philosopher, 'philosopher');
  const th = theme ? sanitizeInput(theme, 'theme') : null;

  const prompt = `
Write an original philosophical quote in the style of ${name}.
${th ? `Theme: ${th}` : ''}

Respond ONLY with valid JSON:
{
  "quoteText": "",
  "authorName": "",
  "themes": [],
  "explanation": ""
}
`;

  const rawText = await callGemini(prompt);
  const parsed = parseAIResponse(rawText);

  if (!parsed) {
    return {
      quoteText: null,
      authorName: null,
      themes: [],
      explanation: '',
      isGenerated: false,
      generationContext: {
        mode: 'by-philosopher',
        inputPhilosopher: name,
        model: GEMINI_MODEL_NAME,
        failed: true,
        generatedAt: new Date(),
      },
    };
  }

  return {
    ...parsed,
    isGenerated: true,
    generationContext: {
      mode: 'by-philosopher',
      inputPhilosopher: name,
      model: GEMINI_MODEL_NAME,
      generatedAt: new Date(),
    },
  };
}

export async function generateByMediaContext(tmdbId, mediaType, { suggestMatches = false } = {}) {
  const [details, reviews] = await Promise.all([
    tmdbClient.getDetails(tmdbId, mediaType),
    tmdbClient.getReviews(tmdbId, mediaType),
  ]);

  const context = `
Title: ${details.title || details.name}
Overview: ${details.overview || ''}
Reviews: ${(reviews || []).map(r => r.content).join(' ')}
`;

  const prompt = `
Generate a philosophical quote inspired by this media context.

${context}

Respond ONLY with valid JSON:
{
  "quoteText": "",
  "authorName": "",
  "themes": [],
  "explanation": ""
}
`;

  const rawText = await callGemini(prompt);
  const parsed = parseAIResponse(rawText);

  let suggestedMatches;
  if (
    suggestMatches
    && tmdbId
    && VALID_TMDB_MEDIA_TYPES.has(mediaType)
  ) {
    try {
      const matches = await buildSuggestedMatches(String(tmdbId), mediaType);
      if (matches.length > 0) {
        suggestedMatches = matches;
      }
    } catch {
      /* TMDB optional — omit suggestions on failure */
    }
  }

  if (!parsed) {
    return {
      quoteText: null,
      authorName: null,
      themes: [],
      explanation: '',
      isGenerated: false,
      generationContext: {
        mode: 'by-media-context',
        mediaContext: { tmdbId, mediaType },
        model: GEMINI_MODEL_NAME,
        failed: true,
        generatedAt: new Date(),
      },
      ...(suggestedMatches ? { suggestedMatches } : {}),
    };
  }

  return {
    ...parsed,
    isGenerated: true,
    generationContext: {
      mode: 'by-media-context',
      mediaContext: { tmdbId, mediaType },
      model: GEMINI_MODEL_NAME,
      generatedAt: new Date(),
    },
    ...(suggestedMatches ? { suggestedMatches } : {}),
  };
}

export function getValidThemes() {
  return VALID_THEMES;
}