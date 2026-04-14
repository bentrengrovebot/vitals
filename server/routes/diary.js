import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/diary/:date
router.get('/:date', async (req, res) => {
  try {
    const entries = await req.prisma.diaryEntry.findMany({
      where: { userId: req.userId, date: new Date(req.params.date) },
      orderBy: { createdAt: 'asc' },
    });
    // Group by slot
    const grouped = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
    entries.forEach(e => {
      if (grouped[e.slot]) grouped[e.slot].push(e);
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/diary/range?start=&end=
router.get('/range/query', async (req, res) => {
  try {
    const { start, end } = req.query;
    const entries = await req.prisma.diaryEntry.findMany({
      where: {
        userId: req.userId,
        date: { gte: new Date(start), lte: new Date(end) },
      },
      orderBy: { date: 'asc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/diary
router.post('/', async (req, res) => {
  try {
    const { date, slot, name, portion, calories, proteinG, fatG, carbsG, fiberG, satFatG, sugarG, sodiumMg, recipeId } = req.body;
    const entry = await req.prisma.diaryEntry.create({
      data: {
        userId: req.userId,
        date: new Date(date),
        slot,
        name,
        portion,
        calories,
        proteinG,
        mealTime: new Date(), // timestamp when food was actually logged
        fatG,
        carbsG,
        fiberG: fiberG ?? null,
        satFatG: satFatG ?? null,
        sugarG: sugarG ?? null,
        sodiumMg: sodiumMg ?? null,
        recipeId,
      },
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/diary/copy
router.post('/copy', async (req, res) => {
  try {
    const { fromDate, toDate, slot } = req.body;
    const entries = await req.prisma.diaryEntry.findMany({
      where: { userId: req.userId, date: new Date(fromDate), slot },
      orderBy: { createdAt: 'asc' },
    });
    if (entries.length === 0) return res.json([]);
    const created = [];
    for (const e of entries) {
      const copy = await req.prisma.diaryEntry.create({
        data: {
          userId: req.userId,
          date: new Date(toDate),
          slot,
          name: e.name,
          portion: e.portion,
          calories: e.calories,
          proteinG: e.proteinG,
          fatG: e.fatG,
          carbsG: e.carbsG,
          recipeId: e.recipeId,
        },
      });
      created.push(copy);
    }
    res.json(created);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/diary/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, portion, calories, proteinG, fatG, carbsG } = req.body;
    const entry = await req.prisma.diaryEntry.update({
      where: { id: req.params.id },
      data: { name, portion, calories, proteinG, fatG, carbsG },
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/diary/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.diaryEntry.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
