import { jest } from '@jest/globals';
import Quote from '../../src/models/Quote.js';

const fakeMediaContextResult = {
  quoteText: 'Generated quote from media.',
  authorName: 'Philosopher',
  themes: ['time'],
  explanation: 'Fits the context.',
  isGenerated: true,
  generationContext: {
    mode: 'by-media-context',
    mediaContext: { tmdbId: '157336', mediaType: 'movie', title: 'Interstellar' },
    model: 'gemini-1.5-flash-latest',
    generatedAt: new Date(),
  },
};

const mockGenerateByMediaContext = jest.fn().mockResolvedValue(fakeMediaContextResult);

await jest.unstable_mockModule('../../src/services/AIQuoteGeneratorService.js', () => ({
  generateByMediaContext: mockGenerateByMediaContext,
  generateByTheme: jest.fn(),
  generateByPhilosopher: jest.fn(),
  getValidThemes: jest.fn().mockReturnValue([]),
}));

const { generateByMediaContext } = await import('../../src/controllers/AIQuoteController.js');

describe('AIQuoteController unit tests', () => {
  describe('generateByMediaContext', () => {
    let createSpy;

    beforeEach(() => {
      mockGenerateByMediaContext.mockResolvedValue(fakeMediaContextResult);
      createSpy = jest.spyOn(Quote, 'create').mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        ...fakeMediaContextResult,
      });
    });

    afterEach(() => {
      createSpy.mockRestore();
    });

    test('returns 200 with quote when save is false', async () => {
      const req = {
        body: { tmdbId: '157336', mediaType: 'movie', save: false },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await generateByMediaContext(req, res, next);

      expect(mockGenerateByMediaContext).toHaveBeenCalledWith(
        '157336',
        'movie',
        { suggestMatches: false }
      );
      expect(createSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          quote: expect.objectContaining({
            quoteText: fakeMediaContextResult.quoteText,
            authorName: fakeMediaContextResult.authorName,
            isGenerated: true,
            generationContext: expect.objectContaining({
              mode: 'by-media-context',
              mediaContext: { tmdbId: '157336', mediaType: 'movie', title: 'Interstellar' },
            }),
          }),
          explanation: fakeMediaContextResult.explanation,
          saved: false,
        })
      );
    });

    test('when save is true, calls Quote.create with result from service', async () => {
      const savedQuote = {
        _id: '507f1f77bcf86cd799439011',
        quoteText: fakeMediaContextResult.quoteText,
        authorName: fakeMediaContextResult.authorName,
        themes: fakeMediaContextResult.themes,
        isGenerated: true,
        generationContext: fakeMediaContextResult.generationContext,
      };
      createSpy.mockResolvedValue(savedQuote);

      const req = {
        body: { tmdbId: '157336', mediaType: 'movie', save: true },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await generateByMediaContext(req, res, next);

      expect(mockGenerateByMediaContext).toHaveBeenCalledWith(
        '157336',
        'movie',
        { suggestMatches: false }
      );
      expect(createSpy).toHaveBeenCalledWith({
        quoteText: fakeMediaContextResult.quoteText,
        authorName: fakeMediaContextResult.authorName,
        themes: fakeMediaContextResult.themes,
        isGenerated: true,
        generationContext: fakeMediaContextResult.generationContext,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('passes suggestMatches to service and includes suggestedMatches in response', async () => {
      mockGenerateByMediaContext.mockResolvedValueOnce({
        ...fakeMediaContextResult,
        suggestedMatches: [
          { tmdbId: '27205', mediaType: 'movie', title: 'Inception' },
        ],
      });

      const req = {
        body: { tmdbId: '157336', mediaType: 'movie', suggestMatches: true },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await generateByMediaContext(req, res, next);

      expect(mockGenerateByMediaContext).toHaveBeenCalledWith(
        '157336',
        'movie',
        { suggestMatches: true }
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedMatches: [{ tmdbId: '27205', mediaType: 'movie', title: 'Inception' }],
        })
      );
    });
  });
});
