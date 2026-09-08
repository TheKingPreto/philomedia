import {
  LENS_FILTERS,
  buildLensKeywordDiscoverOptions,
  getLensById,
  getLensExcludeKeywordQuery,
  getLensKeywordQuery,
  getLensTextKeywords,
} from '../../public/scripts/domain/searchFilters.js';

describe('TMDB keyword mapping on lenses', () => {
  test('every lens has at least one verified TMDB keyword id', () => {
    LENS_FILTERS.forEach((lens) => {
      expect(lens.tmdbKeywords?.length).toBeGreaterThan(0);
      expect(getLensKeywordQuery(lens)).toMatch(/^\d+(\|\d+)*$/);
    });
  });

  test('consciousness-ai excludes superhero noise at the source', () => {
    const lens = getLensById('consciousness-ai');
    expect(getLensExcludeKeywordQuery(lens)).toContain('9715');
    expect(getLensExcludeKeywordQuery(lens)).toContain('180547');
  });

  test('keyword discover options use OR and omit genres', () => {
    const lens = getLensById('utopia-dystopia');
    const options = buildLensKeywordDiscoverOptions(lens, { page: 1 });

    expect(options.withGenres).toBeUndefined();
    expect(options.withKeywords).toContain('4565');
    expect(options.withKeywords).toContain('|');
    expect(options.page).toBe(1);
  });

  test('text keywords include canonical TMDB names', () => {
    const lens = getLensById('freedom-choice');
    expect(getLensTextKeywords(lens)).toEqual(
      expect.arrayContaining(['free will', 'existentialism', 'freedom'])
    );
  });
});
