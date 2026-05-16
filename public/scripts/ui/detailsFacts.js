/**
 * @file Details page “facts” strip: TMDB-derived labels + DOM render.
 */

import { formatRating, joinNames } from '/scripts/ui/detailsFormatters.js';

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

  const facts = [
    formatRating(details),
    getCreativeLead(details, type),
    getStudio(details, type),
    getGenres(details),
    getStreamingProviders(details),
  ].filter(Boolean);

  container.innerHTML = '';
  container.hidden = facts.length === 0;

  facts.forEach(fact => {
    const item = document.createElement('span');
    item.className = 'detail-fact';

    const value = document.createElement('span');
    value.className = 'detail-fact-value';
    value.textContent = fact;

    item.appendChild(value);
    container.appendChild(item);
  });
}
