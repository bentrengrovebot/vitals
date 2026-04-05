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

// POST /api/data/seed-exercises — seed global exercises if none exist
router.post('/seed-exercises', async (req, res) => {
  try {
    const existing = await req.prisma.exercise.count({ where: { userId: null } });
    if (existing > 0) {
      return res.json({ message: 'Exercises already seeded', count: existing });
    }

    const exercises = [
      // Chest
      { name: 'Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell', isCompound: true },
      { name: 'Incline Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell', isCompound: true },
      { name: 'Dumbbell Bench Press', muscleGroup: 'chest', equipment: 'dumbbell', isCompound: true },
      { name: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: 'dumbbell', isCompound: true },
      { name: 'Cable Fly', muscleGroup: 'chest', equipment: 'cable', isCompound: false },
      // Back
      { name: 'Barbell Row', muscleGroup: 'back', equipment: 'barbell', isCompound: true },
      { name: 'Deadlift', muscleGroup: 'back', equipment: 'barbell', isCompound: true },
      { name: 'Pull-Up', muscleGroup: 'back', equipment: 'bodyweight', isCompound: true },
      { name: 'Lat Pulldown', muscleGroup: 'back', equipment: 'cable', isCompound: true },
      { name: 'Seated Cable Row', muscleGroup: 'back', equipment: 'cable', isCompound: true },
      { name: 'Dumbbell Row', muscleGroup: 'back', equipment: 'dumbbell', isCompound: true },
      // Shoulders
      { name: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell', isCompound: true },
      { name: 'Dumbbell Shoulder Press', muscleGroup: 'shoulders', equipment: 'dumbbell', isCompound: true },
      { name: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell', isCompound: false },
      { name: 'Face Pull', muscleGroup: 'shoulders', equipment: 'cable', isCompound: false },
      { name: 'Reverse Fly', muscleGroup: 'shoulders', equipment: 'dumbbell', isCompound: false },
      // Quads
      { name: 'Barbell Squat', muscleGroup: 'quads', equipment: 'barbell', isCompound: true },
      { name: 'Front Squat', muscleGroup: 'quads', equipment: 'barbell', isCompound: true },
      { name: 'Leg Press', muscleGroup: 'quads', equipment: 'machine', isCompound: true },
      { name: 'Leg Extension', muscleGroup: 'quads', equipment: 'machine', isCompound: false },
      { name: 'Bulgarian Split Squat', muscleGroup: 'quads', equipment: 'dumbbell', isCompound: true },
      // Hamstrings
      { name: 'Romanian Deadlift', muscleGroup: 'hamstrings', equipment: 'barbell', isCompound: true },
      { name: 'Lying Leg Curl', muscleGroup: 'hamstrings', equipment: 'machine', isCompound: false },
      { name: 'Seated Leg Curl', muscleGroup: 'hamstrings', equipment: 'machine', isCompound: false },
      { name: 'Stiff-Leg Deadlift', muscleGroup: 'hamstrings', equipment: 'barbell', isCompound: true },
      // Glutes
      { name: 'Hip Thrust', muscleGroup: 'glutes', equipment: 'barbell', isCompound: true },
      { name: 'Cable Kickback', muscleGroup: 'glutes', equipment: 'cable', isCompound: false },
      { name: 'Glute Bridge', muscleGroup: 'glutes', equipment: 'bodyweight', isCompound: false },
      { name: 'Sumo Deadlift', muscleGroup: 'glutes', equipment: 'barbell', isCompound: true },
      // Biceps
      { name: 'Barbell Curl', muscleGroup: 'biceps', equipment: 'barbell', isCompound: false },
      { name: 'Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell', isCompound: false },
      { name: 'Hammer Curl', muscleGroup: 'biceps', equipment: 'dumbbell', isCompound: false },
      { name: 'Incline Dumbbell Curl', muscleGroup: 'biceps', equipment: 'dumbbell', isCompound: false },
      { name: 'Cable Curl', muscleGroup: 'biceps', equipment: 'cable', isCompound: false },
      // Triceps
      { name: 'Tricep Pushdown', muscleGroup: 'triceps', equipment: 'cable', isCompound: false },
      { name: 'Overhead Tricep Extension', muscleGroup: 'triceps', equipment: 'cable', isCompound: false },
      { name: 'Close-Grip Bench Press', muscleGroup: 'triceps', equipment: 'barbell', isCompound: true },
      { name: 'Skull Crusher', muscleGroup: 'triceps', equipment: 'barbell', isCompound: false },
      { name: 'Dip', muscleGroup: 'triceps', equipment: 'bodyweight', isCompound: true },
      // Abs
      { name: 'Cable Crunch', muscleGroup: 'abs', equipment: 'cable', isCompound: false },
      { name: 'Hanging Leg Raise', muscleGroup: 'abs', equipment: 'bodyweight', isCompound: false },
      { name: 'Ab Rollout', muscleGroup: 'abs', equipment: 'other', isCompound: false },
      { name: 'Plank', muscleGroup: 'abs', equipment: 'bodyweight', isCompound: false },
      { name: 'Russian Twist', muscleGroup: 'abs', equipment: 'bodyweight', isCompound: false },
      // Calves
      { name: 'Standing Calf Raise', muscleGroup: 'calves', equipment: 'machine', isCompound: false },
      { name: 'Seated Calf Raise', muscleGroup: 'calves', equipment: 'machine', isCompound: false },
      { name: 'Leg Press Calf Raise', muscleGroup: 'calves', equipment: 'machine', isCompound: false },
      // Cardio
      { name: 'Treadmill Run', muscleGroup: 'cardio', equipment: 'machine', isCompound: false },
      { name: 'Rowing Machine', muscleGroup: 'cardio', equipment: 'machine', isCompound: false },
      { name: 'Cycling', muscleGroup: 'cardio', equipment: 'machine', isCompound: false },
      { name: 'Stairmaster', muscleGroup: 'cardio', equipment: 'machine', isCompound: false },
    ];

    await req.prisma.exercise.createMany({
      data: exercises.map(e => ({ ...e, userId: null })),
    });

    res.json({ message: 'Exercises seeded', count: exercises.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
