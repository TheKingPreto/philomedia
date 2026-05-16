import fs from 'node:fs/promises';
import path from 'node:path';
import { customQuotes } from './custom-quotes.js';
import { THEME_BUCKETS } from './theme-buckets.js';

const ROOT = process.cwd();
const WIKIQUOTE_EN_PATH = path.resolve(ROOT, 'quotes_wikiquote.en.json');
const OUTPUT_PATH = path.resolve(ROOT, 'src', 'data', 'dailyPairings.json');


function removeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuoteTheme(theme) {
  if (!theme) return null;
  const normalized = removeDiacritics(String(theme));
  return normalized;
}

function findMajorTheme(themes = []) {
  const normalized = themes
    .map(theme => normalizeQuoteTheme(theme))
    .filter(Boolean);

  for (const theme of normalized) {
    for (const [bucket, data] of Object.entries(THEME_BUCKETS)) {
      if (data.aliases.some(alias => removeDiacritics(alias) === theme)) return bucket;
    }
  }

  return null;
}

function slugify(text) {
  return removeDiacritics(String(text || ''))
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function buildEntry({ quote, author, themes, source }) {
  const majorTheme = findMajorTheme(themes);
  if (!majorTheme) return null;
  const bucket = THEME_BUCKETS[majorTheme];
  const slug = `${removeDiacritics(author).replace(/[^a-z0-9]+/gu, '-')}-${slugify(quote.split(' ').slice(0, 5).join(' '))}`;

  return {
    slug: slug.slice(0, 60),
    quote: quote.trim(),
    author: author.trim(),
    themes: themes.map(t => removeDiacritics(t || '')).filter(Boolean),
    context: bucket.context,
    works: bucket.works,
    source,
  };
}

async function readWikiQuoteEntries() {
  try {
    const raw = await fs.readFile(WIKIQUOTE_EN_PATH, 'utf8');
    const records = JSON.parse(raw);
    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.error('Failed to read wikiquote file:', error.message);
    return [];
  }
}

async function generateCalendar() {
  const wikiEntries = await readWikiQuoteEntries();

  const allQuotes = [
    ...customQuotes.map(entry => ({
      quote: entry.quote,
      author: entry.author,
      themes: entry.themes,
      source: 'custom',
    })),
    ...wikiEntries
      .filter(entry => entry.author && entry.text)
      .map(entry => ({
        quote: entry.text,
        author: entry.author,
        themes: [entry.theme],
        source: 'wikiquote',
      })),
  ];

  const entries = allQuotes
    .map(buildEntry)
    .filter(Boolean)
    .reduce((acc, current) => {
      if (!acc.some(item => item.quote === current.quote && item.author === current.author)) {
        acc.push(current);
      }
      return acc;
    }, []);

  const output = `${JSON.stringify(entries, null, 2)}\n`;
  await fs.writeFile(OUTPUT_PATH, output, 'utf8');

  console.log(`Generated ${entries.length} daily pairing entries to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

await generateCalendar();
