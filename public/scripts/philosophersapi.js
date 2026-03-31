/**
 * @file scripts/philosophersapi.js
 * @description Quote provider for PhiloMedia frontend.
 *
 * Resolution order:
 *  1. GET /api/quotes  — MongoDB (populated via seed-quotes.js)
 *     Maps { quoteText, authorName, legacyId } → { id, quote, author, themes }
 *     so curatedmatches.js numeric IDs keep working.
 *
 *  2. External philosophersapi.com (via corsproxy) + local custom-quotes.js
 *     Used as fallback if the backend is unreachable (offline, cold start, etc.)
 *
 * The frontend never needs to know which source was used.
 */

import { customQuotes } from '/scripts/custom-quotes.js';

const API_QUOTES_ENDPOINT  = '/api/quotes';
const PROXY_URL            = 'https://corsproxy.io/?';
const PHILOSOPHERS_API_URL = 'https://philosophersapi.com/api/quotes';
const PHILOSOPHERS_URL     = 'https://philosophersapi.com/api/philosophers';

// ─── Source 1: MongoDB via backend API ───────────────────────────────────────

/**
 * Fetches quotes from the backend REST API (/api/quotes).
 * Maps MongoDB document fields to the shape the rest of the frontend expects:
 *   { id, quote, author, themes }
 *
 * The `id` field is set to `legacyId` so curatedmatches.js numeric lookups work.
 * Falls back to `_id` (string) for AI-generated quotes that have no legacyId.
 *
 * @returns {Promise<Array>} normalised quotes, or [] on any error
 */
async function fetchFromDB() {
  const res = await fetch(API_QUOTES_ENDPOINT);
  if (!res.ok) throw new Error(`/api/quotes responded ${res.status}`);

  const docs = await res.json();
  if (!Array.isArray(docs) || docs.length === 0) throw new Error('Empty quotes from DB');

  return docs.map(doc => ({
    id:     doc.legacyId ?? doc._id,   // numeric for curated match, ObjectId string otherwise
    quote:  doc.quoteText,
    author: doc.authorName,
    themes: doc.themes || [],
  }));
}

// ─── Source 2: External API + local fallback ──────────────────────────────────

/**
 * Fetches from philosophersapi.com (via corsproxy) and merges with local custom-quotes.
 * Returns the same { id, quote, author, themes } shape.
 */
async function fetchFromExternalAndLocal() {
  let apiQuotes = [];

  try {
    const [quotesRes, philosophersRes] = await Promise.all([
      fetch(PROXY_URL + encodeURIComponent(PHILOSOPHERS_API_URL)),
      fetch(PROXY_URL + encodeURIComponent(PHILOSOPHERS_URL)),
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
  customQuotes.forEach(q => combined.set(q.quote, { id: q.id, quote: q.quote, author: q.author, themes: q.themes || [] }));
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