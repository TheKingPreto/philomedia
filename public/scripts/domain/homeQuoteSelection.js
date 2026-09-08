/**
 * Citação da home: a mesma selecção da página de detalhes.
 */
import { rankQuotesForSource, selectQuoteForMedia } from './detailsQuotePipeline.js';

export function selectHomeQuote(quotes, dayKey, ratingsByQuoteId) {
  const ranked = rankQuotesForSource(quotes || [], new Map(), { core: [], context: [] });
  return selectQuoteForMedia(ranked, `daily:${dayKey}`, ratingsByQuoteId);
}
