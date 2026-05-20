import express from 'express';
import { getDailyPairing } from '../services/dailyPairingService.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const rawLocale = String(req.query.lang || req.query.locale || 'en').trim().toLowerCase();
    const locale = rawLocale === 'pt' ? 'pt' : 'en';

    const pairing = await getDailyPairing({
      limit: req.query.limit,
      offset: req.query.offset,
      locale,
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
