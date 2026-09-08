/**
 * IDs oficiais do vocabulário de keywords do TMDB, conferidos via
 * GET /search/keyword. `with_keywords` no discover usa `|` (OR).
 */
export function getLensKeywordQuery(lens) {
  const ids = (lens?.tmdbKeywords || [])
    .map(item => Number(item?.id))
    .filter(id => Number.isInteger(id) && id > 0);
  return ids.join('|');
}

export function getLensExcludeKeywordQuery(lens) {
  const ids = (lens?.tmdbExcludeKeywords || [])
    .map(item => Number(item?.id))
    .filter(id => Number.isInteger(id) && id > 0);
  return ids.join('|');
}

/** Termos para scoring de texto: keywords livres + nomes canônicos do TMDB. */
export function getLensTextKeywords(lens) {
  const named = (lens?.tmdbKeywords || []).map(item => item?.name).filter(Boolean);
  return [...new Set([...(lens?.keywords || []), ...named])];
}

/**
 * Opções de /discover para uma lente. Sem gêneros: o pool já vem
 * tematicamente pré-filtrado pela curadoria do TMDB.
 */
export function buildLensKeywordDiscoverOptions(lens, extras = {}) {
  const options = { ...extras };
  const withKeywords = getLensKeywordQuery(lens);
  if (withKeywords) options.withKeywords = withKeywords;
  const withoutKeywords = getLensExcludeKeywordQuery(lens);
  if (withoutKeywords) options.withoutKeywords = withoutKeywords;
  return options;
}

export function buildLensGenreDiscoverOptions(lens, mediaType, extras = {}) {
  const genres = mediaType === 'tv' ? lens?.tvGenres : lens?.movieGenres;
  const options = { ...extras };
  if (Array.isArray(genres) && genres.length) {
    options.withGenres = genres.join('|');
  }
  const withoutKeywords = getLensExcludeKeywordQuery(lens);
  if (withoutKeywords) options.withoutKeywords = withoutKeywords;
  return options;
}

