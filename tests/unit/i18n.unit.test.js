import { registerTranslations, resolveTranslation } from '../../public/scripts/services/i18n.js';
import EN from '../../public/scripts/services/translations.en.js';
import PT from '../../public/scripts/services/translations.pt.js';

// i18n.js carrega sozinho só o locale ativo, e qual é o ativo depende do
// ambiente (getUiLocale consulta navigator.language). Registramos as duas
// tabelas para o teste não depender do idioma da máquina que o roda.
registerTranslations('en', EN);
registerTranslations('pt', PT);

describe('i18n', () => {
  test('resolveTranslation returns Portuguese copy', () => {
    expect(resolveTranslation('nav.home', 'pt')).toBe('Início');
  });

  test('resolveTranslation returns the key itself for unknown keys', () => {
    expect(resolveTranslation('missing.key', 'pt')).toBe('missing.key');
  });

  test('resolveTranslation interpolates variables', () => {
    expect(resolveTranslation('home.works_shown', 'en', { visible: 3, total: 10 }))
      .toBe('3 of 10 works shown');
  });

  test('resolveTranslation returns empty string for a blank key', () => {
    expect(resolveTranslation('', 'en')).toBe('');
    expect(resolveTranslation(null, 'en')).toBe('');
  });

  test('an unrecognized locale falls back to English', () => {
    expect(resolveTranslation('nav.home', 'xx')).toBe(EN['nav.home']);
    expect(resolveTranslation('nav.home', undefined)).toBe(EN['nav.home']);
  });
});

describe('translation tables', () => {
  // Sem tabela do locale carregada não há fallback cruzado: uma chave presente
  // só em en apareceria crua para o usuário pt. A paridade é o que impede isso.
  test('en and pt expose exactly the same keys', () => {
    const enKeys = Object.keys(EN).sort();
    const ptKeys = Object.keys(PT).sort();

    expect(ptKeys).toEqual(enKeys);
  });

  test('no translation value is empty', () => {
    const empty = [...Object.entries(EN), ...Object.entries(PT)]
      .filter(([, value]) => String(value).trim() === '')
      .map(([key]) => key);

    expect(empty).toEqual([]);
  });

  test('thinker detail chrome is translated in both locales', () => {
    expect(resolveTranslation('philosopher.stat_quotes', 'en')).toBe('Quotes');
    expect(resolveTranslation('philosopher.stat_quotes', 'pt')).toBe('Citações');
    expect(resolveTranslation('philosopher.works_title', 'en')).toBe('Related works');
    expect(resolveTranslation('philosopher.works_title', 'pt')).toBe('Obras relacionadas');
    expect(resolveTranslation('philosopher.quotes_empty_title', 'pt')).toBe('Ainda não há citações');
    expect(resolveTranslation('philosopher.not_found_title', 'pt')).toBe('Este pensador não está disponível.');
    expect(resolveTranslation('philosopher.seo_not_found_title', 'en')).toBe('PhiloMedia | Thinker not found');
    expect(resolveTranslation('details.back_to_thinker', 'pt', { name: 'Platão' })).toBe('Ver Platão');
  });
});
