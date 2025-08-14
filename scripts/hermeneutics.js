import { THEME_DATABASE } from '/philomedia/scripts/themedatabase.js';

export function analyzeWorkForThemes(text) {
  if (!text) return [];

  const lowerCaseText = text.toLowerCase();
  const themeScores = [];

  for (const [theme, keywordsWithWeights] of Object.entries(THEME_DATABASE)) {
    let currentThemeScore = 0;
    
    for (const [keyword, weight] of Object.entries(keywordsWithWeights)) {
      const occurrences = lowerCaseText.split(keyword).length - 1;
      
      if (occurrences > 0) {
        currentThemeScore += occurrences * weight;
      }
    }

    if (currentThemeScore > 0) {
      themeScores.push({ theme: theme, score: currentThemeScore });
    }
  }

  return themeScores.sort((a, b) => b.score - a.score);
}