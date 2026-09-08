import { analyzeWorkForThemes } from './hermeneutics.js';
import { curatedQuoteMatches } from './curatedmatches.js';
import {
  formatThemeLabel,
  normalizeKey,
  normalizePhilosopherTheme,
  normalizeQuoteThemes,
} from './domain/canonicalThemes.js';
import {
  PHILOSOPHER_AUTHORS,
  getDisplayAuthorName,
  getPhilosopherSlugByAuthor,
  getPhilosopherUrl,
  getPhilosopherUrlByAuthor,
  slugifyName,
} from './domain/philosopherAuthors.js';
import { THEME_GENRE_HINTS, flattenThemeGenreHint } from './domain/themeGenreHints.js';
import { CURATED_TV_IDS } from './domain/curatedTvIds.js';

export { formatThemeLabel, normalizePhilosopherTheme, normalizeQuoteThemes };

// Reexportados para quem já os importava daqui. A implementação vive nos
// módulos leves, que a home e a página de detalhes usam sem carregar as
// biografias — importar daqui traz o ficheiro inteiro.
export {
  CURATED_TV_IDS,
  THEME_GENRE_HINTS,
  flattenThemeGenreHint,
  getDisplayAuthorName,
  getPhilosopherUrl,
  getPhilosopherUrlByAuthor,
};

/**
 * Biografia e sinais de descoberta por pensador, indexados por slug.
 * A identidade (slug, nome, apelidos) vive em domain/philosopherAuthors.js —
 * este objecto acrescenta o que só as páginas de pensadores consomem.
 */
