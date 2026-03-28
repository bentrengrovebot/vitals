import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/recipes
router.get('/', async (req, res) => {
  try {
    const recipes = await req.prisma.recipe.findMany({
      where: { userId: req.userId },
      include: { ingredients: true },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/recipes
router.post('/', async (req, res) => {
  try {
    const { name, servings, ingredients } = req.body;
    const recipe = await req.prisma.recipe.create({
      data: {
        userId: req.userId,
        name,
        servings: servings || 1,
        ingredients: {
          create: (ingredients || []).map(i => ({
            name: i.name,
            grams: i.grams,
            calories: i.calories,
            proteinG: i.proteinG,
            fatG: i.fatG,
            carbsG: i.carbsG,
            source: i.source || 'ai_estimated',
          })),
        },
      },
      include: { ingredients: true },
    });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/recipes/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, servings, ingredients } = req.body;
    // Delete existing ingredients and recreate
    await req.prisma.recipeIngredient.deleteMany({ where: { recipeId: req.params.id } });
    const recipe = await req.prisma.recipe.update({
      where: { id: req.params.id },
      data: {
        name,
        servings: servings || 1,
        ingredients: {
          create: (ingredients || []).map(i => ({
            name: i.name,
            grams: i.grams,
            calories: i.calories,
            proteinG: i.proteinG,
            fatG: i.fatG,
            carbsG: i.carbsG,
            source: i.source || 'ai_estimated',
          })),
        },
      },
      include: { ingredients: true },
    });
    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/recipes/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.recipe.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
