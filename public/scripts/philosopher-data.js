import { analyzeWorkForThemes } from './hermeneutics.js';
import { THEME_DATABASE } from './themedatabase.js';
import { curatedQuoteMatches } from './curatedmatches.js';

export const CURATED_TV_IDS = new Set([
  '1396', '1399', '1402', '1668', '2316', '4607', '1418', '60735', '1429',
  '60625', '19885', '63174', '119051', '71446', '57243', '1104', '456',
  '1438', '70523', '1424', '1408', '62560', '1407', '1991', '9322', '43865',
  '88751', '128', '46260', '46298', '395',
]);

export const PHILOSOPHER_DEFINITIONS = [
  {
    slug: 'socrates',
    name: 'Socrates',
    period: 'Classical Greece · 470-399 BCE',
    summary: 'Socratic thought turns philosophy into a lived practice of questioning, humility, and ethical self-examination.',
    focus: 'His presence in PhiloMedia revolves around virtue, ignorance, and the discipline of examining life before acting.',
    aliases: ['Socrates'],
    featuredQuoteId: 1001,
  },
  {
    slug: 'plato',
    name: 'Plato',
    period: 'Classical Greece · 428-348 BCE',
    summary: 'Plato frames philosophy as a search for truth beyond appearances, pairing political reflection with questions about knowledge and the soul.',
    focus: 'Across the site, Plato tends to surface where stories wrestle with truth, light, leadership, and the cost of remaining in illusion.',
    aliases: ['Plato'],
    featuredQuoteId: 1008,
  },
  {
    slug: 'aristotle',
    name: 'Aristotle',
    period: 'Classical Greece · 384-322 BCE',
    summary: 'Aristotle centers habit, practical reason, and the idea that character is built through repeated action rather than sudden revelation.',
    focus: 'His quotes in PhiloMedia often anchor stories about reflection, excellence, flourishing, and the ethics of everyday decisions.',
    aliases: ['Aristotle'],
    featuredQuoteId: 1015,
  },
  {
    slug: 'niccolo-machiavelli',
    name: 'Niccolò Machiavelli',
    period: 'Renaissance Italy · 1469-1527',
    summary: 'Machiavelli studies power without sentimentality, watching how image, fear, strategy, and necessity shape public life.',
    focus: 'In the site\'s matches, he appears when stories investigate authority, manipulation, survival, and the gap between appearance and reality.',
    aliases: ['Niccolò Machiavelli', 'Niccolo Machiavelli', 'NiccolÃ² Machiavelli'],
    featuredQuoteId: 1016,
  },
  {
    slug: 'john-locke',
    name: 'John Locke',
    period: 'Early Modern England · 1632-1704',
    summary: 'Locke anchors knowledge in experience and treats understanding as something built through contact with the world.',
    focus: 'His quotes here usually accompany stories of learning, perception, and the slow construction of certainty from lived experience.',
    aliases: ['John Locke'],
    featuredQuoteId: 1045,
  },
  {
    slug: 'charles-darwin',
    name: 'Charles Darwin',
    period: 'Victorian England · 1809-1882',
    summary: 'Darwin reshapes modern thought through evolution, adaptation, observation of living systems, and the patient work of scientific inference.',
    focus: 'In PhiloMedia, Darwin should connect most strongly with stories about biology, natural selection, scientific discovery, species, survival, and humanity\'s place in nature.',
    aliases: ['Charles Darwin', 'Darwin'],
    priorityThemes: ['epistemology', 'humanism', 'truth-deception', 'technology-modernity'],
    contextKeywords: [
      'evolution',
      'evolutionary',
      'adaptation',
      'species',
      'biology',
      'natural selection',
      'natural history',
      'origin of species',
      'scientific discovery',
      'scientific inquiry',
      'scientific method',
      'scientist',
      'research',
      'experiment',
      'nature',
      'naturalist',
      'organism',
      'inheritance',
      'mutation',
      'ecosystem',
      'expedition',
      'galapagos',
      'beagle',
      'observation',
      'science',
      'investigation'
    ],
    contextPenaltyKeywords: [
      'lawyer',
      'attorney',
      'courtroom',
      'police',
      'rookie',
      'con man',
      'cartel',
      'legal drama',
      'office comedy',
      'doctor',
      'medical',
      'hospital',
      'prosecutor'
    ],
    discoveryQueries: ['evolution', 'natural selection', 'biology', 'scientific discovery'],
    relatedWorkThreshold: 30,
  },
  {
    slug: 'karl-marx',
    name: 'Karl Marx',
    period: '19th-century Germany · 1818-1883',
    summary: 'Marx reads society through labor, class struggle, alienation, and the structures that make inequality feel natural.',
    focus: 'PhiloMedia uses Marx most often when films and series expose exploitation, ideology, or the social systems hiding behind everyday life.',
    aliases: ['Karl Marx'],
    featuredQuoteId: 1022,
  },
  {
    slug: 'friedrich-nietzsche',
    name: 'Friedrich Nietzsche',
    period: '19th-century Germany · 1844-1900',
    summary: 'Nietzsche pushes thought toward self-overcoming, purpose, and the search for meaning inside suffering rather than outside it.',
    focus: 'His page leans into resilience, existential pressure, and the kind of works that turn crisis into a test of values.',
    aliases: ['Friedrich Nietzsche', 'Nietzsche'],
    featuredQuoteId: 1027,
  },
  {
    slug: 'simone-de-beauvoir',
    name: 'Simone de Beauvoir',
    period: '20th-century France · 1908-1986',
    summary: 'De Beauvoir joins freedom to responsibility, insisting that identity is formed historically, socially, and through action.',
    focus: 'Within PhiloMedia, she connects to stories about becoming, equality, gender, and the urgency of choosing a life in the present.',
    aliases: ['Simone de Beauvoir'],
    featuredQuoteId: 1043,
  },
  {
    slug: 'clovis-de-barros-filho',
    name: 'Clóvis de Barros Filho',
    period: 'Contemporary Brazil',
    summary: 'Clóvis de Barros Filho translates ethics, coexistence, and happiness into vivid reflections on daily life and shared worlds.',
    focus: 'His matches tend to favor works about freedom, affection, common life, and the fragile moments where happiness becomes visible.',
    aliases: ['Clóvis de Barros Filho', 'Clovis de Barros Filho', 'ClÃ³vis de Barros Filho'],
    featuredQuoteId: 1035,
  },
  {
    slug: 'leandro-karnal',
    name: 'Leandro Karnal',
    period: 'Contemporary Brazil',
    summary: 'Karnal often turns philosophy toward interior life, confronting loneliness, vitality, prudence, and the courage to build hope.',
    focus: 'On the site, he resonates most with works about endurance, self-knowledge, and the active work of remaining alive to experience.',
    aliases: ['Leandro Karnal'],
    featuredQuoteId: 1039,
  },
  {
    slug: 'mario-sergio-cortella',
    name: 'Mário Sergio Cortella',
    period: 'Contemporary Brazil',
    summary: 'Cortella\'s voice joins ethics, leadership, spirituality, and practical wisdom without losing sight of ordinary human limits.',
    focus: 'He tends to connect with stories about purpose, excellence, coexistence, and the attempt to align what one wants, should do, and can do.',
    aliases: ['Mário Sergio Cortella', 'Mario Sergio Cortella', 'MÃ¡rio Sergio Cortella'],
    featuredQuoteId: 1047,
  },
  {
    slug: 'lucas-costa-roxo',
    name: 'Lucas Costa Roxo',
    period: 'Contemporary thinker in the archive',
    summary: 'Within PhiloMedia\'s own quote collection, Lucas Costa Roxo sharpens questions about simulation, language, and political domination.',
    focus: 'His page is built for works that interrogate hyperreality, discourse, power, and the instability of truth in mediated worlds.',
    aliases: ['Lucas Costa Roxo', 'Lucas C. Roxo'],
    featuredQuoteId: 1041,
  },
];

