import { getPhilosophyQuote } from './philosophyQuoteManager.js';
import { searchTMDB } from './seriesAPI.js';

// Basic English stopwords (you can expand)
const stopwords = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'not', 'but', 'you',
  'your', 'are', 'was', 'were', 'they', 'their', 'them', 'what', 'when', 'which',
  'where', 'how', 'why', 'all', 'any', 'can', 'her', 'his', 'our', 'has', 'had',
  'will', 'would', 'there', 'then', 'she', 'he', 'him', 'its', 'out', 'about',
  'who', 'get', 'got', 'one', 'two', 'more', 'some', 'than', 'like', 'just', 'also'
]);

function extractKeywords(phrase) {
  return phrase
    .toLowerCase()
    .replace(/[.,;:!?]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word));
}

function overviewContainsKeyword(overview, keyword) {
  if (!overview) return false;
  return overview.toLowerCase().includes(keyword.toLowerCase());
}

export async function loadContent(genresFilter = []) {
  const { quote, author } = await getPhilosophyQuote();
  const keywords = extractKeywords(quote);

  // For each keyword, search TMDB and filter only results whose overview contains the keyword
  const allResultsArrays = await Promise.all(
    keywords.map(async kw => {
      const results = await searchTMDB(kw);
      return results.filter(item => overviewContainsKeyword(item.overview, kw));
    })
  );

  // Merge all results, removing duplicates by id
  const allResultsMap = new Map();
  allResultsArrays.flat().forEach(item => {
    if (!allResultsMap.has(item.id)) {
      allResultsMap.set(item.id, item);
    }
  });

  let results = Array.from(allResultsMap.values());

  // Filter by genres if provided
  if (genresFilter.length > 0) {
    results = results.filter(item => {
      if (!item.genre_ids) return false;
      return genresFilter.some(gid => item.genre_ids.includes(gid));
    });
  }

  // Sort results by the number of keywords found in overview (descending)
  results.sort((a, b) => {
    const aCount = keywords.filter(k => overviewContainsKeyword(a.overview, k)).length;
    const bCount = keywords.filter(k => overviewContainsKeyword(b.overview, k)).length;
    return bCount - aCount;
  });

  return { quote, author, results };
}
