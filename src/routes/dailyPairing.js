import express from 'express';
import { getDailyPairing } from '../services/dailyPairingService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const pairing = await getDailyPairing({
      limit: req.query.limit,
      offset: req.query.offset,
    });

    if (!pairing) {
      return res.status(404).json({ error: 'Daily pairing unavailable.' });
    }

    return res.json(pairing);
  } catch (error) {
    console.error('Daily pairing error:', error.message);
    return res.status(502).json({ error: 'Could not load daily pairing.' });
  }
});

export default router;
