import { jest } from '@jest/globals';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

await jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

const QuoteTranslationService = await import('../../src/services/QuoteTranslationService.js');

describe('QuoteTranslationService', () => {
  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue({
      response: {
        text: async () => JSON.stringify([
          {
            id: 'wiki-1',
            text: 'Happiness is not an ideal of reason, but of imagination.',
            author: 'Immanuel Kant',
            theme: 'idealism',
            originalText: 'A felicidade não é um ideal da razão, mas sim da imaginação.',
            originalLanguage: 'pt',
            translationStatus: 'machine',
          },
        ]),
      },
    });
  });

  test('rejects empty translation batches', async () => {
    await expect(QuoteTranslationService.translateQuotesBatch([])).rejects.toThrow(
      'At least one quote entry is required.'
    );
  });

  test('translates a batch of quotes into normalized English records', async () => {
    const result = await QuoteTranslationService.translateQuotesBatch([
      {
        id: 'wiki-1',
        text: 'A felicidade não é um ideal da razão, mas sim da imaginação.',
        author: 'Immanuel Kant',
        theme: 'idealism',
        lang: 'pt',
      },
    ]);

    expect(result).toEqual([
      {
        id: 'wiki-1',
        text: 'Happiness is not an ideal of reason, but of imagination.',
        author: 'Immanuel Kant',
        theme: 'idealism',
        originalText: 'A felicidade não é um ideal da razão, mas sim da imaginação.',
        originalLanguage: 'pt',
        translationStatus: 'machine',
        lang: 'en',
      },
    ]);
  });

  test('rejects mismatched response sizes from the model', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: {
        text: async () => JSON.stringify([]),
      },
    });

    await expect(QuoteTranslationService.translateQuotesBatch([
      {
        id: 'wiki-1',
        text: 'Uma vida sem reflexão não vale a pena ser vivida.',
        author: 'Socrates',
        theme: 'wisdom',
        lang: 'pt',
      },
    ])).rejects.toThrow('Translation batch returned an unexpected number of entries.');
  });
});