export const LENS_DEFINITIONS = [
  { id: 'epistemology', label: 'Truth & Knowledge', themes: ['epistemology', 'truth-deception', 'self-knowledge'] },
  { id: 'self-knowledge', label: 'Identity', themes: ['self-knowledge', 'existentialism', 'identity'] },
  { id: 'power-corruption', label: 'Power', themes: ['power-corruption', 'political-philosophy', 'social-justice'] },
  { id: 'stoicism', label: 'Resilience', themes: ['stoicism', 'suffering', 'virtue'] },
  { id: 'memory-time', label: 'Memory & Time', themes: ['memory-time', 'metaphysics'] },
  { id: 'alienation', label: 'Alienation', themes: ['alienation', 'conformity-individuality', 'technology-modernity'] },
  { id: 'social-justice', label: 'Justice & Society', themes: ['social-justice', 'political-philosophy', 'feminism-equality', 'social-contract', 'community'] },
  { id: 'consciousness-ai', label: 'Consciousness & AI', themes: ['consciousness-ai', 'metaphysics', 'postmodernism'] },
  { id: 'utopia-dystopia', label: 'Utopia & Dystopia', themes: ['utopia-dystopia', 'marxism-socialism', 'power-corruption'] },
  { id: 'freedom-choice', label: 'Freedom & Choice', themes: ['existentialism', 'stoicism', 'political-philosophy'] },
  { id: 'faith-spirituality', label: 'Faith & Spirituality', themes: ['sacred-profane', 'metaphysics', 'humanism', 'spirituality'] },
  { id: 'humanism', label: 'Humanism', themes: ['humanism', 'virtue', 'the-other-alterity', 'ethics', 'community', 'happiness'] },
];

