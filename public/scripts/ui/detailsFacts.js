/**
 * @file Details page “facts” strip: TMDB-derived labels + DOM render.
 */

import { formatRating, joinNames } from '/scripts/ui/detailsFormatters.js';
import { t } from '/scripts/services/i18n.js';

function getCreativeLead(details, type) {
  if (type === 'tv') {
    return joinNames(details.created_by, 'name', 3);
  }

  const directors = Array.isArray(details.credits?.crew)
    ? details.credits.crew.filter(person => person?.job === 'Director')
    : [];

  return joinNames(directors, 'name', 3);
}

function getStudio(details, type) {
  const source =
    type === 'tv' && Array.isArray(details.networks) && details.networks.length > 0
      ? details.networks
      : details.production_companies;

  return joinNames(source, 'name', 3);
}

function getGenres(details) {
  return joinNames(details.genres, 'name', 4);
}

function getStreamingProviders(details) {
  const providers = details.watchProviders?.providers;
  if (!Array.isArray(providers) || providers.length === 0) return '';

  return providers
    .map(provider => provider?.provider_name)
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
}

export function renderFacts(details, type) {
  const container = document.getElementById('details-facts');
  if (!container) return;

  const tmdbScore = formatRating(details);
  const facts = [
    tmdbScore
      ? { className: 'detail-fact detail-fact-tmdb', label: t('details.tmdb_rating'), value: tmdbScore }
      : null,
    { className: 'detail-fact', value: getCreativeLead(details, type) },
    { className: 'detail-fact', value: getStudio(details, type) },
    { className: 'detail-fact', value: getGenres(details) },
    { className: 'detail-fact', value: getStreamingProviders(details) },
  ].filter(fact => fact?.value);

  container.innerHTML = '';
  container.hidden = facts.length === 0;

  facts.forEach(fact => {
    const item = document.createElement('span');
    item.className = fact.className;

    if (fact.label) {
      const label = document.createElement('span');
      label.className = 'detail-fact-label';
      label.textContent = fact.label;
      item.appendChild(label);
    }

    const value = document.createElement('span');
    value.className = 'detail-fact-value';
    value.textContent = fact.value;

    item.appendChild(value);
    container.appendChild(item);
  });
}
