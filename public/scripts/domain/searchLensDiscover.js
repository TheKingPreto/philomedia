/**
 * First paint da busca por lente: no máximo um discover por tipo de mídia
 * (keywords). Crew / página 2 / género só entram se o pool ficar curto.
 * Reviews TMDB não fazem parte desta listagem.
 */

import {
  buildLensCrewDiscoverOptions,
  buildLensGenreDiscoverOptions,
  buildLensKeywordDiscoverOptions,
} from './searchFilters.js';

export const LENS_DISCOVER_SHORT_POOL = 16;
export const LENS_DISCOVER_SHORT_PER_MEDIA = 5;
export const LENS_DISCOVER_MIN_POOL = 12;
export const LENS_DISCOVER_MIN_PER_MEDIA = 4;

function withSort(options, sortBy = 'vote_average.desc') {
  return { page: 1, sortBy, ...options };
}

export function countLensDiscoverPool(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    total: list.length,
    movies: list.filter(item => item?.media_type === 'movie').length,
    series: list.filter(item => item?.media_type === 'tv').length,
  };
}

export function isLensDiscoverPoolShort(items = [], {
  minTotal = LENS_DISCOVER_SHORT_POOL,
  minPerMedia = LENS_DISCOVER_SHORT_PER_MEDIA,
} = {}) {
  const counts = countLensDiscoverPool(items);
  return counts.total < minTotal || counts.movies < minPerMedia || counts.series < minPerMedia;
}

export function buildLensPrimaryDiscoverJobs(lens, extras = {}) {
  const keywordOptions = buildLensKeywordDiscoverOptions(lens, extras);
  const hasKeywords = Boolean(keywordOptions.withKeywords);

  return [
    {
      mediaType: 'movie',
      options: withSort(hasKeywords
        ? keywordOptions
        : buildLensGenreDiscoverOptions(lens, 'movie', extras)),
    },
    {
      mediaType: 'tv',
      options: withSort(hasKeywords
        ? keywordOptions
        : buildLensGenreDiscoverOptions(lens, 'tv', extras)),
    },
  ];
}

export function buildLensCrewDiscoverJobs(lens, extras = {}) {
  const crewOptions = buildLensCrewDiscoverOptions(lens, extras);
  if (!crewOptions.withCrew) return [];

  return [
    { mediaType: 'movie', options: withSort(crewOptions) },
    { mediaType: 'tv', options: withSort(crewOptions) },
  ];
}

export function buildLensShortPoolFallbackJobs(lens, extras = {}, { page = 2 } = {}) {
  const keywordOptions = buildLensKeywordDiscoverOptions(lens, extras);
  const hasKeywords = Boolean(keywordOptions.withKeywords);

  return [
    {
      mediaType: 'movie',
      options: {
        page,
        sortBy: 'vote_average.desc',
        ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'movie', extras)),
      },
    },
    {
      mediaType: 'tv',
      options: {
        page,
        sortBy: 'vote_average.desc',
        ...(hasKeywords ? keywordOptions : buildLensGenreDiscoverOptions(lens, 'tv', extras)),
      },
    },
  ];
}

export function buildLensGenreFallbackJobs(lens, extras = {}) {
  return [
    {
      mediaType: 'movie',
      options: withSort(buildLensGenreDiscoverOptions(lens, 'movie', extras)),
    },
    {
      mediaType: 'tv',
      options: withSort(buildLensGenreDiscoverOptions(lens, 'tv', extras)),
    },
  ];
}
