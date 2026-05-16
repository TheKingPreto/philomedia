/**
 * Regenera public/scripts/services/customQuoteTranslationsPt.js via Gemini.
 * Requer GOOGLE_AI_API_KEY no .env
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { customQuotes } from './custom-quotes.js';
import { translateQuotesBatch } from '../../src/services/QuoteTranslationService.js';

dotenv.config();

const TARGET_PATH = path.resolve('public/scripts/services/customQuoteTranslationsPt.js');
const BATCH_SIZE = 8;

function formatOutputFile(translations) {
  const lines = Object.entries(translations)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, text]) => `  ${id}: ${JSON.stringify(text)},`);

  return `/**
 * Traduções revisadas (PT) das citações custom-quotes.js (ids 1001–1066).
 * Geradas via \`npm run translate:quotes:pt\`.
 */
export const CUSTOM_QUOTE_TRANSLATIONS_PT = {
${lines.join('\n')}
};

export function getCustomQuoteTranslationPt(id) {
  const key = Number(id);
  if (!Number.isFinite(key)) return '';
  return String(CUSTOM_QUOTE_TRANSLATIONS_PT[key] || '').trim();
}
`;
}

async function main() {
  const translations = {};
  const pending = customQuotes.filter(entry => entry?.id && entry?.quote);

  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    const batch = pending.slice(index, index + BATCH_SIZE).map(entry => ({
      id: entry.id,
      text: entry.quote,
      author: entry.author,
      theme: (entry.themes || [])[0] || '',
      lang: 'en',
    }));

    const translated = await translateQuotesBatch(batch, { targetLanguage: 'pt' });
    translated.forEach(entry => {
      translations[entry.id] = entry.text;
    });

    console.log(`Translated ${Math.min(index + BATCH_SIZE, pending.length)} / ${pending.length}`);
  }

  await fs.writeFile(TARGET_PATH, formatOutputFile(translations), 'utf8');
  console.log(`Wrote ${TARGET_PATH}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
