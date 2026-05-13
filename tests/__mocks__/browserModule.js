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

// philosophersmatch.js (se usado)
export const matchPhilosopher = () => null;

// main.js / search.js (se usados)
export const loadContent = async () => ({});

// default export vazio para imports sem named exports
export default {};
