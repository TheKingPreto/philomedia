const STORAGE_KEY = 'philomedia_ui_lang';

export function normalizeUiLocale(value) {
  const v = String(value || 'en').trim().toLowerCase();
  return v === 'pt' ? 'pt' : 'en';
}

export function getUiLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeUiLocale(stored);
  } catch {
    /* private mode / blocked */
  }

  if (typeof navigator !== 'undefined') {
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('pt')) return 'pt';
  }

  return 'en';
}

export function setUiLocale(lang) {
  const normalized = normalizeUiLocale(lang);
  try {
    localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    /* ignore */
  }

  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized === 'pt' ? 'pt' : 'en';
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('philomedia:locale-changed', { detail: { locale: normalized } }));
  }

  return normalized;
}

/** TMDB API language tag for localized titles/overviews. */
export function getTmdbLanguage(locale = getUiLocale()) {
  return normalizeUiLocale(locale) === 'pt' ? 'pt-BR' : 'en-US';
}

/** Stable catalog language for discover/search so EN and PT show the same curated pools. */
export function getTmdbCatalogLanguage() {
  return 'en-US';
}

export function initDocumentLocale() {
  const loc = getUiLocale();
  if (typeof document !== 'undefined') {
    document.documentElement.lang = loc === 'pt' ? 'pt' : 'en';
  }
  return loc;
}

/**
 * Copy exibível para perfis de pensador (API + dados fundidos).
 */
export function getThinkerCopyForLocale(profile, locale) {
  if (!profile || typeof profile !== 'object') {
    return { summary: '', focus: '' };
  }

  const loc = normalizeUiLocale(locale);
  const sf = profile.summaryForLocale;
  const ff = profile.focusForLocale;
  const sum = sf && typeof sf === 'object' ? String(sf[loc] || '').trim() : '';
  const foc = ff && typeof ff === 'object' ? String(ff[loc] || '').trim() : '';

  return {
    summary: sum || String(profile.summary || '').trim(),
    focus: foc || String(profile.focus || '').trim(),
  };
}
