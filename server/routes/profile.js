import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    // Check if this is a goals request based on the baseUrl
    if (req.baseUrl === '/api/goals') {
      const goals = await req.prisma.goals.findFirst({
        where: { userId: req.userId },
        orderBy: { effectiveFrom: 'desc' },
      });
      return res.json(goals || { calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500, fiberG: 30, satFatG: 15, sugarG: 25, sodiumMg: 2300 });
    }

    const profile = await req.prisma.profile.findUnique({ where: { userId: req.userId } });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/profile
router.put('/', async (req, res) => {
  try {
    if (req.baseUrl === '/api/goals') {
      const { calories, proteinG, fatG, carbsG, waterMl, fiberG, satFatG, sugarG, sodiumMg } = req.body;
      const goals = await req.prisma.goals.create({
        data: {
          userId: req.userId,
          calories, proteinG, fatG, carbsG,
          waterMl: waterMl || 2500,
          fiberG: fiberG ?? 30,
          satFatG: satFatG ?? 15,
          sugarG: sugarG ?? 25,
          sodiumMg: sodiumMg ?? 2300,
        },
      });
      return res.json(goals);
    }

    const { name, dob, sex, heightCm, weightKg, weightGoalKg } = req.body;
    const profile = await req.prisma.profile.upsert({
      where: { userId: req.userId },
      update: { name, dob: dob ? new Date(dob) : null, sex, heightCm, weightKg, weightGoalKg },
      create: { userId: req.userId, name, dob: dob ? new Date(dob) : null, sex, heightCm, weightKg, weightGoalKg },
    });
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
