import { jest } from '@jest/globals';

// Mock tmdbClient antes de importar o service
const mockGetDetails = jest.fn();
const mockGetReviews = jest.fn();
const mockGetDiscover = jest.fn();

await jest.unstable_mockModule('../../src/services/tmdbClient.js', () => ({
  getDetails: mockGetDetails,
  getReviews: mockGetReviews,
  getDiscover: mockGetDiscover,
}));

// Mock Gemini: generateContent retorna JSON válido
const fakeGeminiResponse = {
  quoteText: 'Time is the fire in which we burn.',
  authorName: 'Carl Sagan',
  themes: ['time', 'existentialism'],
  explanation: 'Fits the media context.',
};
const mockGenerateContent = jest.fn().mockResolvedValue({
  response: { text: () => JSON.stringify(fakeGeminiResponse) },
});
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});
await jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

const AIQuoteGeneratorService = await import('../../src/services/AIQuoteGeneratorService.js');

describe('AIQuoteGeneratorService unit tests', () => {
  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY || 'test-key';
    jest.clearAllMocks();
    mockGetDetails.mockResolvedValue({
      title: 'Interstellar',
      name: null,
      overview: 'A team of explorers travel through a wormhole in space.',
    });
    mockGetReviews.mockResolvedValue([
      { content: 'A masterpiece about time and love.' },
    ]);
  });

  describe('getValidThemes', () => {
    test('returns non-empty array of theme keys', () => {
      const themes = AIQuoteGeneratorService.getValidThemes();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.every((t) => typeof t === 'string')).toBe(true);
    });
  });

  describe('generateByMediaContext', () => {
    test('throws when tmdbId is missing or empty', async () => {
      await expect(
        AIQuoteGeneratorService.generateByMediaContext('', 'movie')
      ).rejects.toThrow('tmdbId and mediaType');
    });

    test('throws when mediaType is invalid', async () => {
      await expect(
        AIQuoteGeneratorService.generateByMediaContext('123', 'anime')
      ).rejects.toThrow('tmdbId and mediaType');
      await expect(
        AIQuoteGeneratorService.generateByMediaContext('123', null)
      ).rejects.toThrow('tmdbId and mediaType');
    });

    test('calls getDetails and getReviews with correct args', async () => {
      await AIQuoteGeneratorService.generateByMediaContext('157336', 'movie');
      expect(mockGetDetails).toHaveBeenCalledWith('157336', 'movie');
      expect(mockGetReviews).toHaveBeenCalledWith('157336', 'movie');
    });

    test('returns quote with correct shape and by-media-context generationContext', async () => {
      const result = await AIQuoteGeneratorService.generateByMediaContext(
        '157336',
        'movie'
      );
      expect(result).toMatchObject({
        quoteText: fakeGeminiResponse.quoteText,
        authorName: fakeGeminiResponse.authorName,
        themes: fakeGeminiResponse.themes,
        explanation: fakeGeminiResponse.explanation,
        isGenerated: true,
      });
      expect(result.generationContext).toMatchObject({
        mode: 'by-media-context',
        mediaContext: {
          tmdbId: '157336',
          mediaType: 'movie',
          title: 'Interstellar',
        },
      });
      expect(result.generationContext.model).toBeDefined();
      expect(result.generationContext.generatedAt).toBeInstanceOf(Date);
    });

    test('works with mediaType tv', async () => {
      mockGetDetails.mockResolvedValueOnce({
        name: 'Breaking Bad',
        title: null,
        overview: 'A chemistry teacher turns to cooking meth.',
      });
      const result = await AIQuoteGeneratorService.generateByMediaContext(
        '1396',
        'tv'
      );
      expect(mockGetDetails).toHaveBeenCalledWith('1396', 'tv');
      expect(result.generationContext.mediaContext).toMatchObject({
        tmdbId: '1396',
        mediaType: 'tv',
        title: 'Breaking Bad',
      });
    });

    test('does not call embeddings when suggestMatches is false', async () => {
      const result = await AIQuoteGeneratorService.generateByMediaContext(
        '157336',
        'movie',
        { suggestMatches: false }
      );
      expect(result.suggestedMatches).toBeUndefined();
      expect(mockGetDiscover).not.toHaveBeenCalled();
    });
  });
});
