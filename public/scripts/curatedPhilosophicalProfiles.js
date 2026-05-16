/**
 * @file curatedPhilosophicalProfiles.js
 * @description Canonical philosophical tags (THEME_DATABASE keys) per TMDB id,
 * for auditing and hybrid scoring (alongside TMDB genres + hermeneutics).
 * Quote id mapping lives in `curatedmatches.js` / `public/data/curatedMatches.json`.
 */

/**
 * @typedef {Object} CuratedPhilosophicalProfile
 * @property {'movie'|'tv'} [mediaType]
 * @property {string[]} philosophicalTags
 * @property {string} [primaryTheme]
 * @property {string[]} [excludedLenses] ids de LENS_FILTERS em domain/searchFilters.js
 * @property {string} [justification]
 */

import curatedPhilosophicalProfilesData from '../data/curatedPhilosophicalProfiles.json' with { type: 'json' };

/** @type {Record<string, CuratedPhilosophicalProfile>} */
export const curatedPhilosophicalProfiles = curatedPhilosophicalProfilesData;

/**
 * @param {string|number|null|undefined} tmdbId
 * @returns {CuratedPhilosophicalProfile|null}
 */
export function getCuratedPhilosophicalProfile(tmdbId) {
  if (tmdbId == null) return null;
  return curatedPhilosophicalProfiles[String(tmdbId)] || null;
}

/**
 * Alinha tags curadas aos pesos de tema de uma citação (home / perfil filósofo).
 * @param {CuratedPhilosophicalProfile|null} profile
 * @param {Map<string, number>} themeWeights
 */
export function scorePhilosophicalTagsAgainstThemeWeights(profile, themeWeights) {
  if (!profile?.philosophicalTags?.length || !themeWeights?.size) return 0;

  let score = 0;
  for (const tag of profile.philosophicalTags) {
    const w = themeWeights.get(tag);
    if (w) score += w * 72;
  }
  if (profile.primaryTheme) {
    const w = themeWeights.get(profile.primaryTheme);
    if (w) score += w * 26;
  }
  return Math.min(130, score);
}

/**
 * @param {CuratedPhilosophicalProfile|null} profile
 * @param {{ id: string, themes: string[] }} lens
 * @returns {{ bonus: number, excluded: boolean }}
 */
export function scoreCuratedProfileForLens(profile, lens) {
  if (!profile?.philosophicalTags?.length || !lens?.themes?.length) {
    return { bonus: 0, excluded: false };
  }
  if (profile.excludedLenses?.includes(lens.id)) {
    return { bonus: 0, excluded: true };
  }
  const lensSet = new Set(lens.themes);
  const hits = profile.philosophicalTags.filter(t => lensSet.has(t)).length;
  let bonus = hits * 32;
  if (profile.primaryTheme && lensSet.has(profile.primaryTheme)) {
    bonus += 22;
  }
  return { bonus, excluded: false };
}

/**
 * @param {CuratedPhilosophicalProfile|null} sourceProfile
 * @param {CuratedPhilosophicalProfile|null} candidateProfile
 * @param {Map<string, number>} sourceThemeWeights
 */
export function scoreCuratedRelatedAffinity(sourceProfile, candidateProfile, sourceThemeWeights) {
  let score = 0;

  if (candidateProfile?.philosophicalTags?.length && sourceThemeWeights?.size) {
    for (const tag of candidateProfile.philosophicalTags) {
      const w = sourceThemeWeights.get(tag);
      if (w) score += w * 95;
    }
  }

  if (sourceProfile?.philosophicalTags?.length && candidateProfile?.philosophicalTags?.length) {
    const a = new Set(sourceProfile.philosophicalTags);
    score += candidateProfile.philosophicalTags.filter(t => a.has(t)).length * 38;
  }

  return Math.min(160, score);
}
