/**
 * @file scripts/philosophersapi.js
 * @description Quote provider for PhiloMedia frontend.
 *
 * Resolution order:
 *  1. GET /api/quotes  — MongoDB (populated via seed-quotes.js)
 *     Maps { quoteText, authorName, legacyId } → { id, quote, author, themes }
 *     so curatedmatches.js numeric IDs keep working.
 *
 *  2. External philosophersapi.com + local custom-quotes.js
 *     Used as fallback if the backend is unreachable (offline, cold start, etc.)
 *
 * The frontend never needs to know which source was used.
 */

import { customQuotes } from '/scripts/custom-quotes.js';
import { getCustomQuoteTranslationPt } from '/scripts/services/customQuoteTranslationsPt.js';

const API_QUOTES_ENDPOINT = '/api/quotes';
const API_QUOTES_CATALOG_ENDPOINT = '/api/quotes/catalog';
const API_PHILOSOPHERS_ENDPOINT = '/api/philosophers';
const PHILOSOPHERS_API_URL = 'https://philosophersapi.com/api/quotes';
const PHILOSOPHERS_URL = 'https://philosophersapi.com/api/philosophers';
const WIKIPEDIA_SUMMARY_ENDPOINTS = [
  'https://en.wikipedia.org/api/rest_v1/page/summary/',
  'https://pt.wikipedia.org/api/rest_v1/page/summary/',
];
const THINKER_REFERENCE_ALIASES = {
  'buddha': ['Gautama Buddha', 'Buddha'],
  'confucius': ['Confucius'],
  'epicurus': ['Epicurus'],
  'galileo galilei': ['Galileo Galilei'],
  'heraclitus': ['Heraclitus'],
  'martin luther king': ['Martin Luther King Jr.', 'Martin Luther King'],
  'plotinus': ['Plotinus'],
  'saint augustine': ['Augustine of Hippo', 'Saint Augustine'],
  'soren kierkegaard': ['Søren Kierkegaard', 'Soren Kierkegaard'],
};

const quoteCatalogPromises = new Map();
let philosopherDirectoryPromise = null;
let submittedPhilosophersPromise = null;
const referenceLookupCache = new Map();
const textDecoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8', { fatal: false }) : null;
const MOJIBAKE_PATTERN = /[ÃÂâ€]/;

// ─── Source 1: MongoDB via backend API ───────────────────────────────────────

/**
 * Fetches quotes from the backend REST API (/api/quotes).
 * The API returns paginated MongoDB documents; this helper walks every page.
 * Maps { quoteText, authorName, legacyId } → { id, quote, author, themes }
 * so curatedmatches.js numeric IDs keep working.
 *
 * The `id` field is set to `legacyId` so curatedmatches.js numeric lookups work.
 * Falls back to `_id` (string) for AI-generated quotes that have no legacyId.
 *
 * @returns {Promise<Array>} normalised quotes, or [] on any error
 */
async function fetchFromDB() {
  const pageSize = 500;
  let page = 1;
  const docs = [];

  for (;;) {
    const qs = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    const res = await fetch(`${API_QUOTES_ENDPOINT}?${qs.toString()}`);
    if (!res.ok) throw new Error(`/api/quotes responded ${res.status}`);

    const payload = await res.json();

    if (payload?.data && Array.isArray(payload.data)) {
      docs.push(...payload.data);
      const totalPages = typeof payload.totalPages === 'number' ? payload.totalPages : page;
      if (page >= totalPages || payload.data.length === 0) break;
      page += 1;
      continue;
    }

    if (Array.isArray(payload)) {
      docs.push(...payload);
      break;
    }

    throw new Error('Unexpected quotes payload shape from /api/quotes');
  }

  if (docs.length === 0) throw new Error('Empty quotes from DB');

  return docs.map(doc => {
    const orig = String(doc.quoteLanguage || 'en').trim().toLowerCase() || 'en';
    const trans = doc.quoteTranslations && typeof doc.quoteTranslations === 'object'
      ? doc.quoteTranslations
      : {};
    const canonical = String(doc.quoteText || '').trim();
    const quoteEn = String(trans.en || '').trim() || (orig === 'en' ? canonical : '');
    const quotePt = String(trans.pt || '').trim() || (orig === 'pt' ? canonical : '');

    return {
      id: doc.legacyId ?? doc._id,
      quote: canonical,
      author: doc.authorName,
      themes: doc.themes || [],
      originalLanguage: orig,
      quote_original: canonical,
      quote_en: quoteEn,
      quote_pt: quotePt,
    };
  });
}

