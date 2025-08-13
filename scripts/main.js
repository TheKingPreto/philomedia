import { getQuotes } from './philosophersapi.js';
import { getDetailsFromTMDB, getReviewsFromTMDB, discoverDiverseWorks } from './seriesapi.js';
import { analyzeWorkForThemes } from './hermeneutics.js';

export async function loadContent() {

  const allQuotes = await getQuotes();
  if (allQuotes.length === 0) {
    return { quote: "Could not load quotes at this time.", author: "System", results: [] };
  }
  const quoteObject = allQuotes[Math.floor(Math.random() * allQuotes.length)];

  let quoteThemes;
  if (quoteObject.themes && quoteObject.themes.length > 0) {
    quoteThemes = new Set(quoteObject.themes);
  } else {
    console.warn("Quote has no themes from API. Analyzing quote text itself...");
    const analyzedQuoteThemes = analyzeWorkForThemes(quoteObject.quote);
    quoteThemes = new Set(analyzedQuoteThemes.map(t => t.theme).slice(0, 2));
  }

  const candidateWorks = (await discoverDiverseWorks()).slice(0, 500);

  const analysisPromises = candidateWorks.map(async (work) => {
    try {
      const [details, reviews] = await Promise.all([
        getDetailsFromTMDB(work.id, work.media_type),
        getReviewsFromTMDB(work.id, work.media_type)
      ]);
      const combinedText = (details.overview || '') + ' ' + reviews.map(r => r.content).join(' ');

      const workThemeProfile = analyzeWorkForThemes(combinedText);

      let matchScore = 0;
      if (workThemeProfile.length > 0 && quoteThemes.size > 0) {
        workThemeProfile.forEach(themeProfile => {
          if (quoteThemes.has(themeProfile.theme)) {
            matchScore += themeProfile.score;
          }
        });
      }

      return { ...details, media_type: work.media_type, matchScore };
    } catch (error) {
      return { ...work, matchScore: 0 };
    }
  });

  const analyzedWorks = await Promise.all(analysisPromises);

  const bestMatches = analyzedWorks
    .filter(work => work.matchScore > 20)
    .sort((a, b) => b.matchScore - a.matchScore);

  return {
    quote: quoteObject.quote,
    author: quoteObject.author,
    results: bestMatches.slice(0, 20)
  };
}