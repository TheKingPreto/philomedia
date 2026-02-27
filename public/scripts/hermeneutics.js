import { THEME_DATABASE } from './themedatabase.js';

export function analyzeWorkForThemes(text) {
  if (!text) return [];

  // Normalize: remove diacritics, lowercase, collapse whitespace
  const normalized = text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[\p{P}\p{S}]/gu, ' ') // remove punctuation and symbols
    .toLowerCase();

  const cleaned = normalized.replace(/\s+/g, ' ').trim();
  const themeScores = [];

  for (const [theme, keywordsWithWeights] of Object.entries(THEME_DATABASE)) {
    let currentThemeScore = 0;

    for (const [keyword, weight] of Object.entries(keywordsWithWeights)) {
      if (!keyword) continue;
      const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'gu');
      const matches = cleaned.match(re);
      const occurrences = matches ? matches.length : 0;
      if (occurrences > 0) currentThemeScore += occurrences * weight;
    }

    if (currentThemeScore > 0) themeScores.push({ theme, score: currentThemeScore });
  }

  return themeScores.sort((a, b) => b.score - a.score);
}