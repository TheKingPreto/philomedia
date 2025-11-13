import express from 'express';
import { 
    getAllMatches, 
    getMatchById, 
    createMatch, 
    updateMatch, 
    deleteMatch 
} from '../controllers/MatchController.js'; 

const router = express.Router();

/**
 * @swagger
 * tags:
 * name: Matches
 * description: API endpoints for managing curated matches between media and custom quotes.
 */

/**
 * @swagger
 * /api/matches:
 * get:
 * summary: Retrieve a list of all curated matches.
 * tags: [Matches]
 * responses:
 * 200:
 * description: A list of curated matches.
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Match'
 * 500:
 * description: Internal Server Error.
 * post:
 * summary: Create a new curated match.
 * tags: [Matches]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * responses:
 * 201:
 * description: The created match.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * 400:
 * description: Validation Error (Missing required fields or duplicate TMDB ID).
 * 500:
 * description: Internal Server Error.
 */

/**
 * @swagger
 * /api/matches/{id}:
 * get:
 * summary: Get a curated match by MongoDB ID.
 * tags: [Matches]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The Match ID (MongoDB ObjectID).
 * responses:
 * 200:
 * description: The match object.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * 404:
 * description: Match not found.
 * put:
 * summary: Update an existing match by ID.
 * tags: [Matches]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The Match ID (MongoDB ObjectID).
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * responses:
 * 200:
 * description: The updated match.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * 400:
 * description: Invalid ID or Validation Error.
 * 404:
 * description: Match not found.
 * delete:
 * summary: Delete a curated match by ID.
 * tags: [Matches]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The Match ID (MongoDB ObjectID).
 * responses:
 * 200:
 * description: Match successfully deleted.
 * 404:
 * description: Match not found.
 */

router.route('/')
    .get(getAllMatches)
    .post(createMatch);

router.route('/:id')
    .get(getMatchById)
    .put(updateMatch)
    .delete(deleteMatch);

export default router;