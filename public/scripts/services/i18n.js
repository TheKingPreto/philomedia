import { getUiLocale, normalizeUiLocale } from './uiLocale.js';
import { TRANSLATIONS } from './translations.js';

/**
 * @param {string} key
 * @param {string} locale
 * @param {Record<string, string|number>} [vars]
 */
export function resolveTranslation(key, locale, vars = {}) {
  const loc = normalizeUiLocale(locale);
  const k = String(key || '').trim();
  if (!k) return '';

  let text = TRANSLATIONS[loc]?.[k] ?? TRANSLATIONS.en[k] ?? k;

  Object.entries(vars).forEach(([name, value]) => {
    text = text.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), String(value ?? ''));
  });

  return text;
}

/**
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  return resolveTranslation(key, getUiLocale(), vars);
}

/**
 * Applies data-i18n* attributes under `root` (default: document).
 * @param {ParentNode} [root]
 */
export function applyPageTranslations(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key && 'placeholder' in el) el.placeholder = t(key);
  });

  root.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) el.setAttribute('aria-label', t(key));
  });

  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) el.setAttribute('title', t(key));
  });
}

export function initPageI18n() {
  applyPageTranslations(document);

  if (typeof window !== 'undefined') {
    window.addEventListener('philomedia:locale-changed', () => {
      applyPageTranslations(document);
    });
  }
}
