/**
 * Corrige palavras coladas comuns em citações importadas do Wikiquote (PT).
 */

const KNOWN_GLUED_REPLACEMENTS = [
  [/sobreDeuse/gi, 'sobre Deus e'],
  [/sobreDeus/gi, 'sobre Deus'],
  [/davida/gi, 'da vida'],
  [/umavida/gi, 'uma vida'],
  [/avidamaravilhosa/gi, 'a vida maravilhosa'],
  [/nossafelicidade/gi, 'nossa felicidade'],
  [/nossadignidade/gi, 'nossa dignidade'],
  [/damoral/gi, 'da moral'],
  [/asaúde/gi, 'a saúde'],
  [/nasaude/gi, 'na saúde'],
  [/Deusconcedeu/gi, 'Deus concedeu'],
  [/dedivino/gi, 'de divino'],
  [/deDivino/gi, 'de Divino'],
  [/noUniverso/gi, 'no Universo'],
  [/ditadoVox/gi, 'ditado Vox'],
  [/moralzomba/gi, 'moral zomba'],
  [/oque-é-com/gi, 'o que é com'],
  [/oqueécom/gi, 'o que é com'],
  [/palávras\.outra/gi, 'palavras. Outra'],
];

/**
 * @param {string} text
 * @param {{ locale?: string }} [options]
 * @returns {string}
 */
export function repairQuoteSpacing(text, { locale } = {}) {
  let value = String(text || '').trim();
  if (!value) return '';

  const loc = String(locale || '').trim().toLowerCase();
  const looksPortuguese = loc === 'pt' || /[áàâãéêíóôõúç]/i.test(value);
  if (!looksPortuguese) return value;

  for (const [pattern, replacement] of KNOWN_GLUED_REPLACEMENTS) {
    value = value.replace(pattern, replacement);
  }

  value = value.replace(
    /([a-záéíóúãõç])([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ])/g,
    '$1 $2',
  );

  return value.replace(/\s+/g, ' ').trim();
}
