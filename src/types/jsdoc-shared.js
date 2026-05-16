/**
 * @file jsdoc-shared.js
 * Central typedefs for editors / JSDoc (no runtime exports required).
 */

/**
 * @typedef {{ quoteText: string, authorName: string, themes?: string[], legacyId?: number|null, _id?: string }} QuoteDoc
 */

/**
 * @typedef {{ id?: string|number, quote?: string, quoteText?: string, author?: string, authorName?: string, themes?: string[], source?: string }} QuoteLike
 */

/**
 * @typedef {{ themes: string[], themeWeights: Map<string,number>, keywords: string[], preferredGenres: number[] }} QuoteProfile
 */

/**
 * @typedef {{ id: number, title?: string, name?: string, overview?: string, media_type?: string, genre_ids?: number[], vote_average?: number, popularity?: number, _sources?: string[] }} TmdbCandidate
 */

/**
 * JSON-safe quote profile for POST /api/tmdb/rank-candidates (`themeWeights` as object keys).
 * @typedef {{
 *   themes: string[],
 *   themeWeights: Record<string, number>,
 *   keywords: string[],
 *   preferredGenres: number[]
 * }} SerializedQuoteProfileJson
 */

/**
 * @typedef {{ profile: SerializedQuoteProfileJson, candidates: TmdbCandidate[], limit?: number }} RankCandidatesRequestBody
 */

/**
 * TMDB candidate after ranking (diagnostic scores from mediaRankCore).
 * @typedef {TmdbCandidate & {
 *   _score?: number,
 *   _primaryThemeMisses?: number,
 *   _evidenceScore?: number,
 *   _driftPenalty?: number
 * }} RankedTmdbCandidate
 */

/**
 * @typedef {{ results: RankedTmdbCandidate[] }} RankCandidatesResponseBody
 */

export {};
