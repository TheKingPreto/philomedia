import { jest } from '@jest/globals';

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

await jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

const { generateGeminiText, isGeminiQuotaError } = await import(
  '../../src/services/geminiGenerate.js'
);

describe('geminiGenerate unit tests', () => {
  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    delete process.env.GOOGLE_AI_MODEL;
    jest.clearAllMocks();
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
    });
  });

  test('isGeminiQuotaError detects 429 quota messages', () => {
    expect(isGeminiQuotaError(new Error('[429 Too Many Requests] Quota exceeded'))).toBe(true);
    expect(isGeminiQuotaError(new Error('network timeout'))).toBe(false);
  });

  test('tries fallback model when primary hits quota', async () => {
    mockGenerateContent
      .mockRejectedValueOnce(new Error('[429 Too Many Requests] Quota exceeded'))
      .mockResolvedValueOnce({
        response: { text: () => '{"ok":true}' },
      });

    const result = await generateGeminiText('prompt', {
      responseMimeType: 'application/json',
    });

    expect(result.text).toBe('{"ok":true}');
    expect(mockGetGenerativeModel).toHaveBeenCalledTimes(2);
    const models = mockGetGenerativeModel.mock.calls.map((call) => call[0].model);
    expect(models[0]).toBe('gemini-2.5-flash');
    expect(models[1]).not.toBe(models[0]);
  });

  test('throws ai_quota_exceeded when all models fail with quota', async () => {
    mockGenerateContent.mockRejectedValue(new Error('[429 Too Many Requests] Quota exceeded'));

    await expect(
      generateGeminiText('prompt', { responseMimeType: 'application/json' })
    ).rejects.toMatchObject({ code: 'ai_quota_exceeded' });
  });
});
