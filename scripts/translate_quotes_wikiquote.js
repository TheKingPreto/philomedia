import fs from 'node:fs/promises';
import path from 'node:path';
import * as dotenv from 'dotenv';
import { translateQuotesBatch } from '../src/services/QuoteTranslationService.js';

dotenv.config();

const SOURCE_PATH = path.resolve('quotes_wikiquote.json');
const TARGET_PATH = path.resolve('quotes_wikiquote.en.json');
const DEFAULT_BATCH_SIZE = 8;

function parseArgs(argv) {
  const values = {
    limit: Number.POSITIVE_INFINITY,
    batchSize: DEFAULT_BATCH_SIZE,
    offset: 0,
    strategy: 'coverage',
  };

  argv.forEach(arg => {
    if (arg.startsWith('--limit=')) {
      values.limit = Number(arg.split('=')[1]) || values.limit;
    }
    if (arg.startsWith('--batch-size=')) {
      values.batchSize = Number(arg.split('=')[1]) || values.batchSize;
    }
    if (arg.startsWith('--offset=')) {
      values.offset = Number(arg.split('=')[1]) || values.offset;
    }
    if (arg.startsWith('--strategy=')) {
      values.strategy = String(arg.split('=')[1] || values.strategy).trim().toLowerCase() || values.strategy;
    }
  });

  return values;
}

async function readJsonArray(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createKey(entry) {
  return `${entry.author}::${entry.originalText || entry.text}`;
}

function dedupeEntries(entries = []) {
  const deduped = new Map();

  entries.forEach(entry => {
    if (!entry?.author || !(entry?.originalText || entry?.text)) return;
    const key = createKey(entry);
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  });

  return [...deduped.values()];
}

function buildPendingEntries(sourceEntries, existingKeys, offset) {
  return sourceEntries
    .map((entry, sourceIndex) => ({
      entry,
      sourceIndex,
    }))
    .slice(offset)
    .filter(({ entry }) => entry?.text && entry?.author)
    .filter(({ entry }) => !existingKeys.has(createKey({
      author: entry.author,
      text: entry.text,
    })))
    .map(({ entry, sourceIndex }) => ({
      id: `wiki-${sourceIndex + 1}`,
      text: entry.text,
      author: entry.author,
      theme: entry.theme || '',
      source: entry.source || '',
      lang: entry.lang || 'pt',
    }));
}

function countTranslationsByAuthor(entries = []) {
  const counts = new Map();

  entries.forEach(entry => {
    const author = String(entry?.author || '').trim();
    if (!author) return;
    counts.set(author, (counts.get(author) || 0) + 1);
  });

  return counts;
}

function selectPendingEntries(pendingEntries, limit, strategy, existingAuthorCounts = new Map()) {
  if (strategy !== 'coverage') {
    return pendingEntries.slice(0, limit);
  }

  const byAuthor = new Map();
  pendingEntries.forEach(entry => {
    const current = byAuthor.get(entry.author) || [];
    current.push(entry);
    byAuthor.set(entry.author, current);
  });

  const orderedAuthors = [...byAuthor.keys()].sort((authorA, authorB) => {
    const existingCountA = existingAuthorCounts.get(authorA) || 0;
    const existingCountB = existingAuthorCounts.get(authorB) || 0;
    if (existingCountA !== existingCountB) return existingCountA - existingCountB;

    const pendingCountA = byAuthor.get(authorA)?.length || 0;
    const pendingCountB = byAuthor.get(authorB)?.length || 0;
    return pendingCountB - pendingCountA || authorA.localeCompare(authorB);
  });

  const selected = [];
  while (selected.length < limit) {
    let addedInRound = false;

    for (const author of orderedAuthors) {
      const entries = byAuthor.get(author) || [];
      if (!entries.length || selected.length >= limit) continue;
      selected.push(entries.shift());
      existingAuthorCounts.set(author, (existingAuthorCounts.get(author) || 0) + 1);
      addedInRound = true;
    }

    if (!addedInRound) break;
  }

  return selected;
}

async function writeTarget(entries) {
  await fs.writeFile(TARGET_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

async function main() {
  const { limit, batchSize, offset, strategy } = parseArgs(process.argv.slice(2));

  const [sourceEntries, existingTranslations] = await Promise.all([
    readJsonArray(SOURCE_PATH),
    readJsonArray(TARGET_PATH),
  ]);

  if (!sourceEntries.length) {
    throw new Error('No source quotes found in quotes_wikiquote.json.');
  }

  const normalizedExistingTranslations = dedupeEntries(existingTranslations);
  const existingKeys = new Set(normalizedExistingTranslations.map(createKey));
  const existingAuthorCounts = countTranslationsByAuthor(normalizedExistingTranslations);
  const pendingEntries = selectPendingEntries(
    buildPendingEntries(sourceEntries, existingKeys, offset),
    limit,
    strategy,
    existingAuthorCounts
  );

  if (!pendingEntries.length) {
    console.log('No pending Portuguese quotes to translate.');
    return;
  }

  console.log(`Translating ${pendingEntries.length} quotes to English...`);

  const translatedEntries = [...normalizedExistingTranslations];

  for (let index = 0; index < pendingEntries.length; index += batchSize) {
    const batch = pendingEntries.slice(index, index + batchSize);
    const translatedBatch = await translateQuotesBatch(batch);

    translatedEntries.push(...translatedBatch);
    await writeTarget(translatedEntries);

    console.log(`Processed ${Math.min(index + batch.length, pendingEntries.length)}/${pendingEntries.length}`);
  }

  console.log(`Done. Saved translations to ${TARGET_PATH}`);
}

main().catch(error => {
  console.error('Translation failed:', error.message);
  process.exit(1);
});
