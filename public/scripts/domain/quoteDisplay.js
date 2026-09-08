/**
 * Canonical quote/thinker display resolution for browser and server.
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

/**
 * Perfil de pensador: summary/focus canônicos + mapa i18n opcional.
 * @param {object} profile
 * @param {'summary'|'focus'} field
 * @param {string} locale
 */
export function resolvePhilosopherTextField(profile, field, locale = 'en') {
  if (!profile || typeof profile !== 'object') return '';

  const loc = String(locale || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';
  const orig = String(profile.originalLanguage || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';
  const canonical = String(profile[field] || '').trim();
  const bucket = field === 'summary' ? profile.summaryI18n : profile.focusI18n;
  const translations = bucket && typeof bucket === 'object' ? bucket : {};
  const other = String(translations[loc] || '').trim();

  if (loc === orig) return canonical || other;
  if (other) return other;
  return canonical;
}
