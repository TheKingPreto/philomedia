/**
 * Client helper for POST /api/tmdb/rank-candidates.
 * @param {{ themes: string[], themeWeights: Map<string, number>, keywords: string[], preferredGenres: number[] }} profile
 * @param {object[]} candidates TMDB-shaped items
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
export async function rankCandidatesRemote(profile, candidates, limit = 10) {
  const body = {
    profile: {
      themes: profile.themes,
      themeWeights: Object.fromEntries(profile.themeWeights),
      keywords: profile.keywords,
      preferredGenres: profile.preferredGenres,
    },
    candidates,
    limit,
  };

  const res = await fetch('/api/tmdb/rank-candidates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const data = await res.json();
  return Array.isArray(data?.results) ? data.results : [];
}
