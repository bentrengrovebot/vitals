import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// DELETE /api/data/all
router.delete('/all', async (req, res) => {
  try {
    await req.prisma.diaryEntry.deleteMany({ where: { userId: req.userId } });
    await req.prisma.recipeIngredient.deleteMany({
      where: { recipe: { userId: req.userId } },
    });
    await req.prisma.recipe.deleteMany({ where: { userId: req.userId } });
    await req.prisma.symptomLog.deleteMany({ where: { userId: req.userId } });
    await req.prisma.weighIn.deleteMany({ where: { userId: req.userId } });
    await req.prisma.waterLog.deleteMany({ where: { userId: req.userId } });
    await req.prisma.supplementLog.deleteMany({ where: { userId: req.userId } });
    await req.prisma.aiInsight.deleteMany({ where: { userId: req.userId } });
    await req.prisma.customFood.deleteMany({ where: { userId: req.userId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/data/export
router.get('/export', async (req, res) => {
  try {
    const data = {
      profile: await req.prisma.profile.findUnique({ where: { userId: req.userId } }),
      goals: await req.prisma.goals.findFirst({ where: { userId: req.userId }, orderBy: { effectiveFrom: 'desc' } }),
      recipes: await req.prisma.recipe.findMany({ where: { userId: req.userId }, include: { ingredients: true } }),
      diary: await req.prisma.diaryEntry.findMany({ where: { userId: req.userId } }),
      weighIns: await req.prisma.weighIn.findMany({ where: { userId: req.userId } }),
      symptoms: await req.prisma.symptomLog.findMany({ where: { userId: req.userId } }),
      water: await req.prisma.waterLog.findMany({ where: { userId: req.userId } }),
      supplements: await req.prisma.supplement.findMany({ where: { userId: req.userId } }),
      insights: await req.prisma.aiInsight.findMany({ where: { userId: req.userId } }),
    };
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
