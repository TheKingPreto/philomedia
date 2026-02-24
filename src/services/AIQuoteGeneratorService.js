import { GoogleGenerativeAI } from '@google/generative-ai';
import { THEME_DATABASE } from '../../scripts/themedatabase.js';
import * as tmdbClient from './tmdbClient.js';

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODEL_NAME = 'gemini-1.5-flash-latest';
const MAX_OUTPUT_TOKENS = 512;
const VALID_THEMES = Object.keys(THEME_DATABASE);

// Caracteres e padrões bloqueados para prevenir prompt injection
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /forget\s+(everything|all|your|the)/i,
  /you\s+are\s+now\s+a/i,
  /act\s+as\s+(a\s+)?different/i,
  /system\s*:/i,
  /\[INST\]/i,
  /<\|.*?\|>/i,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sanitiza input do usuário, removendo caracteres perigosos e
 * verificando padrões de prompt injection.
 * @param {string} input
 * @param {string} fieldName - nome do campo para mensagens de erro
 * @returns {string} input sanitizado
 */
function sanitizeInput(input, fieldName = 'input') {
  if (typeof input !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const trimmed = input.trim().slice(0, 200); // limite de segurança

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new Error(`Invalid ${fieldName}: contains disallowed content.`);
    }
  }

  return trimmed;
}

/**
 * Valida e filtra a lista de temas contra o THEME_DATABASE.
 * Retorna os temas válidos ou lança erro se nenhum for válido.
 * @param {string[]} themes
 * @returns {string[]}
 */
function validateThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error('At least one theme is required.');
  }

  const valid = themes
    .map((t) => sanitizeInput(t, 'theme').toLowerCase())
    .filter((t) => VALID_THEMES.includes(t));

  if (valid.length === 0) {
    throw new Error(
      `No valid themes provided. Valid themes are: ${VALID_THEMES.join(', ')}.`
    );
  }

  return valid;
}

/**
 * Inicializa o cliente Gemini.
 * Lança erro claro se a chave não estiver configurada.
 */
function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GOOGLE_AI_API_KEY is not set. Add it to your .env file.'
    );
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Chama o modelo Gemini com o prompt fornecido e retorna o texto gerado.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callGemini(prompt) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.85, // criatividade moderada — filosófico mas não aleatório
      topP: 0.9,
    },
  });

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  if (!text) {
    throw new Error('AI returned an empty response. Please try again.');
  }

  return text;
}

/**
 * Faz o parse da resposta JSON do Gemini e valida os campos esperados.
 * @param {string} rawText
 * @returns {{ quoteText: string, authorName: string, themes: string[], explanation: string }}
 */
function parseAIResponse(rawText) {
  // Remove blocos de markdown (```json ... ```) que o Gemini às vezes inclui
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('AI response could not be parsed as JSON. Please try again.');
  }

  const { quoteText, authorName, themes, explanation } = parsed;

  if (!quoteText || typeof quoteText !== 'string') {
    throw new Error('AI response missing valid quoteText field.');
  }
  if (!authorName || typeof authorName !== 'string') {
    throw new Error('AI response missing valid authorName field.');
  }

  return {
    quoteText: quoteText.trim().slice(0, 500),
    authorName: authorName.trim().slice(0, 100),
    themes: Array.isArray(themes) ? themes : [],
    explanation: typeof explanation === 'string' ? explanation.trim() : '',
  };
}

// ─── Serviço público ──────────────────────────────────────────────────────────

/**
 * Gera uma citação filosófica original com base em temas do THEME_DATABASE.
 *
 * @param {string[]} themes - lista de temas válidos (ver THEME_DATABASE)
 * @returns {Promise<{
 *   quoteText: string,
 *   authorName: string,
 *   themes: string[],
 *   explanation: string,
 *   isGenerated: boolean,
 *   generationContext: object
 * }>}
 */
/**
 * Enriquece a lista de temas com palavras-chave do THEME_DATABASE para o prompt.
 * @param {string[]} validThemes - temas já validados
 * @returns {string} texto para incluir no prompt (ex.: "existentialism (freedom, choice, responsibility...)")
 */
function enrichThemesForPrompt(validThemes) {
  return validThemes
    .map((t) => {
      const keywords = THEME_DATABASE[t];
      const keys = keywords ? Object.keys(keywords).slice(0, 8).join(', ') : '';
      return keys ? `${t} (${keys})` : t;
    })
    .join('; ');
}

