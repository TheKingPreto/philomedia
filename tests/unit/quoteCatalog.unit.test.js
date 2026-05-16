import {
  mapDatabaseQuoteEntry,
  mapWikiQuoteEntry,
  mapTranslatedWikiQuoteEntry,
  mergeQuoteCatalogEntries,
  mergeWikiBilingualPairs,
} from '../../src/services/quoteCatalog.js';

describe('quote catalog service', () => {
  test('maps local wikiquote records into normalized catalog entries', () => {
    const entry = mapWikiQuoteEntry({
      text: 'A felicidade nao e um ideal da razao, mas sim da imaginacao.',
      author: 'Immanuel Kant',
      theme: 'idealismo',
    }, 0);

    expect(entry).toEqual(expect.objectContaining({
      id: 'wiki-1',
      quote: 'A felicidade nao e um ideal da razao, mas sim da imaginacao.',
      author: 'Immanuel Kant',
      themes: ['idealism'],
      source: 'wikiquote',
      lang: 'pt',
      originalLanguage: 'pt',
    }));
  });

  test('deduplicates equivalent quotes while preserving merged canonical themes', () => {
    const merged = mergeQuoteCatalogEntries([
      {
        id: 1,
        quote_original: 'Know yourself.',
        quote_en: 'Know yourself.',
        quote_pt: '',
        author: 'Socrates',
        themes: ['self-knowledge'],
        source: 'custom',
        originalLanguage: 'en',
      },
      {
        id: 'wiki-1',
        quote_original: 'Know yourself.',
        quote: 'Know yourself.',
        author: 'Sócrates',
        themes: ['virtue'],
        source: 'wikiquote',
        originalLanguage: 'en',
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({
      id: 1,
      author: 'Socrates',
      quote_original: 'Know yourself.',
      source: 'custom',
    }));
    expect(merged[0].themes).toEqual(expect.arrayContaining(['self-knowledge', 'virtue']));
  });

  test('maps translated wikiquote records as English catalog entries', () => {
    const entry = mapTranslatedWikiQuoteEntry({
      id: 'wiki-1',
      text: 'Happiness is not an ideal of reason, but of imagination.',
      author: 'Immanuel Kant',
      theme: 'idealism',
      originalText: 'A felicidade não é um ideal da razão, mas sim da imaginação.',
      originalLanguage: 'pt',
      translationStatus: 'machine',
    }, 0);

    expect(entry).toEqual({
      id: 'wiki-1',
      quote: 'Happiness is not an ideal of reason, but of imagination.',
      author: 'Immanuel Kant',
      themes: ['idealism'],
      source: 'wikiquote-machine',
      lang: 'en',
      originalLanguage: 'pt',
      originalQuote: 'A felicidade não é um ideal da razão, mas sim da imaginação.',
      translationStatus: 'machine',
    });
  });

  test('normalizes translated author aliases into canonical English names', () => {
    const entry = mapTranslatedWikiQuoteEntry({
      id: 'wiki-2',
      text: 'Do not dwell in the past.',
      author: 'Buda',
      theme: 'budismo',
      originalText: 'NÃ£o viva no passado.',
      originalLanguage: 'pt',
      translationStatus: 'machine',
    }, 1);

    expect(entry.author).toBe('Buddha');
  });

  test('repairs mojibake thinker names before applying canonical aliases', () => {
    const entry = mapTranslatedWikiQuoteEntry({
      id: 'wiki-3',
      text: 'Study the past if you would define the future.',
      author: 'ConfÃºcio',
      theme: 'humanism',
      originalText: 'Estude o passado se quiser definir o futuro.',
      originalLanguage: 'pt',
      translationStatus: 'machine',
    }, 2);

    expect(entry.author).toBe('Confucius');
  });

  test('preserves user-submitted database quotes with bilingual shape', () => {
    const entry = mapDatabaseQuoteEntry({
      _id: '507f1f77bcf86cd799439011',
      quoteText: 'In the depth of winter, I found an invincible summer.',
      authorName: 'Albert Camus',
      themes: ['existentialism'],
      submissionSource: 'user-submitted',
      quoteLanguage: 'en',
    });

    expect(entry).toEqual(expect.objectContaining({
      author: 'Albert Camus',
      source: 'user-submitted',
      originalLanguage: 'en',
      quote_original: 'In the depth of winter, I found an invincible summer.',
      quote_en: 'In the depth of winter, I found an invincible summer.',
      quote_pt: '',
    }));
  });

  test('maps quoteTranslations when original is Portuguese', () => {
    const entry = mapDatabaseQuoteEntry({
      _id: '507f1f77bcf86cd799439099',
      quoteText: 'Olá mundo.',
      authorName: 'Test',
      themes: ['virtue'],
      quoteLanguage: 'pt',
      quoteTranslations: { en: 'Hello world.', pt: '' },
    });

    expect(entry.quote_pt).toBe('Olá mundo.');
    expect(entry.quote_en).toBe('Hello world.');
  });

  test('normalizes mojibake author names coming from database quotes', () => {
    const entry = mapDatabaseQuoteEntry({
      _id: '507f1f77bcf86cd799439012',
      quoteText: 'Life can only be understood backwards; but it must be lived forwards.',
      authorName: 'SÃ¸ren Kierkegaard',
      themes: ['existentialism'],
      submissionSource: 'database-import',
      quoteLanguage: 'en',
    });

    expect(entry.author).toBe('Søren Kierkegaard');
  });

  test('pairs PT and EN wikiquote rows into one bilingual record', () => {
    const local = [
      mapWikiQuoteEntry({
        text: 'Experiência é percepção compreendida.',
        author: 'Immanuel Kant',
        theme: 'idealismo',
      }, 3),
    ];
    const translated = [
      mapTranslatedWikiQuoteEntry({
        id: 'wiki-4',
        text: 'Experience is perception understood.',
        author: 'Immanuel Kant',
        theme: 'idealism',
        originalText: 'Experiência é percepção compreendida.',
        originalLanguage: 'pt',
        translationStatus: 'machine',
      }, 0),
    ];

    const merged = mergeWikiBilingualPairs(local, translated);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({
      originalLanguage: 'pt',
      quote_pt: 'Experiência é percepção compreendida.',
      quote_en: 'Experience is perception understood.',
    }));
  });
});
