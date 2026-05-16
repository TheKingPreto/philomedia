/**
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (!text) return '';

  return String(text)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {Element | null} el
 * @param {boolean} hidden
 */
export function setHidden(el, hidden) {
  if (el) el.hidden = hidden;
}