export async function generateByTheme(themes) {
  const validThemes = validateThemes(themes);
  const themesEnriched = enrichThemesForPrompt(validThemes);

  const prompt = `You are a philosophical quote generator. Your task is to create an original philosophical quote inspired by the given themes.

THEMES (with suggested keywords from our system): ${themesEnriched}

Requirements:
- Write an original quote (do NOT reproduce existing famous quotes verbatim)
- The quote must be in the style and spirit of a real philosopher who explored these themes
- The quote should be profound, concise, and intellectually meaningful (max 2 sentences)
- Choose the most fitting philosopher for these themes
- Do NOT add quotation marks inside the quoteText field

Respond ONLY with a valid JSON object in this exact format, no markdown, no extra text:
{
  "quoteText": "the philosophical quote here",
  "authorName": "Philosopher Name",
  "themes": ["theme1", "theme2"],
  "explanation": "One sentence explaining why this philosopher and quote fit the themes."
}`;

  const rawText = await callGemini(prompt);
  const parsed = parseAIResponse(rawText);

  return {
    ...parsed,
    isGenerated: true,
    generationContext: {
      mode: 'by-theme',
      inputThemes: validThemes,
      model: MODEL_NAME,
      generatedAt: new Date(),
    },
  };
}

/**
 * Gera uma citação filosófica original no estilo de um filósofo específico.
 *
 * @param {string} philosopher - nome do filósofo
 * @param {string} [theme] - tema opcional para guiar a geração
 * @returns {Promise<{
 *   quoteText: string,
 *   authorName: string,
 *   themes: string[],
 *   explanation: string,
 *   isGenerated: boolean,
 *   generationContext: object
 * }>}
 */
export async function generateByPhilosopher(philosopher, theme) {
  const sanitizedPhilosopher = sanitizeInput(philosopher, 'philosopher');
  const sanitizedTheme = theme ? sanitizeInput(theme, 'theme') : null;

  const themeClause = sanitizedTheme
    ? `The quote should explore the theme of: ${sanitizedTheme}.`
    : 'Choose a theme central to this philosopher\'s work.';

  const prompt = `You are a philosophical quote generator. Your task is to create an original quote written in the authentic style of the philosopher provided.

PHILOSOPHER: ${sanitizedPhilosopher}
${themeClause}

Requirements:
- Write an original quote that authentically captures this philosopher's voice, vocabulary, and worldview
- Do NOT reproduce any real existing quote verbatim — this must be original
- The quote must be profound, concise, and intellectually meaningful (max 2 sentences)
- Use the philosopher's actual name in the authorName field
- Do NOT add quotation marks inside the quoteText field
- If the philosopher is not real or widely recognized, use the closest real philosopher instead

IMPORTANT DISCLAIMER: This is an AI-generated quote in the style of the philosopher, not an actual historical quote.

Respond ONLY with a valid JSON object in this exact format, no markdown, no extra text:
{
  "quoteText": "the philosophical quote here",
  "authorName": "Philosopher Name",
  "themes": ["theme1", "theme2"],
  "explanation": "One sentence explaining how this quote reflects the philosopher's philosophy."
}`;

  const rawText = await callGemini(prompt);
  const parsed = parseAIResponse(rawText);

  return {
    ...parsed,
    isGenerated: true,
    generationContext: {
      mode: 'by-philosopher',
      inputPhilosopher: sanitizedPhilosopher,
      inputThemes: sanitizedTheme ? [sanitizedTheme] : [],
      model: MODEL_NAME,
      generatedAt: new Date(),
    },
  };
}

// Delimitador para serializar mídia em works (embeddings). Evitar em overview/title.
const MEDIA_WORK_DELIMITER = '::PHILO::';

/**
 * Monta o contexto de uma obra (detalhes + reviews) para o prompt. Limita tamanho e sanitiza.
 * @param {object} details - resposta TMDB (title/name, overview)
 * @param {Array<{ content: string }>} reviews
 * @param {number} maxContextChars
 * @returns {string}
 */
function buildMediaContextString(details, reviews, maxContextChars = 3000) {
  const title = details.title || details.name || 'Unknown';
  const overview = (details.overview || '').slice(0, 800);
  const reviewTexts = (reviews || [])
    .slice(0, 5)
    .map((r) => (r.content || '').slice(0, 300))
    .filter(Boolean);
  let context = `Title: ${title}\n\nOverview: ${overview}`;
  if (reviewTexts.length > 0) {
    context += `\n\nExcerpts from reviews:\n${reviewTexts.join('\n---\n')}`;
  }
  return context.slice(0, maxContextChars);
}

