import { normalizeAuthorKey } from '../domain/i18n/authorKey.js';
import { repairQuoteSpacing } from '../domain/i18n/repairQuoteSpacing.js';
import { resolveQuoteForLocale } from '../domain/i18n/quoteDisplay.js';
import { buildQuoteCatalog } from './quoteCatalog.js';

function normalizeQuoteKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

let catalogByAuthorPromise = null;

async function getCatalogByAuthor() {
  if (!catalogByAuthorPromise) {
    catalogByAuthorPromise = buildQuoteCatalog('en').then(catalog => {
      const byAuthor = new Map();
      (catalog || []).forEach(entry => {
        const authorKey = normalizeAuthorKey(entry.author);
        if (!authorKey) return;
        const list = byAuthor.get(authorKey) || [];
        list.push(entry);
        byAuthor.set(authorKey, list);
      });
      return byAuthor;
    }).catch(() => new Map());
  }
  return catalogByAuthorPromise;
}

/**
 * Resolve citação do calendário editorial para o idioma da UI.
 * @param {{ quote?: string, author?: string }} entry
 * @param {string} [locale]
 */
export async function resolveEditorialQuoteForLocale(entry = {}, locale = 'en') {
  const loc = String(locale || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';
  const englishQuote = String(entry.quote || '').trim();
  const author = String(entry.author || '').trim();

  if (!englishQuote) return '';
  if (loc === 'en') return englishQuote;

  try {
    const byAuthor = await getCatalogByAuthor();
    const quoteKey = normalizeQuoteKey(englishQuote);
    const candidates = byAuthor.get(normalizeAuthorKey(author)) || [];
    const match = candidates.find(candidate => {
      const keys = [
        candidate.quote_original,
        candidate.quote_en,
        candidate.quote,
      ].map(normalizeQuoteKey).filter(Boolean);
      return keys.includes(quoteKey);
    });

    if (match) {
      const resolved = resolveQuoteForLocale(match, 'pt');
      if (resolved && normalizeQuoteKey(resolved) !== quoteKey) {
        return repairQuoteSpacing(resolved, { locale: 'pt' });
      }
    }
  } catch {
    /* catálogo indisponível */
  }

  return englishQuote;
}

export function clearEditorialQuoteCatalogCache() {
  catalogByAuthorPromise = null;
}
