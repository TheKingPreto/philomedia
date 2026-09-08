import { documentLangFromUiLocale, normalizeUiLocale } from '../../public/scripts/services/uiLocale.js';

describe('document lang', () => {
  test('maps UI locale pt to HTML lang pt-BR', () => {
    expect(normalizeUiLocale('pt-BR')).toBe('pt');
    expect(documentLangFromUiLocale('pt')).toBe('pt-BR');
    expect(documentLangFromUiLocale('en')).toBe('en');
  });
});
