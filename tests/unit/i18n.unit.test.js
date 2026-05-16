import { resolveTranslation } from '../../public/scripts/services/i18n.js';

describe('i18n', () => {
  test('resolveTranslation returns Portuguese copy', () => {
    expect(resolveTranslation('nav.home', 'pt')).toBe('Início');
  });

  test('resolveTranslation falls back to English for unknown keys', () => {
    expect(resolveTranslation('missing.key', 'pt')).toBe('missing.key');
  });

  test('resolveTranslation interpolates variables', () => {
    expect(resolveTranslation('home.works_shown', 'en', { visible: 3, total: 10 }))
      .toBe('3 of 10 works shown');
  });
});
