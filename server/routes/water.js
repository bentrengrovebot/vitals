import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/water/:date
router.get('/:date', async (req, res) => {
  try {
    const dateStart = new Date(req.params.date);
    const dateEnd = new Date(req.params.date);
    dateEnd.setDate(dateEnd.getDate() + 1);

    const entries = await req.prisma.waterLog.findMany({
      where: {
        userId: req.userId,
        timestamp: { gte: dateStart, lt: dateEnd },
      },
      orderBy: { timestamp: 'asc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/water
router.post('/', async (req, res) => {
  try {
    const { amountMl } = req.body;
    const entry = await req.prisma.waterLog.create({
      data: { userId: req.userId, amountMl },
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/water/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.waterLog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
