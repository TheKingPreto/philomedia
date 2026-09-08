import { getUiLocale, normalizeUiLocale } from './uiLocale.js';

/**
 * Tabelas de tradução carregadas nesta sessão, por locale.
 *
 * Só o locale ativo é buscado: as duas tabelas somam ~45 KB e trocar de idioma
 * recarrega a página (ui/languageChrome.js), então nunca precisamos das duas ao
 * mesmo tempo no browser. Os testes registram a segunda tabela explicitamente.
 */
const tables = new Map();

export function registerTranslations(locale, table) {
  if (table && typeof table === 'object') {
    tables.set(normalizeUiLocale(locale), table);
  }
}

/**
 * Carrega a tabela de um locale, se ainda não estiver em memória.
 * `normalizeUiLocale` reduz qualquer entrada a 'en' ou 'pt', então o
 * especificador dinâmico nunca é arbitrário.
 */
export async function ensureTranslations(locale) {
  const loc = normalizeUiLocale(locale);
  if (tables.has(loc)) return;

  try {
    const mod = await import(`./translations.${loc}.js`);
    registerTranslations(loc, mod.default);
  } catch (error) {
    // Sem a tabela, t() devolve a própria chave. Preferimos texto cru a uma
    // página em branco por falha de rede num único asset.
    console.error(`[PhiloMedia] Failed to load "${loc}" translations:`, error);
    registerTranslations(loc, {});
  }
}

// Await de topo de módulo: bloqueia os importadores até a tabela estar pronta,
// o que mantém t() e resolveTranslation síncronos para todos os consumidores.
await ensureTranslations(getUiLocale());

/**
 * @param {string} key
 * @param {string} locale
 * @param {Record<string, string|number>} [vars]
 */
export function resolveTranslation(key, locale, vars = {}) {
  const loc = normalizeUiLocale(locale);
  const k = String(key || '').trim();
  if (!k) return '';

  let text = tables.get(loc)?.[k] ?? k;

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
