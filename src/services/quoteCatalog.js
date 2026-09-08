import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Quote from '../models/Quote.js';
import { customQuotes } from '../../public/scripts/custom-quotes.js';
import { getCustomQuoteTranslationPt } from '../../public/scripts/services/customQuoteTranslationsPt.js';
import { normalizeQuoteThemes } from '../../public/scripts/domain/canonicalThemes.js';
import { repairQuoteSpacing } from '../domain/i18n/repairQuoteSpacing.js';
import { resolveQuoteForLocale } from '../domain/i18n/quoteDisplay.js';

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../scripts/data');
const WIKIQUOTE_PATH = path.join(DATA_DIR, 'quotes_wikiquote.json');
const WIKIQUOTE_EN_PATH = path.join(DATA_DIR, 'quotes_wikiquote.en.json');
const TRANSLATED_AUTHOR_ALIASES = {
  'buda': 'Buddha',
  'confucio': 'Confucius',
  'epicuro': 'Epicurus',
  'galileu galilei': 'Galileo Galilei',
  'heraclito': 'Heraclitus',
  'martin luther king': 'Martin Luther King Jr.',
  'plotino': 'Plotinus',
  'soren kierkegaard': 'Søren Kierkegaard',
  'santo agostinho': 'Saint Augustine',
};
const MOJIBAKE_PATTERN = /[ÃÂâ€]/;

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
  const quoteRef = String(entry.quote_original || entry.quote || '').trim();
  if (!quoteRef) return '';
  return `${normalizeText(entry.author)}::${normalizeText(quoteRef)}`;
}