async function fetchQuoteCatalogFromBackend(lang = 'en') {
  const res = await fetch(`${API_QUOTES_CATALOG_ENDPOINT}?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) throw new Error(`/api/quotes/catalog responded ${res.status}`);

  const docs = await res.json();
  if (!Array.isArray(docs) || docs.length === 0) throw new Error('Empty quote catalog');

  return docs.map(doc => ({
    id: doc.id,
    quote: doc.quote,
    author: doc.author,
    themes: doc.themes || [],
    source: doc.source || 'catalog',
    lang: doc.lang,
    originalLanguage: doc.originalLanguage,
    quote_original: doc.quote_original,
    quote_en: doc.quote_en,
    quote_pt: doc.quote_pt,
    translationStatus: doc.translationStatus,
  }));
}

// ─── Source 2: External API + local fallback ──────────────────────────────────

/**
 * Fetches from philosophersapi.com and merges with local custom-quotes.
 * Returns the same { id, quote, author, themes } shape.
 */
async function fetchFromExternalAndLocal() {
  let apiQuotes = [];

  try {
    const [quotesRes, philosophersRes] = await Promise.all([
      fetch(PHILOSOPHERS_API_URL),
      fetch(PHILOSOPHERS_URL),
    ]);

    if (!quotesRes.ok || !philosophersRes.ok) {
      throw new Error('External philosophers API unavailable');
    }

    const quotesData      = await quotesRes.json();
    const philosophersData = await philosophersRes.json();

    const philosopherMap = new Map(philosophersData.map(p => [p.id, p.name]));

    apiQuotes = quotesData.map(q => ({
      id:     q.id || null,
      quote:  q.quote,
      author: q.philosopher ? (philosopherMap.get(q.philosopher.id) || 'Unknown') : 'Unknown',
      themes: q.tags || [],
    }));
  } catch (err) {
    console.warn('[PhiloMedia] External API unavailable, using local quotes only:', err.message);
  }

  // Merge: custom-quotes take priority (deduplicate by quote text)
  const combined = new Map();
  customQuotes.forEach(q => {
    const quotePt = getCustomQuoteTranslationPt(q.id);
    combined.set(q.quote, {
      id: q.id,
      quote: q.quote,
      author: q.author,
      themes: q.themes || [],
      originalLanguage: 'en',
      quote_original: q.quote,
      quote_en: q.quote,
      quote_pt: quotePt,
    });
  });
  apiQuotes.forEach(q => { if (!combined.has(q.quote)) combined.set(q.quote, q); });

  return Array.from(combined.values());
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns all available philosophical quotes, normalised to:
 *   { id, quote, author, themes }
 *
 * Always resolves — never throws — so callers get [] at worst.
 */
export async function getQuotes() {
  // Try the DB first (fast, reliable, no CORS dependency)
  try {
    const dbQuotes = await fetchFromDB();
    return dbQuotes;
  } catch (err) {
    console.warn('[PhiloMedia] DB quotes unavailable, falling back to external API:', err.message);
  }

  // Fallback: external API + local file
  try {
    return await fetchFromExternalAndLocal();
  } catch (err) {
    console.warn('[PhiloMedia] All quote sources failed:', err.message);
    return [];
  }
}

export async function getQuoteCatalog(lang = 'en') {
  const locale = String(lang || 'en').trim().toLowerCase();

  if (!quoteCatalogPromises.has(locale)) {
    quoteCatalogPromises.set(locale, fetchQuoteCatalogFromBackend(locale)
      .catch(err => {
        console.warn('[PhiloMedia] Quote catalog unavailable, falling back to regular quotes:', err.message);
        return getQuotes();
      }));
  }

  return quoteCatalogPromises.get(locale);
}

function repairMojibake(value) {
  const rawValue = String(value || '').trim();
  if (!rawValue || !MOJIBAKE_PATTERN.test(rawValue) || !textDecoder) return rawValue;

  try {
    const bytes = Uint8Array.from(rawValue, character => character.charCodeAt(0));
    const repaired = textDecoder.decode(bytes).trim();
    return repaired || rawValue;
  } catch {
    return rawValue;
  }
}

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeThinkerName(value) {
  const repaired = repairMojibake(value);
  const aliases = {
    'buda': 'Buddha',
    'confucio': 'Confucius',
    'epicuro': 'Epicurus',
    'galileu galilei': 'Galileo Galilei',
    'heraclito': 'Heraclitus',
    'martin luther king': 'Martin Luther King Jr.',
    'plotino': 'Plotinus',
    'santo agostinho': 'Saint Augustine',
    'soren kierkegaard': 'Søren Kierkegaard',
  };

  const normalized = normalizeKey(repaired);
  return aliases[normalized] || repaired;
}

function normalizePortraitUrl(rawUrl) {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl;
  if (rawUrl.startsWith('/')) return `https://philosophersapi.com${rawUrl}`;
  return `https://philosophersapi.com/${rawUrl.replace(/^\/+/, '')}`;
}

function toPortraitProxyUrl(rawUrl) {
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl, window.location.origin);
    if (url.hostname === 'upload.wikimedia.org') {
      return `/api/assets/portrait?src=${encodeURIComponent(url.toString())}`;
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function normalizePhilosopherEntry(entry) {
  const portraitUrl =
    toPortraitProxyUrl(normalizePortraitUrl(entry?.images?.faceImages?.face500x500))
    || toPortraitProxyUrl(normalizePortraitUrl(entry?.images?.faceImages?.face250x250))
    || '';

  return {
    id: entry.id,
    name: normalizeThinkerName(entry.name),
    life: entry.life || '',
    school: entry.school || '',
    interests: Array.isArray(entry.interests) ? entry.interests : [],
    topicalDescription: entry.topicalDescription || '',
    birthYear: entry.birthYear || '',
    deathYear: entry.deathYear || '',
    wikiTitle: normalizeThinkerName(entry.wikiTitle || ''),
    portraitUrl,
  };
}

export async function getPhilosopherDirectory() {
  if (!philosopherDirectoryPromise) {
    philosopherDirectoryPromise = fetch(PHILOSOPHERS_URL)
      .then(async response => {
        if (!response.ok) throw new Error(`Philosophers API responded ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid philosopher directory payload');
        return data.map(normalizePhilosopherEntry).filter(entry => entry.name);
      })
      .catch(error => {
        console.warn('[PhiloMedia] Philosopher directory unavailable:', error.message);
        return [];
      });
  }

  return philosopherDirectoryPromise;
}

export async function getSubmittedPhilosophers() {
  if (!submittedPhilosophersPromise) {
    submittedPhilosophersPromise = fetch(API_PHILOSOPHERS_ENDPOINT, {
      credentials: 'same-origin',
    })
      .then(async response => {
        if (!response.ok) throw new Error(`Philosophers endpoint responded ${response.status}`);
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      })
      .catch(error => {
        console.warn('[PhiloMedia] Submitted philosophers unavailable:', error.message);
        return [];
      });
  }

  return submittedPhilosophersPromise;
}

export async function submitPhilosopherContribution(payload) {
  const response = await fetch(API_PHILOSOPHERS_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || result.error || 'Could not submit thinker.');
    error.status = response.status;
    error.details = result.errors || [];
    throw error;
  }

  submittedPhilosophersPromise = null;
  return result;
}

function buildSummaryCandidates(title) {
  const value = normalizeThinkerName(title);
  if (!value) return [];

  const normalizedTitle = normalizeKey(value);
  const aliasCandidates = THINKER_REFERENCE_ALIASES[normalizedTitle] || [];
  const titles = [...new Set([value, ...aliasCandidates].filter(Boolean))];

  return [...new Set(
    titles.flatMap(candidate => {
      const cleanedCandidate = normalizeThinkerName(candidate);
      const underscoreTitle = cleanedCandidate.replace(/\s+/g, '_');
      const normalized = cleanedCandidate
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '_');

      return [underscoreTitle, normalized];
    })
  )];
}

function normalizeWhitespace(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSentences(text) {
  return normalizeWhitespace(text)
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function extractLifeRange(text) {
  const matches = normalizeWhitespace(text).match(/\b\d{3,4}\b/g) || [];
  const uniqueYears = [...new Set(matches)];

  if (uniqueYears.length >= 2) {
    return `${uniqueYears[0]}-${uniqueYears[1]}`;
  }

  return uniqueYears[0] || '';
}

function buildDescriptor(description) {
  const cleanDescription = normalizeWhitespace(description).replace(/\.$/, '');
  if (!cleanDescription) return '';

  const shortened = cleanDescription
    .split(',')[0]
    .split(/\s+and\s+/i)[0]
    .trim();

  if (!shortened) return '';

  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

function buildSummary(name, description, extract) {
  const cleanDescription = normalizeWhitespace(description).replace(/\.$/, '');
  if (cleanDescription) {
    const normalizedExtract = ` ${normalizeWhitespace(extract).toLowerCase()} `;
    const copula = normalizedExtract.includes(' is ') && !normalizedExtract.includes(' was ') ? 'is' : 'was';
    const lowered = cleanDescription.charAt(0).toLowerCase() + cleanDescription.slice(1);
    return `${name} ${copula} ${lowered}.`;
  }

  return splitSentences(extract)[0] || '';
}

function buildFocus(extract) {
  const sentences = splitSentences(extract);
  if (sentences.length >= 2) {
    return sentences.slice(1, 3).join(' ');
  }

  return sentences[0] || '';
}

function normalizeReferencePayload(name, payload) {
  if (!payload) return null;

  const portraitUrl = toPortraitProxyUrl(
    payload?.thumbnail?.source || payload?.originalimage?.source || ''
  );
  const description = normalizeWhitespace(payload?.description || '');
  const extract = normalizeWhitespace(payload?.extract || '');
  const periodDescriptor = buildDescriptor(description);
  const lifeRange = extractLifeRange(extract);

  return {
    portraitUrl,
    description,
    extract,
    period: periodDescriptor && lifeRange
      ? `${periodDescriptor} · ${lifeRange}`
      : (periodDescriptor || lifeRange),
    summary: buildSummary(name, description, extract),
    focus: buildFocus(extract),
  };
}

async function fetchReferenceFromSummaryEndpoint(name, title) {
  const candidates = buildSummaryCandidates(title);

  for (const baseUrl of WIKIPEDIA_SUMMARY_ENDPOINTS) {
    for (const candidate of candidates) {
      try {
        const response = await fetch(`${baseUrl}${encodeURIComponent(candidate)}`);
        if (!response.ok) continue;

        const data = await response.json();
        const reference = normalizeReferencePayload(name, data);
        if (reference?.portraitUrl || reference?.summary || reference?.period || reference?.focus) {
          return reference;
        }
      } catch (error) {
        continue;
      }
    }
  }

  return '';
}

export async function getPhilosopherReference(title, wikiTitle = '') {
  const cacheKey = `${title}::${wikiTitle}`;
  if (!referenceLookupCache.has(cacheKey)) {
    referenceLookupCache.set(cacheKey, (async () => {
      const titles = [wikiTitle, title, normalizeThinkerName(title), normalizeThinkerName(wikiTitle)].filter(Boolean);
      for (const candidate of titles) {
        const reference = await fetchReferenceFromSummaryEndpoint(title, candidate);
        if (reference) return reference;
      }
      return null;
    })());
  }

  return referenceLookupCache.get(cacheKey);
}

export async function getPhilosopherPortrait(title, wikiTitle = '') {
  const reference = await getPhilosopherReference(title, wikiTitle);
  return reference?.portraitUrl || '';
}
