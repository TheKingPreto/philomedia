import express from 'express';
import { getAllQuotes, getQuoteById, createQuote, updateQuote, deleteQuote 
} from '../controllers/QuoteController.js'; 

const router = express.Router();

/**
 * @swagger
 * components:
 * tags:
 * name: Quotes
 * description: API endpoints for managing custom philosophical quotes.
 */

/**
 * @swagger
 * /api/quotes:
 * get:
 * summary: Retrieve a list of all custom quotes.
 * tags: [Quotes]
 * responses:
 * 200:
 * description: A list of quotes.
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Quote'
 * 500:
 * description: Internal Server Error.
 * post:
 * summary: Create a new custom quote.
 * tags: [Quotes]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * responses:
 * 201:
 * description: The created quote.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * 400:
 * description: Validation Error (Missing required fields).
 * 500:
 * description: Internal Server Error.
 */

/**
 * @swagger
 * /api/quotes/{id}:
 * get:
 * summary: Get a quote by ID.
 * tags: [Quotes]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The Quote ID (MongoDB ObjectID).
 * responses:
 * 200:
 * description: The quote object.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * 404:
 * description: Quote not found.
 * put:
 * summary: Update an existing quote by ID.
 * tags: [Quotes]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The Quote ID (MongoDB ObjectID).
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * responses:
 * 200:
 * description: The updated quote.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Quote'
 * 400:
 * description: Invalid ID or Validation Error.
 * 404:
 * description: Quote not found.
 * delete:
 * summary: Delete a quote by ID.
 * tags: [Quotes]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The Quote ID (MongoDB ObjectID).
 * responses:
 * 200:
 * description: Quote successfully deleted.
 * 404:
 * description: Quote not found.
 */

router.route('/')
    .get(getAllQuotes) 
    .post(createQuote); 
router.route('/:id')
    .get(getQuoteById) 
    .put(updateQuote) 
    .delete(deleteQuote); 

export default router;