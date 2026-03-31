/**
 * @file scripts/seed-quotes.js
 * @description Migrates all quotes from scripts/custom-quotes.js into MongoDB.
 *
 * Run once (or whenever custom-quotes.js is updated):
 *   node public/scripts/seed-quotes.js
 *
 * Safe to re-run — uses upsert on legacyId so existing docs are updated,
 * not duplicated. New quotes are inserted automatically.
 */

import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { customQuotes } from './custom-quotes.js';
import Quote from '../../src/models/Quote.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  let inserted = 0;
  let updated  = 0;
  let skipped  = 0;

  for (const q of customQuotes) {
    if (!q.quote || !q.author) {
      console.warn(`⚠️  Skipping quote id=${q.id} — missing quote or author`);
      skipped++;
      continue;
    }

    const result = await Quote.findOneAndUpdate(
      { legacyId: q.id },
      {
        $set: {
          quoteText:  q.quote,
          authorName: q.author,
          themes:     q.themes || [],
          legacyId:   q.id,
          isGenerated: false,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (result.createdAt && Date.now() - result.createdAt < 5000) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`\n📚 Seed complete:`);
  console.log(`   ${inserted} inserted`);
  console.log(`   ${updated}  updated`);
  console.log(`   ${skipped}  skipped`);
  console.log(`   ${customQuotes.length} total quotes in source\n`);

  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
