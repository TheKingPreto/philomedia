import { MAX_RANK_CANDIDATES, rankCandidatesFromBody } from '../../src/services/mediaRankingService.js';

const profile = {
  themes: ['existentialism'],
  themeWeights: { existentialism: 1 },
  keywords: ['freedom'],
  preferredGenres: [18],
};

function candidate(id) {
  return {
    id,
    title: `Title ${id}`,
    overview: 'A person searches for meaning.',
    media_type: 'movie',
    genre_ids: [18],
    vote_average: 8,
    popularity: 20,
    _sources: ['movie-popular'],
  };
}

describe('rankCandidatesFromBody', () => {
  test(`rejects more than ${MAX_RANK_CANDIDATES} candidates`, () => {
    const outcome = rankCandidatesFromBody({
      profile,
      candidates: Array.from({ length: MAX_RANK_CANDIDATES + 1 }, (_, index) => candidate(index + 1)),
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.status).toBe(400);
    expect(outcome.error).toMatch(/Too many candidates/);
  });

  test(`accepts ${MAX_RANK_CANDIDATES} candidates`, () => {
    const outcome = rankCandidatesFromBody({
      profile,
      candidates: Array.from({ length: MAX_RANK_CANDIDATES }, (_, index) => candidate(index + 1)),
      limit: 5,
    });

    expect(outcome.ok).toBe(true);
    expect(Array.isArray(outcome.results)).toBe(true);
  });
});
