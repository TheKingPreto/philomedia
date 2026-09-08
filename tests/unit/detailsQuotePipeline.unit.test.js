/**
 * @file tests/unit/detailsQuotePipeline.unit.test.js
 *
 * Cobre a selecção da citação da página de detalhes. O regressão principal:
 * antes, qualquer obra sem alinhamento temático caía num ramo que ordenava o
 * catálogo por uma nota independente da obra, devolvendo sempre a mesma
 * citação.
 */
import { jest } from '@jest/globals';

import {
  STRONG_POOL_SIZE,
  WEAK_POOL_SIZE,
} from '../../public/scripts/domain/detailsPageConfig.js';
import {
  applyQuoteRatingBias,
  buildGenreThemeWeights,
  buildQuoteThemeWeights,
  buildSourceContext,
  buildSourceThemeWeights,
  clearQuoteScoringCache,
  extractTmdbKeywordNames,
  hashString,
  preferReviewsByLanguage,
  rankQuotesForSource,
  resolveQuoteCandidatePool,
  selectPoolIndex,
  selectQuoteForMedia,
} from '../../public/scripts/domain/detailsQuotePipeline.js';
import { selectHomeQuote } from '../../public/scripts/domain/homeQuoteSelection.js';

const GENRE_DRAMA = 18;
const GENRE_SCIFI = 878;
const GENRE_WAR = 10752;

function makeQuote(id, author, quote, themes = []) {
  return { id, author, quote, quote_en: quote, themes, source: 'custom' };
}

/** Catálogo pequeno mas com autores e temas variados. */
const CATALOG = [
  makeQuote('q1', 'Hannah Arendt', 'Power corresponds to the human ability to act in concert, never merely to act.', ['power-corruption']),
  makeQuote('q2', 'Jean-Paul Sartre', 'Man is condemned to be free; because once thrown into the world he is responsible for everything he does.', ['existentialism']),
  makeQuote('q3', 'Karl Marx', 'The philosophers have only interpreted the world in various ways; the point is to change it.', ['marxism-socialism']),
  makeQuote('q4', 'Simone de Beauvoir', 'One is not born, but rather becomes, a woman through the choices of a lifetime.', ['feminism-equality']),
  makeQuote('q5', 'Michel Foucault', 'Knowledge is not made for understanding; it is made for cutting through illusion.', ['epistemology']),
  makeQuote('q6', 'Albert Camus', 'There is but one truly serious philosophical problem, and that is the absurd meaning of existence.', ['existentialism']),
  makeQuote('q7', 'Friedrich Nietzsche', 'He who fights with monsters should look to it that he himself does not become a monster.', ['power-corruption']),
  makeQuote('q8', 'Immanuel Kant', 'War is bad in that it produces more evil people than it takes away by violence.', ['war-and-conflict']),
  makeQuote('q9', 'Plato', 'The beginning is the most important part of any work of human character.', ['virtue']),
  makeQuote('q10', 'David Hume', 'Reason is, and ought only to be, the slave of the passions of the mind.', ['epistemology']),
];

/** Obra sem sinopse e sem reviews: o pior caso, que antes colapsava. */
function makeBareMedia(id, genreIds = [GENRE_DRAMA]) {
  return {
    id,
    title: `Untitled ${id}`,
    overview: '',
    genres: genreIds.map(genreId => ({ id: genreId, name: `genre-${genreId}` })),
  };
}

function pickQuoteFor(media, mediaType = 'movie', reviews = []) {
  const weights = buildSourceThemeWeights(media, reviews, mediaType, 8);
  const ranked = rankQuotesForSource(CATALOG, weights, { core: [], context: [] });
  return selectQuoteForMedia(ranked, `${mediaType}:${media.id}`);
}

beforeEach(() => {
  clearQuoteScoringCache();
});

describe('hashString', () => {
  it('é estável e não negativo', () => {
    expect(hashString('movie:550')).toBe(hashString('movie:550'));
    expect(hashString('movie:550')).toBeGreaterThanOrEqual(0);
  });

  it('separa chaves diferentes', () => {
    expect(hashString('movie:550')).not.toBe(hashString('movie:551'));
  });
});