/** Philosophical lens presets for the search page (themes, keywords, TMDB genre hints). */
export const LENS_FILTERS = [
  {
    id: 'epistemology',
    label: 'Truth & Knowledge',
    summary: 'Works shaped by doubt, evidence, hidden truths, and uncertainty.',
    themes: ['epistemology', 'truth-deception'],
    keywords: ['truth', 'knowledge', 'doubt', 'deception', 'evidence'],
    tmdbKeywords: [
      { id: 490, name: 'philosophy' },
      { id: 10410, name: 'conspiracy' },
      { id: 9758, name: 'deception' },
      { id: 5340, name: 'investigation' },
    ],
    movieGenres: [9648, 878, 53],
    tvGenres: [9648, 80, 18, 10765],
  },
  {
    id: 'self-knowledge',
    label: 'Identity',
    summary: 'Stories about self-discovery, fractured selves, and inner reflection.',
    themes: ['self-knowledge', 'existentialism'],
    keywords: [
      'identity', 'self', 'reflection', 'persona', 'introspection', 'authenticity',
      'belonging', 'mask', 'transformation', 'self-discovery', 'who am i',
    ],
    tmdbKeywords: [
      { id: 3394, name: 'identity crisis' },
      { id: 9181, name: 'alter ego' },
      { id: 10683, name: 'coming of age' },
    ],
    movieGenres: [18, 9648, 878],
    tvGenres: [18, 9648, 10765, 16],
  },
  {
    id: 'power-corruption',
    label: 'Power',
    summary: 'Power struggles, political decay, and the cost of control.',
    themes: ['power-corruption', 'political-philosophy'],
    keywords: ['power', 'corruption', 'control', 'authority', 'ambition'],
    tmdbKeywords: [
      { id: 417, name: 'corruption' },
      { id: 7606, name: 'dictatorship' },
      { id: 178712, name: 'totalitarianism' },
    ],
    movieGenres: [18, 80, 53, 10752],
    tvGenres: [18, 80, 10768, 10759],
  },
  {
    id: 'stoicism',
    label: 'Resilience',
    summary: 'Works about endurance, discipline, adversity, and inner strength.',
    themes: ['stoicism', 'suffering', 'heros-journey', 'virtue'],
    keywords: ['resilience', 'endure', 'adversity', 'discipline', 'strength', 'survival', 'courage'],
    tmdbKeywords: [
      { id: 10349, name: 'survival' },
      { id: 216923, name: 'perseverance' },
    ],
    movieGenres: [18, 12, 28, 10752],
    tvGenres: [18, 10759, 10768, 16],
  },
  {
    id: 'memory-time',
    label: 'Memory & Time',
    summary: 'Narratives that orbit memory, regret, time, and perception.',
    themes: ['memory-time', 'metaphysics'],
    keywords: [
      'memory', 'memories', 'time', 'past', 'future', 'regret', 'nostalgia', 'forgotten',
      'remember', 'loop', 'timeline', 'flashback', 'amnesia', 'time travel',
    ],
    tmdbKeywords: [
      { id: 10937, name: 'memory' },
      { id: 1453, name: 'amnesia' },
      { id: 4379, name: 'time travel' },
      { id: 10854, name: 'time loop' },
    ],
    movieGenres: [9648, 18],
    tvGenres: [9648, 18, 10765, 16],
  },
  {
    id: 'alienation',
    label: 'Alienation',
    summary: 'Works about isolation, disconnection, outsiders, and belonging.',
    themes: ['alienation', 'conformity-individuality'],
    keywords: ['alienation', 'isolation', 'outsider', 'belonging', 'society'],
    tmdbKeywords: [
      { id: 7368, name: 'alienation' },
      { id: 9957, name: 'loneliness' },
      { id: 1533, name: 'isolation' },
    ],
    movieGenres: [18, 878, 9648],
    tvGenres: [18, 9648, 10765],
  },
  {
    id: 'social-justice',
    label: 'Justice & Society',
    summary: 'Stories about inequality, rights, oppression, and social order.',
    themes: ['social-justice', 'political-philosophy'],
    keywords: ['justice', 'inequality', 'rights', 'society', 'oppression'],
    tmdbKeywords: [
      { id: 14514, name: 'class differences' },
      { id: 11479, name: 'social commentary' },
      { id: 12987, name: 'poverty' },
      { id: 163119, name: 'injustice' },
      { id: 154954, name: 'social injustice' },
    ],
    movieGenres: [18, 80, 99, 10752],
    tvGenres: [18, 80, 10768, 99],
  },
  {
    id: 'consciousness-ai',
    label: 'Consciousness & AI',
    summary: 'Works that question mind, humanity, technology, and sentience.',
    themes: ['consciousness-ai', 'technology-modernity'],
    keywords: [
      'consciousness', 'sentience', 'mind', 'ai', 'android', 'robot', 'machine',
      'humanity', 'synthetic', 'simulation', 'virtual', 'digital',
    ],
    tmdbKeywords: [
      { id: 310, name: 'artificial intelligence (a.i.)' },
      { id: 378084, name: 'artificial intelligence' },
      { id: 803, name: 'android' },
      { id: 14544, name: 'robot' },
      { id: 161219, name: 'consciousness' },
      { id: 8469, name: 'computer simulation' },
    ],
    tmdbExcludeKeywords: [
      { id: 9715, name: 'superhero' },
      { id: 180547, name: 'marvel cinematic universe (mcu)' },
    ],
    movieGenres: [878, 9648],
    tvGenres: [10765, 9648],
  },
  {
    id: 'utopia-dystopia',
    label: 'Utopia & Dystopia',
    summary: 'Worlds shaped by control, rebellion, ideal societies, and collapse.',
    themes: ['utopia-dystopia', 'power-corruption'],
    keywords: ['utopia', 'dystopia', 'control', 'rebellion', 'society'],
    tmdbKeywords: [
      { id: 4565, name: 'dystopia' },
      { id: 3469, name: 'utopia' },
      { id: 178712, name: 'totalitarianism' },
      { id: 18420, name: 'surveillance' },
      { id: 11196, name: 'rebellion' },
    ],
    movieGenres: [878, 9648, 28],
    tvGenres: [10765, 10768, 10759],
  },
  {
    id: 'freedom-choice',
    label: 'Freedom & Choice',
    summary: 'Stories about free will, consequence, destiny, and moral responsibility.',
    themes: ['existentialism', 'stoicism', 'political-philosophy'],
    keywords: ['freedom', 'choice', 'responsibility', 'destiny', 'liberty', 'fate'],
    tmdbKeywords: [
      { id: 18091, name: 'free will' },
      { id: 10855, name: 'fate' },
      { id: 198423, name: 'moral dilemma' },
      { id: 181324, name: 'existentialism' },
    ],
    movieGenres: [18, 878, 53],
    tvGenres: [18, 10765, 9648],
  },
  {
    id: 'faith-spirituality',
    label: 'Faith & Spirituality',
    summary: 'Works that explore belief, transcendence, ritual, and the sacred.',
    themes: ['sacred-profane', 'metaphysics', 'truth-deception'],
    keywords: ['faith', 'spiritual', 'divine', 'sacred', 'ritual', 'transcendence'],
    tmdbKeywords: [
      { id: 11001, name: 'religion' },
      { id: 6150, name: 'faith' },
      { id: 10706, name: 'spirituality' },
      { id: 6155, name: 'afterlife' },
    ],
    movieGenres: [18, 14, 9648],
    tvGenres: [18, 10765, 9648],
  },
  {
    id: 'humanism',
    label: 'Humanism',
    summary: 'Works centered on dignity, empathy, compassion, and human potential.',
    themes: ['humanism', 'virtue', 'the-other-alterity'],
    keywords: ['humanity', 'dignity', 'compassion', 'empathy', 'human', 'hope'],
    tmdbKeywords: [
      { id: 202647, name: 'humanity' },
      { id: 18454, name: 'compassion' },
    ],
    movieGenres: [18, 12, 16],
    tvGenres: [18, 16, 10759],
  },
];

