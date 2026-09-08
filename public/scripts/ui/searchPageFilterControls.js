/**
 * @file Search page filter chips and sort <select> (presentational).
 */

import {
  LENS_FILTERS,
  MEDIA_FILTERS,
  RATING_FILTERS,
  SORT_FILTERS,
  WATCH_PROVIDER_FILTERS,
  isLensChipVisible,
  partitionLensFilters,
} from '/scripts/domain/searchFilters.js';
import { getLensToggleCopy, getLocalizedFilterCopy } from '/scripts/services/searchFilterI18n.js';

export function renderSearchFilterChip(container, filter, activeId, groupName, options = {}) {
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
  if (options.describedBy) {
    button.setAttribute('aria-describedby', options.describedBy);
  }
  if (options.hidden) {
    button.hidden = true;
  }

  container.appendChild(button);
  return button;
}

function renderActiveLensSummary(lensSummaryEl, activeLensId) {
  if (!lensSummaryEl) return;

  const lens = LENS_FILTERS.find(filter => filter.id === activeLensId);
  const summary = lens ? getLocalizedFilterCopy(lens, 'lens').summary : '';

  if (!summary) {
    lensSummaryEl.hidden = true;
    lensSummaryEl.textContent = '';
    return;
  }

  lensSummaryEl.hidden = false;
  lensSummaryEl.textContent = summary;
}

function renderLensToggle(container, expanded) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'filter-chip lens-expand-chip';
  button.dataset.action = 'toggle-lenses';
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  button.setAttribute('aria-controls', 'lens-suggestions-more');
  button.textContent = getLensToggleCopy(expanded);
  container.appendChild(button);
  return button;
}

/**
 * @param {{ lens: string, media: string, rating: string, provider?: string, sort: string }} filters
 */
export function renderSearchFilterControls({
  lensSuggestionsContainer,
  lensSummaryEl,
  mediaFiltersContainer,
  ratingFiltersContainer,
  providerFiltersContainer,
  sortSelect,
  filters,
  lensesExpanded = false,
}) {
  lensSuggestionsContainer.innerHTML = '';
  mediaFiltersContainer.innerHTML = '';
  ratingFiltersContainer.innerHTML = '';
  if (providerFiltersContainer) providerFiltersContainer.innerHTML = '';

  const { featured, rest } = partitionLensFilters(LENS_FILTERS);
  const activeLensId = filters.lens;
  const summaryId = lensSummaryEl?.id || '';
  const activeSummary = activeLensId !== 'all' && summaryId ? summaryId : '';

  featured.forEach(filter => {
    renderSearchFilterChip(lensSuggestionsContainer, filter, activeLensId, 'lens', {
      describedBy: filter.id === activeLensId ? activeSummary : '',
    });
  });

  const extras = document.createElement('span');
  extras.id = 'lens-suggestions-more';
  extras.className = 'lens-chip-extras';
  rest.forEach(filter => {
    renderSearchFilterChip(extras, filter, activeLensId, 'lens', {
      describedBy: filter.id === activeLensId ? activeSummary : '',
      hidden: !isLensChipVisible(filter.id, {
        expanded: lensesExpanded,
        activeLensId,
      }),
    });
  });
  lensSuggestionsContainer.appendChild(extras);
  renderLensToggle(lensSuggestionsContainer, lensesExpanded);
  renderActiveLensSummary(lensSummaryEl, activeLensId);

  MEDIA_FILTERS.forEach(filter => {
    renderSearchFilterChip(mediaFiltersContainer, filter, filters.media, 'media');
  });

  RATING_FILTERS.forEach(filter => {
    renderSearchFilterChip(ratingFiltersContainer, filter, filters.rating, 'rating');
  });

  if (providerFiltersContainer) {
    WATCH_PROVIDER_FILTERS.forEach(filter => {
      renderSearchFilterChip(providerFiltersContainer, filter, filters.provider || 'any', 'provider');
    });
  }

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
