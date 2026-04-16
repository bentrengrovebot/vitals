import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/weighins?limit=14
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 14;
    const weighIns = await req.prisma.weighIn.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
    res.json(weighIns);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/weighins
router.post('/', async (req, res) => {
  try {
    const { weightKg, date } = req.body;
    // Use the client-supplied local date to avoid NZ→UTC day-shift.
    // Append T12:00:00 so Postgres @db.Date truncation never flips
    // to the previous day regardless of timezone.
    const d = date ? new Date(date + 'T12:00:00') : new Date();

    // Calculate 7-day moving average
    const recent = await req.prisma.weighIn.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
      take: 6,
    });
    const values = [weightKg, ...recent.map(w => w.weightKg)].slice(0, 7);
    const trendKg = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;

    const weighIn = await req.prisma.weighIn.create({
      data: { userId: req.userId, date: d, weightKg, trendKg },
    });

    // Update profile weight
    await req.prisma.profile.updateMany({
      where: { userId: req.userId },
      data: { weightKg },
    });

    res.json(weighIn);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/weighins/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.weighIn.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
