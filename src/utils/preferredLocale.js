/**
 * @file preferredLocale.js
 * @description Escolhe o locale da UI a partir do cabeçalho Accept-Language.
 *
 * Serve só para emitir o `Link: rel=modulepreload` da tabela de tradução certa,
 * já que o HTML é estático e não sabe o idioma. O cliente decide o locale de
 * verdade em uiLocale.js (localStorage e navigator.language), então um palpite
 * errado aqui só desperdiça um preload — nunca troca o idioma da página.
 */

const SUPPORTED = ['en', 'pt'];
const DEFAULT_LOCALE = 'en';

/**
 * @param {string} [header] Valor bruto de Accept-Language.
 * @returns {'en' | 'pt'}
 */
export function preferredLocaleFromHeader(header) {
  if (typeof header !== 'string' || header.trim() === '') return DEFAULT_LOCALE;

  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.split('=')[1]) : 1;

      return {
        language: String(tag || '').trim().toLowerCase().split('-')[0],
        // q ilegível conta como 1: o idioma foi pedido, e descartá-lo por causa
        // do peso malformado só nos faria pré-carregar a tabela errada.
        quality: Number.isFinite(q) ? q : 1,
        index,
      };
    })
    .filter((entry) => entry.language !== '' && entry.quality > 0)
    // Empate mantém a ordem original, que é a preferência declarada.
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  const match = ranked.find((entry) => SUPPORTED.includes(entry.language));
  return match ? /** @type {'en' | 'pt'} */ (match.language) : DEFAULT_LOCALE;
}
