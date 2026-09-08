import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import Quote from '../../src/models/Quote.js';
import * as QuoteController from '../../src/controllers/QuoteController.js';
import {
  isApprovedForCatalog,
  mapDatabaseQuoteEntry,
} from '../../src/services/quoteCatalog.js';
import quoteRoutes from '../../src/routes/quotes.js';

const OWNER_ID = '507f1f77bcf86cd799439011';

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe('quote catalog moderation gate', () => {
  test('legacy documents without moderationStatus stay approved', () => {
    const entry = mapDatabaseQuoteEntry({
      _id: OWNER_ID,
      quoteText: 'Know yourself.',
      authorName: 'Socrates',
      themes: ['self-knowledge'],
    });
    expect(isApprovedForCatalog(entry)).toBe(true);
    expect(isApprovedForCatalog({ moderationStatus: 'approved' })).toBe(true);
    expect(isApprovedForCatalog({ moderationStatus: 'pending' })).toBe(false);
    expect(isApprovedForCatalog({ moderationStatus: 'rejected' })).toBe(false);
  });
});

describe('admin quote moderation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('createQuote stamps pending moderation for user submissions', async () => {
    let constructed = null;
    jest.spyOn(Quote.prototype, 'save').mockImplementation(function save() {
      constructed = this.toObject();
      return Promise.resolve(this);
    });

    await QuoteController.createQuote({
      body: { quoteText: 'A', authorName: 'B' },
      user: { _id: OWNER_ID },
    }, makeRes(), jest.fn());

    expect(constructed.moderationStatus).toBe('pending');
    expect(constructed.submissionSource).toBe('user-submitted');
  });

  test('moderateQuote returns 403 for a non-admin even when authenticated', async () => {
    const res = makeRes();
    await QuoteController.moderateQuote({
      params: { id: OWNER_ID },
      body: { status: 'approved' },
      user: { _id: OWNER_ID, role: 'user' },
    }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('PATCH /api/quotes/:id/moderation is 403 for a non-admin session', async () => {
    const originalFlag = process.env.ALLOW_TEST_AUTH;
    process.env.ALLOW_TEST_AUTH = '1';

    const app = express();
    app.use(express.json());
    app.use('/api/quotes', quoteRoutes);

    const response = await request(app)
      .patch(`/api/quotes/${OWNER_ID}/moderation`)
      .set('x-test-auth-user', JSON.stringify({ _id: OWNER_ID, role: 'user', displayName: 'User' }))
      .send({ status: 'approved' });

    if (originalFlag === undefined) delete process.env.ALLOW_TEST_AUTH;
    else process.env.ALLOW_TEST_AUTH = originalFlag;

    expect(response.status).toBe(403);
  });
});
