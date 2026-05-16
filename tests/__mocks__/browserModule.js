/**
 * @file tests/__mocks__/browserModule.js
 *
 * Mock para todos os módulos frontend importados via paths absolutos
 * de browser (/scripts/...). O Jest redireciona esses imports aqui via
 * moduleNameMapper no package.json.
 *
 * Exporta no-ops para cada named export usado nos scripts de browser,
 * evitando erros de "does not provide an export named X" nos testes.
 */

// seriesapi.js
export const getDetailsFromTMDB = async () => ({});
export const getReviewsFromTMDB = async () => [];

// philosophersapi.js
export const getQuotes = async () => [];
export const getQuoteCatalog = async () => [];

// hermeneutics.js
export const analyzeWorkForThemes = () => [];

// curatedmatches.js
export const curatedQuoteMatches = {};

// curatedPhilosophicalProfiles.js
export const curatedPhilosophicalProfiles = {};
export function getCuratedPhilosophicalProfile() {
  return null;
}
export function scorePhilosophicalTagsAgainstThemeWeights() {
  return 0;
}
export function scoreCuratedProfileForLens() {
  return { bonus: 0, excluded: false };
}
export function scoreCuratedRelatedAffinity() {
  return 0;
}

// philosophersmatch.js (se usado)
export const matchPhilosopher = () => null;

// home.page.js (e outros pages) — mocks mínimos se testes importarem
export const loadContent = async () => ({});
export const loadMoreContent = async () => ({ results: [], hasMore: false, nextOffset: 0, totalWorks: 0 });

// default export vazio para imports sem named exports
export default {};
