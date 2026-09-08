/**
 * @file curatedTvIds.js
 * @description IDs TMDB das séries curadas, usados para inferir mediaType
 * quando o pareamento curado não o diz.
 *
 * Separado de philosopher-data.js para a home não carregar as biografias.
 */
export const CURATED_TV_IDS = new Set([
  '1396', '1399', '1402', '1668', '2316', '4607', '1418', '60735', '1429',
  '60625', '19885', '63174', '119051', '71446', '57243', '1104', '456',
  '1438', '70523', '1424', '1408', '62560', '1407', '1991', '9322', '43865',
  '88751', '128', '46260', '46298', '395',
]);
