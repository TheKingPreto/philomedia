import { jest } from '@jest/globals';
import Quote from '../../src/models/Quote.js';
import Match from '../../src/models/Match.js';
import * as QuoteController from '../../src/controllers/QuoteController.js';
import * as MatchController from '../../src/controllers/MatchController.js';

const OWNER_ID = '507f1f77bcf86cd799439011';
const STRANGER_ID = '507f1f77bcf86cd799439022';
const TARGET_ID = '507f1f77bcf86cd799439033';

function makeRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

/** Documento devolvido pelo findById, com os métodos que o controlador usa. */
function makeDoc(overrides = {}) {
  return {
    submittedBy: OWNER_ID,
    set: jest.fn(),
    save: jest.fn().mockImplementation(function save() {
      return Promise.resolve(this);
    }),
    deleteOne: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Quote mutations reject non-owners', () => {
  test('updateQuote returns 403 for a stranger and never writes', async () => {
    const doc = makeDoc();
    jest.spyOn(Quote, 'findById').mockResolvedValue(doc);

    const req = {
      params: { id: TARGET_ID },
      body: { quoteText: 'hijacked' },
      user: { _id: STRANGER_ID },
    };
    const res = makeRes();

    await QuoteController.updateQuote(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(doc.set).not.toHaveBeenCalled();
    expect(doc.save).not.toHaveBeenCalled();
  });

  test('deleteQuote returns 403 for a stranger and never deletes', async () => {
    const doc = makeDoc();
    jest.spyOn(Quote, 'findById').mockResolvedValue(doc);

    const req = { params: { id: TARGET_ID }, user: { _id: STRANGER_ID } };
    const res = makeRes();

    await QuoteController.deleteQuote(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(doc.deleteOne).not.toHaveBeenCalled();
  });

  test('updateQuote lets the owner through', async () => {
    const doc = makeDoc();
    jest.spyOn(Quote, 'findById').mockResolvedValue(doc);

    const req = {
      params: { id: TARGET_ID },
      body: { quoteText: 'legit edit' },
      user: { _id: OWNER_ID },
    };
    const res = makeRes();

    await QuoteController.updateQuote(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(doc.set).toHaveBeenCalledWith({ quoteText: 'legit edit' });
  });

  test('updateQuote lets an admin edit editorial content', async () => {
    const doc = makeDoc({ submittedBy: null });
    jest.spyOn(Quote, 'findById').mockResolvedValue(doc);

    const req = {
      params: { id: TARGET_ID },
      body: { quoteText: 'curated edit' },
      user: { _id: STRANGER_ID, role: 'admin' },
    };
    const res = makeRes();

    await QuoteController.updateQuote(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('updateQuote still 404s before checking ownership', async () => {
    jest.spyOn(Quote, 'findById').mockResolvedValue(null);

    const req = { params: { id: TARGET_ID }, body: {}, user: { _id: OWNER_ID } };
    const res = makeRes();

    await QuoteController.updateQuote(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Quote mutations ignore server-owned fields', () => {
  test('updateQuote strips legacyId and generation flags', async () => {
    const doc = makeDoc();
    jest.spyOn(Quote, 'findById').mockResolvedValue(doc);

    const req = {
      params: { id: TARGET_ID },
      body: {
        quoteText: 'legit',
        legacyId: 1035,
        isGenerated: true,
        submittedBy: STRANGER_ID,
        submissionSource: 'system',
        generationContext: { mode: 'by-theme' },
      },
      user: { _id: OWNER_ID },
    };

    await QuoteController.updateQuote(req, makeRes(), jest.fn());

    expect(doc.set).toHaveBeenCalledWith({ quoteText: 'legit' });
  });

  test('updateQuote keeps only en and pt inside quoteTranslations', async () => {
    const doc = makeDoc();
    jest.spyOn(Quote, 'findById').mockResolvedValue(doc);

    const req = {
      params: { id: TARGET_ID },
      body: { quoteTranslations: { en: 'hello', pt: 'olá', legacyId: 1 } },
      user: { _id: OWNER_ID },
    };

    await QuoteController.updateQuote(req, makeRes(), jest.fn());

    expect(doc.set).toHaveBeenCalledWith({
      quoteTranslations: { en: 'hello', pt: 'olá' },
    });
  });

  test('createQuote stamps the author and drops a forged legacyId', async () => {
    let constructed = null;
    jest.spyOn(Quote.prototype, 'save').mockImplementation(function save() {
      constructed = this.toObject();
      return Promise.resolve(this);
    });

    const req = {
      body: {
        quoteText: 'A',
        authorName: 'B',
        legacyId: 1035,
        submittedBy: STRANGER_ID,
        submissionSource: 'system',
      },
      user: { _id: OWNER_ID },
    };

    await QuoteController.createQuote(req, makeRes(), jest.fn());

    expect(constructed.legacyId).toBeNull();
    expect(constructed.submissionSource).toBe('user-submitted');
    expect(String(constructed.submittedBy)).toBe(OWNER_ID);
  });
});

describe('Match mutations', () => {
  test('deleteMatch returns 403 for a stranger', async () => {
    const doc = makeDoc();
    jest.spyOn(Match, 'findById').mockResolvedValue(doc);

    const req = { params: { id: TARGET_ID }, user: { _id: STRANGER_ID } };
    const res = makeRes();

    await MatchController.deleteMatch(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(doc.deleteOne).not.toHaveBeenCalled();
  });

  test('updateMatch strips submittedBy from the body', async () => {
    const doc = makeDoc();
    jest.spyOn(Match, 'findById').mockResolvedValue(doc);

    const req = {
      params: { id: TARGET_ID },
      body: { mediaType: 'tv', submittedBy: STRANGER_ID, createdAt: '2000-01-01' },
      user: { _id: OWNER_ID },
    };

    await MatchController.updateMatch(req, makeRes(), jest.fn());

    expect(doc.set).toHaveBeenCalledWith({ mediaType: 'tv' });
  });

  test('createMatch stamps the author', async () => {
    let constructed = null;
    jest.spyOn(Match.prototype, 'save').mockImplementation(function save() {
      constructed = this.toObject();
      return Promise.resolve(this);
    });

    const req = {
      body: { tmdbId: '157336', quoteId: TARGET_ID, submittedBy: STRANGER_ID },
      user: { _id: OWNER_ID },
    };

    await MatchController.createMatch(req, makeRes(), jest.fn());

    expect(String(constructed.submittedBy)).toBe(OWNER_ID);
  });
});