export const THEME_GENRE_HINTS = {
  suffering: { movie: [18, 9648, 10749], tv: [18, 9648, 10765] },
  tragedy: { movie: [18, 9648], tv: [18, 9648] },
  virtue: { movie: [12, 18, 10759], tv: [18, 10759, 16] },
  existentialism: { movie: [18, 878, 9648], tv: [18, 9648, 10765] },
  'self-knowledge': { movie: [18, 9648], tv: [18, 9648, 16] },
  alienation: { movie: [18, 878, 9648], tv: [18, 878, 9648, 10765] },
  stoicism: { movie: [18, 12, 28, 10752], tv: [18, 10759, 10768, 16] },
  'power-corruption': { movie: [18, 80, 53, 10752], tv: [18, 80, 10768, 10759] },
  'social-justice': { movie: [18, 80, 99, 10752], tv: [18, 80, 10768, 99] },
  'political-philosophy': { movie: [18, 80, 99, 10752], tv: [18, 80, 10768, 99] },
  'truth-deception': { movie: [9648, 53, 80], tv: [9648, 80, 10765] },
  epistemology: { movie: [9648, 53, 878], tv: [9648, 80, 10765] },
  metaphysics: { movie: [878, 9648, 14], tv: [10765, 9648, 18] },
  'memory-time': { movie: [9648, 18], tv: [9648, 18, 10765, 16] },
  humanism: { movie: [18, 12, 16], tv: [18, 16, 10759] },
  'feminism-equality': { movie: [18, 10749], tv: [18, 10766] },
  postmodernism: { movie: [9648, 878, 53], tv: [9648, 10765, 18] },
  'consciousness-ai': { movie: [878, 9648], tv: [10765, 9648] },
  aesthetics: { movie: [18, 16, 10402], tv: [18, 16, 10402] },
  romanticism: { movie: [10749, 18], tv: [18, 10766] },
  'sacred-profane': { movie: [18, 14, 9648, 36], tv: [18, 10765, 9648] },
  'social-contract': { movie: [18, 80, 10752], tv: [18, 10768, 80] },
  'technology-modernity': { movie: [878, 9648, 18], tv: [10765, 18, 9648] },
  'language-semiotics': { movie: [9648, 18, 99], tv: [9648, 18, 99] },
  hedonism: { movie: [35, 18, 10749], tv: [35, 18, 10766] },
  'war-and-conflict': { movie: [10752, 28, 18], tv: [10768, 10759, 18] },
  'the-other-alterity': { movie: [18, 10749, 12], tv: [18, 16, 10766] },
  utilitarianism: { movie: [18, 53, 80], tv: [18, 80, 9648] },
};

