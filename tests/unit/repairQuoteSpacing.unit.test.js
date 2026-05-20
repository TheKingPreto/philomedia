import { repairQuoteSpacing } from '../../src/domain/i18n/repairQuoteSpacing.js';
import { normalizeAuthorKey } from '../../src/domain/i18n/authorKey.js';

describe('repairQuoteSpacing', () => {
  test('fixes Wittgenstein glued words', () => {
    const raw = 'O que eu sei sobreDeuse o sentido davida? Eu sei que este mundo existe';
    expect(repairQuoteSpacing(raw, { locale: 'pt' })).toBe(
      'O que eu sei sobre Deus e o sentido da vida? Eu sei que este mundo existe',
    );
  });

  test('leaves English text unchanged', () => {
    const en = 'What we cannot speak about we must pass over in silence.';
    expect(repairQuoteSpacing(en, { locale: 'pt' })).toBe(en);
  });
});

describe('normalizeAuthorKey', () => {
  test('maps Heráclito to heraclitus key', () => {
    expect(normalizeAuthorKey('Heráclito')).toBe('heraclitus');
    expect(normalizeAuthorKey('Heraclitus')).toBe('heraclitus');
  });
});
