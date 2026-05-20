/**
 * Chave estável de autor para cruzar calendário editorial, catálogo e UI.
 */
export const AUTHOR_KEY_ALIASES = {
  buda: 'buddha',
  confucio: 'confucius',
  epicuro: 'epicurus',
  'galileu galilei': 'galileo galilei',
  heraclito: 'heraclitus',
  'martin luther king': 'martin luther king jr',
  plotino: 'plotinus',
  'soren kierkegaard': 'soren kierkegaard',
  'santo agostinho': 'saint augustine',
  'clovis de barros filho': 'clovis de barros filho',
};

export function normalizeAuthorKey(author) {
  const base = String(author || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return AUTHOR_KEY_ALIASES[base] || base;
}