describe('selectPoolIndex', () => {
  it('devolve sempre 0 para lote unitário', () => {
    expect(selectPoolIndex(123456, 1)).toBe(0);
    expect(selectPoolIndex(0, 0)).toBe(0);
  });

  it('nunca sai dos limites do lote', () => {
    for (let hash = 0; hash < 500; hash += 1) {
      const index = selectPoolIndex(hash * 7919, 6);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });

  it('favorece o início do lote sem excluir o resto', () => {
    const indexes = Array.from({ length: 400 }, (_, i) => selectPoolIndex(i * 7919, 6));
    const first = indexes.filter(i => i === 0).length;
    const last = indexes.filter(i => i === 5).length;

    expect(first).toBeGreaterThan(last);
    expect(last).toBeGreaterThan(0);
  });
});

describe('buildGenreThemeWeights', () => {
  it('deriva temas dos géneros TMDB', () => {
    const weights = buildGenreThemeWeights(makeBareMedia(1, [GENRE_WAR]), 'movie');

    expect(weights.size).toBeGreaterThan(0);
    expect(weights.has('war-and-conflict')).toBe(true);
  });

  it('normaliza os pesos para somar 1', () => {
    const weights = buildGenreThemeWeights(makeBareMedia(2, [GENRE_DRAMA, GENRE_SCIFI]), 'movie');
    const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0);

    expect(total).toBeCloseTo(1, 5);
  });

  it('aceita o formato genre_ids dos resultados de listagem', () => {
    const weights = buildGenreThemeWeights({ genre_ids: [GENRE_WAR] }, 'movie');

    expect(weights.has('war-and-conflict')).toBe(true);
  });

  it('devolve vazio quando não há géneros', () => {
    expect(buildGenreThemeWeights({ genres: [] }, 'movie').size).toBe(0);
    expect(buildGenreThemeWeights({}, 'movie').size).toBe(0);
  });
});

describe('buildSourceThemeWeights', () => {
  it('produz perfil temático mesmo sem sinopse nem reviews', () => {
    const weights = buildSourceThemeWeights(makeBareMedia(3, [GENRE_WAR]), [], 'movie', 8);

    expect(weights.size).toBeGreaterThan(0);
  });

  it('combina o sinal textual com o de género', () => {
    const media = {
      id: 4,
      title: 'The Trial',
      overview: 'A study of power, tyranny and corruption inside the state.',
      genres: [{ id: GENRE_WAR, name: 'War' }],
    };

    const weights = buildSourceThemeWeights(media, [], 'movie', 8);

    expect(weights.has('power-corruption')).toBe(true);
    expect(weights.has('war-and-conflict')).toBe(true);
  });
});

describe('resolveQuoteCandidatePool', () => {
  it('completa o lote até ao tamanho alvo quando o corte deixa passar poucas', () => {
    const ranked = rankQuotesForSource(
      CATALOG,
      buildSourceThemeWeights(makeBareMedia(5), [], 'movie', 8),
      { core: [], context: [] }
    );
    const { tier, pool } = resolveQuoteCandidatePool(ranked);

    expect(tier).toBe('weak');
    expect(pool.length).toBe(Math.min(WEAK_POOL_SIZE, CATALOG.length));
  });

  it('não repete autores dentro do lote', () => {
    const ranked = rankQuotesForSource(
      CATALOG,
      buildSourceThemeWeights(makeBareMedia(6), [], 'movie', 8),
      { core: [], context: [] }
    );
    const { pool } = resolveQuoteCandidatePool(ranked);
    const authors = pool.map(quote => quote.author);

    expect(new Set(authors).size).toBe(authors.length);
  });

  it('mantém o lote estreito quando a evidência é forte', () => {
    const ranked = rankQuotesForSource(CATALOG, new Map(), { core: [], context: [] })
      .map(quote => ({ ...quote, _themeScore: 40, _tokenScore: 20 }));
    const { tier, pool } = resolveQuoteCandidatePool(ranked);

    expect(tier).toBe('strong');
    expect(pool.length).toBe(STRONG_POOL_SIZE);
  });
});

