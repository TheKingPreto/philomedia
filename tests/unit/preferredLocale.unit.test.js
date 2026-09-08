import { preferredLocaleFromHeader } from '../../src/utils/preferredLocale.js';

describe('preferredLocaleFromHeader', () => {
  test('defaults to English when the header is absent or empty', () => {
    expect(preferredLocaleFromHeader(undefined)).toBe('en');
    expect(preferredLocaleFromHeader('')).toBe('en');
    expect(preferredLocaleFromHeader('   ')).toBe('en');
    expect(preferredLocaleFromHeader(null)).toBe('en');
  });

  test('reads a plain language tag', () => {
    expect(preferredLocaleFromHeader('pt')).toBe('pt');
    expect(preferredLocaleFromHeader('en')).toBe('en');
  });

  test('strips the region subtag', () => {
    expect(preferredLocaleFromHeader('pt-BR')).toBe('pt');
    expect(preferredLocaleFromHeader('en-US')).toBe('en');
  });

  test('honours q-values over declaration order', () => {
    expect(preferredLocaleFromHeader('en;q=0.5,pt-BR;q=0.9')).toBe('pt');
    expect(preferredLocaleFromHeader('pt;q=0.2,en;q=0.8')).toBe('en');
  });

  test('keeps declaration order when qualities tie', () => {
    expect(preferredLocaleFromHeader('pt-BR,en-US')).toBe('pt');
    expect(preferredLocaleFromHeader('en-US,pt-BR')).toBe('en');
  });

  test('skips unsupported languages to find a supported one', () => {
    expect(preferredLocaleFromHeader('fr-FR,es;q=0.9,pt;q=0.5')).toBe('pt');
    expect(preferredLocaleFromHeader('de,ja')).toBe('en');
  });

  test('ignores entries explicitly refused with q=0', () => {
    expect(preferredLocaleFromHeader('pt;q=0,en;q=0.3')).toBe('en');
  });

  test('tolerates wildcards and malformed input', () => {
    expect(preferredLocaleFromHeader('*')).toBe('en');
    expect(preferredLocaleFromHeader(',,;;')).toBe('en');
    expect(preferredLocaleFromHeader('pt;q=abc')).toBe('pt');
  });
});
