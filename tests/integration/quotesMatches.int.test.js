import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../server.js';
import Quote from '../../src/models/Quote.js';
import Match from '../../src/models/Match.js';

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  await Quote.deleteMany({});
  await Match.deleteMany({});
});

describe('Quotes and Matches integration (in-memory Mongo)', () => {
  test('Create, read, update, delete a Quote via API', async () => {
    const newQuote = { quoteText: 'Test quote', authorName: 'Tester', themes: ['test'] };

    // Create
    const createRes = await request(app).post('/api/quotes').send(newQuote);
    expect(createRes.statusCode).toBe(201);
    expect(createRes.body).toHaveProperty('_id');

    const id = createRes.body._id;

    // Read
    const getRes = await request(app).get(`/api/quotes/${id}`);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toHaveProperty('quoteText', 'Test quote');

    // Update
    const updateRes = await request(app).put(`/api/quotes/${id}`).send({ quoteText: 'Updated quote' });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body).toHaveProperty('quoteText', 'Updated quote');

    // Delete
    const delRes = await request(app).delete(`/api/quotes/${id}`);
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body).toHaveProperty('message');
  });

  test('Create a Match referencing a Quote and retrieve populated match', async () => {
    const quote = await Quote.create({ quoteText: 'Match quote', authorName: 'Author', themes: [] });

    const matchPayload = { tmdbId: '12345', quoteId: quote._id.toString(), mediaType: 'movie' };
    const createMatchRes = await request(app).post('/api/matches').send(matchPayload);
    expect(createMatchRes.statusCode).toBe(201);
    expect(createMatchRes.body).toHaveProperty('_id');

    const matchId = createMatchRes.body._id;

    const getMatchRes = await request(app).get(`/api/matches/${matchId}`);
    expect(getMatchRes.statusCode).toBe(200);
    expect(getMatchRes.body).toHaveProperty('quoteId');
    expect(getMatchRes.body.quoteId).toHaveProperty('quoteText', 'Match quote');
  });
});
