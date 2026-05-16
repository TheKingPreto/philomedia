/**
 * @file DOM helpers for the search page (loading, errors, empty states).
 */

import { escapeHtml } from '/scripts/ui/viewHelpers.js';

/**
 * @param {{ resultsMeta: HTMLElement, searchToolbar: HTMLElement, resultsContainer: HTMLElement }} els
 */
export function setSearchLoading(els, message = 'Searching...') {
  const { resultsMeta, searchToolbar, resultsContainer } = els;
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="loading-skeleton" aria-hidden="true">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
    <p class="loading-message">${escapeHtml(message)}</p>
  `;
}

export function setSearchError(els, message, isServerError = false) {
  const { resultsMeta, searchToolbar, resultsContainer } = els;
  const isRateLimited = /too many/i.test(String(message || ''));
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="error-state">
      <p class="error-state-title">${escapeHtml(message)}</p>
      ${isServerError
        ? '<p class="error-state-text">Check that <code>TMDB_API_KEY</code> is set on the server.</p>'
        : (isRateLimited ? '<p class="error-state-text">Please wait a few seconds and try again. Theme exploration is now cached as you browse.</p>' : '')}
    </div>
  `;
}

export function setSearchEmpty(els, message = 'Try another search term.') {
  const { resultsMeta, searchToolbar, resultsContainer } = els;
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">No results found</p>
      <p class="empty-state-text">${escapeHtml(message)}</p>
    </div>
  `;
}
