/** Philosophical lens presets for the search page (themes, keywords, TMDB genre hints). */
export const LENS_FILTERS = [
  {
    id: 'epistemology',
    label: 'Truth & Knowledge',
    summary: 'Works shaped by doubt, evidence, hidden truths, and uncertainty.',
    themes: ['epistemology', 'truth-deception'],
    keywords: ['truth', 'knowledge', 'doubt', 'deception', 'evidence'],
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
    movieGenres: [18, 9648, 878],
    tvGenres: [18, 9648, 10765, 16],
  },
  {
    id: 'power-corruption',
    label: 'Power',
    summary: 'Power struggles, political decay, and the cost of control.',
    themes: ['power-corruption', 'political-philosophy'],
    keywords: ['power', 'corruption', 'control', 'authority', 'ambition'],
    movieGenres: [18, 80, 53, 10752],
    tvGenres: [18, 80, 10768, 10759],
  },
  {
    id: 'stoicism',
    label: 'Resilience',
    summary: 'Works about endurance, discipline, adversity, and inner strength.',
    themes: ['stoicism', 'suffering', 'heros-journey', 'virtue'],
    keywords: ['resilience', 'endure', 'adversity', 'discipline', 'strength', 'survival', 'courage'],
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
    movieGenres: [9648, 18],
    tvGenres: [9648, 18, 10765, 16],
  },
  {
    id: 'alienation',
    label: 'Alienation',
    summary: 'Works about isolation, disconnection, outsiders, and belonging.',
    themes: ['alienation', 'conformity-individuality'],
    keywords: ['alienation', 'isolation', 'outsider', 'belonging', 'society'],
    movieGenres: [18, 878, 9648],
    tvGenres: [18, 9648, 10765],
  },
  {
    id: 'social-justice',
    label: 'Justice & Society',
    summary: 'Stories about inequality, rights, oppression, and social order.',
    themes: ['social-justice', 'political-philosophy'],
    keywords: ['justice', 'inequality', 'rights', 'society', 'oppression'],
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
    movieGenres: [878, 9648],
    tvGenres: [10765, 9648],
  },
  {
    id: 'utopia-dystopia',
    label: 'Utopia & Dystopia',
    summary: 'Worlds shaped by control, rebellion, ideal societies, and collapse.',
    themes: ['utopia-dystopia', 'power-corruption'],
    keywords: ['utopia', 'dystopia', 'control', 'rebellion', 'society'],
    movieGenres: [878, 9648, 28],
    tvGenres: [10765, 10768, 10759],
  },
  {
    id: 'freedom-choice',
    label: 'Freedom & Choice',
    summary: 'Stories about free will, consequence, destiny, and moral responsibility.',
    themes: ['existentialism', 'stoicism', 'political-philosophy'],
    keywords: ['freedom', 'choice', 'responsibility', 'destiny', 'liberty', 'fate'],
    movieGenres: [18, 878, 53],
    tvGenres: [18, 10765, 9648],
  },
  {
    id: 'faith-spirituality',
    label: 'Faith & Spirituality',
    summary: 'Works that explore belief, transcendence, ritual, and the sacred.',
    themes: ['sacred-profane', 'metaphysics', 'truth-deception'],
    keywords: ['faith', 'spiritual', 'divine', 'sacred', 'ritual', 'transcendence'],
    movieGenres: [18, 14, 9648],
    tvGenres: [18, 10765, 9648],
  },
  {
    id: 'humanism',
    label: 'Humanism',
    summary: 'Works centered on dignity, empathy, compassion, and human potential.',
    themes: ['humanism', 'virtue', 'the-other-alterity'],
    keywords: ['humanity', 'dignity', 'compassion', 'empathy', 'human', 'hope'],
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
