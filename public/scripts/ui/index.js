/**
 * @file Shared presentational helpers for PhiloMedia pages.
 */

export { escapeHtml, normalizeText, setHidden } from './viewHelpers.js';
export {
  formatYear,
  formatRuntime,
  formatRating,
  joinNames,
} from './detailsFormatters.js';
export { renderFacts } from './detailsFacts.js';
export { setSearchEmpty, setSearchError, setSearchLoading } from './searchPageViews.js';
export {
  renderSearchFilterChip,
  renderSearchFilterControls,
  renderSearchSortControl,
} from './searchPageFilterControls.js';
