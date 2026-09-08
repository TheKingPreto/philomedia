import * as authorKeyFromSrc from '../../src/domain/i18n/authorKey.js';
import * as authorKeyFromPublic from '../../public/scripts/domain/authorKey.js';
import * as repairFromSrc from '../../src/domain/i18n/repairQuoteSpacing.js';
import * as repairFromPublic from '../../public/scripts/domain/repairQuoteSpacing.js';
import * as quoteDisplayFromSrc from '../../src/domain/i18n/quoteDisplay.js';
import * as quoteDisplayFromPublic from '../../public/scripts/domain/quoteDisplay.js';
import * as mediaRankFromSrc from '../../src/domain/mediaRanking/mediaRankCore.js';
import * as mediaRankFromPublic from '../../public/scripts/mediaRankCore.js';

describe('shared domain modules (one source, thin re-export)', () => {
  test('authorKey is the same module identity from src and public', () => {
    expect(authorKeyFromSrc.normalizeAuthorKey).toBe(authorKeyFromPublic.normalizeAuthorKey);
    expect(authorKeyFromSrc.AUTHOR_KEY_ALIASES).toBe(authorKeyFromPublic.AUTHOR_KEY_ALIASES);
  });

  test('repairQuoteSpacing is the same module identity from src and public', () => {
    expect(repairFromSrc.repairQuoteSpacing).toBe(repairFromPublic.repairQuoteSpacing);
  });

  test('quoteDisplay is the same module identity from src and public', () => {
    expect(quoteDisplayFromSrc.resolveQuoteForLocale).toBe(quoteDisplayFromPublic.resolveQuoteForLocale);
    expect(quoteDisplayFromSrc.resolvePhilosopherTextField)
      .toBe(quoteDisplayFromPublic.resolvePhilosopherTextField);
  });

  test('mediaRankCore is the same module identity from src and public', () => {
    expect(mediaRankFromSrc.rankCandidates).toBe(mediaRankFromPublic.rankCandidates);
    expect(mediaRankFromSrc.buildQuoteProfile).toBe(mediaRankFromPublic.buildQuoteProfile);
    expect(mediaRankFromSrc.scoreTmdbKeywordOverlap).toBe(mediaRankFromPublic.scoreTmdbKeywordOverlap);
  });
});
