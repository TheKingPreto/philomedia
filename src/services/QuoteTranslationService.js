import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-flash-latest';
const MAX_OUTPUT_TOKENS = 4096;
const MAX_BATCH_SIZE = 10;
const MAX_RETRIES = 3;

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not set.');
  }
  return new GoogleGenerativeAI(apiKey);
}

function sanitizeEntry(entry) {
  return {
    id: entry.id,
    text: String(entry.text || '').trim().slice(0, 520),
    author: String(entry.author || '').trim().slice(0, 120),
    theme: String(entry.theme || '').trim().slice(0, 80),
    source: String(entry.source || '').trim().slice(0, 240),
    lang: String(entry.lang || 'pt').trim().toLowerCase() || 'pt',
  };
}

function buildPrompt(entries) {
  const payload = entries.map(({ id, text, author, theme }) => ({
    id,
    author,
    theme,
    originalText: text,
  }));

  return `
Translate the following philosophical quotes into natural, idiomatic English.

Rules:
- Preserve the meaning, tone, and rhetorical force of each quote.
- Prefer canonical English formulations when a quote is widely known.
- Do not invent or remove ideas.
- Keep the same author and theme.
- Return ONLY valid JSON as an array.

Input:
${JSON.stringify(payload, null, 2)}

Return format:
[
  {
    "id": "",
    "text": "",
    "author": "",
    "theme": "",
    "originalText": "",
    "originalLanguage": "pt",
    "translationStatus": "machine"
  }
]
`;
}

function parseResponse(rawText) {
  const cleaned = String(rawText || '').replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) {
    throw new Error('Invalid translation payload.');
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error('Translation response must be an array.');
  }

  return parsed.map(entry => ({
    id: entry.id,
    text: String(entry.text || '').trim().slice(0, 520),
    author: String(entry.author || '').trim().slice(0, 120),
    theme: String(entry.theme || '').trim().slice(0, 80),
    originalText: String(entry.originalText || '').trim().slice(0, 520),
    originalLanguage: String(entry.originalLanguage || 'pt').trim().toLowerCase() || 'pt',
    translationStatus: String(entry.translationStatus || 'machine').trim().toLowerCase() || 'machine',
    lang: 'en',
  }));
}

export async function translateQuotesBatch(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('At least one quote entry is required.');
  }

  if (entries.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size cannot exceed ${MAX_BATCH_SIZE}.`);
  }

  const sanitizedEntries = entries.map(sanitizeEntry);
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  });

  let result = null;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      result = await model.generateContent(buildPrompt(sanitizedEntries));
      break;
    } catch (error) {
      attempt += 1;
      if (attempt >= MAX_RETRIES) {
        throw error;
      }

      await new Promise(resolve => {
        setTimeout(resolve, 1500 * attempt);
      });
    }
  }

  const responseText = await result.response.text();
  const translated = parseResponse(responseText);

  if (translated.length !== sanitizedEntries.length) {
    throw new Error('Translation batch returned an unexpected number of entries.');
  }

  return translated.map((entry, index) => ({
    ...entry,
    id: sanitizedEntries[index].id,
    author: sanitizedEntries[index].author,
    theme: sanitizedEntries[index].theme,
    originalText: sanitizedEntries[index].text,
  }));
}
