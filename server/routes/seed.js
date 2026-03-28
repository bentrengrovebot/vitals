import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function dk(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}
function dkStr(daysAgo = 0) {
  const d = dk(daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// POST /api/seed/demo — populate account with 14 days of realistic data
router.post('/demo', async (req, res) => {
  try {
    const userId = req.userId;

    // 1. Profile
    await req.prisma.profile.upsert({
      where: { userId },
      update: { name: 'Ben', sex: 'Male', heightCm: 176, weightKg: 101.5, weightGoalKg: 95, dob: new Date('1995-06-15') },
      create: { userId, name: 'Ben', sex: 'Male', heightCm: 176, weightKg: 101.5, weightGoalKg: 95, dob: new Date('1995-06-15') },
    });

    // 2. Goals
    await req.prisma.goals.create({
      data: { userId, calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 },
    });

    // 3. Recipes
    const recipes = [
      { name: 'Cottage Cheese Bowl', servings: 1, ingredients: [
        { name: 'Anchor Cottage Cheese', grams: 250, calories: 245, proteinG: 30, fatG: 5.5, carbsG: 10, source: 'ai_estimated' },
        { name: 'Blueberries', grams: 80, calories: 46, proteinG: 0.6, fatG: 0.3, carbsG: 11.6, source: 'ai_estimated' },
        { name: 'Honey', grams: 15, calories: 46, proteinG: 0, fatG: 0, carbsG: 12.5, source: 'ai_estimated' },
        { name: 'Walnuts', grams: 20, calories: 131, proteinG: 3, fatG: 13, carbsG: 2.7, source: 'ai_estimated' },
      ]},
      { name: 'Chicken Stir Fry', servings: 2, ingredients: [
        { name: 'Chicken Breast', grams: 400, calories: 440, proteinG: 92, fatG: 4, carbsG: 0, source: 'ai_estimated' },
        { name: 'Brown Rice', grams: 200, calories: 222, proteinG: 5, fatG: 1.8, carbsG: 46, source: 'ai_estimated' },
        { name: 'Broccoli', grams: 150, calories: 51, proteinG: 4.2, fatG: 0.5, carbsG: 10, source: 'ai_estimated' },
        { name: 'Soy Sauce', grams: 20, calories: 11, proteinG: 1.7, fatG: 0, carbsG: 1, source: 'ai_estimated' },
        { name: 'Sesame Oil', grams: 10, calories: 88, proteinG: 0, fatG: 10, carbsG: 0, source: 'ai_estimated' },
      ]},
      { name: 'Protein Smoothie', servings: 1, ingredients: [
        { name: 'Whey Protein', grams: 30, calories: 120, proteinG: 25, fatG: 1.5, carbsG: 2, source: 'ai_estimated' },
        { name: 'Banana', grams: 120, calories: 107, proteinG: 1.3, fatG: 0.4, carbsG: 27, source: 'ai_estimated' },
        { name: 'Peanut Butter', grams: 20, calories: 118, proteinG: 5, fatG: 10, carbsG: 3.5, source: 'ai_estimated' },
        { name: 'Milk', grams: 250, calories: 155, proteinG: 8, fatG: 8, carbsG: 12, source: 'ai_estimated' },
      ]},
      { name: 'Salmon & Veggies', servings: 1, ingredients: [
        { name: 'Salmon Fillet', grams: 200, calories: 412, proteinG: 40, fatG: 27, carbsG: 0, source: 'ai_estimated' },
        { name: 'Sweet Potato', grams: 200, calories: 172, proteinG: 3.2, fatG: 0.2, carbsG: 40, source: 'ai_estimated' },
        { name: 'Asparagus', grams: 100, calories: 20, proteinG: 2.2, fatG: 0.1, carbsG: 3.9, source: 'ai_estimated' },
        { name: 'Olive Oil', grams: 10, calories: 88, proteinG: 0, fatG: 10, carbsG: 0, source: 'ai_estimated' },
      ]},
      { name: 'Eggs on Toast', servings: 1, ingredients: [
        { name: 'Eggs', grams: 120, calories: 186, proteinG: 15, fatG: 13, carbsG: 1, source: 'ai_estimated' },
        { name: 'Sourdough Bread', grams: 70, calories: 190, proteinG: 6, fatG: 1, carbsG: 38, source: 'ai_estimated' },
        { name: 'Butter', grams: 10, calories: 72, proteinG: 0.1, fatG: 8, carbsG: 0, source: 'ai_estimated' },
        { name: 'Avocado', grams: 50, calories: 80, proteinG: 1, fatG: 7, carbsG: 4, source: 'ai_estimated' },
      ]},
    ];

    for (const r of recipes) {
      await req.prisma.recipe.create({
        data: {
          userId, name: r.name, servings: r.servings,
          ingredients: { create: r.ingredients },
        },
      });
    }

    // 4. Diary entries (14 days)
    const meals = [
      // [slot, name, cal, protein, fat, carbs, portion]
      ['Breakfast', 'Cottage Cheese Bowl', 468, 33.6, 18.8, 36.8, '1 serve'],
      ['Breakfast', 'Eggs on Toast', 528, 22.1, 29.1, 43, '1 serve'],
      ['Breakfast', 'Protein Smoothie', 500, 39.3, 19.9, 44.5, '1 serve'],
      ['Lunch', 'Chicken Stir Fry', 406, 51.5, 8.2, 28.5, '1/2 serve'],
      ['Lunch', 'Salmon & Veggies', 692, 45.4, 37.3, 43.9, '1 serve'],
      ['Dinner', 'Chicken Stir Fry', 406, 51.5, 8.2, 28.5, '1/2 serve'],
      ['Dinner', 'Salmon & Veggies', 692, 45.4, 37.3, 43.9, '1 serve'],
      ['Snacks', 'Protein Bar', 210, 20, 8, 22, '1 bar'],
      ['Snacks', 'Apple', 95, 0.5, 0.3, 25, '1 medium'],
      ['Snacks', 'Peanut Butter (20g)', 118, 5, 10, 3.5, '20g'],
      ['Snacks', 'Greek Yoghurt', 130, 15, 4, 8, '170g'],
    ];

    for (let day = 0; day < 14; day++) {
      const date = dk(day);
      // Pick 3-5 meals randomly for each day
      const dayMeals = [];
      // Always a breakfast
      dayMeals.push(meals[day % 3]);
      // Always a lunch
      dayMeals.push(meals[3 + (day % 2)]);
      // Always a dinner
      dayMeals.push(meals[5 + (day % 2)]);
      // 1-2 snacks
      dayMeals.push(meals[7 + (day % 4)]);
      if (day % 3 !== 0) dayMeals.push(meals[7 + ((day + 1) % 4)]);

      for (const m of dayMeals) {
        await req.prisma.diaryEntry.create({
          data: { userId, date, slot: m[0], name: m[1], calories: m[2], proteinG: m[3], fatG: m[4], carbsG: m[5], portion: m[6] },
        });
      }
    }

    // 5. Weigh-ins (14 days, slight downward trend)
    const startWeight = 102.5;
    for (let day = 13; day >= 0; day--) {
      const noise = (Math.random() - 0.5) * 0.6;
      const weight = Math.round((startWeight - (13 - day) * 0.08 + noise) * 10) / 10;
      await req.prisma.weighIn.create({
        data: { userId, date: dk(day), weightKg: weight },
      });
    }

    // 6. Water logs (today + yesterday)
    for (let day = 0; day < 3; day++) {
      const entries = day === 0 ? [250, 500, 250, 500, 250] : [250, 500, 750, 250, 500, 250];
      for (let i = 0; i < entries.length; i++) {
        const ts = new Date(dk(day));
        ts.setHours(7 + i * 2, Math.floor(Math.random() * 60), 0, 0);
        await req.prisma.waterLog.create({
          data: { userId, timestamp: ts, amountMl: entries[i] },
        });
      }
    }

    // 7. Supplements
    const supps = [
      { name: 'Iron', activeIngredient: 'Ferrous Fumarate', activeDose: '30mg' },
      { name: 'Creatine', activeIngredient: null, activeDose: '5g' },
      { name: 'Fish Oil', activeIngredient: 'Omega-3', activeDose: '1000mg' },
      { name: 'Vitamin D', activeIngredient: 'Cholecalciferol', activeDose: '1000IU' },
    ];
    const createdSupps = [];
    for (const s of supps) {
      const sup = await req.prisma.supplement.create({
        data: { userId, name: s.name, activeIngredient: s.activeIngredient, activeDose: s.activeDose, isActive: true },
      });
      createdSupps.push(sup);
    }

    // Supplement logs (mark 2 as taken today)
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 2; i++) {
      const takenAt = new Date(today);
      takenAt.setHours(7, 30, 0, 0);
      await req.prisma.supplementLog.create({
        data: { userId, supplementId: createdSupps[i].id, date: today, takenAt },
      });
    }

    // 8. Symptoms (scattered over 14 days)
    const symptomEntries = [
      { daysAgo: 0, type: 'reflux', severity: 3 },
      { daysAgo: 1, type: 'bloating', severity: 2 },
      { daysAgo: 3, type: 'energy_low', severity: 3, notes: 'After lunch slump' },
      { daysAgo: 4, type: 'reflux', severity: 4, notes: 'After spicy chicken' },
      { daysAgo: 6, type: 'energy_high', severity: 4 },
      { daysAgo: 7, type: 'reflux', severity: 2 },
      { daysAgo: 8, type: 'headache', severity: 3 },
      { daysAgo: 10, type: 'gut_good', severity: 4 },
      { daysAgo: 12, type: 'bloating', severity: 3 },
    ];
    for (const s of symptomEntries) {
      const ts = dk(s.daysAgo);
      ts.setHours(14 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60), 0, 0);
      await req.prisma.symptomLog.create({
        data: { userId, timestamp: ts, type: s.type, severity: s.severity, notes: s.notes || null },
      });
    }

    // 9. Blood test (1 sample)
    await req.prisma.bloodTest.create({
      data: {
        userId,
        date: dk(30),
        source: 'manual',
        markers: {
          iron: { value: 8, unit: 'umol/L', range: '10-30', status: 'low' },
          ferritin: { value: 22, unit: 'ug/L', range: '30-300', status: 'low' },
          b12: { value: 380, unit: 'pmol/L', range: '150-750', status: 'normal' },
          vitamin_d: { value: 45, unit: 'nmol/L', range: '50-150', status: 'low' },
          cholesterol_total: { value: 4.8, unit: 'mmol/L', range: '0-5.0', status: 'normal' },
          testosterone: { value: 18.5, unit: 'nmol/L', range: '8-30', status: 'normal' },
          hba1c: { value: 34, unit: 'mmol/mol', range: '20-41', status: 'normal' },
          haemoglobin: { value: 148, unit: 'g/L', range: '130-170', status: 'normal' },
        },
      },
    });

    res.json({ success: true, message: 'Demo data seeded: 14 days food, 14 weigh-ins, 5 recipes, 4 supplements, 9 symptoms, 1 blood test' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
