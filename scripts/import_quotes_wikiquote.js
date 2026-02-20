import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import Quote from '../src/models/Quote.js';

const BATCH_SIZE = 500;
const FILE_PATH = path.resolve('quotes_wikiquote.json');

async function main() {
  await mongoose.connect('mongodb://localhost:27017/philomedia', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const fileContent = fs.readFileSync(FILE_PATH, 'utf-8');
  let quotesArr = JSON.parse(fileContent);

  // If file is an array, use directly. If not, extract array.
  if (!Array.isArray(quotesArr)) {
    quotesArr = quotesArr.quotes || [];
  }

  for (let i = 0; i < quotesArr.length; i += BATCH_SIZE) {
    const batch = quotesArr.slice(i, i + BATCH_SIZE);
    const formattedBatch = batch.map(q => ({
      quoteText: q.text || '',
      authorName: q.author || '',
      themes: q.theme ? [q.theme] : [],
    }));
    try {
      await Quote.insertMany(formattedBatch);
      console.log(`Imported batch ${i + 1} to ${Math.min(i + BATCH_SIZE, quotesArr.length)}`);
    } catch (err) {
      console.error('Error importing batch:', err);
    }
  }

  await mongoose.disconnect();
  console.log('Import finished.');
}

main();
