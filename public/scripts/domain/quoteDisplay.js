/**
 * Resolve texto de citação para exibição (espelha src/domain/i18n/quoteDisplay.js).
 */

export function resolveQuoteForLocale(entry, locale = 'en') {
  if (!entry || typeof entry !== 'object') return '';

  const loc = String(locale || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';
  const orig = String(entry.originalLanguage || '').trim().toLowerCase();
  const canonical = String(entry.quote_original ?? entry.quote ?? '').trim();

  const quoteEn = String(entry.quote_en ?? '').trim();
  const quotePt = String(entry.quote_pt ?? '').trim();

  if (loc === 'pt') {
    if (quotePt) return quotePt;
    if (orig === 'pt' && canonical) return canonical;
    if (quoteEn) return quoteEn;
    return canonical;
  }

  if (quoteEn) return quoteEn;
  if (orig === 'en' && canonical) return canonical;
  if (quotePt) return quotePt;
  return canonical;
}
