/** Quote source weights for details-page scoring. */
export const QUOTE_SOURCE_BOOST = {
  custom: 24,
  system: 22,
  database: 20,
  import: 16,
  'database-import': 16,
  'user-submitted': 14,
  wikiquote: 8,
  'wikiquote-en': 8,
  'wikiquote-machine': 5,
};

export const MIN_STRONG_THEME_SCORE = 20;
export const MIN_STRONG_TOKEN_SCORE = 8;
export const MIN_DECENT_SCORE = 34;
export const MIN_DECENT_THEME_SCORE = 14;
export const MIN_DECENT_TOKEN_SCORE = 10;

/** Max related works returned on the details page. */
export const DETAILS_RELATED_WORKS_LIMIT = 6;

export const GENERIC_QUOTE_PATTERNS = [
  /\b(life|world|people|things|everything|nothing)\s+(is|are)\s+(good|bad|beautiful|important|difficult|simple)\b/i,
  /\b(always|never)\s+(be|do|say|think|remember)\b/i,
  /\b(be yourself|follow your dreams|think positive|never give up)\b/i,
];

/** First-token slug of author name → preferred lens theme ids. */
export const AUTHOR_LENS_MAP = {
  descartes: ['consciousness-ai', 'technology-modernity', 'epistemology', 'idealism'],
  nietzsche: ['consciousness-ai', 'power-corruption', 'existentialism', 'self-knowledge'],
  dennett: ['consciousness-ai', 'technology-modernity'],
  turing: ['consciousness-ai', 'technology-modernity'],
  kierkegaard: ['self-knowledge', 'alienation', 'conformity-individuality', 'existentialism'],
  sartre: ['self-knowledge', 'alienation', 'conformity-individuality', 'existentialism'],
  camus: ['self-knowledge', 'alienation', 'existentialism'],
  fromm: ['self-knowledge', 'alienation', 'social-justice'],
  marx: ['social-justice', 'political-philosophy', 'marxism-socialism', 'power-corruption'],
  rawls: ['social-justice', 'political-philosophy', 'social-contract'],
  arendt: ['social-justice', 'political-philosophy', 'power-corruption'],
  foucault: ['power-corruption', 'social-justice', 'political-philosophy'],
  hobbes: ['power-corruption', 'political-philosophy', 'social-contract'],
  machiavelli: ['power-corruption', 'political-philosophy'],
};

export const NOISE_WORDS = new Set([
  'about', 'after', 'alive', 'along', 'already', 'another', 'around', 'away',
  'because', 'before', 'become', 'becomes', 'becoming', 'beginning', 'between',
  'business', 'character', 'characters', 'city', 'family', 'father', 'find',
  'finds', 'following', 'friend', 'friends', 'girl', 'girls', 'group', 'help',
  'helps', 'home', 'japan', 'journey', 'life', 'lives', 'mother', 'movie',
  'movies', 'must', 'older', 'ordinary', 'school', 'series', 'show', 'story',
  'student', 'students', 'takes', 'their', 'there', 'these', 'through', 'time',
  'tries', 'trying', 'under', 'while', 'world', 'years', 'young',
]);

/** Stopwords when mining philosopher profile text for discovery keywords (bio + quotes). */
export const PHILOSOPHER_CONTEXT_STOPWORDS = new Set([
  'about', 'across', 'after', 'always', 'appears', 'around', 'before', 'being',
  'between', 'beyond', 'collection', 'connected', 'discipline', 'examination',
  'experience', 'inside', 'layer', 'media', 'philosopher', 'philosophical',
  'thinker',
  'philosophy', 'practice', 'presence', 'questions', 'reading', 'readings',
  'resonates', 'shape', 'shapes', 'site', 'stories', 'story', 'their', 'these',
  'through', 'title', 'titles', 'voice', 'works', 'world', 'would',
  'american', 'brazilian', 'british', 'chinese', 'french', 'german', 'greek',
  'english', 'italian', 'writer', 'poet', 'educator', 'teacher', 'politician',
  'statesman', 'psychologist', 'scientist', 'physicist', 'mathematician',
  'archive', 'independent',
]);
