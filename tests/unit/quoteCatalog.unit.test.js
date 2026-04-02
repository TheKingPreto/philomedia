import {
  mapDatabaseQuoteEntry,
  mapWikiQuoteEntry,
  mapTranslatedWikiQuoteEntry,
  mergeQuoteCatalogEntries,
} from '../../src/services/quoteCatalog.js';

describe('quote catalog service', () => {
  test('maps local wikiquote records into normalized catalog entries', () => {
    const entry = mapWikiQuoteEntry({
      text: 'A felicidade nao e um ideal da razao, mas sim da imaginacao.',
      author: 'Immanuel Kant',
      theme: 'idealismo',
    }, 0);

    expect(entry).toEqual({
      id: 'wiki-1',
      quote: 'A felicidade nao e um ideal da razao, mas sim da imaginacao.',
      author: 'Immanuel Kant',
      themes: ['idealismo'],
      source: 'wikiquote',
      lang: 'pt',
      originalLanguage: 'pt',
    });
  });

  test('deduplicates equivalent quotes while preserving merged themes', () => {
    const merged = mergeQuoteCatalogEntries([
      {
        id: 1,
        quote: 'Know yourself.',
        author: 'Socrates',
        themes: ['self-knowledge'],
        source: 'custom',
      },
      {
        id: 'wiki-1',
        quote: 'Know yourself.',
        author: 'Sócrates',
        themes: ['wisdom'],
        source: 'wikiquote',
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({
      id: 1,
      author: 'Socrates',
      quote: 'Know yourself.',
      source: 'custom',
    }));
    expect(merged[0].themes).toEqual(expect.arrayContaining(['self-knowledge', 'wisdom']));
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

  test('preserves user-submitted database quotes in the English catalog', () => {
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
      lang: 'en',
      originalLanguage: 'en',
    }));
  });
});
