/**
 * @file Pure string formatters for TMDB details (movies / TV).
 */

import { getYear } from '/scripts/domain/detailsMediaHelpers.js';

export function formatYear(dateString) {
  return getYear(dateString)?.toString() || 'Unknown year';
}

export function formatRuntime(details, type) {
  if (type === 'movie' && Number.isFinite(details.runtime) && details.runtime > 0) {
    const hours = Math.floor(details.runtime / 60);
    const minutes = details.runtime % 60;

    if (hours === 0) return `${minutes} min`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  if (type === 'tv') {
    const runtime = Array.isArray(details.episode_run_time)
      ? details.episode_run_time.find(value => Number.isFinite(value) && value > 0)
      : null;
    const seasons = Number.isFinite(details.number_of_seasons) && details.number_of_seasons > 0
      ? `${details.number_of_seasons} season${details.number_of_seasons === 1 ? '' : 's'}`
      : '';

    if (seasons && runtime) return `${seasons} | ${runtime} min episodes`;
    if (seasons) return seasons;
    if (runtime) return `${runtime} min episodes`;
  }

  return 'Runtime unavailable';
}

export function formatRating(details) {
  const voteAverage = Number(details.vote_average);
  const voteCount = Number(details.vote_count);

  if (!Number.isFinite(voteAverage) || voteAverage <= 0) {
    return '';
  }

  const rounded = voteAverage.toFixed(1);
  if (!Number.isFinite(voteCount) || voteCount <= 0) {
    return `${rounded}/10`;
  }

  return `${rounded}/10 from ${voteCount.toLocaleString()} votes`;
}

export function joinNames(items, key = 'name', limit = 3) {
  if (!Array.isArray(items) || items.length === 0) return '';

  return items
    .map(item => item?.[key])
    .filter(Boolean)
    .slice(0, limit)
    .join(', ');
}
