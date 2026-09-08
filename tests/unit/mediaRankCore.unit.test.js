/**
 * @file tests/unit/mediaRankCore.unit.test.js
 *
 * Cobre o ranking de obras relacionadas à citação. O regressão principal:
 * o weak-match rebaixava o genérico em massa em vez de premiar overlap
 * com keywords TMDB / temas da lente.
 */
import {
  buildQuoteProfile,
  extractCandidateKeywordNames,
  rankCandidates,
  scoreTmdbKeywordOverlap,
} from '../../public/scripts/mediaRankCore.js';

function makeCandidate(overrides = {}) {
  return {
    id: 1,
    title: 'Generic Hit',
    overview: 'A popular adventure about friends saving the city.',
    media_type: 'movie',
    genre_ids: [28, 12],
    vote_average: 8.4,
    popularity: 420,
    _sources: ['movie-popular'],
    ...overrides,
  };
}

describe('extractCandidateKeywordNames', () => {
  test('lê o formato de filme e o de série', () => {
    expect(extractCandidateKeywordNames({
      keywords: { keywords: [{ id: 4565, name: 'dystopia' }] },
    })).toEqual(['dystopia']);

    expect(extractCandidateKeywordNames({
      keywords: { results: [{ id: 181324, name: 'existentialism' }] },
    })).toEqual(['existentialism']);
  });

  test('aceita tmdbKeywords já extraídas', () => {
    expect(extractCandidateKeywordNames({
      tmdbKeywords: [{ id: 490, name: 'philosophy' }, 'freedom'],
    })).toEqual(['philosophy', 'freedom']);
  });
});

describe('buildQuoteProfile', () => {
  test('expõe temas e keywords a partir de uma citação existencial', () => {
    const profile = buildQuoteProfile({
      quote: 'Man is condemned to be free; because once thrown into the world he is responsible for everything he does.',
      themes: ['existentialism'],
    });

    expect(profile.themes).toContain('existentialism');
    expect(profile.themeWeights.get('existentialism')).toBeGreaterThan(0);
    expect(Array.isArray(profile.keywords)).toBe(true);
  });
});

describe('scoreTmdbKeywordOverlap', () => {
  test('premeia overlap com keywords filosóficas da lente', () => {
    const profile = buildQuoteProfile({
      quote: 'Existence precedes essence.',
      themes: ['existentialism'],
    });

    const philosophical = scoreTmdbKeywordOverlap(profile, {
      tmdbKeywords: [{ name: 'existentialism' }, { name: 'philosophy' }],
    });
    const generic = scoreTmdbKeywordOverlap(profile, {
      tmdbKeywords: [{ name: 'superhero' }, { name: 'marvel comic' }],
    });

    expect(philosophical).toBeGreaterThanOrEqual(14);
    expect(generic).toBe(0);
  });
});

describe('rankCandidates', () => {
  test('candidato com keywords da lente supera o genérico popular', () => {
    const profile = buildQuoteProfile({
      quote: 'Man is condemned to be free and must invent meaning without appeal.',
      themes: ['existentialism'],
    });

    const generic = makeCandidate({
      id: 101,
      title: 'Sky Punchers',
      overview: 'Superheroes punch a meteor and save the city with gadgets.',
      vote_average: 8.9,
      popularity: 900,
      tmdbKeywords: [{ name: 'superhero' }, { name: 'comic' }],
    });
    const philosophical = makeCandidate({
      id: 202,
      title: 'The Stranger Hours',
      overview: 'A quiet study of alienation, freedom, and the meaning of existence.',
      vote_average: 7.1,
      popularity: 18,
      _sources: ['movie-themed'],
      tmdbKeywords: [{ name: 'existentialism' }, { name: 'philosophy' }, { name: 'alienation' }],
    });

    const ranked = rankCandidates(profile, [generic, philosophical], 5);

    expect(ranked[0].id).toBe(202);
    expect(ranked.find(item => item.id === 202)._tmdbKeywordScore).toBeGreaterThanOrEqual(14);
    expect(ranked.find(item => item.id === 202)._weakThemePenalty).toBe(0);

    const [soloPhilosophical] = rankCandidates(profile, [philosophical], 3);
    const [soloGeneric] = rankCandidates(profile, [generic], 3);
    expect(soloPhilosophical._score).toBeGreaterThan(soloGeneric._score);
    expect(soloPhilosophical._tmdbKeywordScore).toBeGreaterThan(soloGeneric._tmdbKeywordScore);
  });

  test('weak-match não se aplica quando há keyword filosófica TMDB', () => {
    const profile = buildQuoteProfile({
      quote: 'Existence precedes essence.',
      themes: ['existentialism'],
    });

    const [withKeywords] = rankCandidates(profile, [
      makeCandidate({
        id: 7,
        title: 'Blank Canvas',
        overview: 'People walk around a city and talk.',
        vote_average: 6.1,
        popularity: 4,
        tmdbKeywords: [{ name: 'existentialism' }],
      }),
    ], 3);

    expect(withKeywords._tmdbKeywordScore).toBeGreaterThanOrEqual(14);
    expect(withKeywords._weakThemePenalty).toBe(0);
  });

  test('candidato genérico sem sinal filosófico leva penalidade weak-match', () => {
    const profile = buildQuoteProfile({
      quote: 'Existence precedes essence.',
      themes: ['existentialism'],
    });

    const [generic] = rankCandidates(profile, [
      makeCandidate({
        id: 9,
        title: 'Punch League',
        overview: 'Fighters train and win a tournament.',
        tmdbKeywords: [{ name: 'boxing' }],
      }),
    ], 3);

    expect(generic._tmdbKeywordScore).toBe(0);
    expect(generic._weakThemePenalty).toBe(22);
  });

  test('devolve no máximo o limite pedido', () => {
    const profile = buildQuoteProfile({
      quote: 'Know yourself.',
      themes: ['self-knowledge'],
    });
    const candidates = Array.from({ length: 8 }, (_, index) => makeCandidate({
      id: index + 1,
      title: `Title ${index + 1}`,
    }));

    expect(rankCandidates(profile, candidates, 3)).toHaveLength(3);
  });
});
