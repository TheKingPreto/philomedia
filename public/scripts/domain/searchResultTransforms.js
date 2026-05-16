/**
 * @file Search result ordering, toolbar filtering, and media balancing (browser domain).
 */

import { getLensById } from '/scripts/domain/searchFilters.js';
import { scoreLensAffinity } from '/scripts/domain/searchLensRanking.js';

export function getReleaseTimestamp(item) {
  const rawDate = item.release_date || item.first_air_date || '';
  const timestamp = Date.parse(rawDate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function getResultPriorityScore(item) {
  if (Number.isFinite(item._activeLensScore)) return item._activeLensScore;
  if (Number.isFinite(item._discoveryScore)) return item._discoveryScore;
  if (Number.isFinite(item._combinedLensScore)) return item._combinedLensScore;
  return Number(item.vote_average) || 0;
}

export function balanceResultsByMedia(items, limit) {
  const movies = items.filter(item => item.media_type === 'movie');
  const series = items.filter(item => item.media_type === 'tv');

  if (!movies.length || !series.length) {
    return items.slice(0, limit);
  }

  const orderedBuckets = getResultPriorityScore(movies[0]) >= getResultPriorityScore(series[0])
    ? [movies, series]
    : [series, movies];

  const blended = [];
  while (blended.length < limit && (orderedBuckets[0].length || orderedBuckets[1].length)) {
    orderedBuckets.forEach(bucket => {
      if (bucket.length && blended.length < limit) {
        blended.push(bucket.shift());
      }
    });
  }

  return blended;
}

export function applySearchToolbarFilters(items, { media, ratingMin }) {
  let filtered = [...items];

  if (media !== 'all') {
    filtered = filtered.filter(item => item.media_type === media);
  }

  if (ratingMin > 0) {
    filtered = filtered.filter(item => Number(item.vote_average || 0) >= ratingMin);
  }

  return filtered;
}

export function sortVisibleSearchResults(items, sortId) {
  const visible = [...items];

  if (sortId === 'rating') {
    return visible.sort((a, b) =>
      (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || (Number(b.vote_count) || 0) - (Number(a.vote_count) || 0)
      || getResultPriorityScore(b) - getResultPriorityScore(a)
      || a._searchIndex - b._searchIndex
    );
  }

  if (sortId === 'recent') {
    return visible.sort((a, b) =>
      getReleaseTimestamp(b) - getReleaseTimestamp(a)
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || getResultPriorityScore(b) - getResultPriorityScore(a)
      || a._searchIndex - b._searchIndex
    );
  }

  if (sortId === 'popularity') {
    return visible.sort((a, b) =>
      (Number(b.popularity) || 0) - (Number(a.popularity) || 0)
      || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
      || getResultPriorityScore(b) - getResultPriorityScore(a)
      || a._searchIndex - b._searchIndex
    );
  }

  return visible;
}

/**
 * @param {{ lens: string, media: string, ratingMin: number }} filters
 */
export function getSyncFilteredSearchResults({
  items,
  filters,
  discoveryLensId,
  lensDisplayLimit,
}) {
  const filtered = applySearchToolbarFilters(items, {
    media: filters.media,
    ratingMin: filters.ratingMin,
  });

  const activeLens = getLensById(filters.lens);
  if (activeLens) {
    const ranked = filtered
      .map(item => ({
        ...item,
        _activeLensScore: scoreLensAffinity(item, activeLens),
      }))
      .sort((a, b) =>
        b._activeLensScore - a._activeLensScore
        || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
        || a._searchIndex - b._searchIndex
      );

    const strongMatches = ranked.filter(item => item._activeLensScore >= 9);
    const selected = (strongMatches.length >= 8 ? strongMatches : ranked).slice(0, lensDisplayLimit);
    return filters.media === 'all'
      ? balanceResultsByMedia(selected, lensDisplayLimit)
      : selected;
  }

  if (discoveryLensId) {
    const discoveryLens = getLensById(discoveryLensId);
    if (discoveryLens) {
      return filtered
        .sort((a, b) =>
          scoreLensAffinity(b, discoveryLens) - scoreLensAffinity(a, discoveryLens)
          || (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0)
        )
        .slice(0, lensDisplayLimit);
    }
  }

  return filtered.sort((a, b) => a._searchIndex - b._searchIndex);
}
