/**
 * Syncs `public/scripts/mediaRankCore.js` from the canonical domain module.
 * Run: npm run extract:media-rank
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const domainPath = path.join(root, 'src', 'domain', 'mediaRanking', 'mediaRankCore.js');
const outPath = path.join(root, 'public', 'scripts', 'mediaRankCore.js');

let body = fs.readFileSync(domainPath, 'utf8');
body = body.replaceAll("from '../../../public/scripts/", "from './");

const header = `/**
 * Shared TMDB candidate ranking + quote profile for home page and server API.
 * Generated from src/domain/mediaRanking/mediaRankCore.js — run npm run extract:media-rank after edits.
 */
`;

const lines = body.split('\n');
const firstImport = lines.findIndex(line => line.startsWith('import '));
const rest = firstImport >= 0 ? lines.slice(firstImport).join('\n') : body;

fs.writeFileSync(outPath, `${header}${rest}\n`, 'utf8');
console.log('Wrote', path.relative(root, outPath));
