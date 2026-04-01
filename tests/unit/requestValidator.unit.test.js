import express from 'express';
import request from 'supertest';
import { body } from 'express-validator';
import { validateRequest } from '../../src/middleware/requestValidator.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.post(
    '/validate',
    body('name').isString().withMessage('name must be a string'),
    validateRequest,
    (req, res) => {
      res.status(204).end();
    }
  );
  return app;
}

describe('validateRequest middleware', () => {
  test('returns 400 with express-validator errors when validation fails', async () => {
    const response = await request(createApp())
      .post('/validate')
      .send({ name: 42 });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors[0]).toEqual(
      expect.objectContaining({
        msg: 'name must be a string',
        path: 'name',
      })
    );
  });

  test('continues to the handler when validation succeeds', async () => {
    const response = await request(createApp())
      .post('/validate')
      .send({ name: 'Socrates' });

    expect(response.status).toBe(204);
  });
});
