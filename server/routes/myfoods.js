import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/my-foods
router.get('/', async (req, res) => {
  try {
    const foods = await req.prisma.customFood.findMany({
      where: { userId: req.userId },
      orderBy: { name: 'asc' },
    });
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/my-foods
router.post('/', async (req, res) => {
  try {
    const { name, servingSize, unit, calories, proteinG, fatG, carbsG } = req.body;
    const food = await req.prisma.customFood.create({
      data: { userId: req.userId, name, servingSize: servingSize || 100, unit: unit || 'g', calories, proteinG, fatG, carbsG },
    });
    res.json(food);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/my-foods/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, servingSize, unit, calories, proteinG, fatG, carbsG } = req.body;
    const food = await req.prisma.customFood.update({
      where: { id: req.params.id },
      data: { name, servingSize, unit, calories, proteinG, fatG, carbsG },
    });
    res.json(food);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/my-foods/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.customFood.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