/**
 * Une hints movie+tv num único array (p.ex. home page que descobre por género TMDB).
 * @param {string} theme
 * @returns {number[]}
 */
export function flattenThemeGenreHint(theme) {
  const hint = THEME_GENRE_HINTS[theme];
  if (!hint) return [];
  if (Array.isArray(hint)) return hint;
  return [...new Set([...(hint.movie || []), ...(hint.tv || [])])];
}

const CANONICAL_THEME_IDS = new Set(Object.keys(THEME_DATABASE));
const THEME_ALIASES = {
  'idealismo': 'idealism',
  'empirismo': 'epistemology',
  'ciencia': 'epistemology',
  'literatura': 'aesthetics',
  'existencialismo': 'existentialism',
  'filosofia politica': 'political-philosophy',
  'utilitarismo': 'utilitarianism',
  'patristica': 'sacred-profane',
  'evolucao': 'epistemology',
  'evolution': 'epistemology',
  'biologia': 'epistemology',
  'biology': 'epistemology',
  'selecao natural': 'epistemology',
  'natural selection': 'epistemology',
  'historia natural': 'epistemology',
  'natural history': 'epistemology',
  'metodo cientifico': 'epistemology',
  'scientific method': 'epistemology',
  'investigacao cientifica': 'epistemology',
  'scientific inquiry': 'epistemology',
  'adaptacao': 'epistemology',
  'adaptation': 'epistemology',
  'origem das especies': 'epistemology',
  'origin of species': 'epistemology',
  'literatura brasileira': 'aesthetics',
  'psicologia e filosofia': 'self-knowledge',
  'psicanalise': 'self-knowledge',
  'iluminismo': 'humanism',
  'linguagem': 'language-semiotics',
  'pessimismo': 'suffering',
  'racionalismo': 'epistemology',
  'feminismo': 'feminism-equality',
  'filosofia pre socratica': 'metaphysics',
  'ciencia e filosofia': 'epistemology',
  'matematica e filosofia': 'epistemology',
  'neoplatonismo': 'metaphysics',
  'hedonismo': 'hedonism',
  'invencao': 'technology-modernity',
  'politica e ciencia': 'political-philosophy',
  'educacao': 'humanism',
  'filosofia e literatura': 'aesthetics',
  'budismo': 'sacred-profane',
  'cosmologia': 'metaphysics',
  'arte e ciencia': 'aesthetics',
  'contratualismo': 'social-contract',
  'direitos humanos': 'social-justice',
  'direitos civis': 'social-justice',
  'filosofia chinesa': 'humanism',
  'romantismo': 'romanticism',
  'estoicismo': 'stoicism',
  'etica': 'virtue',
  'politica': 'political-philosophy',
};

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyName(value) {
  return normalizeKey(value).replace(/\s+/g, '-');
}

