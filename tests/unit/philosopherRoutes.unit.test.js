import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';
import philosopherRoutes from '../../src/routes/philosophers.js';
import PhilosopherProfile from '../../src/models/PhilosopherProfile.js';
import Quote from '../../src/models/Quote.js';

function createApp(user = null) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = user;
    req.isAuthenticated = () => Boolean(user);
    next();
  });
  app.use('/api/philosophers', philosopherRoutes);
  return app;
}

describe('philosopher contribution routes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('GET /api/philosophers returns submitted profiles', async () => {
    const lean = jest.fn().mockResolvedValue([
      {
        _id: 'profile-1',
        slug: 'albert-camus',
        name: 'Albert Camus',
        summary: 'Camus explores revolt and absurdity.',
      },
    ]);
    const sort = jest.fn().mockReturnValue({ lean });
    jest.spyOn(PhilosopherProfile, 'find').mockReturnValue({ sort });

    const response = await request(createApp()).get('/api/philosophers');

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual(expect.objectContaining({
      slug: 'albert-camus',
      name: 'Albert Camus',
    }));
  });

  test('POST /api/philosophers rejects unauthenticated submissions', async () => {
    const response = await request(createApp())
      .post('/api/philosophers')
      .send({
        name: 'Albert Camus',
        quotes: [{ quoteText: 'In the depth of winter, I finally learned that within me there lay an invincible summer.' }],
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: 'Authentication required. Please log in to perform this action.',
    });
  });

  test('POST /api/philosophers creates a submitted philosopher and new quotes', async () => {
    const user = { _id: '507f1f77bcf86cd799439011' };

    jest.spyOn(PhilosopherProfile, 'findOne').mockResolvedValue(null);
    jest.spyOn(PhilosopherProfile, 'create').mockResolvedValue({
      _id: 'profile-2',
      slug: 'albert-camus',
      name: 'Albert Camus',
      period: '20th-century France · 1913-1960',
      summary: 'Camus studies absurdity and revolt.',
      focus: 'He connects strongly to meaning, rebellion, and resilience.',
      aliases: ['Camus'],
      portraitUrl: '',
      wikiTitle: 'Albert Camus',
    });

    const quoteLean = jest.fn().mockResolvedValue([]);
    const quoteSelect = jest.fn().mockReturnValue({ lean: quoteLean });
    jest.spyOn(Quote, 'find').mockReturnValue({ select: quoteSelect });
    const insertManySpy = jest.spyOn(Quote, 'insertMany').mockResolvedValue([]);

    const response = await request(createApp(user))
      .post('/api/philosophers')
      .send({
        name: 'Albert Camus',
        period: '20th-century France · 1913-1960',
        summary: 'Camus studies absurdity and revolt.',
        focus: 'He connects strongly to meaning, rebellion, and resilience.',
        wikiTitle: 'Albert Camus',
        aliases: ['Camus'],
        quotes: [
          {
            quoteText: 'In the depth of winter, I finally learned that within me there lay an invincible summer.',
            themes: ['existentialism', 'resilience'],
          },
          {
            quoteText: 'Should I kill myself, or have a cup of coffee?',
            themes: ['existentialism'],
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(expect.objectContaining({
      createdQuotes: 2,
      skippedQuotes: 0,
      philosopher: expect.objectContaining({
        slug: 'albert-camus',
        name: 'Albert Camus',
      }),
    }));
    expect(insertManySpy).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        authorName: 'Albert Camus',
        submissionSource: 'user-submitted',
        quoteLanguage: 'en',
      }),
    ]));
  });

  test('POST /api/philosophers adds quotes to an existing thinker profile without duplicating quotes', async () => {
    const user = { _id: '507f1f77bcf86cd799439011' };
    const existingProfile = {
      _id: 'profile-3',
      slug: 'albert-camus',
      name: 'Albert Camus',
      aliases: ['Camus'],
      period: '20th-century France · 1913-1960',
      summary: 'Camus studies absurdity and revolt.',
      focus: 'He connects strongly to meaning, rebellion, and resilience.',
      portraitUrl: '',
      wikiTitle: 'Albert Camus',
    };

    jest.spyOn(PhilosopherProfile, 'findOne').mockResolvedValue(existingProfile);
    const updateSpy = jest.spyOn(PhilosopherProfile, 'findOneAndUpdate').mockResolvedValue({
      ...existingProfile,
      aliases: ['Camus', 'A. Camus'],
    });

    const quoteLean = jest.fn().mockResolvedValue([
      {
        quoteText: 'Should I kill myself, or have a cup of coffee?',
      },
    ]);
    const quoteSelect = jest.fn().mockReturnValue({ lean: quoteLean });
    jest.spyOn(Quote, 'find').mockReturnValue({ select: quoteSelect });
    const insertManySpy = jest.spyOn(Quote, 'insertMany').mockResolvedValue([]);

    const response = await request(createApp(user))
      .post('/api/philosophers')
      .send({
        name: 'Albert Camus',
        aliases: ['A. Camus'],
        quotes: [
          {
            quoteText: 'Should I kill myself, or have a cup of coffee?',
            themes: ['existentialism'],
          },
          {
            quoteText: 'Real generosity toward the future lies in giving all to the present.',
            themes: ['humanism', 'existentialism'],
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      createdQuotes: 1,
      skippedQuotes: 1,
      philosopher: expect.objectContaining({
        slug: 'albert-camus',
        name: 'Albert Camus',
      }),
    }));
    expect(updateSpy).toHaveBeenCalledWith(
      { slug: 'albert-camus' },
      {
        $set: expect.objectContaining({
          name: 'Albert Camus',
          aliases: expect.arrayContaining(['Camus', 'A. Camus']),
        }),
      },
      { new: true, runValidators: true }
    );
    expect(insertManySpy).toHaveBeenCalledWith([
      expect.objectContaining({
        quoteText: 'Real generosity toward the future lies in giving all to the present.',
        authorName: 'Albert Camus',
        submissionSource: 'user-submitted',
      }),
    ]);
  });
});
