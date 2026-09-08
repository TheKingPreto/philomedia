/**
 * @file scripts/import_quotes_wikiquote.js
 * @description Imports quotes from quotes_wikiquote.json into MongoDB.
 *
 * Usage:
 *   node scripts/import_quotes_wikiquote.js
 *
 * Features:
 *  - Uses MONGODB_URI from .env (never hardcoded)
 *  - Deduplicates by quoteText — safe to run multiple times
 *  - Skips quotes missing text or author
 *  - Processes in batches to avoid memory issues with large files
 *  - Reports inserted / skipped / error counts clearly
 *
 * Wikiquote JSON format expected:
 *  [{ text, author, theme, context?, source?, lang? }, ...]
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import Quote from '../src/models/Quote.js';

dotenv.config();

const FILE_PATH  = path.resolve('quotes_wikiquote.json');
const BATCH_SIZE = 200;

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

async function main() {
  // ─── Load file ──────────────────────────────────────────────────────────────
  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ File not found: ${FILE_PATH}`);
    process.exit(1);
  }

  let rawData;
  try {
    rawData = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
  } catch (e) {
    console.error('❌ Failed to parse quotes_wikiquote.json:', e.message);
    process.exit(1);
  }

  const allQuotes = Array.isArray(rawData) ? rawData : (rawData.quotes || []);
  console.log(`📂 Loaded ${allQuotes.length} quotes from file`);

  // ─── Connect ────────────────────────────────────────────────────────────────
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  // ─── Process in batches ──────────────────────────────────────────────────────
  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;

  for (let i = 0; i < allQuotes.length; i += BATCH_SIZE) {
    const batch = allQuotes.slice(i, i + BATCH_SIZE);

    const ops = batch
      .filter(q => {
        // Must have text and author — skip silently
        if (!q.text?.trim() || !q.author?.trim()) {
          skipped++;
          return false;
        }
        // Basic length guard (model has maxlength: 500)
        if (q.text.trim().length > 500) {
          skipped++;
          return false;
        }
        return true;
      })
      .map(q => ({
        updateOne: {
          filter: { quoteText: q.text.trim() },   // deduplicate by exact text
          update: {
            $setOnInsert: {
              quoteText:   q.text.trim(),
              authorName:  q.author.trim().slice(0, 100),
              themes:      q.theme ? [q.theme] : [],
              isGenerated: false,
              createdAt:   new Date(),
            },
          },
          upsert: true,
        },
      }));

    if (ops.length === 0) continue;

    try {
      const result = await Quote.bulkWrite(ops, { ordered: false });
      inserted += result.upsertedCount;
      skipped  += result.matchedCount; // already existed
    } catch (err) {
      // bulkWrite with ordered:false continues on duplicate key errors
      // Only truly unexpected errors are caught here
      console.error(`  ⚠️  Batch ${i}–${i + BATCH_SIZE} partial error:`, err.message);
      errors++;
    }

    const progress = Math.min(i + BATCH_SIZE, allQuotes.length);
    process.stdout.write(`\r  Progress: ${progress}/${allQuotes.length}`);
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  const total = await Quote.countDocuments();
  console.log('\n');
  console.log('📚 Import complete:');
  console.log(`   ${inserted} new quotes inserted`);
  console.log(`   ${skipped}  skipped (duplicate or invalid)`);
  console.log(`   ${errors}   batch errors`);
  console.log(`   ${total}    total quotes in collection\n`);

  await mongoose.disconnect();
  console.log('✅ Done');
}

main().catch(err => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