/**
 * Gera uma citação filosófica inspirada no contexto de uma obra (filme/série).
 * Pipeline: busca detalhes + reviews no TMDB, monta contexto, chama Gemini.
 *
 * @param {string} tmdbId - ID TMDB da obra
 * @param {string} mediaType - 'movie' ou 'tv'
 * @param {{ suggestMatches?: boolean }} [options]
 * @returns {Promise<{
 *   quoteText: string,
 *   authorName: string,
 *   themes: string[],
 *   explanation: string,
 *   isGenerated: boolean,
 *   generationContext: object,
 *   suggestedMatches?: Array<{ tmdbId: string, mediaType: string, title: string }>
 * }>}
 */
export async function generateByMediaContext(tmdbId, mediaType, options = {}) {
  const id = String(tmdbId).trim();
  const type = mediaType === 'tv' || mediaType === 'movie' ? mediaType : null;
  if (!id || !type) {
    throw new Error('tmdbId and mediaType (movie or tv) are required.');
  }

  const [details, reviews] = await Promise.all([
    tmdbClient.getDetails(id, type),
    tmdbClient.getReviews(id, type),
  ]);

  const mediaTitle = details.title || details.name || 'Unknown';
  const contextString = buildMediaContextString(details, reviews);

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(contextString)) {
      throw new Error('Invalid media context: contains disallowed content.');
    }
  }

  const prompt = `You are a philosophical quote generator. Your task is to create an original philosophical quote inspired by the following film or TV show.

MEDIA CONTEXT:
${contextString}

Requirements:
- Write an original quote that captures the philosophical depth or themes of this work (do NOT reproduce existing famous quotes verbatim)
- The quote must be in the style of a real philosopher whose ideas resonate with this media
- Be profound, concise, and intellectually meaningful (max 2 sentences)
- Choose the most fitting philosopher for the themes suggested by the title, overview, and reviews
- Do NOT add quotation marks inside the quoteText field

Respond ONLY with a valid JSON object in this exact format, no markdown, no extra text:
{
  "quoteText": "the philosophical quote here",
  "authorName": "Philosopher Name",
  "themes": ["theme1", "theme2"],
  "explanation": "One sentence explaining why this quote fits the media context."
}`;

  const rawText = await callGemini(prompt);
  const parsed = parseAIResponse(rawText);

  const result = {
    ...parsed,
    isGenerated: true,
    generationContext: {
      mode: 'by-media-context',
      mediaContext: { tmdbId: id, mediaType: type, title: mediaTitle },
      model: MODEL_NAME,
      generatedAt: new Date(),
    },
  };

  if (options.suggestMatches) {
    try {
      result.suggestedMatches = await suggestMediaMatchesForQuote(parsed.quoteText, 5);
    } catch (err) {
      console.warn('Embeddings suggestion skipped:', err.message);
      result.suggestedMatches = [];
    }
  }

  return result;
}

/**
 * Sugere obras (filmes/séries) que combinam semanticamente com a citação via embeddings.
 * Depende do script Python embeddings_match.py (sentence-transformers).
 *
 * @param {string} quoteText
 * @param {number} topK
 * @returns {Promise<Array<{ tmdbId: string, mediaType: string, title: string }>>}
 */
async function suggestMediaMatchesForQuote(quoteText, topK = 5) {
  const { matchQuoteToWorks } = await import('../../scripts/embeddingsMatch.js');
  const [movies, tv] = await Promise.all([
    tmdbClient.getDiscover('movie', 1),
    tmdbClient.getDiscover('tv', 1),
  ]);
  const mediaList = [...movies, ...tv].slice(0, 80);
  const works = mediaList.map((m) => {
    const overview = (m.overview || '').slice(0, 400).replace(new RegExp(MEDIA_WORK_DELIMITER, 'g'), ' ');
    const title = (m.title || m.name || '').replace(new RegExp(MEDIA_WORK_DELIMITER, 'g'), ' ');
    return `${m.id}${MEDIA_WORK_DELIMITER}${m.media_type}${MEDIA_WORK_DELIMITER}${title}${MEDIA_WORK_DELIMITER}${overview}`;
  });
  if (works.length === 0) return [];

  const matches = await matchQuoteToWorks(quoteText, works, topK);
  const delimiter = MEDIA_WORK_DELIMITER;
  return matches.map((m) => {
    const parts = (m.text || '').split(delimiter);
    const tmdbId = parts[0] || '';
    const mediaType = parts[1] || 'movie';
    const title = (parts[2] || '').trim() || 'Unknown';
    return { tmdbId, mediaType, title };
  }).filter((m) => m.tmdbId);
}

/**
 * Retorna a lista de temas válidos disponíveis para geração.
 * @returns {string[]}
 */
export function getValidThemes() {
  return VALID_THEMES;
}