import express from 'express';
import Match from '../models/Match.js'; 

const router = express.Router();

/**
 * @swagger
 * /api/matches:
 *   get:
 *     summary: Returns all matches.
 *     tags: [Matches]
 *     responses:
 *       200:
 *         description: List of matches returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Match'
 *       500:
 *         description: Error retrieving matches.
 */

/**
 * @swagger
 * /api/matches:
 *   post:
 *     summary: Creates a new match.
 *     tags: [Matches]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Match'
 *     responses:
 *       201:
 *         description: Match created successfully.
 *       400:
 *         description: Invalid match data.
 *       500:
 *         description: Error creating match.
 */

/**
 * @swagger
 * /api/matches/{id}:
 *   get:
 *     summary: Returns a match by ID.
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     responses:
 *       200:
 *         description: Match returned successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       404:
 *         description: Match not found.
 *       500:
 *         description: Error retrieving match.
 */

/**
 * @swagger
 * /api/matches/{id}:
 *   put:
 *     summary: Updates a match by ID.
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Match'
 *     responses:
 *       200:
 *         description: Match updated successfully.
 *       400:
 *         description: Invalid match data.
 *       404:
 *         description: Match not found.
 *       500:
 *         description: Error updating match.
 */

/**
 * @swagger
 * /api/matches/{id}:
 *   delete:
 *     summary: Deletes a match by ID.
 *     tags: [Matches]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Match ID
 *     responses:
 *       200:
 *         description: Match deleted successfully.
 *       404:
 *         description: Match not found.
 *       500:
 *         description: Error deleting match.
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
  const match = new Match(req.body);
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