import { jest } from '@jest/globals';
import Quote from '../../src/models/Quote.js';
import { clearAiQuoteCache } from '../../src/services/aiQuoteCache.js';

const AUTHOR_ID = '507f1f77bcf86cd799439099';

/** O controlador só persiste com sessão; os testes de `save` precisam de uma. */
function authenticate(req) {
  req.isAuthenticated = () => true;
  req.user = { _id: AUTHOR_ID };
  return req;
}

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
      process.env.GOOGLE_AI_API_KEY = 'test-key';
      clearAiQuoteCache();
      mockGenerateByMediaContext.mockClear();
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
        { suggestMatches: false, locale: 'en' }
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

      const req = authenticate({
        body: { tmdbId: '157336', mediaType: 'movie', save: true },
      });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await generateByMediaContext(req, res, next);

      expect(mockGenerateByMediaContext).toHaveBeenCalledWith(
        '157336',
        'movie',
        { suggestMatches: false, locale: 'en' }
      );
      expect(createSpy).toHaveBeenCalledWith({
        quoteText: fakeMediaContextResult.quoteText,
        authorName: fakeMediaContextResult.authorName,
        themes: fakeMediaContextResult.themes,
        isGenerated: true,
        generationContext: fakeMediaContextResult.generationContext,
        submittedBy: AUTHOR_ID,
      });
      expect(next).not.toHaveBeenCalled();
    });

    test('refuses to persist for an anonymous caller', async () => {
      const req = {
        body: { tmdbId: '157336', mediaType: 'movie', save: true },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await generateByMediaContext(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(createSpy).not.toHaveBeenCalled();
    });

    test('serves a repeated request from cache instead of calling Gemini again', async () => {
      const req = () => authenticate({ body: { tmdbId: '157336', mediaType: 'movie' } });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await generateByMediaContext(req(), res, jest.fn());
      await generateByMediaContext(req(), res, jest.fn());

      expect(mockGenerateByMediaContext).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledTimes(2);
    });

    test('does not cache a failed generation', async () => {
      mockGenerateByMediaContext.mockResolvedValueOnce({ generationContext: { failed: true } });
      const req = () => ({ body: { tmdbId: '999999', mediaType: 'movie' } });
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await generateByMediaContext(req(), res, jest.fn());
      await generateByMediaContext(req(), res, jest.fn());

      expect(mockGenerateByMediaContext).toHaveBeenCalledTimes(2);
    });

    test('returns 503 with ai_quota_exceeded when service throws quota error', async () => {
      const quotaError = new Error('Quota exceeded');
      quotaError.code = 'ai_quota_exceeded';
      mockGenerateByMediaContext.mockRejectedValueOnce(quotaError);

      const req = {
        body: { tmdbId: '157336', mediaType: 'movie' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await generateByMediaContext(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'ai_quota_exceeded' })
      );
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
        { suggestMatches: true, locale: 'en' }
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          suggestedMatches: [{ tmdbId: '27205', mediaType: 'movie', title: 'Inception' }],
        })
      );
    });
  });
});
