import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/symptoms?limit=20
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const symptoms = await req.prisma.symptomLog.findMany({
      where: { userId: req.userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    res.json(symptoms);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/symptoms
router.post('/', async (req, res) => {
  try {
    const { type, severity, notes } = req.body;
    const symptom = await req.prisma.symptomLog.create({
      data: { userId: req.userId, type, severity: severity || 3, notes },
    });
    res.json(symptom);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/symptoms/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.symptomLog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
