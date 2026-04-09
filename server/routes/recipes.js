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

// POST /api/recipes/seed-v8 — seed Meal Plan v8 recipes + goals
router.post('/seed-v8', async (req, res) => {
  try {
    const userId = req.userId;
    const recipes = [
      {
        name: 'M1 — Morning Cottage Cheese',
        ingredients: [
          { name: 'Cottage cheese', grams: 200, calories: 184, proteinG: 24, fatG: 8, carbsG: 4 },
          { name: 'Carrot sticks', grams: 80, calories: 28, proteinG: 1, fatG: 0, carbsG: 6 },
          { name: 'Almonds (raw)', grams: 25, calories: 124, proteinG: 5, fatG: 12, carbsG: 1 },
        ],
      },
      {
        name: 'M2 — Whey + Almonds',
        ingredients: [
          { name: 'Whey isolate', grams: 40, calories: 150, proteinG: 33, fatG: 1, carbsG: 2 },
          { name: 'Almonds (raw)', grams: 35, calories: 195, proteinG: 7, fatG: 17, carbsG: 2 },
        ],
      },
      {
        name: 'M2 — Chicken + Almonds',
        ingredients: [
          { name: 'Cooked chicken (leftover/tinned)', grams: 150, calories: 155, proteinG: 32, fatG: 3, carbsG: 0 },
          { name: 'Almonds (raw)', grams: 30, calories: 163, proteinG: 6, fatG: 15, carbsG: 1 },
        ],
      },
      {
        name: 'M3 — Post-Training Chicken + Rice',
        ingredients: [
          { name: 'Cooked chicken breast', grams: 220, calories: 240, proteinG: 51, fatG: 4, carbsG: 0 },
          { name: 'Cooked white rice', grams: 100, calories: 130, proteinG: 3, fatG: 0, carbsG: 28 },
          { name: 'Broccoli (steamed)', grams: 120, calories: 38, proteinG: 3, fatG: 0, carbsG: 5 },
          { name: 'Olive oil', grams: 13, calories: 113, proteinG: 0, fatG: 13, carbsG: 0 },
        ],
      },
      {
        name: 'M3 — Tinned Chicken + Rice',
        ingredients: [
          { name: 'Tinned chicken breast (drained)', grams: 200, calories: 213, proteinG: 42, fatG: 5, carbsG: 0 },
          { name: 'Cooked white rice', grams: 100, calories: 130, proteinG: 3, fatG: 0, carbsG: 28 },
          { name: 'Broccoli (steamed)', grams: 120, calories: 38, proteinG: 3, fatG: 0, carbsG: 5 },
          { name: 'Olive oil', grams: 13, calories: 113, proteinG: 0, fatG: 13, carbsG: 0 },
        ],
      },
      {
        name: 'M3 — Rest Day (Half Rice)',
        ingredients: [
          { name: 'Cooked chicken breast', grams: 220, calories: 240, proteinG: 51, fatG: 4, carbsG: 0 },
          { name: 'Cooked white rice', grams: 50, calories: 65, proteinG: 2, fatG: 0, carbsG: 14 },
          { name: 'Broccoli (steamed)', grams: 120, calories: 38, proteinG: 3, fatG: 0, carbsG: 5 },
          { name: 'Olive oil', grams: 13, calories: 113, proteinG: 0, fatG: 13, carbsG: 0 },
        ],
      },
      {
        name: 'M5 — Yoghurt + Almonds',
        ingredients: [
          { name: 'Greek yoghurt (full fat)', grams: 170, calories: 168, proteinG: 17, fatG: 8, carbsG: 7 },
          { name: 'Almonds (raw)', grams: 15, calories: 84, proteinG: 3, fatG: 7, carbsG: 1 },
        ],
      },
      {
        name: 'M5 — Whey Shake',
        ingredients: [
          { name: 'Whey isolate', grams: 40, calories: 150, proteinG: 33, fatG: 1, carbsG: 2 },
        ],
      },
      {
        name: 'M5 — Cottage Cheese',
        ingredients: [
          { name: 'Cottage cheese', grams: 200, calories: 184, proteinG: 24, fatG: 8, carbsG: 4 },
        ],
      },
    ];

    const created = [];
    for (const r of recipes) {
      // Skip if recipe with same name already exists
      const existing = await req.prisma.recipe.findFirst({ where: { userId, name: r.name } });
      if (existing) continue;
      const recipe = await req.prisma.recipe.create({
        data: {
          userId,
          name: r.name,
          servings: 1,
          ingredients: {
            create: r.ingredients.map(i => ({ ...i, source: 'meal_plan_v8' })),
          },
        },
        include: { ingredients: true },
      });
      created.push(recipe);
    }

    // Set macro goals (Week 1-2)
    await req.prisma.goals.create({
      data: { userId, calories: 2000, proteinG: 200, fatG: 97, carbsG: 75, waterMl: 2500 },
    });

    res.json({ recipesCreated: created.length, goalsSet: true });
  } catch (err) {
    console.error(err);
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
