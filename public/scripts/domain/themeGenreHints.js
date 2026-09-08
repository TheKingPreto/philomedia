/**
 * @file themeGenreHints.js
 * @description Mapeamento tema filosófico → géneros TMDB (movie e tv).
 *
 * Vive separado de philosopher-data.js porque o pipeline de citações e o
 * ranqueamento de obras precisam só deste mapa, não das biografias.
 */
export const THEME_GENRE_HINTS = {
  suffering: { movie: [18, 9648, 10749], tv: [18, 9648, 10765] },
  tragedy: { movie: [18, 9648], tv: [18, 9648] },
  virtue: { movie: [12, 18, 10759], tv: [18, 10759, 16] },
  existentialism: { movie: [18, 878, 9648], tv: [18, 9648, 10765] },
  'self-knowledge': { movie: [18, 9648], tv: [18, 9648, 16] },
  alienation: { movie: [18, 878, 9648], tv: [18, 878, 9648, 10765] },
  stoicism: { movie: [18, 12, 28, 10752], tv: [18, 10759, 10768, 16] },
  'power-corruption': { movie: [18, 80, 53, 10752], tv: [18, 80, 10768, 10759] },
  'social-justice': { movie: [18, 80, 99, 10752], tv: [18, 80, 10768, 99] },
  'political-philosophy': { movie: [18, 80, 99, 10752], tv: [18, 80, 10768, 99] },
  'truth-deception': { movie: [9648, 53, 80], tv: [9648, 80, 10765] },
  epistemology: { movie: [9648, 53, 878], tv: [9648, 80, 10765] },
  metaphysics: { movie: [878, 9648, 14], tv: [10765, 9648, 18] },
  'memory-time': { movie: [9648, 18], tv: [9648, 18, 10765, 16] },
  humanism: { movie: [18, 12, 16], tv: [18, 16, 10759] },
  'feminism-equality': { movie: [18, 10749], tv: [18, 10766] },
  postmodernism: { movie: [9648, 878, 53], tv: [9648, 10765, 18] },
  'consciousness-ai': { movie: [878, 9648], tv: [10765, 9648] },
  aesthetics: { movie: [18, 16, 10402], tv: [18, 16, 10402] },
  romanticism: { movie: [10749, 18], tv: [18, 10766] },
  'sacred-profane': { movie: [18, 14, 9648, 36], tv: [18, 10765, 9648] },
  'social-contract': { movie: [18, 80, 10752], tv: [18, 10768, 80] },
  'technology-modernity': { movie: [878, 9648, 18], tv: [10765, 18, 9648] },
  'language-semiotics': { movie: [9648, 18, 99], tv: [9648, 18, 99] },
  hedonism: { movie: [35, 18, 10749], tv: [35, 18, 10766] },
  'war-and-conflict': { movie: [10752, 28, 18], tv: [10768, 10759, 18] },
  'the-other-alterity': { movie: [18, 10749, 12], tv: [18, 16, 10766] },
  utilitarianism: { movie: [18, 53, 80], tv: [18, 80, 9648] },
};

/**
 * Une hints movie+tv num único array (p.ex. home page que descobre por género TMDB).
 * @param {string} theme
 * @returns {number[]}
 */
export function flattenThemeGenreHint(theme) {
  const hint = THEME_GENRE_HINTS[theme];
  if (!hint) return [];
  if (Array.isArray(hint)) return hint;
  return [...new Set([...(hint.movie || []), ...(hint.tv || [])])];
}
