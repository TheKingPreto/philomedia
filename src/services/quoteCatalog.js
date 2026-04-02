import fs from 'node:fs/promises';
import path from 'node:path';
import Quote from '../models/Quote.js';
import { customQuotes } from '../../public/scripts/custom-quotes.js';

const WIKIQUOTE_PATH = path.resolve(process.cwd(), 'quotes_wikiquote.json');
const WIKIQUOTE_EN_PATH = path.resolve(process.cwd(), 'quotes_wikiquote.en.json');
const TRANSLATED_AUTHOR_ALIASES = {
  'buda': 'Buddha',
  'confucio': 'Confucius',
  'epicuro': 'Epicurus',
  'galileu galilei': 'Galileo Galilei',
  'heraclito': 'Heraclitus',
  'plotino': 'Plotinus',
  'santo agostinho': 'Saint Augustine',
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createMergeKey(entry) {
  return `${normalizeText(entry.author)}::${normalizeText(entry.quote)}`;
}

function uniqStrings(values = []) {
  return [...new Set(
    values
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

function normalizeTranslatedAuthor(author) {
  const rawAuthor = String(author || '').trim();
  if (!rawAuthor) return '';

  const normalized = normalizeText(rawAuthor);
  return TRANSLATED_AUTHOR_ALIASES[normalized] || rawAuthor;
}

async function readJsonArray(filePath) {
  try {
    const file = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(file);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function mapCustomQuoteEntry(entry) {
  return {
    id: entry.id,
    quote: entry.quote,
    author: entry.author,
    themes: uniqStrings(entry.themes || []),
    source: 'custom',
    lang: 'en',
    originalLanguage: 'en',
  };
}

export function mapDatabaseQuoteEntry(entry) {
  const submissionSource = String(entry.submissionSource || '').trim().toLowerCase();
  const source = submissionSource
    || (entry.legacyId != null ? 'database' : 'database-import');

  return {
    id: entry.legacyId ?? String(entry._id),
    quote: entry.quoteText,
    author: entry.authorName,
    themes: uniqStrings(entry.themes || []),
    source: entry.isGenerated
      ? 'generated'
      : source,
    lang: String(entry.quoteLanguage || 'en').trim().toLowerCase() || 'en',
    originalLanguage: String(entry.quoteLanguage || 'en').trim().toLowerCase() || 'en',
  };
}

export function mapWikiQuoteEntry(entry, index) {
  return {
    id: `wiki-${index + 1}`,
    quote: String(entry.text || '').trim(),
    author: String(entry.author || '').trim(),
    themes: uniqStrings(entry.theme ? [entry.theme] : []),
    source: 'wikiquote',
    lang: String(entry.lang || 'pt').trim().toLowerCase() || 'pt',
    originalLanguage: String(entry.lang || 'pt').trim().toLowerCase() || 'pt',
  };
}

export function mapTranslatedWikiQuoteEntry(entry, index) {
  return {
    id: entry.id || `wiki-en-${index + 1}`,
    quote: String(entry.text || '').trim(),
    author: normalizeTranslatedAuthor(entry.author),
    themes: uniqStrings(entry.theme ? [entry.theme] : []),
    source: entry.translationStatus ? `wikiquote-${entry.translationStatus}` : 'wikiquote-en',
    lang: 'en',
    originalLanguage: String(entry.originalLanguage || 'pt').trim().toLowerCase() || 'pt',
    originalQuote: String(entry.originalText || '').trim(),
    translationStatus: String(entry.translationStatus || 'machine').trim().toLowerCase() || 'machine',
  };
}

export function mergeQuoteCatalogEntries(entries = []) {
  const merged = new Map();

  entries.forEach(entry => {
    if (!entry?.quote || !entry?.author) return;

    const key = createMergeKey(entry);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...entry,
        themes: uniqStrings(entry.themes || []),
      });
      return;
    }

    merged.set(key, {
      ...existing,
      id: existing.id ?? entry.id,
      source: existing.source || entry.source,
      lang: existing.lang || entry.lang,
      originalLanguage: existing.originalLanguage || entry.originalLanguage,
      originalQuote: existing.originalQuote || entry.originalQuote,
      translationStatus: existing.translationStatus || entry.translationStatus,
      themes: uniqStrings([...(existing.themes || []), ...(entry.themes || [])]),
    });
  });

  return [...merged.values()];
}

export async function readLocalWikiQuoteEntries() {
  const records = await readJsonArray(WIKIQUOTE_PATH);
  return records.map(mapWikiQuoteEntry).filter(entry => entry.quote && entry.author);
}

export async function readTranslatedWikiQuoteEntries() {
  const records = await readJsonArray(WIKIQUOTE_EN_PATH);
  return records.map(mapTranslatedWikiQuoteEntry).filter(entry => entry.quote && entry.author);
}

function selectLocaleEntries(locale, {
  customEntries,
  databaseEntries,
  localWikiEntries,
  translatedWikiEntries,
}) {
  if (locale === 'pt') {
    return mergeQuoteCatalogEntries([
      ...localWikiEntries,
    ]);
  }

  return mergeQuoteCatalogEntries([
    ...customEntries,
    ...databaseEntries,
    ...translatedWikiEntries,
  ]);
}

export async function buildQuoteCatalog(locale = 'en') {
  const normalizedLocale = String(locale || 'en').trim().toLowerCase();

  const [databaseEntries, localWikiEntries, translatedWikiEntries] = await Promise.all([
    Quote.find({ isGenerated: { $ne: true } })
      .lean()
      .then(entries => entries.map(mapDatabaseQuoteEntry))
      .catch(() => []),
    readLocalWikiQuoteEntries(),
    readTranslatedWikiQuoteEntries(),
  ]);

  const customEntries = customQuotes.map(mapCustomQuoteEntry);

  return selectLocaleEntries(normalizedLocale, {
    customEntries,
    databaseEntries,
    localWikiEntries,
    translatedWikiEntries,
  });
}
