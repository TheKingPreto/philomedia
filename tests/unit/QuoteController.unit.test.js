import { jest } from '@jest/globals';
import Quote from '../../src/models/Quote.js';
import * as QuoteController from '../../src/controllers/QuoteController.js';

describe('QuoteController unit tests (mocked model)', () => {
  test('getAllQuotes returns paginated quotes from Quote.find', async () => {
    const fakeQuotes = [{ quoteText: 'A', authorName: 'X' }];
    const findSpy = jest.spyOn(Quote, 'find').mockImplementation(() => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            lean: () => Promise.resolve(fakeQuotes),
          }),
        }),
      }),
    }));
    const countSpy = jest.spyOn(Quote, 'countDocuments').mockResolvedValue(1);

    const req = { query: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await QuoteController.getAllQuotes(req, res, next);

    expect(findSpy).toHaveBeenCalledWith({});
    expect(countSpy).toHaveBeenCalledWith({});
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      data: fakeQuotes,
      page: 1,
      limit: 50,
      total: 1,
      totalPages: 1,
    });

    findSpy.mockRestore();
    countSpy.mockRestore();
  });

  test('getQuoteById returns 404 when not found', async () => {
    const findByIdSpy = jest.spyOn(Quote, 'findById').mockResolvedValueOnce(null);

    const req = { params: { id: '507f1f77bcf86cd799439011' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await QuoteController.getQuoteById(req, res, next);

    expect(findByIdSpy).toHaveBeenCalledWith(req.params.id);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Quote not found.' });

    findByIdSpy.mockRestore();
  });
});