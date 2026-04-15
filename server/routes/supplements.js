import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/supplements
router.get('/', async (req, res) => {
  try {
    const supplements = await req.prisma.supplement.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
    });
    res.json(supplements);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/supplements
router.post('/', async (req, res) => {
  try {
    const { name, activeIngredient, activeDose, brand, source } = req.body;
    const supplement = await req.prisma.supplement.create({
      data: { userId: req.userId, name, activeIngredient, activeDose, brand, source },
    });
    res.json(supplement);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/supplements/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, activeIngredient, activeDose, isActive } = req.body;
    const supplement = await req.prisma.supplement.update({
      where: { id: req.params.id },
      data: { name, activeIngredient, activeDose, isActive },
    });
    res.json(supplement);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/supplements/:id — soft delete
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.supplement.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/supplements/log/:date
router.get('/log/:date', async (req, res) => {
  try {
    const logs = await req.prisma.supplementLog.findMany({
      where: { userId: req.userId, date: new Date(req.params.date) },
    });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/supplements/log
router.post('/log', async (req, res) => {
  try {
    const { supplementId, date, takenAt, endTime, notes, withFood } = req.body;
    // Use the diary date (or today if not provided) so retroactive logs
    // attach to the correct day even when takenAt time-of-day is custom.
    const dateBucket = date ? new Date(date + 'T00:00:00') : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const log = await req.prisma.supplementLog.create({
      data: {
        userId: req.userId,
        supplementId,
        date: dateBucket,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
        endTime: endTime ? new Date(endTime) : null,
        notes: notes || null,
        withFood: !!withFood,
      },
    });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/supplements/log/:id — edit timing/notes
router.put('/log/:id', async (req, res) => {
  try {
    const { takenAt, endTime, notes, withFood } = req.body;
    const data = {};
    if (takenAt !== undefined) data.takenAt = takenAt ? new Date(takenAt) : null;
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
    if (notes !== undefined) data.notes = notes || null;
    if (withFood !== undefined) data.withFood = !!withFood;
    const log = await req.prisma.supplementLog.update({
      where: { id: req.params.id },
      data,
    });
    res.json(log);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/supplements/log/:id
router.delete('/log/:id', async (req, res) => {
  try {
    await req.prisma.supplementLog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
