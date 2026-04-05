import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /exercises?q=&muscle= — search exercises (global + user's custom)
router.get('/exercises', async (req, res) => {
  try {
    const { q, muscle } = req.query;
    const where = {
      OR: [{ userId: null }, { userId: req.userId }],
    };
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    if (muscle) {
      where.muscleGroup = muscle;
    }
    const exercises = await req.prisma.exercise.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 50,
    });
    res.json(exercises);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /exercises — create custom exercise
router.post('/exercises', async (req, res) => {
  try {
    const { name, muscleGroup, equipment, description, isCompound } = req.body;
    const exercise = await req.prisma.exercise.create({
      data: {
        userId: req.userId,
        name,
        muscleGroup,
        equipment: equipment || 'barbell',
        description,
        isCompound: isCompound || false,
      },
    });
    res.json(exercise);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /sessions?date= — list sessions (recent 20 or by date)
router.get('/sessions', async (req, res) => {
  try {
    const { date } = req.query;
    const where = { userId: req.userId };
    if (date) {
      where.date = new Date(date);
    }
    const sessions = await req.prisma.workoutSession.findMany({
      where,
      include: { sets: true },
      orderBy: { date: 'desc' },
      take: date ? undefined : 20,
    });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /sessions/:id — get session with sets
router.get('/sessions/:id', async (req, res) => {
  try {
    const session = await req.prisma.workoutSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { sets: { orderBy: [{ exerciseId: 'asc' }, { setIndex: 'asc' }] } },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /sessions — create session
router.post('/sessions', async (req, res) => {
  try {
    const { date, planDayId, name, durationMins, notes } = req.body;
    const session = await req.prisma.workoutSession.create({
      data: {
        userId: req.userId,
        date: new Date(date),
        planDayId,
        name,
        durationMins,
        notes,
      },
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /sessions/:id — update session
router.put('/sessions/:id', async (req, res) => {
  try {
    const { name, durationMins, notes } = req.body;
    const session = await req.prisma.workoutSession.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { name, durationMins, notes },
    });
    if (session.count === 0) return res.status(404).json({ error: 'Session not found' });
    const updated = await req.prisma.workoutSession.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /sessions/:id — delete session
router.delete('/sessions/:id', async (req, res) => {
  try {
    const session = await req.prisma.workoutSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    await req.prisma.workoutSession.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /sessions/:id/sets — add set (supports exerciseId or exerciseName with find-or-create)
router.post('/sessions/:id/sets', async (req, res) => {
  try {
    const session = await req.prisma.workoutSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let { exerciseId, exerciseName, muscleGroup, setIndex, reps, weightKg, rir, rpe, isWarmup, completed } = req.body;

    // Find-or-create exercise by name if no exerciseId provided
    if (!exerciseId && exerciseName) {
      let exercise = await req.prisma.exercise.findFirst({
        where: {
          name: { equals: exerciseName, mode: 'insensitive' },
          OR: [{ userId: null }, { userId: req.userId }],
        },
      });
      if (!exercise) {
        exercise = await req.prisma.exercise.create({
          data: {
            userId: req.userId,
            name: exerciseName,
            muscleGroup: muscleGroup || 'other',
          },
        });
      }
      exerciseId = exercise.id;
    }

    const set = await req.prisma.workoutSessionSet.create({
      data: {
        sessionId: req.params.id,
        exerciseId,
        setIndex: setIndex || 0,
        reps,
        weightKg,
        rir,
        rpe,
        isWarmup: isWarmup || false,
        completed: completed !== undefined ? completed : true,
      },
    });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /sets/:id — update set
router.put('/sets/:id', async (req, res) => {
  try {
    const { reps, weightKg, rir, rpe, isWarmup, completed } = req.body;
    const existing = await req.prisma.workoutSessionSet.findFirst({
      where: { id: req.params.id },
      include: { session: true },
    });
    if (!existing || existing.session.userId !== req.userId) {
      return res.status(404).json({ error: 'Set not found' });
    }
    const set = await req.prisma.workoutSessionSet.update({
      where: { id: req.params.id },
      data: { reps, weightKg, rir, rpe, isWarmup, completed },
    });
    res.json(set);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /sets/:id — delete set
router.delete('/sets/:id', async (req, res) => {
  try {
    const existing = await req.prisma.workoutSessionSet.findFirst({
      where: { id: req.params.id },
      include: { session: true },
    });
    if (!existing || existing.session.userId !== req.userId) {
      return res.status(404).json({ error: 'Set not found' });
    }
    await req.prisma.workoutSessionSet.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /exercises/:id/last — get last performance for an exercise (most recent completed sets)
router.get('/exercises/:id/last', async (req, res) => {
  try {
    // Find the most recent session that has sets for this exercise
    const lastSets = await req.prisma.workoutSessionSet.findMany({
      where: {
        exerciseId: req.params.id,
        session: { userId: req.userId },
        completed: true,
        isWarmup: false,
        reps: { not: null },
      },
      include: { session: { select: { id: true, date: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (lastSets.length === 0) return res.json({ sets: [], suggested: null });

    // Group by session, take most recent session's sets
    const lastSessionId = lastSets[0].session.id;
    const sessionSets = lastSets.filter(s => s.session.id === lastSessionId);
    const lastDate = lastSets[0].session.date;

    // Calculate suggestion for next set based on progressive overload
    // Find the best working set (highest weight with good reps)
    const workingSets = sessionSets.filter(s => s.weightKg && s.reps);
    let suggested = null;
    if (workingSets.length > 0) {
      const best = workingSets.reduce((a, b) => (a.weightKg > b.weightKg ? a : b));
      const avgRir = workingSets.filter(s => s.rir != null).reduce((sum, s, _, arr) => sum + s.rir / arr.length, 0);

      // Progressive overload logic:
      // If avg RIR >= 3: increase weight by 2.5kg, keep reps
      // If avg RIR 1-2: keep weight, try +1 rep
      // If avg RIR 0: keep everything (already at limit)
      if (avgRir >= 3) {
        suggested = { weightKg: Math.round((best.weightKg + 2.5) * 10) / 10, reps: best.reps, rir: best.rir };
      } else if (avgRir >= 1) {
        suggested = { weightKg: best.weightKg, reps: best.reps + 1, rir: best.rir };
      } else {
        suggested = { weightKg: best.weightKg, reps: best.reps, rir: 0 };
      }
    }

    res.json({
      sets: sessionSets.map(s => ({ weightKg: s.weightKg, reps: s.reps, rir: s.rir, setIndex: s.setIndex })),
      lastDate,
      suggested,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /volume?days=30 — sets per muscle group
router.get('/volume', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const sets = await req.prisma.workoutSessionSet.findMany({
      where: {
        session: { userId: req.userId, date: { gte: since } },
        completed: true,
        isWarmup: false,
      },
      include: { session: true },
    });

    // Get exercise details for muscle group mapping
    const exerciseIds = [...new Set(sets.map(s => s.exerciseId))];
    const exercises = await req.prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
    });
    const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));

    // Aggregate sets per muscle group
    const volume = {};
    sets.forEach(set => {
      const exercise = exerciseMap[set.exerciseId];
      const group = exercise ? exercise.muscleGroup : 'other';
      volume[group] = (volume[group] || 0) + 1;
    });

    res.json(volume);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
