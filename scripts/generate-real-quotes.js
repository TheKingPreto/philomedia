import fs from 'node:fs/promises';
import path from 'node:path';
import { customQuotes } from '../public/scripts/custom-quotes.js';
import { THEME_BUCKETS } from './theme-buckets.js';

const ROOT = process.cwd();
const WIKIQUOTE_PATH = path.resolve(ROOT, 'scripts', 'data', 'quotes_wikiquote.en.json');
const OUTPUT_PATH = path.resolve(ROOT, 'src', 'data', 'dailyPairings.real.json');
const MAIN_PATH = path.resolve(ROOT, 'src', 'data', 'dailyPairings.json');

function removeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeValue(value) {
  return removeDiacritics(String(value || ''));
}

function findMajorTheme(themes = []) {
  const normalized = themes
    .map(theme => normalizeValue(theme))
    .filter(Boolean);

  for (const theme of normalized) {
    for (const [bucket, data] of Object.entries(THEME_BUCKETS)) {
      if (data.aliases.some(alias => normalizeValue(alias) === theme)) {
        return bucket;
      }
    }
  }

  // fallback by splitting theme words
  for (const theme of normalized) {
    const parts = theme.split(/[^a-z0-9]+/g).filter(Boolean);
    for (const part of parts) {
      for (const [bucket, data] of Object.entries(THEME_BUCKETS)) {
        if (data.aliases.some(alias => normalizeValue(alias) === part)) {
          return bucket;
        }
      }
    }
  }

  return null;
}

function slugify(value) {
  return normalizeValue(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildEntry({ quote, author, themes, source }) {
  const majorTheme = findMajorTheme(themes || []);
  const bucketKey = majorTheme || 'culture';
  const bucket = THEME_BUCKETS[bucketKey] || THEME_BUCKETS.culture;

  const slugBase = `${author}-${quote.slice(0, 30)}`;
  const slug = `${slugify(slugBase)}-${slugify(bucketKey)}`.slice(0, 60);

  return {
    slug,
    quote: quote.trim(),
    author: author.trim(),
    themes: themes.map(t => normalizeValue(t)).filter(Boolean),
    context: bucket.context,
    works: bucket.works,
    source,
  };
}

async function readWikiQuotes() {
  const raw = await fs.readFile(WIKIQUOTE_PATH, 'utf8');
  const entries = JSON.parse(raw);
  if (!Array.isArray(entries)) {
    throw new Error('Expected scripts/data/quotes_wikiquote.en.json to contain an array');
  }
  return entries.map(entry => ({
    quote: entry.text,
    author: entry.author,
    themes: [entry.theme || ''],
    source: 'wikiquote',
  }));
}

async function generateRealCalendar() {
  const wikiQuotes = await readWikiQuotes();

  const allQuotes = [
    ...customQuotes.map(entry => ({
      quote: entry.quote,
      author: entry.author,
      themes: entry.themes || [],
      source: 'custom',
    })),
    ...wikiQuotes.filter(entry => entry.quote && entry.author),
  ];

  const entries = allQuotes
    .map(buildEntry)
    .reduce((acc, current) => {
      const duplicate = acc.some(item => item.quote === current.quote && item.author === current.author);
      if (!duplicate) acc.push(current);
      return acc;
    }, []);

  console.log(`Found ${entries.length} unique real quotes`);

  // If we have fewer than 365, repeat the entries to fill the calendar
  const targetEntries = 365;
  const repeatedEntries = [];
  let entryIndex = 0;

  for (let i = 0; i < targetEntries; i++) {
    const originalEntry = entries[entryIndex];

    // Create a unique slug for repeated entries
    const cycleNumber = Math.floor(i / entries.length) + 1;
    const baseSlug = originalEntry.slug.replace(/-\d+$/, ''); // Remove any trailing numbers
    const newSlug = cycleNumber > 1 ? `${baseSlug}-${cycleNumber}` : baseSlug;

    repeatedEntries.push({
      ...originalEntry,
      slug: newSlug.slice(0, 60), // Ensure slug doesn't exceed length
    });

    entryIndex = (entryIndex + 1) % entries.length;
  }

  const output = `${JSON.stringify(repeatedEntries, null, 2)}\n`;

  await fs.writeFile(OUTPUT_PATH, output, 'utf8');
  console.log(`Generated ${repeatedEntries.length} calendar entries (${entries.length} unique quotes repeated)`);

  if (process.argv.includes('--write') || process.argv.includes('-w')) {
    await fs.writeFile(MAIN_PATH, output, 'utf8');
    console.log(`Updated main calendar file: ${path.relative(ROOT, MAIN_PATH)}`);
  }

  console.log(`✅ Calendar now has ${repeatedEntries.length} days using ${entries.length} authentic philosophical quotes`);
}

await generateRealCalendar();
