import {
  LENS_FILTERS,
  FEATURED_LENS_IDS,
  buildLensKeywordDiscoverOptions,
  buildLensCrewDiscoverOptions,
  buildWatchProviderDiscoverExtras,
  getLensById,
  getLensExcludeKeywordQuery,
  getLensKeywordQuery,
  getLensTextKeywords,
  itemHasLensKeywordHit,
  isLensChipVisible,
  partitionLensFilters,
  withLensQueryParam,
  withProviderQueryParam,
} from '../../public/scripts/domain/searchFilters.js';
import { LENS_DEFINITIONS } from '../../public/scripts/philosopher-data.js';

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

describe('featured search lenses', () => {
  test('highlights the five lenses used on the search page', () => {
    expect(FEATURED_LENS_IDS).toEqual([
      'epistemology',
      'power-corruption',
      'alienation',
      'consciousness-ai',
      'freedom-choice',
    ]);
    FEATURED_LENS_IDS.forEach((id) => {
      expect(getLensById(id)).toBeTruthy();
    });
  });

  test('keeps featured chips first and leaves the rest behind see-all', () => {
    const { featured, rest } = partitionLensFilters(LENS_FILTERS);

    expect(featured.map(lens => lens.id)).toEqual([...FEATURED_LENS_IDS]);
    expect(featured).toHaveLength(5);
    expect(rest).toHaveLength(LENS_FILTERS.length - 5);
    expect(rest.every(lens => !FEATURED_LENS_IDS.includes(lens.id))).toBe(true);
  });

  test('keeps a hidden active lens visible while collapsed', () => {
    expect(isLensChipVisible('stoicism', { expanded: false, activeLensId: 'all' })).toBe(false);
    expect(isLensChipVisible('stoicism', { expanded: false, activeLensId: 'stoicism' })).toBe(true);
    expect(isLensChipVisible('epistemology', { expanded: false, activeLensId: 'all' })).toBe(true);
    expect(isLensChipVisible('stoicism', { expanded: true, activeLensId: 'all' })).toBe(true);
  });
});

describe('lens query param', () => {
  test('writes lens while preserving other params', () => {
    expect(withLensQueryParam('?q=matrix&sort=rating', 'alienation'))
      .toBe('?q=matrix&sort=rating&lens=alienation');
    expect(withLensQueryParam('?lens=stoicism&q=dune', 'consciousness-ai'))
      .toBe('?lens=consciousness-ai&q=dune');
  });

  test('drops lens without touching the rest of the query string', () => {
    expect(withLensQueryParam('?lens=alienation&q=matrix', 'all')).toBe('?q=matrix');
    expect(withLensQueryParam('?lens=alienation', '')).toBe('');
    expect(withLensQueryParam('', 'power-corruption')).toBe('?lens=power-corruption');
  });
});

describe('unified lens catalog', () => {
  test('search filters and thinker definitions share the same 12 ids', () => {
    expect(LENS_FILTERS.map(lens => lens.id)).toEqual(LENS_DEFINITIONS.map(lens => lens.id));
    expect(LENS_FILTERS).toHaveLength(12);
    LENS_FILTERS.forEach((lens, index) => {
      expect(lens.label).toBe(LENS_DEFINITIONS[index].label);
      expect(lens.themes).toEqual(LENS_DEFINITIONS[index].themes);
    });
  });

  test('alienation and self-knowledge include neighbor TMDB keyword ids', () => {
    expect(getLensKeywordQuery(getLensById('alienation'))).toContain('230841');
    expect(getLensKeywordQuery(getLensById('alienation'))).toContain('350828');
    expect(getLensKeywordQuery(getLensById('self-knowledge'))).toContain('1284');
    expect(getLensKeywordQuery(getLensById('self-knowledge'))).toContain('2796');
    expect(getLensKeywordQuery(getLensById('humanism'))).toContain('211062');
    expect(getLensKeywordQuery(getLensById('humanism'))).toContain('15120');
  });

  test('scores TMDB keyword ids from details, not only overview text', () => {
    const lens = getLensById('alienation');
    expect(itemHasLensKeywordHit({
      overview: 'A quiet drama.',
      tmdbKeywords: [{ id: 7368, name: 'alienation' }],
    }, lens)).toBe(true);
    expect(itemHasLensKeywordHit({
      overview: 'A quiet drama.',
      tmdbKeywords: [{ id: 4565, name: 'dystopia' }],
    }, lens)).toBe(false);
  });
});

describe('watch providers and crew discover options', () => {
  test('builds BR flatrate extras for a curated provider', () => {
    expect(buildWatchProviderDiscoverExtras('netflix')).toEqual({
      withWatchProviders: '8',
      watchRegion: 'BR',
      watchMonetizationTypes: 'flatrate',
    });
    expect(buildWatchProviderDiscoverExtras('any').withWatchProviders).toBeUndefined();
  });

  test('crew is a separate discover option and does not replace keywords', () => {
    const lens = getLensById('alienation');
    const keywords = buildLensKeywordDiscoverOptions(lens);
    const crew = buildLensCrewDiscoverOptions(lens);

    expect(keywords.withKeywords).toContain('7368');
    expect(keywords.withCrew).toBeUndefined();
    expect(crew.withCrew).toContain('8452');
    expect(crew.withKeywords).toBeUndefined();
  });

  test('writes provider in the query string beside lens', () => {
    expect(withProviderQueryParam('?lens=alienation', 'netflix'))
      .toBe('?lens=alienation&provider=netflix');
    expect(withProviderQueryParam('?lens=alienation&provider=netflix', 'any'))
      .toBe('?lens=alienation');
  });
});
