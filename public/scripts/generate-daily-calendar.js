import fs from 'node:fs/promises';
import path from 'node:path';
import { customQuotes } from './custom-quotes.js';
import { THEME_BUCKETS } from './theme-buckets.js';

const ROOT = process.cwd();
const WIKIQUOTE_EN_PATH = path.resolve(ROOT, 'quotes_wikiquote.en.json');
const OUTPUT_PATH = path.resolve(ROOT, 'src', 'data', 'dailyPairings.generated.js');


  identity: {
    aliases: ['identity', 'self-knowledge', 'individuality', 'freedom', 'experience', 'autoconhecimento', 'identidade', 'humanism', 'humanidade'],
    works: [
      { tmdbId: '550', mediaType: 'movie' },
      { tmdbId: '324857', mediaType: 'movie' },
      { tmdbId: '372058', mediaType: 'movie' },
      { tmdbId: '603', mediaType: 'movie' },
      { tmdbId: '129', mediaType: 'movie' },
      { tmdbId: '38', mediaType: 'movie' },
      { tmdbId: '890', mediaType: 'tv' },
      { tmdbId: '1396', mediaType: 'tv' },
    ],
    context: 'Famous voices on self-knowledge, identity, freedom, and the work it takes to become who you are.',
  },
  power: {
    aliases: ['power-corruption', 'political-philosophy', 'strategy', 'perception', 'truth-deception', 'poder', 'corrupcao', 'political', 'politics', 'politica', 'poder', 'corrupcao', 'dominio', 'domination', 'filosofia politica', 'filosofia política', 'contratualismo'],
    works: [
      { tmdbId: '238', mediaType: 'movie' },
      { tmdbId: '1399', mediaType: 'tv' },
      { tmdbId: '1396', mediaType: 'tv' },
      { tmdbId: '155', mediaType: 'movie' },
      { tmdbId: '496243', mediaType: 'movie' },
      { tmdbId: '680', mediaType: 'movie' },
      { tmdbId: '311', mediaType: 'movie' },
      { tmdbId: '438631', mediaType: 'movie' },
    ],
    context: 'Works and quotes that explore power, strategy, image, and the price of control.',
  },
  love: {
    aliases: ['love', 'social-contract', 'community', 'compassion', 'humanism', 'intimacy', 'amor', 'amizade', 'carinho'],
    works: [
      { tmdbId: '152601', mediaType: 'movie' },
      { tmdbId: '38', mediaType: 'movie' },
      { tmdbId: '76', mediaType: 'movie' },
      { tmdbId: '80', mediaType: 'movie' },
      { tmdbId: '843', mediaType: 'movie' },
      { tmdbId: '66573', mediaType: 'tv' },
      { tmdbId: '9322', mediaType: 'tv' },
    ],
    context: 'Quoted reflections on love, care, shared worlds, and the labor of building relationships.',
  },
  justice: {
    aliases: ['social-justice', 'equality', 'activism', 'ideology', 'religion', 'conflict', 'justice', 'justica', 'direitos civis', 'direitos humanos', 'igualdade', 'liberdade', 'justica social', 'igualdade social'],
    works: [
      { tmdbId: '496243', mediaType: 'movie' },
      { tmdbId: '1438', mediaType: 'tv' },
      { tmdbId: '93405', mediaType: 'tv' },
      { tmdbId: '619264', mediaType: 'movie' },
      { tmdbId: '110415', mediaType: 'movie' },
      { tmdbId: '598', mediaType: 'movie' },
      { tmdbId: '424781', mediaType: 'movie' },
    ],
    context: 'A selection of quotes and media that engage social justice, inequality, and change.',
  },
  truth: {
    aliases: ['epistemology', 'truth-deception', 'postmodernism', 'language-semiotics', 'reason', 'skepticism', 'nihilism', 'verdade', 'conhecimento', 'idealismo', 'iluminismo', 'racionalismo', 'empirismo', 'ciência', 'ciencia', 'filosofia', 'linguagem', 'realidade', 'ciência e filosofia', 'arte e ciência', 'ciência', 'filosofia pré-socrática', 'neoplatonismo'],
    works: [
      { tmdbId: '603', mediaType: 'movie' },
      { tmdbId: '27205', mediaType: 'movie' },
      { tmdbId: '11324', mediaType: 'movie' },
      { tmdbId: '77', mediaType: 'movie' },
      { tmdbId: '37165', mediaType: 'movie' },
      { tmdbId: '62560', mediaType: 'tv' },
      { tmdbId: '63247', mediaType: 'tv' },
    ],
    context: 'Famous reflections on truth, reality, knowledge, and the limits of belief.',
  },
  ethics: {
    aliases: ['ethics', 'virtue', 'moral-philosophy', 'stoicism', 'purpose', 'open-mindedness', 'etica', 'virtude', 'moral', 'hedonismo'],
    works: [
      { tmdbId: '1424', mediaType: 'tv' },
      { tmdbId: '71712', mediaType: 'tv' },
      { tmdbId: '66573', mediaType: 'tv' },
      { tmdbId: '155', mediaType: 'movie' },
      { tmdbId: '603', mediaType: 'movie' },
      { tmdbId: '38', mediaType: 'movie' },
      { tmdbId: '157336', mediaType: 'movie' },
    ],
    context: 'Ethics, duty, choice, and the practical questions that make philosophy feel alive.',
  },
  time: {
    aliases: ['memory-time', 'time', 'change', 'hope', 'spirituality', 'tempo', 'mudanca', 'mudança', 'esperanca', 'esperança', 'vida', 'pessimismo', 'sofrimento'],
    works: [
      { tmdbId: '38', mediaType: 'movie' },
      { tmdbId: '329865', mediaType: 'movie' },
      { tmdbId: '157336', mediaType: 'movie' },
      { tmdbId: '70523', mediaType: 'tv' },
      { tmdbId: '77', mediaType: 'movie' },
      { tmdbId: '122906', mediaType: 'movie' },
      { tmdbId: '80', mediaType: 'movie' },
    ],
    context: 'Quotes about time, memory, loss, and the urgency of living well.',
  },
  culture: {
    aliases: ['postmodernism', 'technology-modernity', 'capitalism', 'alienation', 'utopia-dystopia', 'media', 'cultura', 'tecnologia', 'modernidade', 'utopia', 'aliens', 'arte', 'literatura', 'filosofia e literatura', 'arte e ciência', 'feminismo'],
    works: [
      { tmdbId: '78', mediaType: 'movie' },
      { tmdbId: '152601', mediaType: 'movie' },
      { tmdbId: '264660', mediaType: 'movie' },
      { tmdbId: '63247', mediaType: 'tv' },
      { tmdbId: '42009', mediaType: 'tv' },
      { tmdbId: '60574', mediaType: 'tv' },
      { tmdbId: '180', mediaType: 'movie' },
    ],
    context: 'Culture, technology, simulation, and the philosophical questions of modern life.',
  },
};


function removeDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuoteTheme(theme) {
  if (!theme) return null;
  const normalized = removeDiacritics(String(theme));
  return normalized;
}

function findMajorTheme(themes = []) {
  const normalized = themes
    .map(theme => normalizeQuoteTheme(theme))
    .filter(Boolean);

  for (const theme of normalized) {
    for (const [bucket, data] of Object.entries(THEME_BUCKETS)) {
      if (data.aliases.some(alias => removeDiacritics(alias) === theme)) return bucket;
    }
  }

  return null;
}

function slugify(text) {
  return removeDiacritics(String(text || ''))
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function buildEntry({ quote, author, themes, source }) {
  const majorTheme = findMajorTheme(themes);
  if (!majorTheme) return null;
  const bucket = THEME_BUCKETS[majorTheme];
  const slug = `${removeDiacritics(author).replace(/[^a-z0-9]+/gu, '-')}-${slugify(quote.split(' ').slice(0, 5).join(' '))}`;

  return {
    slug: slug.slice(0, 60),
    quote: quote.trim(),
    author: author.trim(),
    themes: themes.map(t => removeDiacritics(t || '')).filter(Boolean),
    context: bucket.context,
    works: bucket.works,
    source,
  };
}

async function readWikiQuoteEntries() {
  try {
    const raw = await fs.readFile(WIKIQUOTE_EN_PATH, 'utf8');
    const records = JSON.parse(raw);
    return Array.isArray(records) ? records : [];
  } catch (error) {
    console.error('Failed to read wikiquote file:', error.message);
    return [];
  }
}

async function generateCalendar() {
  const wikiEntries = await readWikiQuoteEntries();

  const allQuotes = [
    ...customQuotes.map(entry => ({
      quote: entry.quote,
      author: entry.author,
      themes: entry.themes,
      source: 'custom',
    })),
    ...wikiEntries
      .filter(entry => entry.author && entry.text)
      .map(entry => ({
        quote: entry.text,
        author: entry.author,
        themes: [entry.theme],
        source: 'wikiquote',
      })),
  ];

  const entries = allQuotes
    .map(buildEntry)
    .filter(Boolean)
    .reduce((acc, current) => {
      if (!acc.some(item => item.quote === current.quote && item.author === current.author)) {
        acc.push(current);
      }
      return acc;
    }, []);

  const output = `/* eslint-disable max-len */\nexport const DAILY_PAIRINGS = ${JSON.stringify(entries, null, 2)};\n`;
  await fs.writeFile(OUTPUT_PATH, output, 'utf8');

  console.log(`Generated ${entries.length} daily pairing entries to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

await generateCalendar();

// Export for use in other scripts
export { THEME_BUCKETS };
