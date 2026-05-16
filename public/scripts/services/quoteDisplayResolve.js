import { resolveQuoteForLocale } from '/scripts/domain/quoteDisplay.js';
import { getCustomQuoteTranslationPt } from '/scripts/services/customQuoteTranslationsPt.js';
import { getUiLocale, normalizeUiLocale } from '/scripts/services/uiLocale.js';

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Texto de citação para exibição na UI (home, detalhes, pensadores).
 */
export function getDisplayQuoteText(quote, locale = getUiLocale()) {
  if (!quote || typeof quote !== 'object') return '';

  const loc = normalizeUiLocale(locale);
  const quotePt = String(quote.quote_pt ?? '').trim();
  if (loc === 'pt' && quotePt) return quotePt;

  if (loc === 'pt') {
    const byId = getCustomQuoteTranslationPt(quote.id);
    if (byId) return byId;
  }

  return resolveQuoteForLocale(quote, loc);
}

let catalogLookupPromise = null;

async function getCatalogLookup(locale) {
  const loc = normalizeUiLocale(locale);
  if (!catalogLookupPromise || catalogLookupPromise.locale !== loc) {
    catalogLookupPromise = (async () => {
      const { getQuoteCatalog } = await import('/scripts/philosophersapi.js');
      const catalog = await getQuoteCatalog(loc);
      const byAuthor = new Map();
      (catalog || []).forEach(entry => {
        const authorKey = normalizeKey(entry.author);
        if (!authorKey) return;
        const list = byAuthor.get(authorKey) || [];
        list.push(entry);
        byAuthor.set(authorKey, list);
      });
      return { locale: loc, byAuthor };
    })();
  }
  return catalogLookupPromise;
}

/**
 * Resolve citação para exibição (catálogo, custom PT ou calendário editorial).
 */
export async function resolveDisplayQuoteText(entry = {}, locale = getUiLocale()) {
  const loc = normalizeUiLocale(locale);
  const direct = getDisplayQuoteText(entry, loc);
  if (loc === 'en') return direct;

  const englishRef = normalizeKey(entry.quote_en || entry.quote_original || entry.quote);
  if (englishRef && normalizeKey(direct) !== englishRef) return direct;

  const byId = getCustomQuoteTranslationPt(entry.id);
  if (byId) return byId;

  try {
    const { byAuthor } = await getCatalogLookup(loc);
    const quoteKey = normalizeKey(entry.quote_en || entry.quote_original || entry.quote);
    const candidates = byAuthor.get(normalizeKey(entry.author)) || [];
    const match = candidates.find(candidate => {
      const keys = [
        candidate.quote_original,
        candidate.quote_en,
        candidate.quote,
      ].map(normalizeKey).filter(Boolean);
      return keys.includes(quoteKey);
    });
    if (match) return getDisplayQuoteText(match, loc);
  } catch {
    /* catálogo indisponível */
  }

  return direct || String(entry.quote || '').trim();
}

/** @deprecated use resolveDisplayQuoteText */
export const resolveEditorialQuoteText = resolveDisplayQuoteText;

export function clearQuoteCatalogLookupCache() {
  catalogLookupPromise = null;
}
