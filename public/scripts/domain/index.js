/**
 * @file Client-side domain data (filters, constants) shared across pages.
 */

export {
  LENS_FILTERS,
  MEDIA_FILTERS,
  RATING_FILTERS,
  SORT_FILTERS,
  getLensById,
  getRatingFilterById,
} from './searchFilters.js';

export {
  AUTHOR_LENS_MAP,
  DETAILS_RELATED_WORKS_LIMIT,
  GENERIC_QUOTE_PATTERNS,
  MIN_DECENT_SCORE,
  MIN_DECENT_THEME_SCORE,
  MIN_DECENT_TOKEN_SCORE,
  MIN_STRONG_THEME_SCORE,
  MIN_STRONG_TOKEN_SCORE,
  NOISE_WORDS,
  PHILOSOPHER_CONTEXT_STOPWORDS,
  QUOTE_SOURCE_BOOST,
} from './detailsPageConfig.js';

export { getDisplayDate, getDisplayTitle, getYear } from './detailsMediaHelpers.js';
export {
  buildQuoteFallbackKey,
  buildSearchQuery,
  buildSourceContext,
  createThemeWeightMap,
  extractSalientTokenGroups,
  extractSalientTokens,
  getQuoteAuthor,
  getQuoteSource,
  getQuoteText,
  mergeCandidateBuckets,
  normalizeQuoteEntry,
  rankRelatedCandidates,
  scoreQuoteAuthorLens,
  scoreQuoteQuality,
  scoreQuoteThemeAlignment,
  scoreQuoteTokenAlignmentGrouped,
} from './detailsQuotePipeline.js';

export {
  annotateResults,
  mergeResultsByIdentity,
  scoreLensAffinity,
} from './searchLensRanking.js';

export {
  applySearchToolbarFilters,
  balanceResultsByMedia,
  getReleaseTimestamp,
  getResultPriorityScore,
  getSyncFilteredSearchResults,
  sortVisibleSearchResults,
} from './searchResultTransforms.js';