const PHILOSOPHER_PROFILE_DETAILS = {
  socrates: {
    period: 'Classical Greece · 470-399 BCE',
    summary: 'Socratic thought turns philosophy into a lived practice of questioning, humility, and ethical self-examination.',
    focus: 'His presence in PhiloMedia revolves around virtue, ignorance, and the discipline of examining life before acting.',
    featuredQuoteId: 1001,
    priorityThemes: ['epistemology', 'virtue', 'self-knowledge'],
  },
  plato: {
    period: 'Classical Greece · 428-348 BCE',
    summary: 'Plato frames philosophy as a search for truth beyond appearances, pairing political reflection with questions about knowledge and the soul.',
    focus: 'Across the site, Plato tends to surface where stories wrestle with truth, light, leadership, and the cost of remaining in illusion.',
    featuredQuoteId: 1008,
    priorityThemes: ['epistemology', 'metaphysics', 'political-philosophy'],
  },
  aristotle: {
    period: 'Classical Greece · 384-322 BCE',
    summary: 'Aristotle centers habit, practical reason, and the idea that character is built through repeated action rather than sudden revelation.',
    focus: 'His quotes in PhiloMedia often anchor stories about reflection, excellence, flourishing, and the ethics of everyday decisions.',
    featuredQuoteId: 1015,
    priorityThemes: ['virtue', 'epistemology', 'self-knowledge'],
  },
  'niccolo-machiavelli': {
    period: 'Renaissance Italy · 1469-1527',
    summary: 'Machiavelli studies power without sentimentality, watching how image, fear, strategy, and necessity shape public life.',
    focus: 'In the site\'s matches, he appears when stories investigate authority, manipulation, survival, and the gap between appearance and reality.',
    featuredQuoteId: 1016,
    priorityThemes: ['power-corruption', 'political-philosophy', 'truth-deception'],
  },
  'john-locke': {
    period: 'Early Modern England · 1632-1704',
    summary: 'Locke anchors knowledge in experience and treats understanding as something built through contact with the world.',
    focus: 'His quotes here usually accompany stories of learning, perception, and the slow construction of certainty from lived experience.',
    featuredQuoteId: 1045,
    priorityThemes: ['epistemology', 'political-philosophy', 'social-contract'],
  },
  'charles-darwin': {
    period: 'Victorian England · 1809-1882',
    summary: 'Darwin reshapes modern thought through evolution, adaptation, observation of living systems, and the patient work of scientific inference.',
    focus: 'In PhiloMedia, Darwin should connect most strongly with stories about biology, natural selection, scientific discovery, species, survival, and humanity\'s place in nature.',
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
      'investigation',
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
      'prosecutor',
    ],
    discoveryQueries: ['evolution', 'natural selection', 'biology', 'scientific discovery'],
    relatedWorkThreshold: 30,
    featuredQuoteId: 'wiki-318',
  },
  'karl-marx': {
    period: '19th-century Germany · 1818-1883',
    summary: 'Marx reads society through labor, class struggle, alienation, and the structures that make inequality feel natural.',
    focus: 'PhiloMedia uses Marx most often when films and series expose exploitation, ideology, or the social systems hiding behind everyday life.',
    featuredQuoteId: 1021,
    priorityThemes: ['marxism-socialism', 'social-justice', 'alienation'],
  },
  'friedrich-nietzsche': {
    period: '19th-century Germany · 1844-1900',
    summary: 'Nietzsche pushes thought toward self-overcoming, purpose, and the search for meaning inside suffering rather than outside it.',
    focus: 'His page leans into resilience, existential pressure, and the kind of works that turn crisis into a test of values.',
    featuredQuoteId: 1066,
    priorityThemes: ['suffering', 'existentialism', 'epistemology'],
  },
  'simone-de-beauvoir': {
    period: '20th-century France · 1908-1986',
    summary: 'De Beauvoir joins freedom to responsibility, insisting that identity is formed historically, socially, and through action.',
    focus: 'Within PhiloMedia, she connects to stories about becoming, equality, gender, and the urgency of choosing a life in the present.',
    featuredQuoteId: 1043,
    priorityThemes: ['existentialism', 'feminism-equality', 'self-knowledge'],
  },
  'clovis-de-barros-filho': {
    period: 'Contemporary Brazil',
    summary: 'Clóvis de Barros Filho translates ethics, coexistence, and happiness into vivid reflections on daily life and shared worlds.',
    focus: 'His matches tend to favor works about freedom, affection, common life, and the fragile moments where happiness becomes visible.',
    featuredQuoteId: 1034,
    priorityThemes: ['humanism', 'virtue', 'self-knowledge'],
  },
  'leandro-karnal': {
    period: 'Contemporary Brazil',
    summary: 'Karnal often turns philosophy toward interior life, confronting loneliness, vitality, prudence, and the courage to build hope.',
    focus: 'On the site, he resonates most with works about endurance, self-knowledge, and the active work of remaining alive to experience.',
    featuredQuoteId: 1039,
    priorityThemes: ['existentialism', 'self-knowledge', 'suffering'],
  },
  'mario-sergio-cortella': {
    period: 'Contemporary Brazil',
    summary: 'Cortella\'s voice joins ethics, leadership, spirituality, and practical wisdom without losing sight of ordinary human limits.',
    focus: 'He tends to connect with stories about purpose, excellence, coexistence, and the attempt to align what one wants, should do, and can do.',
    featuredQuoteId: 1047,
    priorityThemes: ['humanism', 'virtue', 'metaphysics'],
  },
  'lucas-costa-roxo': {
    period: 'Contemporary thinker in the archive',
    summary: 'Within PhiloMedia\'s own quote collection, Lucas Costa Roxo sharpens questions about simulation, language, and political domination.',
    focus: 'His page is built for works that interrogate hyperreality, discourse, power, and the instability of truth in mediated worlds.',
    featuredQuoteId: 1042,
    priorityThemes: ['postmodernism', 'truth-deception', 'political-philosophy'],
  },
  'immanuel-kant': {
    period: 'Enlightenment Prussia · 1724-1804',
    summary: 'Kant ties together critique of knowledge, the moral law, and the conditions that make experience possible as parts of one rigorous project.',
    focus: 'On PhiloMedia he reads best next to works about duty, evidence, limits of reason, and the tension between scientific law and human dignity.',
    featuredQuoteId: 'wiki-11',
    priorityThemes: ['epistemology', 'virtue', 'metaphysics', 'political-philosophy'],
  },
  'baruch-spinoza': {
    period: 'Dutch Golden Age · 1632-1677',
    summary: 'Spinoza thinks God, nature, and reason as one substance, linking knowledge of causes with human freedom and the love of what is necessary.',
    focus: 'He matches narratives where clarity, affect, and metaphysical stakes reshape ethics rather than quick confessional drama.',
    featuredQuoteId: 'wiki-35',
    priorityThemes: ['metaphysics', 'virtue', 'epistemology'],
  },
  'david-hume': {
    period: 'Scottish Enlightenment · 1711-1776',
    summary: 'Hume grounds beliefs in habit, feeling, and social life, showing how experience supports—and limits—the claims we treat as obvious.',
    focus: 'He fits works about custom, skepticism, the science of mind, and stories where secure truth keeps melting under scrutiny.',
    featuredQuoteId: 1052,
    priorityThemes: ['epistemology', 'truth-deception', 'aesthetics'],
  },
  'ludwig-wittgenstein': {
    period: '20th-century Austria and Britain · 1889-1951',
    summary: 'Wittgenstein treats philosophical trouble as often rooted in language, urging attention to how forms of life hold meanings together.',
    focus: 'His archive voice pairs with films and series about rules, silence, ordinary life, and the limits of saying versus showing.',
    featuredQuoteId: 1053,
    priorityThemes: ['language-semiotics', 'epistemology', 'metaphysics'],
  },
  'arthur-schopenhauer': {
    period: '19th-century Germany · 1788-1860',
    summary: 'Schopenhauer describes the world as driven by blind will, linking pessimism, compassion, and aesthetic quiet as fragile exits from relentless desire.',
    focus: 'Use him where stories stress suffering, renunciation, illusion, and the gravity of bodily life.',
    featuredQuoteId: 1054,
    priorityThemes: ['suffering', 'metaphysics', 'truth-deception'],
  },
  heraclitus: {
    period: 'Archaic Greece · c. 535-c. 475 BCE',
    summary: 'Heraclitus makes change and strife metaphysical principles, teaching that a common logos orders the fire-transformed world we half see.',
    focus: 'He lines up with plots about flux, opposition, and hidden unity beneath surface chaos.',
    featuredQuoteId: 1055,
    priorityThemes: ['metaphysics', 'truth-deception', 'epistemology'],
  },
  epicurus: {
    period: 'Ancient Greece · 341-270 BCE',
    summary: 'Epicurus seeks measured pleasure and ataraxia through sober judgment, friendship, and removing empty fears rather than crude excess.',
    focus: 'He belongs beside stories about limits, simple goods, death-anxiety, and calm in a turbulent world.',
    featuredQuoteId: 1056,
    priorityThemes: ['hedonism', 'virtue', 'metaphysics'],
  },
  'blaise-pascal': {
    period: 'Early modern France · 1623-1662',
    summary: 'Pascal contrasts the misery and dignity of the human subject before infinity, weaving mathematics, apologetics, and existential wager.',
    focus: 'Pair him with narratives of faith, finitude, diversion, and the heart\'s hidden reasons.',
    featuredQuoteId: 1057,
    priorityThemes: ['sacred-profane', 'suffering', 'epistemology'],
  },
  'francis-bacon': {
    period: 'Early modern England · 1561-1626',
    summary: 'Bacon champions empirical method, critique of idols, and the patient revision of knowledge against scholastic habit.',
    focus: 'He suits works about investigation, institutional truth, and the slow correction of collective error.',
    featuredQuoteId: 1058,
    priorityThemes: ['epistemology', 'truth-deception', 'memory-time'],
  },
  voltaire: {
    period: 'Enlightenment France · 1694-1778',
    summary: 'Voltaire weaponizes wit against dogma and fanaticism, defending toleration, criticism, and lucid irony as civic virtues.',
    focus: 'His lines resonate where satire, free inquiry, and fragile pluralism face absolutism.',
    featuredQuoteId: 1059,
    priorityThemes: ['humanism', 'political-philosophy', 'sacred-profane'],
  },
  'john-stuart-mill': {
    period: 'Victorian Britain · 1806-1873',
    summary: 'Mill connects liberty, utility, and experiment, arguing that individual character and social progress advance through protected dissent.',
    focus: 'Think of him when plots weigh consequences, rights, happiness, and the moral weight of staying neutral.',
    featuredQuoteId: 1060,
    priorityThemes: ['utilitarianism', 'political-philosophy', 'humanism'],
  },
  'saint-augustine': {
    period: 'Late antiquity · 354-430',
    summary: 'Augustine narrates inner life before God, binding memory, desire, time, and fallen love into a theology of restless hearts.',
    focus: 'Use him for stories about confession, grace, temptation, and cities torn between two loves.',
    featuredQuoteId: 1061,
    priorityThemes: ['sacred-profane', 'virtue', 'memory-time'],
  },
  'soren-kierkegaard': {
    period: '19th-century Denmark · 1813-1855',
    summary: 'Kierkegaard makes existence a task of subjective commitment, sketching stages of life shot through with anxiety, irony, and faith.',
    focus: 'He matches works about choice, despair, inwardness, and the leap beyond tidy systems.',
    featuredQuoteId: 1062,
    priorityThemes: ['existentialism', 'sacred-profane', 'suffering'],
  },
  'hannah-arendt': {
    period: '20th-century Germany and United States · 1906-1975',
    summary: 'Arendt studies plurality, power, and political action, tracing how total domination and thoughtlessness hollow out common worlds.',
    focus: 'She aligns with fiction about public life, responsibility, revolution, and evil as banal routine.',
    featuredQuoteId: 'wiki-267',
    priorityThemes: ['political-philosophy', 'power-corruption', 'truth-deception'],
  },
  'augusto-cury': {
    period: 'Contemporary Brazil',
    summary: 'Cury writes at the crossroads of clinical insight and popular ethics, stressing anxiety management, creativity, and emotional education.',
    focus: 'His quotes pair with accessible dramas about burnout, resilience, and everyday mental hygiene.',
    featuredQuoteId: 'wiki-279',
    priorityThemes: ['self-knowledge', 'humanism', 'virtue'],
  },
  'sigmund-freud': {
    period: 'Modern Austria · 1856-1939',
    summary: 'Freud maps unconscious conflict, dream-work, and the talking cure as routes into motives we disown.',
    focus: 'Invoke him where desire, repression, and interpretation unsettle neat self-portraits.',
    featuredQuoteId: 1064,
    priorityThemes: ['self-knowledge', 'truth-deception', 'taboo-transgression'],
  },
  plotinus: {
    period: 'Late antiquity · 204-270',
    summary: 'Plotinus renews Platonism through contemplative ascent, describing soul, intellect, and the One as layered emanations of the good.',
    focus: 'He fits mystical arcs, beauty as revelation, and narratives longing to reunite with source.',
    featuredQuoteId: 'wiki-97',
    priorityThemes: ['metaphysics', 'sacred-profane', 'aesthetics'],
  },
  'isaac-newton': {
    period: 'Early modern England · 1643-1727',
    summary: 'Newton fuses bold mathematics with experiment, modeling force, motion, and celestial order while insisting humility before what remains unknown.',
    focus: 'Use him where rigor, mystery, and the scale of the cosmos frame human inquiry.',
    featuredQuoteId: 'wiki-335',
    priorityThemes: ['epistemology', 'metaphysics', 'truth-deception'],
  },
};

