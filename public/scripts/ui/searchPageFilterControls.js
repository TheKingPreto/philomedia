/**
 * @file Search page filter chips and sort <select> (presentational).
 */

import {
  LENS_FILTERS,
  MEDIA_FILTERS,
  RATING_FILTERS,
  SORT_FILTERS,
} from '/scripts/domain/searchFilters.js';
import { getLocalizedFilterCopy } from '/scripts/services/searchFilterI18n.js';

export function renderSearchFilterChip(container, filter, activeId, groupName) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-chip';
  if (filter.id === activeId) {
    button.classList.add('is-active');
    button.setAttribute('aria-pressed', 'true');
  } else {
    button.setAttribute('aria-pressed', 'false');
  }

  button.dataset.group = groupName;
  button.dataset.value = filter.id;
  const copy = getLocalizedFilterCopy(filter, groupName);
  button.textContent = copy.label;
  if (copy.summary) {
    button.title = copy.summary;
  }

  container.appendChild(button);
}

/**
 * @param {{ lens: string, media: string, rating: string, sort: string }} filters
 */
export function renderSearchFilterControls({
  lensSuggestionsContainer,
  mediaFiltersContainer,
  ratingFiltersContainer,
  sortSelect,
  filters,
}) {
  lensSuggestionsContainer.innerHTML = '';
  mediaFiltersContainer.innerHTML = '';
  ratingFiltersContainer.innerHTML = '';

  LENS_FILTERS.forEach(filter => {
    renderSearchFilterChip(lensSuggestionsContainer, filter, filters.lens, 'lens');
  });

  MEDIA_FILTERS.forEach(filter => {
    renderSearchFilterChip(mediaFiltersContainer, filter, filters.media, 'media');
  });

  RATING_FILTERS.forEach(filter => {
    renderSearchFilterChip(ratingFiltersContainer, filter, filters.rating, 'rating');
  });

  if (sortSelect) {
    sortSelect.value = filters.sort;
  }
}

export function renderSearchSortControl(sortSelect, sortValue) {
  if (!sortSelect) return;

  sortSelect.innerHTML = '';
  SORT_FILTERS.forEach(filter => {
    const option = document.createElement('option');
    option.value = filter.id;
    option.textContent = getLocalizedFilterCopy(filter, 'sort').label;
    sortSelect.appendChild(option);
  });

  sortSelect.value = sortValue;
}
