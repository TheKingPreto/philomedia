/**
 * Fonte única das 12 lentes filosóficas.
 * A busca (`LENS_FILTERS`) e os pensadores (`LENS_DEFINITIONS`) derivam daqui:
 * não duplique labels/ids. Temas são a união do que a busca e os pensadores
 * já usavam, para nenhum dos dois lados perder sinal.
 *
 * IDs de `tmdbKeywords` conferidos via GET /search/keyword.
 * IDs de `LENS_CREW_DIRECTORS` conferidos via GET /search/person.
 */
export const LENS_CATALOG = [
  {
    id: 'epistemology',
    label: 'Truth & Knowledge',
    summary: 'Works shaped by doubt, evidence, hidden truths, and uncertainty.',
    themes: ['epistemology', 'truth-deception', 'self-knowledge'],
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
    themes: ['self-knowledge', 'existentialism', 'identity'],
    keywords: [
      'identity', 'self', 'reflection', 'persona', 'introspection', 'authenticity',
      'belonging', 'mask', 'transformation', 'self-discovery', 'who am i',
    ],
    tmdbKeywords: [
      { id: 3394, name: 'identity crisis' },
      { id: 9181, name: 'alter ego' },
      { id: 10683, name: 'coming of age' },
      { id: 1284, name: 'identity' },
      { id: 2796, name: 'self-discovery' },
      { id: 305104, name: 'introspection' },
      { id: 161891, name: 'doppelgänger' },
      { id: 312677, name: 'existential crisis' },
    ],
    movieGenres: [18, 9648, 878],
    tvGenres: [18, 9648, 10765, 16],
  },
  {
    id: 'power-corruption',
    label: 'Power',
    summary: 'Power struggles, political decay, and the cost of control.',
    themes: ['power-corruption', 'political-philosophy', 'social-justice'],
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
    themes: ['alienation', 'conformity-individuality', 'technology-modernity'],
    keywords: ['alienation', 'isolation', 'outsider', 'belonging', 'society'],
    tmdbKeywords: [
      { id: 7368, name: 'alienation' },
      { id: 9957, name: 'loneliness' },
      { id: 1533, name: 'isolation' },
      { id: 350828, name: 'workplace alienation' },
      { id: 382878, name: 'social alienation' },
      { id: 230841, name: 'anomie' },
      { id: 218174, name: 'social isolation' },
      { id: 190742, name: 'solitude' },
      { id: 170356, name: 'outsider' },
    ],
    movieGenres: [18, 878, 9648],
    tvGenres: [18, 9648, 10765],
  },
  {
    id: 'social-justice',
    label: 'Justice & Society',
    summary: 'Stories about inequality, rights, oppression, and social order.',
    themes: ['social-justice', 'political-philosophy', 'feminism-equality', 'social-contract', 'community'],
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
    themes: ['consciousness-ai', 'technology-modernity', 'metaphysics', 'postmodernism'],
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
    themes: ['utopia-dystopia', 'power-corruption', 'marxism-socialism'],
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
    themes: ['sacred-profane', 'metaphysics', 'truth-deception', 'humanism', 'spirituality'],
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
    themes: ['humanism', 'virtue', 'the-other-alterity', 'ethics', 'community', 'happiness'],
    keywords: ['humanity', 'dignity', 'compassion', 'empathy', 'human', 'hope'],
    tmdbKeywords: [
      { id: 202647, name: 'humanity' },
      { id: 18454, name: 'compassion' },
      { id: 211062, name: 'ethics' },
      { id: 15120, name: 'kindness' },
      { id: 257412, name: 'human nature' },
      { id: 181834, name: 'empathy' },
      { id: 208666, name: 'dignity' },
      { id: 231729, name: 'humanism' },
      { id: 229949, name: 'altruism' },
    ],
    movieGenres: [18, 12, 16],
    tvGenres: [18, 16, 10759],
  },
];

/**
 * Diretores como reforço de lente via discover `with_crew`.
 * Não substitui keywords: a 1ª leva continua `with_keywords`; crew é 2ª leva (OR).
 */
export const LENS_CREW_DIRECTORS = [
  { id: 8452, name: 'Andrei Tarkovsky', lenses: ['alienation', 'faith-spirituality', 'memory-time'] },
  { id: 525, name: 'Christopher Nolan', lenses: ['memory-time', 'epistemology', 'freedom-choice'] },
  { id: 5026, name: 'Akira Kurosawa', lenses: ['humanism', 'social-justice', 'stoicism'] },
];

export function getLensDefinitionFields(lens) {
  return {
    id: lens.id,
    label: lens.label,
    themes: [...(lens.themes || [])],
  };
}

export const LENS_DEFINITIONS = LENS_CATALOG.map(getLensDefinitionFields);
