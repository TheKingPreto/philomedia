import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonPath = path.join(__dirname, 'dailyPairings.json');

/** @type {readonly object[]} */
export const DAILY_PAIRINGS = JSON.parse(readFileSync(jsonPath, 'utf8'));