function uniqStrings(values = []) {
  return [...new Set(
    values
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

function repairMojibake(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue || !MOJIBAKE_PATTERN.test(rawValue)) return rawValue;

  try {
    const repaired = Buffer.from(rawValue, 'latin1').toString('utf8').trim();
    if (repaired && repaired !== rawValue) {
      return repaired;
    }
  } catch {
    return rawValue;
  }

  return rawValue;
}

function normalizeTranslatedAuthor(author) {
  const rawAuthor = repairMojibake(author);
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

/**
 * Entrada custom-quotes: inglês legado → canônico EN, PT vazio até tradução.
 */
export function mapCustomQuoteEntry(entry) {
  const author = normalizeTranslatedAuthor(entry.author);
  const q = String(entry.quote || '').trim();
  const quotePt = getCustomQuoteTranslationPt(entry.id);

  return {
    id: entry.id,
    author,
    themes: normalizeQuoteThemes(uniqStrings(entry.themes || [])),
    source: 'custom',
    originalLanguage: 'en',
    quote_original: q,
    quote_en: q,
    quote_pt: quotePt,
    translationStatus: quotePt ? 'curated' : '',
  };
}

/**
 * Documento Mongo: quoteText = texto na língua de origem; quoteTranslations = derivados.
 */
export function mapDatabaseQuoteEntry(entry) {
  const submissionSource = String(entry.submissionSource || '').trim().toLowerCase();
  const source = submissionSource
    || (entry.legacyId != null ? 'database' : 'database-import');

  const orig = String(entry.quoteLanguage || 'en').trim().toLowerCase() || 'en';
  const canonical = String(entry.quoteText || '').trim();
  const trans = entry.quoteTranslations && typeof entry.quoteTranslations === 'object'
    ? entry.quoteTranslations
    : {};
  const tEn = String(trans.en || '').trim();
  const tPt = String(trans.pt || '').trim();

  const quote_en = tEn || (orig === 'en' ? canonical : '');
  const quote_pt = tPt || (orig === 'pt' ? canonical : '');

  return {
    id: entry.legacyId ?? String(entry._id),
    author: normalizeTranslatedAuthor(entry.authorName),
    themes: normalizeQuoteThemes(uniqStrings(entry.themes || [])),
    source: entry.isGenerated
      ? 'generated'
      : source,
    originalLanguage: orig,
    quote_original: canonical,
    quote_en,
    quote_pt,
    translationStatus: entry.translationStatus || '',
  };
}

export function mapWikiQuoteEntry(entry, index) {
  const quote = repairQuoteSpacing(String(entry.text || '').trim(), { locale: 'pt' });

  return {
    id: `wiki-${index + 1}`,
    quote,
    author: normalizeTranslatedAuthor(entry.author),
    themes: normalizeQuoteThemes(uniqStrings(entry.theme ? [entry.theme] : [])),
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
    themes: normalizeQuoteThemes(uniqStrings(entry.theme ? [entry.theme] : [])),
    source: entry.translationStatus ? `wikiquote-${entry.translationStatus}` : 'wikiquote-en',
    lang: 'en',
    originalLanguage: String(entry.originalLanguage || 'pt').trim().toLowerCase() || 'pt',
    originalQuote: String(entry.originalText || '').trim(),
    translationStatus: String(entry.translationStatus || 'machine').trim().toLowerCase() || 'machine',
  };
}

/**
 * Une par PT + EN (Wikiquote) num único registro com quote_original em PT.
 */
export function mergeWikiBilingualPairs(localWikiEntries, translatedWikiEntries) {
  const ptByKey = new Map();

  localWikiEntries.forEach(e => {
    const key = createMergeKey(e);
    if (key) ptByKey.set(key, e);
  });

  const usedPtKeys = new Set();
  const unified = [];

  translatedWikiEntries.forEach(enEntry => {
    const lookupKey = createMergeKey({
      author: enEntry.author,
      quote: enEntry.originalQuote || '',
      quote_original: enEntry.originalQuote || '',
    });

    const pt = lookupKey ? ptByKey.get(lookupKey) : null;

    const themesMerged = normalizeQuoteThemes(uniqStrings([
      ...(pt?.themes || []),
      ...(enEntry.themes || []),
    ]));

    if (pt) {
      usedPtKeys.add(lookupKey);
      unified.push({
        id: enEntry.id || pt.id,
        author: pt.author,
        themes: themesMerged,
        source: 'wikiquote',
        originalLanguage: 'pt',
        quote_original: pt.quote,
        quote_pt: pt.quote,
        quote_en: enEntry.quote,
        translationStatus: enEntry.translationStatus || 'machine',
      });
    } else {
      const origLang = String(enEntry.originalLanguage || 'pt').trim().toLowerCase() || 'pt';
      const qPt = String(enEntry.originalQuote || '').trim();
      const qEn = String(enEntry.quote || '').trim();

      unified.push({
        id: enEntry.id,
        author: enEntry.author,
        themes: themesMerged,
        source: enEntry.source || 'wikiquote-en',
        originalLanguage: origLang,
        quote_original: qPt || qEn,
        quote_pt: qPt,
        quote_en: qEn,
        translationStatus: enEntry.translationStatus,
      });
    }
  });

  localWikiEntries.forEach(pt => {
    const key = createMergeKey(pt);
    if (key && !usedPtKeys.has(key)) {
      unified.push({
        id: pt.id,
        author: pt.author,
        themes: normalizeQuoteThemes(pt.themes || []),
        source: 'wikiquote',
        originalLanguage: 'pt',
        quote_original: pt.quote,
        quote_pt: pt.quote,
        quote_en: '',
        translationStatus: '',
      });
    }
  });

  return unified;
}

export function mergeQuoteCatalogEntries(entries = []) {
  const merged = new Map();

  entries.forEach(entry => {
    const author = entry.author;
    const qOrig = String(entry.quote_original || entry.quote || '').trim();
    const qEn = String(entry.quote_en ?? '').trim();
    const qPt = String(entry.quote_pt ?? '').trim();
    const effectiveCanonical = qOrig || qEn || qPt;

    if (!effectiveCanonical || !author) return;

    const key = `${normalizeText(author)}::${normalizeText(effectiveCanonical)}`;
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, {
        ...entry,
        quote_original: qOrig || effectiveCanonical,
        quote_en: qEn,
        quote_pt: qPt,
        themes: normalizeQuoteThemes(uniqStrings(entry.themes || [])),
      });
      return;
    }

    merged.set(key, {
      ...existing,
      id: existing.id ?? entry.id,
      source: existing.source || entry.source,
      author: existing.author || entry.author,
      originalLanguage: existing.originalLanguage || entry.originalLanguage,
      quote_original: qOrig || existing.quote_original || effectiveCanonical,
      quote_en: qEn || existing.quote_en || '',
      quote_pt: qPt || existing.quote_pt || '',
      originalQuote: existing.originalQuote || entry.originalQuote,
      translationStatus: existing.translationStatus || entry.translationStatus,
      themes: normalizeQuoteThemes(uniqStrings([
        ...(existing.themes || []),
        ...(entry.themes || []),
      ])),
    });
  });

  return [...merged.values()];
}

function projectCatalogEntryForLocale(entry, locale) {
  const loc = String(locale || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';
  let quote = resolveQuoteForLocale(entry, loc);
  if (loc === 'pt') {
    quote = repairQuoteSpacing(quote, { locale: 'pt' });
  }

  return {
    ...entry,
    quote,
    lang: loc,
  };
}

export async function readLocalWikiQuoteEntries() {
  const records = await readJsonArray(WIKIQUOTE_PATH);
  return records.map(mapWikiQuoteEntry).filter(entry => entry.quote && entry.author);
}

export async function readTranslatedWikiQuoteEntries() {
  const records = await readJsonArray(WIKIQUOTE_EN_PATH);
  return records.map(mapTranslatedWikiQuoteEntry).filter(entry => entry.quote && entry.author);
}

/**
 * Catálogo único: custom + Mongo + Wikiquote pareado (PT/EN); `quote` resolve para ?lang=.
 */
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
  const wikiUnified = mergeWikiBilingualPairs(localWikiEntries, translatedWikiEntries);

  const merged = mergeQuoteCatalogEntries([
    ...customEntries,
    ...databaseEntries,
    ...wikiUnified,
  ]);

  return merged.map(entry => projectCatalogEntryForLocale(entry, normalizedLocale));
}
