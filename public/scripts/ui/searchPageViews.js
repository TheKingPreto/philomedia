/**
 * @file DOM helpers for the search page (loading, errors, empty states).
 */

import { t } from '/scripts/services/i18n.js';
import { escapeHtml } from '/scripts/ui/viewHelpers.js';

/**
 * @param {{ resultsMeta: HTMLElement, searchToolbar: HTMLElement, resultsContainer: HTMLElement }} els
 */
export function setSearchLoading(els, message = t('search.loading')) {
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
        ? `<p class="error-state-text">${t('search.error_tmdb')}</p>`
        : (isRateLimited ? `<p class="error-state-text">${t('search.error_rate_limit')}</p>` : '')}
    </div>
  `;
}

export function setSearchEmpty(els, message = t('search.empty_default')) {
  const { resultsMeta, searchToolbar, resultsContainer } = els;
  resultsMeta.hidden = true;
  searchToolbar.hidden = true;
  resultsContainer.innerHTML = `
    <div class="empty-state">
      <p class="empty-state-title">${escapeHtml(t('search.empty_title'))}</p>
      <p class="empty-state-text">${escapeHtml(message)}</p>
    </div>
  `;
}