export const MEDIA_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'movie', label: 'Movies' },
  { id: 'tv', label: 'Series' },
];

export const RATING_FILTERS = [
  { id: 'any', label: 'Any rating', min: 0 },
  { id: '7plus', label: '7+ TMDB', min: 7 },
  { id: '8plus', label: '8+ TMDB', min: 8 },
];

export const SORT_FILTERS = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'rating', label: 'Highest rated' },
  { id: 'recent', label: 'Newest' },
  { id: 'popularity', label: 'Most popular' },
];

export function getLensById(lensId) {
  return LENS_FILTERS.find(lens => lens.id === lensId) || null;
}

export function getRatingFilterById(ratingId) {
  return RATING_FILTERS.find(filter => filter.id === ratingId) || RATING_FILTERS[0];
}

/** Short set shown by default on the search page; the rest sit behind “see all”. */
export const FEATURED_LENS_IDS = Object.freeze([
  'epistemology',
  'power-corruption',
  'alienation',
  'consciousness-ai',
  'freedom-choice',
]);

export function isFeaturedLensId(lensId) {
  return FEATURED_LENS_IDS.includes(lensId);
}

export function isLensChipVisible(lensId, { expanded = false, activeLensId = 'all' } = {}) {
  if (expanded || isFeaturedLensId(lensId)) return true;
  return Boolean(lensId) && lensId !== 'all' && lensId === activeLensId;
}

export function partitionLensFilters(lenses = LENS_FILTERS) {
  const featured = FEATURED_LENS_IDS
    .map(id => lenses.find(lens => lens.id === id))
    .filter(Boolean);
  const rest = lenses.filter(lens => !FEATURED_LENS_IDS.includes(lens.id));
  return { featured, rest };
}

/**
 * Write or drop `lens` while preserving every other query param.
 * @param {string} search `location.search` (`?a=1&lens=x` or `a=1`)
 * @param {string} lensId lens id, or `'all'` / `''` to remove
 */
export function withLensQueryParam(search, lensId) {
  const raw = String(search || '').replace(/^\?/, '');
  const params = new URLSearchParams(raw);

  if (lensId && lensId !== 'all') {
    params.set('lens', lensId);
  } else {
    params.delete('lens');
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}
