/**
 * @file scripts/philosophersapi.js
 * @description Thinker directory, Wikipedia portraits, and quote catalog re-exports.
 *
 * O catálogo de citações vive em quoteCatalogClient.js para a página de details
 * não puxar Wikipedia + custom-quotes no grafo inicial.
 */

export { getQuoteCatalog, getQuotes } from '/scripts/services/quoteCatalogClient.js';

const API_PHILOSOPHERS_ENDPOINT = '/api/philosophers';
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

let philosopherDirectoryPromise = null;
let submittedPhilosophersPromise = null;
const referenceLookupCache = new Map();
const textDecoder = typeof TextDecoder === 'function' ? new TextDecoder('utf-8', { fatal: false }) : null;
const MOJIBAKE_PATTERN = /[ÃÂâ€]/;
const FETCH_TIMEOUT_MS = 4000;
const REFERENCE_TIMEOUT_MS = 5000;

function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

function withTimeout(promise, timeoutMs = REFERENCE_TIMEOUT_MS, fallback = null) {
  let timer;
  const timeoutPromise = new Promise(resolve => {
    timer = setTimeout(() => resolve(fallback), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
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
    philosopherDirectoryPromise = fetchWithTimeout(PHILOSOPHERS_URL)
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
        const response = await fetchWithTimeout(`${baseUrl}${encodeURIComponent(candidate)}`);
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

  return null;
}

export async function getPhilosopherReference(title, wikiTitle = '') {
  const cacheKey = `${title}::${wikiTitle}`;
  if (!referenceLookupCache.has(cacheKey)) {
    referenceLookupCache.set(cacheKey, withTimeout((async () => {
      try {
        const titles = [wikiTitle, title, normalizeThinkerName(title), normalizeThinkerName(wikiTitle)].filter(Boolean);
        for (const candidate of titles) {
          const reference = await fetchReferenceFromSummaryEndpoint(title, candidate);
          if (reference) return reference;
        }
      } catch (error) {
        return null;
      }
      return null;
    })()));
  }

  return referenceLookupCache.get(cacheKey);
}

export async function getPhilosopherPortrait(title, wikiTitle = '') {
  const reference = await getPhilosopherReference(title, wikiTitle);
  return reference?.portraitUrl || '';
}
