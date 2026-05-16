/**
 * Removes duplicate daily pairing entries (same slug) keeping the first occurrence.
 * Run from repo root: node scripts/dedupe-daily-pairings.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'src', 'data', 'dailyPairings.json');

const raw = await fs.readFile(dataPath, 'utf8');
const DAILY_PAIRINGS = JSON.parse(raw);

const before = DAILY_PAIRINGS.length;
const seen = new Set();
const unique = [];

for (const entry of DAILY_PAIRINGS) {
  const key = entry.slug || `${entry.author}|${entry.quote}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(entry);
}

await fs.writeFile(dataPath, `${JSON.stringify(unique, null, 2)}\n`, 'utf8');

console.log(`dailyPairings.json: ${before} → ${unique.length} (removed ${before - unique.length} duplicates)`);
