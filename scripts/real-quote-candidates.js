import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { THEME_BUCKETS } from './theme-buckets.js';

const ROOT = process.cwd();
const OUTPUT_PATH = path.resolve(ROOT, 'src', 'data', 'dailyPairings.realCandidates.json');

function validateThemes(themes) {
  if (!Array.isArray(themes) || themes.length === 0) {
    throw new Error('At least one theme is required.');
  }
  return themes.map((theme) => String(theme).trim()).filter(Boolean);
}

function createPrompt(theme, count) {
  return `You are a philosophy researcher. For the theme ${theme}, provide up to ${count} real quotes from actual historical or contemporary authors. Include only quotes you are confident are authentic and well-known.

Respond ONLY in valid JSON, with an array of objects in this format:
[
  {
    "quote": "",
    "author": "",
    "source": "",
    "sourceUrl": ""
  }
]

If you are not sure the quote is real, do not include it. Do not invent sources or authors.
`;
}

function parseAIResponse(rawText) {
  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return null;

  try {
    const result = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(result)) return null;
    return result
      .filter(item => item && item.quote && item.author)
      .map(item => ({
        quote: String(item.quote).trim(),
        author: String(item.author).trim(),
        source: item.source ? String(item.source).trim() : '',
        sourceUrl: item.sourceUrl ? String(item.sourceUrl).trim() : '',
      }));
  } catch {
    return null;
  }
}

function getGeminiClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not set in the environment.');
  }
  return new GoogleGenerativeAI(apiKey);
}

async function callGemini(prompt) {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 1024,
      temperature: 0.2,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function generateCandidates(themes, countPerTheme = 5) {
  const validatedThemes = validateThemes(themes);
  const candidates = [];

  for (const theme of validatedThemes) {
    console.log(`\nSearching real quote candidates for theme: ${theme}`);
    const prompt = createPrompt(theme, countPerTheme);

    try {
      const raw = await callGemini(prompt);
      const quotes = parseAIResponse(raw);
      if (!quotes || quotes.length === 0) {
        console.log(`  No valid candidates returned for theme: ${theme}`);
        continue;
      }

      quotes.forEach(q => candidates.push({ theme, ...q }));
      console.log(`  Found ${quotes.length} candidate(s) for theme: ${theme}`);
    } catch (error) {
      console.error(`  Error generating candidates for theme ${theme}:`, error.message);
    }

    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  return candidates;
}

async function main() {
  const themes = Object.keys(THEME_BUCKETS);
  const countPerTheme = 3;
  const candidates = await generateCandidates(themes, countPerTheme);

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(candidates, null, 2), 'utf8');
  console.log(`\nSaved ${candidates.length} quote candidates to ${OUTPUT_PATH}`);
  console.log('IMPORTANT: These are candidate quotes and must be verified before use.');
}

await main();
