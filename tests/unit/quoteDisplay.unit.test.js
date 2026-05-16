import {
  resolvePhilosopherTextField,
  resolveQuoteForLocale,
} from '../../src/domain/i18n/quoteDisplay.js';

describe('quoteDisplay i18n helpers', () => {
  test('resolveQuoteForLocale prefers matching language fields', () => {
    expect(resolveQuoteForLocale({
      originalLanguage: 'pt',
      quote_original: 'Oi',
      quote_pt: 'Oi',
      quote_en: 'Hi',
    }, 'en')).toBe('Hi');

    expect(resolveQuoteForLocale({
      originalLanguage: 'pt',
      quote_original: 'Oi',
      quote_pt: 'Oi',
      quote_en: 'Hi',
    }, 'pt')).toBe('Oi');
  });

  test('resolveQuoteForLocale falls back across languages when a side is missing', () => {
    expect(resolveQuoteForLocale({
      originalLanguage: 'en',
      quote_original: 'Only English.',
      quote_en: 'Only English.',
      quote_pt: '',
    }, 'pt')).toBe('Only English.');
  });

  test('resolvePhilosopherTextField uses translations bucket', () => {
    const profile = {
      summary: 'Hello',
      originalLanguage: 'en',
      summaryI18n: { en: '', pt: 'Olá' },
    };

    expect(resolvePhilosopherTextField(profile, 'summary', 'en')).toBe('Hello');
    expect(resolvePhilosopherTextField(profile, 'summary', 'pt')).toBe('Olá');
  });
});
