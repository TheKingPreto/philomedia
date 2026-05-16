/**
 * @file curatedmatches.js
 * @description Maps TMDB media IDs to custom quote IDs for the best curated
 * philosophical match. This is the highest-priority lookup — it overrides
 * the automated theme analysis.
 *
 * Source of truth: `/data/curatedMatches.json` (served from `public/data/`).
 * Edit that file, then reload — no bundler required.
 *
 * To find the correct TMDB id for any title: open the details page, check
 * the URL bar for the `?id=` param, and use that value as the key here.
 *
 * Format: { "tmdbId": quoteId }
 *
 * Complementary philosophical tags per work: `curatedPhilosophicalProfiles.js`.
 */
import curatedQuoteMatches from '../data/curatedMatches.json' with { type: 'json' };

export { curatedQuoteMatches };