describe('selectQuoteForMedia', () => {
  it('devolve sempre a mesma citação para a mesma obra', () => {
    const media = makeBareMedia(550);

    expect(pickQuoteFor(media).quote).toBe(pickQuoteFor(media).quote);
  });

  it('distribui citações diferentes entre obras sem sinal temático', () => {
    // Regressão: antes desta correcção as 24 obras recebiam a mesma citação.
    const picks = Array.from({ length: 24 }, (_, i) => pickQuoteFor(makeBareMedia(1000 + i)).quote);
    const distinct = new Set(picks);

    expect(distinct.size).toBeGreaterThan(1);
    expect(distinct.size).toBeGreaterThanOrEqual(4);
  });

  it('nenhuma citação domina a amostra', () => {
    const picks = Array.from({ length: 24 }, (_, i) => pickQuoteFor(makeBareMedia(2000 + i)).quote);
    const counts = picks.reduce((acc, quote) => {
      acc[quote] = (acc[quote] || 0) + 1;
      return acc;
    }, {});
    const mostRepeated = Math.max(...Object.values(counts));

    expect(mostRepeated).toBeLessThan(picks.length / 2);
  });

  it('anota a camada e o tamanho do lote usados', () => {
    const selected = pickQuoteFor(makeBareMedia(7));

    expect(selected._tier).toBe('weak');
    expect(selected._poolSize).toBeGreaterThan(1);
  });

  it('devolve null para catálogo vazio', () => {
    expect(selectQuoteForMedia([], 'movie:1')).toBeNull();
    expect(selectQuoteForMedia(null, 'movie:1')).toBeNull();
  });

  it('exclui a citação com polegar para baixo quando há alternativa', () => {
    const ranked = rankQuotesForSource(CATALOG, new Map(), { core: [], context: [] });
    const leader = ranked[0];
    const selected = selectQuoteForMedia(
      ranked,
      'movie:1',
      new Map([[String(leader.id), -1]])
    );

    expect(selected.id).not.toBe(leader.id);
    expect(applyQuoteRatingBias(ranked, new Map([[String(leader.id), -1]])))
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: leader.id })]));
  });

  it('privilegia a citação com polegar para cima num empate', () => {
    const tied = [
      { id: 'q1', quote: 'First tied line about virtue.', author: 'Plato', themes: ['virtue'], source: 'custom', _score: 40, _themeScore: 40, _tokenScore: 20 },
      { id: 'q2', quote: 'Second tied line about virtue.', author: 'Aristotle', themes: ['virtue'], source: 'custom', _score: 40, _themeScore: 40, _tokenScore: 20 },
    ];
    const biased = applyQuoteRatingBias(tied, new Map([['q2', 1]]));

    expect(biased[0].id).toBe('q2');
  });
});

describe('home quote selection', () => {
  it('reuses selectQuoteForMedia for the same catalog and day key', () => {
    const dayKey = '2026-09-08';
    const ranked = rankQuotesForSource(CATALOG, new Map(), { core: [], context: [] });
    const fromPipeline = selectQuoteForMedia(ranked, `daily:${dayKey}`);

    expect(selectHomeQuote(CATALOG, dayKey).quote).toBe(fromPipeline.quote);
    expect(selectHomeQuote(CATALOG, dayKey).id).toBe(fromPipeline.id);
  });
});

describe('buildQuoteThemeWeights', () => {
  it('reaproveita o resultado em memória entre chamadas', () => {
    const quote = CATALOG[0];

    expect(buildQuoteThemeWeights(quote)).toBe(buildQuoteThemeWeights(quote));
  });

  it('recalcula depois de limpar a cache', () => {
    const quote = CATALOG[0];
    const before = buildQuoteThemeWeights(quote);
    clearQuoteScoringCache();

    const after = buildQuoteThemeWeights(quote);
    expect(after).not.toBe(before);
    expect([...after.entries()]).toEqual([...before.entries()]);
  });
});

describe('extractTmdbKeywordNames', () => {
  it('lê o formato de filme e o de série', () => {
    expect(extractTmdbKeywordNames({
      keywords: { keywords: [{ id: 4565, name: 'dystopia' }] },
    })).toEqual(['dystopia']);

    expect(extractTmdbKeywordNames({
      keywords: { results: [{ id: 181324, name: 'existentialism' }] },
    })).toEqual(['existentialism']);
  });

  it('entra no contexto textual da obra', () => {
    const context = buildSourceContext({
      title: 'Arrival',
      overview: 'A linguist meets visitors.',
      genres: [{ id: 878, name: 'Science Fiction' }],
      tmdbKeywords: [{ id: 4379, name: 'time travel' }],
    });

    expect(context).toContain('time travel');
    expect(context).toContain('Arrival');
  });
});

describe('preferReviewsByLanguage', () => {
  it('keeps EN/PT and falls back to the only available language', () => {
    expect(preferReviewsByLanguage([
      { content: 'Bonjour', iso_639_1: 'fr' },
      { content: 'Hello', iso_639_1: 'en' },
      { content: 'Olá', iso_639_1: 'pt' },
    ]).map(review => review.iso_639_1)).toEqual(['en', 'pt']);

    expect(preferReviewsByLanguage([
      { content: 'Nur das', iso_639_1: 'de' },
    ])).toEqual([{ content: 'Nur das', iso_639_1: 'de' }]);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
