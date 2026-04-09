import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database');
    process.exit(1);
  }
  console.log(`Seeding recipes and goals for user: ${user.email}`);

  // ── Macro Goals (Week 1-2 targets) ──
  await prisma.goals.create({
    data: {
      userId: user.id,
      calories: 2000,
      proteinG: 200,
      fatG: 97,
      carbsG: 75,
      waterMl: 2500,
    },
  });
  console.log('Goals set: 2000 cal / 200P / 75C / 97F');

  // ── Recipes ──
  const recipes = [
    {
      name: 'M1 — Morning Cottage Cheese',
      servings: 1,
      ingredients: [
        { name: 'Cottage cheese', grams: 200, calories: 184, proteinG: 24, fatG: 8, carbsG: 4 },
        { name: 'Carrot sticks', grams: 80, calories: 28, proteinG: 1, fatG: 0, carbsG: 6 },
        { name: 'Almonds (raw)', grams: 25, calories: 124, proteinG: 5, fatG: 12, carbsG: 1 },
      ],
    },
    {
      name: 'M2 — Whey + Almonds',
      servings: 1,
      ingredients: [
        { name: 'Whey isolate', grams: 40, calories: 150, proteinG: 33, fatG: 1, carbsG: 2 },
        { name: 'Almonds (raw)', grams: 35, calories: 195, proteinG: 7, fatG: 17, carbsG: 2 },
      ],
    },
    {
      name: 'M2 — Chicken + Almonds',
      servings: 1,
      ingredients: [
        { name: 'Cooked chicken (leftover/tinned)', grams: 150, calories: 155, proteinG: 32, fatG: 3, carbsG: 0 },
        { name: 'Almonds (raw)', grams: 30, calories: 163, proteinG: 6, fatG: 15, carbsG: 1 },
      ],
    },
    {
      name: 'M3 — Post-Training Chicken + Rice',
      servings: 1,
      ingredients: [
        { name: 'Cooked chicken breast', grams: 220, calories: 240, proteinG: 51, fatG: 4, carbsG: 0 },
        { name: 'Cooked white rice', grams: 100, calories: 130, proteinG: 3, fatG: 0, carbsG: 28 },
        { name: 'Broccoli (steamed)', grams: 120, calories: 38, proteinG: 3, fatG: 0, carbsG: 5 },
        { name: 'Olive oil', grams: 13, calories: 113, proteinG: 0, fatG: 13, carbsG: 0 },
      ],
    },
    {
      name: 'M3 — Tinned Chicken + Rice',
      servings: 1,
      ingredients: [
        { name: 'Tinned chicken breast (drained)', grams: 200, calories: 213, proteinG: 42, fatG: 5, carbsG: 0 },
        { name: 'Cooked white rice', grams: 100, calories: 130, proteinG: 3, fatG: 0, carbsG: 28 },
        { name: 'Broccoli (steamed)', grams: 120, calories: 38, proteinG: 3, fatG: 0, carbsG: 5 },
        { name: 'Olive oil', grams: 13, calories: 113, proteinG: 0, fatG: 13, carbsG: 0 },
      ],
    },
    {
      name: 'M3 — Rest Day (Half Rice)',
      servings: 1,
      ingredients: [
        { name: 'Cooked chicken breast', grams: 220, calories: 240, proteinG: 51, fatG: 4, carbsG: 0 },
        { name: 'Cooked white rice', grams: 50, calories: 65, proteinG: 2, fatG: 0, carbsG: 14 },
        { name: 'Broccoli (steamed)', grams: 120, calories: 38, proteinG: 3, fatG: 0, carbsG: 5 },
        { name: 'Olive oil', grams: 13, calories: 113, proteinG: 0, fatG: 13, carbsG: 0 },
      ],
    },
    {
      name: 'M5 — Yoghurt + Almonds',
      servings: 1,
      ingredients: [
        { name: 'Greek yoghurt (full fat)', grams: 170, calories: 168, proteinG: 17, fatG: 8, carbsG: 7 },
        { name: 'Almonds (raw)', grams: 15, calories: 84, proteinG: 3, fatG: 7, carbsG: 1 },
      ],
    },
    {
      name: 'M5 — Whey Shake',
      servings: 1,
      ingredients: [
        { name: 'Whey isolate', grams: 40, calories: 150, proteinG: 33, fatG: 1, carbsG: 2 },
      ],
    },
    {
      name: 'M5 — Cottage Cheese',
      servings: 1,
      ingredients: [
        { name: 'Cottage cheese', grams: 200, calories: 184, proteinG: 24, fatG: 8, carbsG: 4 },
      ],
    },
  ];

  for (const r of recipes) {
    const created = await prisma.recipe.create({
      data: {
        userId: user.id,
        name: r.name,
        servings: r.servings,
        ingredients: {
          create: r.ingredients.map(i => ({ ...i, source: 'meal_plan_v8' })),
        },
      },
    });
    const totals = r.ingredients.reduce(
      (t, i) => ({ cal: t.cal + i.calories, p: t.p + i.proteinG, f: t.f + i.fatG, c: t.c + i.carbsG }),
      { cal: 0, p: 0, f: 0, c: 0 }
    );
    console.log(`  Recipe: ${created.name} — ${totals.cal} cal / ${totals.p}P / ${totals.c}C / ${totals.f}F`);
  }

  console.log(`\nDone! ${recipes.length} recipes created + goals updated.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
