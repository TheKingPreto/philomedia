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

// hermeneutics.js, viewHelpers.js e philosopher-data.js entram com a
// implementação real: o pipeline de citações depende do comportamento
// genuíno destes módulos para ser testado com sentido.
export { analyzeWorkForThemes } from '../../public/scripts/hermeneutics.js';
export { normalizeText } from '../../public/scripts/ui/viewHelpers.js';
export { THEME_GENRE_HINTS } from '../../public/scripts/domain/themeGenreHints.js';

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
export function preferReviewsByLanguage(reviews = []) {
  return Array.isArray(reviews) ? reviews : [];
}

export function extractItemTmdbKeywords() {
  return [];
}

export function itemHasLensKeywordHit() {
  return false;
}

export function getLensTextKeywords() {
  return [];
}

export function getLensById() {
  return null;
}

export const LENS_FILTERS = [];

export function rankTrendingByLensOverlap(items = []) {
  return items;
}

export function buildLensKeywordDiscoverOptions() {
  return {};
}

export function buildLensCrewDiscoverOptions() {
  return {};
}

export function buildWatchProviderDiscoverExtras() {
  return {};
}

// philosophersmatch.js (se usado)
export const matchPhilosopher = () => null;

// home.page.js (e outros pages) — mocks mínimos se testes importarem
export const loadContent = async () => ({});
export const loadMoreContent = async () => ({ results: [], hasMore: false, nextOffset: 0, totalWorks: 0 });

// default export vazio para imports sem named exports
export default {};
