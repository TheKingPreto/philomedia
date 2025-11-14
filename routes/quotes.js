import express from 'express';
import Quote from '../models/Quote.js';

const router = express.Router();

/**
 * @swagger
 * paths:
 * /api/quotes:
 * get:
 * summary: Returns a list of all Quotes.
 * tags: [Quotes]
 * responses:
 * 200:
 * description: The list of quotes returned successfully.
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Quote'
 * 500:
 * description: Server error when retrieving quotes.
 * post:
 * summary: Creates a new Quote.
 * tags: [Quotes]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * responses:
 * 201:
 * description: Quote created successfully.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * 400:
 * description: Invalid data supplied.
 * 500:
 * description: Server error when creating the quote.
 *
 * /api/quotes/{id}:
 * get:
 * summary: Returns a Quote by its ID.
 * tags: [Quotes]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The ID of the Quote.
 * responses:
 * 200:
 * description: Quote returned successfully.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * 404:
 * description: Quote not found.
 * put:
 * summary: Updates a Quote by its ID.
 * tags: [Quotes]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The ID of the Quote to update.
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * responses:
 * 200:
 * description: Quote updated successfully.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * 404:
 * description: Quote not found.
 * 400:
 * description: Invalid data supplied for update.
 * delete:
 * summary: Deletes a Quote by its ID.
 * tags: [Quotes]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The ID of the Quote to delete.
 * responses:
 * 200:
 * description: Quote deleted successfully.
 * 404:
 * description: Quote not found.
 */

router.get('/', async (req, res) => {
  try {
    const quotes = await Quote.find();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).json({ message: 'Quote not found' });
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const quote = new Quote(req.body);
  try {
    const newQuote = await quote.save();
    res.status(201).json(newQuote);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedQuote = await Quote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedQuote) return res.status(404).json({ message: 'Quote not found' });
    res.json(updatedQuote);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deletedQuote = await Quote.findByIdAndDelete(req.params.id);
    if (!deletedQuote) return res.status(404).json({ message: 'Quote not found' });
    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;