import {
  buildPhilosopherProfiles,
  getDisplayAuthorName,
  getPhilosopherDefinitionByAuthor,
  getPhilosopherProfileBySlug,
  getPhilosopherUrlByAuthor,
} from '../../public/scripts/philosopher-data.js';

describe('philosopher data helpers', () => {
  test('normalizes mojibake author names to the canonical philosopher profile', () => {
    const definition = getPhilosopherDefinitionByAuthor('NiccolÃ² Machiavelli');

    expect(definition).toEqual(expect.objectContaining({
      slug: 'niccolo-machiavelli',
      name: 'Niccolò Machiavelli',
    }));
    expect(getDisplayAuthorName('NiccolÃ² Machiavelli')).toBe('Niccolò Machiavelli');
  });

  test('returns a philosopher URL when the author belongs to the curated collection', () => {
    expect(getPhilosopherUrlByAuthor('Lucas C. Roxo')).toBe('/html/philosopher.html?slug=lucas-costa-roxo');
    expect(getPhilosopherUrlByAuthor('Unknown Thinker')).toBe('/html/philosopher.html?slug=unknown-thinker');
  });

  test('builds philosopher profiles by grouping aliases, themes, and linked works', () => {
    const profiles = buildPhilosopherProfiles([
      {
        id: 1016,
        quote: 'It is better to be feared than loved, if you cannot be both.',
        author: 'NiccolÃ² Machiavelli',
        themes: ['political-philosophy', 'power-corruption'],
      },
      {
        id: 1018,
        quote: 'Never attempt to win by force what can be won by deception.',
        author: 'Niccolo Machiavelli',
        themes: ['truth-deception', 'power-corruption'],
      },
    ]);

    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toEqual(expect.objectContaining({
      slug: 'niccolo-machiavelli',
      name: 'Niccolò Machiavelli',
      quoteCount: 2,
      linkedWorkCount: 2,
    }));
    expect(profiles[0].topThemes[0]).toBe('power-corruption');
    expect(profiles[0].lenses.map(lens => lens.id)).toContain('power-corruption');
  });

  test('resolves philosopher detail pages by slug from the aggregated quote collection', () => {
    const quotes = [
      {
        id: 1035,
        quote: 'Love is the project of building a common world.',
        author: 'ClÃ³vis de Barros Filho',
        themes: ['love', 'community', 'social-contract'],
      },
      {
        id: 1034,
        quote: 'The only possible freedom is to know the determinations that act upon you.',
        author: 'Clóvis de Barros Filho',
        themes: ['determinism', 'freedom', 'self-knowledge'],
      },
    ];

    const profile = getPhilosopherProfileBySlug(quotes, 'clovis-de-barros-filho');

    expect(profile).toEqual(expect.objectContaining({
      name: 'Clóvis de Barros Filho',
      quoteCount: 2,
    }));
    expect(profile.lenses.map(lens => lens.id)).toEqual(
      expect.arrayContaining(['self-knowledge'])
    );
    expect(getPhilosopherProfileBySlug(quotes, 'missing-slug')).toBeNull();
  });

  test('creates a dynamic philosopher profile for authors outside the curated overrides', () => {
    const profile = getPhilosopherProfileBySlug([
      {
        id: 'wiki-1',
        quote: 'Sapere aude.',
        author: 'Immanuel Kant',
        themes: ['epistemology', 'idealism'],
      },
      {
        id: 'wiki-2',
        quote: 'Two things fill the mind with ever new admiration and awe.',
        author: 'Immanuel Kant',
        themes: ['metaphysics', 'ethics'],
      },
    ], 'immanuel-kant');

    expect(profile).toEqual(expect.objectContaining({
      slug: 'immanuel-kant',
      name: 'Immanuel Kant',
      quoteCount: 2,
    }));
    expect(profile.summary).toContain('Immanuel Kant');
  });

  test('prioritizes Darwin around science and evolution instead of generic metaphysics', () => {
    const profile = getPhilosopherProfileBySlug([
      {
        id: 'darwin-1',
        quote: 'A man who dares to waste one hour of time has not discovered the value of life.',
        author: 'Charles Darwin',
        themes: ['evolucao', 'selecao natural'],
      },
      {
        id: 'darwin-2',
        quote: 'In the long history of humankind, those who learned to collaborate and improvise most effectively have prevailed.',
        author: 'Darwin',
        themes: ['biology', 'scientific inquiry'],
      },
    ], 'charles-darwin');

    expect(profile).toEqual(expect.objectContaining({
      slug: 'charles-darwin',
      name: 'Charles Darwin',
      quoteCount: 2,
    }));
    expect(profile.topThemes[0]).toBe('epistemology');
    expect(profile.focus).toContain('natural selection');
    expect(profile.contextKeywords).toEqual(expect.arrayContaining(['evolution', 'biology', 'natural selection']));
  });

  test('normalizes translated wikiquote themes into English canonical labels', () => {
    const profile = getPhilosopherProfileBySlug([
      {
        id: 'wiki-10',
        quote: 'Life is a kind of Chess, in which we have often points to gain, and competitors or adversaries to contend with.',
        author: 'Benjamin Franklin',
        themes: ['política e ciência'],
      },
      {
        id: 'wiki-11',
        quote: 'Lost time is never found again.',
        author: 'Benjamin Franklin',
        themes: ['matemática e filosofia'],
      },
    ], 'benjamin-franklin');

    expect(profile).toEqual(expect.objectContaining({
      name: 'Benjamin Franklin',
      needsReferenceMetadata: true,
    }));
    expect(profile.topThemes).toEqual(expect.arrayContaining(['political-philosophy', 'epistemology']));
    expect(profile.themeLabels).toEqual(expect.arrayContaining(['Political Philosophy', 'Epistemology']));
    expect(profile.quotes[0].themes).toContain('political-philosophy');
    expect(profile.quotes[1].themes).toContain('epistemology');
  });

  test('estimates related work counts for thematic philosophers without curated links', () => {
    const profile = getPhilosopherProfileBySlug([
      {
        id: 'wiki-12',
        quote: 'Art washes away from the soul the dust of everyday life.',
        author: 'Pablo Picasso',
        themes: ['aesthetics'],
      },
      {
        id: 'wiki-13',
        quote: 'Every act of creation is first an act of destruction.',
        author: 'Pablo Picasso',
        themes: ['aesthetics', 'romanticism'],
      },
    ], 'pablo-picasso');

    expect(profile.linkedWorkCount).toBeGreaterThan(0);
  });

  test('merges submitted philosopher metadata into dynamically built profiles', () => {
    const profile = getPhilosopherProfileBySlug(
      [
        {
          id: 'user-1',
          quote: 'One must imagine Sisyphus happy.',
          author: 'Albert Camus',
          themes: ['existentialism', 'resilience'],
        },
        {
          id: 'user-2',
          quote: 'The struggle itself toward the heights is enough to fill a man’s heart.',
          author: 'Camus',
          themes: ['existentialism'],
        },
      ],
      'albert-camus',
      [],
      [
        {
          slug: 'albert-camus',
          name: 'Albert Camus',
          period: '20th-century France · 1913-1960',
          summary: 'Camus explores absurdity, revolt, and lucid endurance.',
          focus: 'He connects to works about meaning, rebellion, and resilience.',
          aliases: ['Camus'],
          wikiTitle: 'Albert Camus',
        },
      ]
    );

    expect(profile).toEqual(expect.objectContaining({
      name: 'Albert Camus',
      quoteCount: 2,
      period: '20th-century France · 1913-1960',
    }));
    expect(profile.summary).toContain('absurdity');
    expect(profile.focus).toContain('resilience');
  });
});