function truncate(text, maxLength = 160) {
  const value = String(text || '').trim();
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

const LIKELY_PORTUGUESE_MARKERS = [
  ' nao ', ' você ', ' voces ', ' para ', ' porque ', ' quando ', ' uma ', ' umas ',
  ' esta ', ' esse ', ' essa ', ' coisas ', ' mundo ', ' vida ', ' felicidade ',
  ' razão ', ' imaginação ', ' guerra ', ' homens ', ' mulher ', ' pessoas ', ' apenas ',
];

function isLikelyEnglishQuote(quote) {
  const normalized = ` ${normalizeKey(quote)} `;
  const hasPortugueseMarker = LIKELY_PORTUGUESE_MARKERS.some(marker => normalized.includes(normalizeKey(marker)));
  return !hasPortugueseMarker;
}

export function formatThemeLabel(theme) {
  const normalizedTheme = normalizePhilosopherTheme(theme) || String(theme || '').trim().toLowerCase();

  return String(normalizedTheme || '')
    .split('-')
    .filter(Boolean)
    .map(part => (part === 'ai' ? 'AI' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

export function normalizePhilosopherTheme(theme) {
  const rawTheme = String(theme || '').trim().toLowerCase();
  if (!rawTheme) return '';
  if (CANONICAL_THEME_IDS.has(rawTheme)) return rawTheme;

  const normalized = normalizeKey(rawTheme);
  if (!normalized) return '';

  const hyphenated = normalized.replace(/\s+/g, '-');
  if (CANONICAL_THEME_IDS.has(hyphenated)) return hyphenated;

  return THEME_ALIASES[normalized] || '';
}

function normalizeQuoteThemes(themes = []) {
  return [...new Set(
    (themes || [])
      .map(normalizePhilosopherTheme)
      .filter(Boolean)
  )];
}

function uniqStrings(values = []) {
  return [...new Set(
    (values || [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

function createAuthorIndex() {
  const index = new Map();

  PHILOSOPHER_DEFINITIONS.forEach(definition => {
    [definition.name, ...(definition.aliases || [])].forEach(alias => {
      const key = normalizeKey(alias);
      if (key) {
        index.set(key, definition.slug);
      }
    });
  });

  return index;
}

const AUTHOR_INDEX = createAuthorIndex();
const PHILOSOPHER_INDEX = new Map(
  PHILOSOPHER_DEFINITIONS.map(definition => [definition.slug, definition])
);

function createDirectoryIndex(directory = []) {
  const index = new Map();

  directory.forEach(entry => {
    [entry?.name, entry?.wikiTitle].forEach(candidate => {
      const key = normalizeKey(candidate);
      if (key) {
        index.set(key, entry);
      }
    });
  });

  return index;
}

function normalizeSubmittedDefinition(entry = {}) {
  const name = String(entry.name || '').trim();
  const slug = String(entry.slug || slugifyName(name)).trim().toLowerCase();
  if (!name || !slug) return null;

  return {
    slug,
    name,
    period: String(entry.period || '').trim(),
    summary: String(entry.summary || '').trim(),
    focus: String(entry.focus || '').trim(),
    aliases: uniqStrings(entry.aliases || []),
    portraitUrl: String(entry.portraitUrl || '').trim(),
    wikiTitle: String(entry.wikiTitle || '').trim(),
    featuredQuoteId: null,
    isCommunitySubmitted: true,
  };
}

function createSubmittedProfileIndices(submittedProfiles = []) {
  const bySlug = new Map();
  const byAuthor = new Map();

  (submittedProfiles || [])
    .map(normalizeSubmittedDefinition)
    .filter(Boolean)
    .forEach(profile => {
      bySlug.set(profile.slug, profile);
      [profile.name, ...(profile.aliases || [])].forEach(alias => {
        const key = normalizeKey(alias);
        if (key) {
          byAuthor.set(key, profile);
        }
      });
    });

  return { bySlug, byAuthor };
}

function mergeBaseDefinitions(curatedDefinition, submittedDefinition, fallbackAuthor) {
  if (!curatedDefinition && !submittedDefinition) return null;
  if (!curatedDefinition) return { ...submittedDefinition };
  if (!submittedDefinition) return { ...curatedDefinition };

  return {
    ...submittedDefinition,
    ...curatedDefinition,
    slug: curatedDefinition.slug || submittedDefinition.slug,
    name: curatedDefinition.name || submittedDefinition.name || fallbackAuthor,
    period: curatedDefinition.period || submittedDefinition.period,
    summary: curatedDefinition.summary || submittedDefinition.summary,
    focus: curatedDefinition.focus || submittedDefinition.focus,
    aliases: uniqStrings([...(curatedDefinition.aliases || []), ...(submittedDefinition.aliases || [])]),
    portraitUrl: curatedDefinition.portraitUrl || submittedDefinition.portraitUrl,
    wikiTitle: curatedDefinition.wikiTitle || submittedDefinition.wikiTitle,
    featuredQuoteId: curatedDefinition.featuredQuoteId ?? submittedDefinition.featuredQuoteId ?? null,
    priorityThemes: uniqStrings([...(curatedDefinition.priorityThemes || []), ...(submittedDefinition.priorityThemes || [])]),
    contextKeywords: uniqStrings([...(curatedDefinition.contextKeywords || []), ...(submittedDefinition.contextKeywords || [])]),
    contextPenaltyKeywords: uniqStrings([...(curatedDefinition.contextPenaltyKeywords || []), ...(submittedDefinition.contextPenaltyKeywords || [])]),
    discoveryQueries: uniqStrings([...(curatedDefinition.discoveryQueries || []), ...(submittedDefinition.discoveryQueries || [])]),
    relatedWorkThreshold: Number(curatedDefinition.relatedWorkThreshold ?? submittedDefinition.relatedWorkThreshold) || 0,
    isCommunitySubmitted: Boolean(submittedDefinition.isCommunitySubmitted) && !curatedDefinition,
  };
}

function resolvePrimaryLens(topThemes = []) {
  const ranked = LENS_DEFINITIONS
    .map(lens => {
      const score = lens.themes.reduce((total, theme, index) => {
        const position = topThemes.indexOf(theme);
        if (position === -1) return total;
        return total + Math.max(2, 8 - position - index);
      }, 0);

      return { ...lens, score };
    })
    .filter(lens => lens.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  return ranked.slice(0, 3).map(({ score, ...lens }) => lens);
}

function accumulateThemeScores(quotes = []) {
  const scores = new Map();

  quotes.forEach(quote => {
    (quote.themes || []).forEach((theme, index) => {
      const normalizedTheme = normalizePhilosopherTheme(theme);
      if (!normalizedTheme) return;
      const nextScore = (scores.get(normalizedTheme) || 0) + Math.max(6, 14 - index * 2);
      scores.set(normalizedTheme, nextScore);
    });

    analyzeWorkForThemes(quote.quote || '')
      .slice(0, 4)
      .forEach(({ theme, score }, index) => {
        const nextScore = (scores.get(theme) || 0) + Math.max(2, Math.round(score / 2) - index);
        scores.set(theme, nextScore);
      });
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([theme]) => theme);
}

function prioritizeThemes(topThemes = [], baseDefinition = null, limit = 4) {
  const priorityThemes = uniqStrings(baseDefinition?.priorityThemes || [])
    .map(normalizePhilosopherTheme)
    .filter(Boolean);

  return [...new Set([...priorityThemes, ...topThemes])]
    .slice(0, limit);
}

function buildFallbackSummary(name, themeLabels = []) {
  if (!themeLabels.length) {
    return `${name} appears in the broader PhiloMedia archive through quotes gathered for the project's philosophical reading layer.`;
  }

  return `${name} appears in the broader PhiloMedia archive through quotes that circle ${themeLabels.slice(0, 3).join(', ').toLowerCase()}.`;
}

function buildFallbackFocus(name, themeLabels = []) {
  if (!themeLabels.length) {
    return `This page follows how ${name} resonates with the site's quotes, lenses, and media pairings.`;
  }

  return `This page follows how ${name} resonates with works about ${themeLabels.slice(0, 3).join(', ').toLowerCase()} inside the site's reading layer.`;
}

function estimateRelatedWorkCount(topThemes = [], quoteCount = 0, curatedCount = 0) {
  if (curatedCount > 0) return curatedCount;

  const hintedThemes = topThemes.filter(theme => THEME_GENRE_HINTS[theme]).length;
  if (!hintedThemes || !quoteCount) return 0;

  return Math.min(8, Math.max(2, hintedThemes * 2 + Math.min(quoteCount, 3) - 1));
}

function buildPeriodText(directoryEntry) {
  if (!directoryEntry) return 'Thinker in the archive';

  const life = String(directoryEntry.life || '').replace(/[()]/g, '').trim();
  const school = String(directoryEntry.school || '').trim();

  if (school && life) return `${school} · ${life}`;
  if (life) return life;
  if (school) return school;
  return 'Thinker in the archive';
}

function findDirectoryEntry(candidateNames, directoryIndex) {
  for (const name of candidateNames) {
    const match = directoryIndex.get(normalizeKey(name));
    if (match) return match;
  }

  return null;
}

function buildProfileDefinition({ baseDefinition, rawAuthors, topThemes, directoryEntry }) {
  const primaryAuthor = directoryEntry?.name || baseDefinition?.name || rawAuthors[0] || 'Unknown';
  const themeLabels = topThemes.map(formatThemeLabel);
  const period = baseDefinition?.period || buildPeriodText(directoryEntry);
  const summary = baseDefinition?.summary || directoryEntry?.topicalDescription || buildFallbackSummary(primaryAuthor, themeLabels);
  const focus = baseDefinition?.focus || buildFallbackFocus(primaryAuthor, themeLabels);
  const needsReferenceMetadata = (
    (!baseDefinition?.period && period === 'Thinker in the archive')
    || (!baseDefinition?.summary && !directoryEntry?.topicalDescription)
  );

  return {
    slug: baseDefinition?.slug || slugifyName(primaryAuthor),
    name: primaryAuthor,
    period,
    summary,
    focus,
    aliases: [...new Set([...(baseDefinition?.aliases || []), ...rawAuthors])],
    featuredQuoteId: baseDefinition?.featuredQuoteId ?? null,
    portraitUrl: baseDefinition?.portraitUrl || directoryEntry?.portraitUrl || '',
    wikiTitle: directoryEntry?.wikiTitle || '',
    priorityThemes: uniqStrings(baseDefinition?.priorityThemes || [])
      .map(normalizePhilosopherTheme)
      .filter(Boolean),
    contextKeywords: uniqStrings(baseDefinition?.contextKeywords || []),
    contextPenaltyKeywords: uniqStrings(baseDefinition?.contextPenaltyKeywords || []),
    discoveryQueries: uniqStrings(baseDefinition?.discoveryQueries || []),
    relatedWorkThreshold: Number(baseDefinition?.relatedWorkThreshold) || 0,
    needsReferenceMetadata,
    isCommunitySubmitted: Boolean(baseDefinition?.isCommunitySubmitted),
  };
}

function selectFeaturedQuote(definition, quotes = []) {
  if (!quotes.length) return null;

  const featured = quotes.find(quote => String(quote.id) === String(definition.featuredQuoteId));
  if (featured) return featured;

  return [...quotes].sort((a, b) => {
    const aThemes = Array.isArray(a.themes) ? a.themes.length : 0;
    const bThemes = Array.isArray(b.themes) ? b.themes.length : 0;
    return bThemes - aThemes || (b.quote?.length || 0) - (a.quote?.length || 0);
  })[0];
}

function buildCuratedQuoteIndex() {
  const index = new Map();

  Object.entries(curatedQuoteMatches).forEach(([tmdbId, quoteId]) => {
    const key = String(quoteId);
    const current = index.get(key) || [];
    current.push(String(tmdbId));
    index.set(key, current);
  });

  return index;
}

const CURATED_QUOTE_INDEX = buildCuratedQuoteIndex();

export function getLinkedWorkIdsForQuoteIds(quoteIds = []) {
  const linked = new Set();

  quoteIds.forEach(quoteId => {
    (CURATED_QUOTE_INDEX.get(String(quoteId)) || []).forEach(tmdbId => linked.add(tmdbId));
  });

  return [...linked];
}

export function getPhilosopherDefinitionBySlug(slug) {
  return PHILOSOPHER_INDEX.get(String(slug || '').trim()) || null;
}

export function getPhilosopherDefinitionByAuthor(author) {
  const slug = AUTHOR_INDEX.get(normalizeKey(author));
  return slug ? getPhilosopherDefinitionBySlug(slug) : null;
}

export function getDisplayAuthorName(author) {
  return getPhilosopherDefinitionByAuthor(author)?.name || String(author || 'Unknown');
}

export function getPhilosopherUrl(slug) {
  if (!slug) return null;
  return `/html/philosopher.html?slug=${encodeURIComponent(slug)}`;
}

export function getPhilosopherUrlByAuthor(author) {
  const definition = getPhilosopherDefinitionByAuthor(author);
  if (definition) return getPhilosopherUrl(definition.slug);

  const slug = slugifyName(author);
  return slug ? getPhilosopherUrl(slug) : null;
}

export function getLensSearchUrl(lensId) {
  if (!lensId) return '/html/search.html';
  return `/html/search.html?lens=${encodeURIComponent(lensId)}`;
}

export function filterPhilosopherCatalogQuotes(quotes = []) {
  return (quotes || []).filter(quote => {
    if (!quote?.quote || !quote?.author) return false;
    if (quote.source === 'wikiquote' || quote.source === 'database-import') {
      return false;
    }
    return isLikelyEnglishQuote(quote.quote);
  });
}

export function buildPhilosopherProfiles(quotes = [], philosopherDirectory = [], submittedProfiles = []) {
  const groupedQuotes = new Map();
  const directoryIndex = createDirectoryIndex(philosopherDirectory);
  const submittedIndices = createSubmittedProfileIndices(submittedProfiles);

  (quotes || []).forEach((quote, index) => {
    const definition = mergeBaseDefinitions(
      getPhilosopherDefinitionByAuthor(quote.author),
      submittedIndices.byAuthor.get(normalizeKey(quote.author))
        || submittedIndices.bySlug.get(slugifyName(quote.author)),
      quote.author
    );
    const slug = definition?.slug || slugifyName(quote.author);
    if (!slug) return;

    const current = groupedQuotes.get(slug) || {
      baseDefinition: definition || null,
      rawAuthors: new Set(),
      quotes: [],
    };

    current.rawAuthors.add(quote.author);
    current.quotes.push({
      ...quote,
      _inputOrder: index,
    });
    groupedQuotes.set(slug, current);
  });

  return [...groupedQuotes.entries()]
    .map(([slug, group]) => {
      const rawAuthors = [...group.rawAuthors];
      const topThemes = prioritizeThemes(
        accumulateThemeScores(group.quotes),
        group.baseDefinition
      );
      const directoryEntry = findDirectoryEntry(
        [group.baseDefinition?.name, ...(group.baseDefinition?.aliases || []), ...rawAuthors],
        directoryIndex
      );
      const definition = buildProfileDefinition({
        baseDefinition: group.baseDefinition ? { ...group.baseDefinition, slug } : null,
        rawAuthors,
        topThemes,
        directoryEntry,
      });
      const philosopherQuotes = group.quotes.map(quote => ({
        ...quote,
        author: definition.name,
        themes: normalizeQuoteThemes(quote.themes),
      }));
      const featuredQuote = selectFeaturedQuote(definition, philosopherQuotes);
      const quoteIds = philosopherQuotes.map(quote => quote.id).filter(id => id != null);
      const linkedWorkIds = getLinkedWorkIdsForQuoteIds(quoteIds);
      const linkedWorkCount = Math.max(
        linkedWorkIds.length,
        estimateRelatedWorkCount(topThemes, philosopherQuotes.length, linkedWorkIds.length)
      );
      const lenses = resolvePrimaryLens(topThemes).map(lens => ({
        ...lens,
        url: getLensSearchUrl(lens.id),
      }));

      return {
        ...definition,
        featuredQuote,
        featuredQuotePreview: truncate(featuredQuote?.quote || ''),
        quoteCount: philosopherQuotes.length,
        quotes: philosopherQuotes.sort((a, b) => a._inputOrder - b._inputOrder),
        quoteIds,
        topThemes,
        themeLabels: topThemes.map(formatThemeLabel),
        lenses,
        linkedWorkIds,
        linkedWorkCount,
        url: getPhilosopherUrl(definition.slug),
        portraitUrl: definition.portraitUrl || '',
        wikiTitle: definition.wikiTitle || '',
        needsReferenceMetadata: Boolean(definition.needsReferenceMetadata),
        isCommunitySubmitted: Boolean(definition.isCommunitySubmitted),
        initials: definition.name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map(part => part.charAt(0).toUpperCase())
          .join(''),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function getPhilosopherProfileBySlug(quotes = [], slug, philosopherDirectory = [], submittedProfiles = []) {
  return buildPhilosopherProfiles(quotes, philosopherDirectory, submittedProfiles).find(profile => profile.slug === slug) || null;
}
