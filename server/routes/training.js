import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /exercises?q=&muscle=
router.get('/exercises', async (req, res) => {
  try {
    const { q, muscle } = req.query;
    const where = { OR: [{ userId: null }, { userId: req.userId }] };
    if (muscle) where.muscleGroup = muscle;
    if (q) where.name = { contains: q, mode: 'insensitive' };
    const exercises = await req.prisma.exercise.findMany({ where, orderBy: { name: 'asc' }, take: 50 });
    res.json(exercises);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /exercises
router.post('/exercises', async (req, res) => {
  try {
    const { name, muscleGroup, equipment, isCompound, description } = req.body;
    const exercise = await req.prisma.exercise.create({
      data: { userId: req.userId, name, muscleGroup, equipment: equipment || 'barbell', isCompound: isCompound || false, description },
    });
    res.json(exercise);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /sessions?date=YYYY-MM-DD
router.get('/sessions', async (req, res) => {
  try {
    const { date } = req.query;
    const where = { userId: req.userId };
    if (date) where.date = new Date(date);
    const sessions = await req.prisma.workoutSession.findMany({
      where, include: { sets: { orderBy: { setIndex: 'asc' } } }, orderBy: { createdAt: 'desc' }, take: 20,
    });
    res.json(sessions);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /sessions/:id
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await req.prisma.workoutSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { sets: { orderBy: { setIndex: 'asc' } } },
    });
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /sessions
router.post('/sessions', async (req, res) => {
  try {
    const { date, name, durationMins, notes, planDayId } = req.body;
    const session = await req.prisma.workoutSession.create({
      data: { userId: req.userId, date: new Date(date || new Date()), name: name || 'Workout', durationMins, notes, planDayId },
      include: { sets: true },
    });
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /sessions/:id
router.put('/sessions/:id', async (req, res) => {
  try {
    const { name, durationMins, notes } = req.body;
    const session = await req.prisma.workoutSession.update({
      where: { id: req.params.id },
      data: { name, durationMins, notes },
      include: { sets: true },
    });
    res.json(session);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  try {
    await req.prisma.workoutSession.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /sessions/:id/sets
router.post('/sessions/:id/sets', async (req, res) => {
  try {
    const { exerciseId, exerciseName, muscleGroup, setIndex, reps, weightKg, rir, rpe, isWarmup } = req.body;
    // Find or create exercise
    let exId = exerciseId;
    if (!exId && exerciseName) {
      let exercise = await req.prisma.exercise.findFirst({
        where: { name: { equals: exerciseName, mode: 'insensitive' }, OR: [{ userId: null }, { userId: req.userId }] },
      });
      if (!exercise) {
        exercise = await req.prisma.exercise.create({
          data: { userId: req.userId, name: exerciseName, muscleGroup: muscleGroup || 'other', equipment: 'other' },
        });
      }
      exId = exercise.id;
    }
    // Get next set index if not provided
    let idx = setIndex;
    if (idx === undefined) {
      const lastSet = await req.prisma.workoutSessionSet.findFirst({
        where: { sessionId: req.params.id, exerciseId: exId },
        orderBy: { setIndex: 'desc' },
      });
      idx = lastSet ? lastSet.setIndex + 1 : 1;
    }
    const set = await req.prisma.workoutSessionSet.create({
      data: { sessionId: req.params.id, exerciseId: exId, setIndex: idx, reps, weightKg, rir, rpe, isWarmup: isWarmup || false },
    });
    res.json(set);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /sets/:id
router.put('/sets/:id', async (req, res) => {
  try {
    const { reps, weightKg, rir, rpe, isWarmup, completed } = req.body;
    const set = await req.prisma.workoutSessionSet.update({
      where: { id: req.params.id },
      data: { reps, weightKg, rir, rpe, isWarmup, completed },
    });
    res.json(set);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /sets/:id
router.delete('/sets/:id', async (req, res) => {
  try {
    await req.prisma.workoutSessionSet.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /volume?days=30
router.get('/volume', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sets = await req.prisma.workoutSessionSet.findMany({
      where: { session: { userId: req.userId, date: { gte: since } }, isWarmup: false, completed: true },
      include: { session: { select: { date: true } } },
    });
    // Get exercise data for muscle group mapping
    const exerciseIds = [...new Set(sets.map(s => s.exerciseId))];
    const exercises = await req.prisma.exercise.findMany({ where: { id: { in: exerciseIds } } });
    const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));

    // Count sets per muscle group
    const volume = {};
    sets.forEach(s => {
      const ex = exMap[s.exerciseId];
      if (ex) {
        volume[ex.muscleGroup] = (volume[ex.muscleGroup] || 0) + 1;
      }
    });
    res.json(volume);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
