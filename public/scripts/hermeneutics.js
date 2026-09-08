import { THEME_DATABASE } from './themedatabase.js';

/**
 * THEME_DATABASE é estático, então as ~400 expressões são compiladas uma vez
 * no carregamento do módulo. Compilá-las por chamada dominava o custo da
 * página de detalhes, que analisa o catálogo inteiro a cada obra aberta.
 */
const COMPILED_THEMES = Object.entries(THEME_DATABASE).map(([theme, keywordsWithWeights]) => ({
  theme,
  keywords: Object.entries(keywordsWithWeights)
    .filter(([keyword]) => keyword)
    .map(([keyword, weight]) => ({
      pattern: new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gu'),
      weight,
    })),
}));

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

  for (const { theme, keywords } of COMPILED_THEMES) {
    let currentThemeScore = 0;

    for (const { pattern, weight } of keywords) {
      const matches = cleaned.match(pattern);
      if (matches) currentThemeScore += matches.length * weight;
    }

    if (currentThemeScore > 0) themeScores.push({ theme, score: currentThemeScore });
  }

  return themeScores.sort((a, b) => b.score - a.score);
}
