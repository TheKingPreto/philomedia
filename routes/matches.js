import express from 'express';
import Match from '../models/Match.js'; 

const router = express.Router();

/**
 * @swagger
 * paths:
 * /api/matches:
 * get:
 * summary: Returns a list of all Matches.
 * tags: [Matches]
 * responses:
 * 200:
 * description: The list of matches returned successfully.
 * content:
 * application/json:
 * schema:
 * type: array
 * items:
 * $ref: '#/components/schemas/Match'
 * 500:
 * description: Server error when retrieving matches.
 * post:
 * summary: Creates a new Match (association between work and quote).
 * tags: [Matches]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * responses:
 * 201:
 * description: Match created successfully.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * 400:
 * description: Invalid data supplied.
 * 500:
 * description: Server error when creating the match.
 *
 * /api/matches/{id}:
 * get:
 * summary: Returns a Match by its ID.
 * tags: [Matches]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The ID of the Match.
 * responses:
 * 200:
 * description: Match returned successfully.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * 404:
 * description: Match not found.
 * put:
 * summary: Updates a Match by its ID.
 * tags: [Matches]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The ID of the Match to update.
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * responses:
 * 200:
 * description: Match updated successfully.
 * content:
 * application/json:
 * schema:
 * $ref: '#/components/schemas/Match'
 * 404:
 * description: Match not found.
 * 400:
 * description: Invalid data supplied for update.
 * delete:
 * summary: Deletes a Match by its ID.
 * tags: [Matches]
 * parameters:
 * - in: path
 * name: id
 * schema:
 * type: string
 * required: true
 * description: The ID of the Match to delete.
 * responses:
 * 200:
 * description: Match deleted successfully.
 * 404:
 * description: Match not found.
 */

router.get('/', async (req, res) => {
  try {
    const matches = await Match.find();
    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  const match = new MatchModel(req.body);
  try {
    const newMatch = await match.save();
    res.status(201).json(newMatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const updatedMatch = await Match.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedMatch) return res.status(404).json({ message: 'Match not found' });
    res.json(updatedMatch);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const deletedMatch = await Match.findByIdAndDelete(req.params.id);
    if (!deletedMatch) return res.status(404).json({ message: 'Match not found' });
    res.json({ message: 'Match deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;