import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const r1 = n => Math.round(n * 10) / 10;

function createMcpServer(prisma) {
  const server = new McpServer({ name: 'vitals', version: '1.0.0' });

  async function getUserId() {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found. Sign up in the app first.');
    return user.id;
  }

  // ====== NUTRITION ======

  server.tool('get_diary', 'Get food diary entries for a date with calories and macros.', { date: z.string().optional().describe('YYYY-MM-DD. Defaults to today.') }, async ({ date }) => {
    const userId = await getUserId();
    const d = date || dateKey();
    const entries = await prisma.diaryEntry.findMany({ where: { userId, date: new Date(d) }, orderBy: { slot: 'asc' } });
    const bySlot = {};
    entries.forEach(e => { if (!bySlot[e.slot]) bySlot[e.slot] = []; bySlot[e.slot].push({ name: e.name, portion: e.portion, calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG }); });
    const totals = entries.reduce((t, e) => ({ calories: t.calories + (e.calories || 0), proteinG: t.proteinG + (e.proteinG || 0), fatG: t.fatG + (e.fatG || 0), carbsG: t.carbsG + (e.carbsG || 0) }), { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 });
    return { content: [{ type: 'text', text: JSON.stringify({ date: d, meals: bySlot, totals }, null, 2) }] };
  });

  server.tool('log_food', 'Log a food item to the diary.', {
    slot: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']), name: z.string(), calories: z.number(),
    proteinG: z.number().optional(), fatG: z.number().optional(), carbsG: z.number().optional(),
    portion: z.string().optional(), date: z.string().optional(),
  }, async ({ slot, name, calories, proteinG, fatG, carbsG, portion, date }) => {
    const userId = await getUserId();
    await prisma.diaryEntry.create({ data: { userId, date: new Date(date || dateKey()), slot, name, portion, calories, proteinG: proteinG || 0, fatG: fatG || 0, carbsG: carbsG || 0 } });
    return { content: [{ type: 'text', text: `Logged "${name}" to ${slot}: ${calories} cal, ${proteinG || 0}g P, ${fatG || 0}g F, ${carbsG || 0}g C` }] };
  });

  server.tool('get_goals', 'Get daily nutrition goals and profile.', {}, async () => {
    const userId = await getUserId();
    const goals = await prisma.goals.findFirst({ where: { userId }, orderBy: { effectiveFrom: 'desc' } });
    const profile = await prisma.profile.findUnique({ where: { userId } });
    return { content: [{ type: 'text', text: JSON.stringify({ goals, profile: profile ? { name: profile.name, weightKg: profile.weightKg, weightGoalKg: profile.weightGoalKg } : null }, null, 2) }] };
  });

  server.tool('log_water', 'Log water intake in ml.', { amountMl: z.number(), date: z.string().optional() }, async ({ amountMl, date }) => {
    const userId = await getUserId();
    await prisma.waterLog.create({ data: { userId, date: new Date(date || dateKey()), amountMl, timestamp: new Date() } });
    const logs = await prisma.waterLog.findMany({ where: { userId, date: new Date(date || dateKey()) } });
    const total = logs.reduce((s, l) => s + l.amountMl, 0);
    return { content: [{ type: 'text', text: `Logged ${amountMl}ml. Today total: ${total}ml` }] };
  });

  server.tool('copy_meal', 'Copy a meal slot from one date to another.', {
    fromDate: z.string(), toDate: z.string(), slot: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']),
  }, async ({ fromDate, toDate, slot }) => {
    const userId = await getUserId();
    const entries = await prisma.diaryEntry.findMany({ where: { userId, date: new Date(fromDate), slot } });
    if (!entries.length) return { content: [{ type: 'text', text: `No entries for ${slot} on ${fromDate}` }] };
    for (const e of entries) { await prisma.diaryEntry.create({ data: { userId, date: new Date(toDate), slot, name: e.name, portion: e.portion, calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG } }); }
    return { content: [{ type: 'text', text: `Copied ${entries.length} items from ${slot} ${fromDate} to ${toDate}` }] };
  });

  // ====== TRAINING ======

  server.tool('get_training_sessions', 'Get recent workouts with exercises and sets.', { date: z.string().optional() }, async ({ date }) => {
    const userId = await getUserId();
    const where = { userId };
    if (date) where.date = new Date(date);
    const sessions = await prisma.workoutSession.findMany({ where, include: { sets: true }, orderBy: { date: 'desc' }, take: 10 });
    const exIds = [...new Set(sessions.flatMap(s => s.sets.map(set => set.exerciseId)))];
    const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
    const exMap = Object.fromEntries(exercises.map(e => [e.id, e.name]));
    const result = sessions.map(s => ({
      name: s.name, date: s.date, durationMins: s.durationMins,
      exercises: Object.entries(s.sets.reduce((g, set) => { const n = exMap[set.exerciseId] || set.exerciseId; if (!g[n]) g[n] = []; if (set.reps) g[n].push({ weightKg: set.weightKg, reps: set.reps, rir: set.rir }); return g; }, {})).map(([name, sets]) => ({ name, sets })),
    }));
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  server.tool('log_set', 'Log a set for an exercise. Auto-creates session if needed.', {
    exerciseName: z.string(), weightKg: z.number(), reps: z.number(), rir: z.number().optional(), sessionId: z.string().optional(),
  }, async ({ exerciseName, weightKg, reps, rir, sessionId }) => {
    const userId = await getUserId();
    let session = sessionId ? await prisma.workoutSession.findFirst({ where: { id: sessionId, userId } }) : await prisma.workoutSession.findFirst({ where: { userId, date: new Date(dateKey()), durationMins: null }, orderBy: { createdAt: 'desc' } });
    if (!session) session = await prisma.workoutSession.create({ data: { userId, date: new Date(dateKey()), name: 'Workout' } });
    let exercise = await prisma.exercise.findFirst({ where: { name: { equals: exerciseName, mode: 'insensitive' }, OR: [{ userId: null }, { userId }] } });
    if (!exercise) exercise = await prisma.exercise.create({ data: { name: exerciseName, muscleGroup: 'other', equipment: 'other' } });
    const last = await prisma.workoutSessionSet.findFirst({ where: { sessionId: session.id, exerciseId: exercise.id }, orderBy: { setIndex: 'desc' } });
    const idx = last ? last.setIndex + 1 : 1;
    await prisma.workoutSessionSet.create({ data: { sessionId: session.id, exerciseId: exercise.id, setIndex: idx, weightKg, reps, rir, completed: true } });
    return { content: [{ type: 'text', text: `Logged: ${exerciseName} — ${weightKg}kg × ${reps}${rir != null ? ` @${rir}RIR` : ''} (set ${idx})` }] };
  });

  server.tool('log_workout', 'Log a complete workout with multiple exercises at once.', {
    name: z.string().optional(), date: z.string().optional(),
    exercises: z.array(z.object({ name: z.string(), sets: z.array(z.object({ weightKg: z.number(), reps: z.number(), rir: z.number().optional() })) })),
  }, async ({ name, date, exercises }) => {
    const userId = await getUserId();
    const session = await prisma.workoutSession.create({ data: { userId, date: new Date(date || dateKey()), name: name || 'Workout' } });
    const logged = [];
    for (const ex of exercises) {
      let exercise = await prisma.exercise.findFirst({ where: { name: { equals: ex.name, mode: 'insensitive' }, OR: [{ userId: null }, { userId }] } });
      if (!exercise) exercise = await prisma.exercise.create({ data: { name: ex.name, muscleGroup: 'other', equipment: 'other' } });
      for (let i = 0; i < ex.sets.length; i++) { const s = ex.sets[i]; await prisma.workoutSessionSet.create({ data: { sessionId: session.id, exerciseId: exercise.id, setIndex: i + 1, weightKg: s.weightKg, reps: s.reps, rir: s.rir, completed: true } }); }
      logged.push(`${ex.name}: ${ex.sets.map(s => `${s.weightKg}kg×${s.reps}`).join(', ')}`);
    }
    await prisma.workoutSession.update({ where: { id: session.id }, data: { durationMins: 45 } });
    return { content: [{ type: 'text', text: `Logged workout:\n${logged.join('\n')}` }] };
  });

  server.tool('get_training_volume', 'Get weekly sets per muscle group.', { days: z.number().optional() }, async ({ days }) => {
    const userId = await getUserId();
    const since = new Date(); since.setDate(since.getDate() - (days || 7));
    const sets = await prisma.workoutSessionSet.findMany({ where: { session: { userId, date: { gte: since } }, completed: true, isWarmup: false } });
    const exIds = [...new Set(sets.map(s => s.exerciseId))];
    const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
    const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));
    const volume = {};
    sets.forEach(s => { const g = exMap[s.exerciseId]?.muscleGroup || 'other'; volume[g] = (volume[g] || 0) + 1; });
    return { content: [{ type: 'text', text: JSON.stringify({ period: `${days || 7} days`, totalSets: Object.values(volume).reduce((s, v) => s + v, 0), byMuscle: volume }, null, 2) }] };
  });

  server.tool('get_workout_plan', 'Get the current workout plan with days and exercises.', {}, async () => {
    const userId = await getUserId();
    const plan = await prisma.workoutPlan.findFirst({ where: { userId, isActive: true }, include: { days: { orderBy: { dayIndex: 'asc' }, include: { exercises: { orderBy: { orderIndex: 'asc' } } } } } });
    if (!plan) return { content: [{ type: 'text', text: 'No active plan.' }] };
    const exIds = plan.days.flatMap(d => d.exercises.map(e => e.exerciseId));
    const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
    const exMap = Object.fromEntries(exercises.map(e => [e.id, e.name]));
    return { content: [{ type: 'text', text: JSON.stringify({ name: plan.name, description: plan.description, days: plan.days.map(d => ({ name: d.name, exercises: d.exercises.map(e => ({ name: exMap[e.exerciseId] || '?', targetSets: e.targetSets, targetReps: e.targetReps, targetRir: e.targetRir })) })) }, null, 2) }] };
  });

  server.tool('search_exercises', 'Search the exercise library.', { query: z.string().optional(), muscleGroup: z.string().optional() }, async ({ query, muscleGroup }) => {
    const userId = await getUserId();
    const where = { OR: [{ userId: null }, { userId }] };
    if (query) where.name = { contains: query, mode: 'insensitive' };
    if (muscleGroup) where.muscleGroup = muscleGroup;
    const exercises = await prisma.exercise.findMany({ where, orderBy: { name: 'asc' }, take: 20 });
    return { content: [{ type: 'text', text: JSON.stringify(exercises.map(e => ({ name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment })), null, 2) }] };
  });

  // ====== BODY ======

  server.tool('log_weight', 'Log a body weight measurement.', { weightKg: z.number() }, async ({ weightKg }) => {
    const userId = await getUserId();
    await prisma.weighIn.create({ data: { userId, date: new Date(dateKey()), weightKg } });
    return { content: [{ type: 'text', text: `Logged weight: ${weightKg}kg` }] };
  });

  server.tool('get_weight_history', 'Get recent weight measurements.', { limit: z.number().optional() }, async ({ limit }) => {
    const userId = await getUserId();
    const entries = await prisma.weighIn.findMany({ where: { userId }, orderBy: { date: 'desc' }, take: limit || 14 });
    return { content: [{ type: 'text', text: JSON.stringify(entries.map(e => ({ date: e.date, weightKg: e.weightKg })), null, 2) }] };
  });

  server.tool('get_supplements', 'Get supplement list and today\'s status.', {}, async () => {
    const userId = await getUserId();
    const supps = await prisma.supplement.findMany({ where: { userId, isActive: true } });
    const logs = await prisma.supplementLog.findMany({ where: { userId, date: new Date(dateKey()) } });
    const loggedIds = new Set(logs.map(l => l.supplementId));
    return { content: [{ type: 'text', text: JSON.stringify(supps.map(s => ({ name: s.name, dose: s.activeDose, takenToday: loggedIds.has(s.id) })), null, 2) }] };
  });

  return server;
}

/**
 * Stateless Streamable HTTP MCP endpoint for claude.ai custom connectors.
 * No auth — leave OAuth fields empty when adding connector in claude.ai.
 */
export function setupMCP(app, prisma) {
  // CORS headers required for claude.ai
  app.use('/mcp', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  });

  // Single endpoint — stateless, new server per request
  app.all('/mcp', async (req, res) => {
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = createMcpServer(prisma);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      await server.close();
    } catch (err) {
      console.error('MCP error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'MCP error' });
    }
  });

  console.log('MCP remote endpoint mounted at /mcp');
}