export const PHILOSOPHER_DEFINITIONS = PHILOSOPHER_AUTHORS.map((author) => ({
  ...author,
  ...PHILOSOPHER_PROFILE_DETAILS[author.slug],
}));

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

function uniqStrings(values = []) {
  return [...new Set(
    (values || [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

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

  const sfl = entry.summaryForLocale && typeof entry.summaryForLocale === 'object'
    ? entry.summaryForLocale
    : null;
  const ffl = entry.focusForLocale && typeof entry.focusForLocale === 'object'
    ? entry.focusForLocale
    : null;

  return {
    slug,
    name,
    period: String(entry.period || '').trim(),
    summary: String(entry.summary || '').trim(),
    focus: String(entry.focus || '').trim(),
    originalLanguage: String(entry.originalLanguage || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en',
    summaryForLocale: sfl
      ? { en: String(sfl.en || '').trim(), pt: String(sfl.pt || '').trim() }
      : undefined,
    focusForLocale: ffl
      ? { en: String(ffl.en || '').trim(), pt: String(ffl.pt || '').trim() }
      : undefined,
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

function mergeLocaleMaps(a, b) {
  const left = a && typeof a === 'object' ? a : {};
  const right = b && typeof b === 'object' ? b : {};
  return {
    en: String(left.en || right.en || '').trim(),
    pt: String(left.pt || right.pt || '').trim(),
  };
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
    summaryForLocale: mergeLocaleMaps(submittedDefinition.summaryForLocale, curatedDefinition.summaryForLocale),
    focusForLocale: mergeLocaleMaps(submittedDefinition.focusForLocale, curatedDefinition.focusForLocale),
    originalLanguage: curatedDefinition.originalLanguage || submittedDefinition.originalLanguage || 'en',
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

  return ranked.slice(0, 3).map(({ score: _, ...lens }) => lens);
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

  const out = {
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

  if (baseDefinition?.summaryForLocale) {
    out.summaryForLocale = baseDefinition.summaryForLocale;
    out.focusForLocale = baseDefinition.focusForLocale || { en: '', pt: '' };
    out.originalLanguage = baseDefinition.originalLanguage || 'en';
  } else if (baseDefinition?.originalLanguage) {
    out.originalLanguage = baseDefinition.originalLanguage;
  }

  return out;
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
  const slug = getPhilosopherSlugByAuthor(author);
  return slug ? getPhilosopherDefinitionBySlug(slug) : null;
}

export function getLensSearchUrl(lensId) {
  if (!lensId) return '/html/search.html';
  return `/html/search.html?lens=${encodeURIComponent(lensId)}`;
}

export function filterPhilosopherCatalogQuotes(quotes = [], uiLocale = 'en') {
  const loc = String(uiLocale || 'en').trim().toLowerCase() === 'pt' ? 'pt' : 'en';

  return (quotes || []).filter(quote => {
    if (!quote?.quote || !quote?.author) return false;
    if (loc === 'pt') return true;
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

/**
 * Index page: always include curated PHILOSOPHER_DEFINITIONS, enriched with quote data when available.
 */
export function buildPhilosopherIndexProfiles(quotes = [], philosopherDirectory = [], submittedProfiles = []) {
  const fromQuotes = buildPhilosopherProfiles(quotes, philosopherDirectory, submittedProfiles);
  const bySlug = new Map(fromQuotes.map(profile => [profile.slug, profile]));
  const directoryIndex = createDirectoryIndex(philosopherDirectory);

  const profiles = PHILOSOPHER_DEFINITIONS.map(definition => {
    const existing = bySlug.get(definition.slug);
    if (existing) return existing;

    const directoryEntry = findDirectoryEntry(
      [definition.name, ...(definition.aliases || [])],
      directoryIndex
    );
    const topThemes = definition.priorityThemes || [];
    const themeLabels = topThemes.map(formatThemeLabel);
    const name = definition.name;

    return {
      slug: definition.slug,
      name,
      period: definition.period,
      summary: definition.summary,
      focus: definition.focus,
      aliases: [...(definition.aliases || [])],
      featuredQuote: null,
      featuredQuotePreview: '',
      quoteCount: 0,
      quotes: [],
      quoteIds: [],
      topThemes,
      themeLabels,
      lenses: resolvePrimaryLens(topThemes).map(lens => ({
        ...lens,
        url: getLensSearchUrl(lens.id),
      })),
      linkedWorkIds: [],
      linkedWorkCount: 0,
      url: getPhilosopherUrl(definition.slug),
      portraitUrl: directoryEntry?.portraitUrl || '',
      wikiTitle: directoryEntry?.wikiTitle || '',
      needsReferenceMetadata: false,
      isCommunitySubmitted: false,
      initials: name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join(''),
    };
  });

  fromQuotes.forEach(profile => {
    if (!profiles.some(item => item.slug === profile.slug)) {
      profiles.push(profile);
    }
  });

  return profiles.sort((a, b) => a.name.localeCompare(b.name));
}

export function getPhilosopherProfileBySlug(quotes = [], slug, philosopherDirectory = [], submittedProfiles = []) {
  const normalized = String(slug || '').trim();
  if (!normalized) return null;

  return buildPhilosopherIndexProfiles(quotes, philosopherDirectory, submittedProfiles)
    .find(profile => profile.slug === normalized) || null;
}
