import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import crypto from 'crypto';

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const r1 = n => Math.round(n * 10) / 10;

function createMcpServer(prisma, authedUserId = null) {
  const server = new McpServer({ name: 'vitals', version: '1.0.0' });

  // Returns the userId for the current MCP session. If called via the
  // authenticated /mcp endpoint, that's the bearer-token holder. The
  // legacy "first user" fallback only fires when no token is set
  // (single-user dev environments).
  async function getUserId() {
    if (authedUserId) return authedUserId;
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found. Sign up in the app first.');
    return user.id;
  }

  // ====== NUTRITION ======

  server.tool('get_diary', 'Get food diary entries for a date with calories, macros, micronutrients (fibre/sat fat/sugar/sodium/potassium), and meal time per entry.', { date: z.string().optional().describe('YYYY-MM-DD. Defaults to today.') }, async ({ date }) => {
    const userId = await getUserId();
    const d = date || dateKey();
    const entries = await prisma.diaryEntry.findMany({ where: { userId, date: new Date(d) }, orderBy: { slot: 'asc' } });
    const bySlot = {};
    entries.forEach(e => {
      if (!bySlot[e.slot]) bySlot[e.slot] = [];
      bySlot[e.slot].push({
        id: e.id, name: e.name, portion: e.portion,
        calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG,
        fiberG: e.fiberG, satFatG: e.satFatG, sugarG: e.sugarG, sodiumMg: e.sodiumMg, potassiumMg: e.potassiumMg,
        mealTime: e.mealTime,
      });
    });
    const totals = entries.reduce((t, e) => ({
      calories: t.calories + (e.calories || 0),
      proteinG: t.proteinG + (e.proteinG || 0),
      fatG: t.fatG + (e.fatG || 0),
      carbsG: t.carbsG + (e.carbsG || 0),
      fiberG: t.fiberG + (e.fiberG || 0),
      satFatG: t.satFatG + (e.satFatG || 0),
      sugarG: t.sugarG + (e.sugarG || 0),
      sodiumMg: t.sodiumMg + (e.sodiumMg || 0),
      potassiumMg: t.potassiumMg + (e.potassiumMg || 0),
    }), { calories: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, satFatG: 0, sugarG: 0, sodiumMg: 0, potassiumMg: 0 });
    return { content: [{ type: 'text', text: JSON.stringify({ date: d, meals: bySlot, totals }, null, 2) }] };
  });

  server.tool('log_food', 'Log a food item to the diary. Accepts main macros (cal/P/F/C), extended nutrients (fibre/sat fat/sugar/sodium/potassium), and the actual eating time.', {
    slot: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']),
    name: z.string(),
    calories: z.number(),
    proteinG: z.number().optional(),
    fatG: z.number().optional(),
    carbsG: z.number().optional(),
    fiberG: z.number().optional(),
    satFatG: z.number().optional(),
    sugarG: z.number().optional(),
    sodiumMg: z.number().optional(),
    potassiumMg: z.number().optional(),
    portion: z.string().optional(),
    date: z.string().optional().describe('YYYY-MM-DD diary date. Defaults to today.'),
    mealTime: z.string().optional().describe('ISO 8601 timestamp of when food was actually eaten. Defaults to now.'),
  }, async ({ slot, name, calories, proteinG, fatG, carbsG, fiberG, satFatG, sugarG, sodiumMg, potassiumMg, portion, date, mealTime }) => {
    const userId = await getUserId();
    await prisma.diaryEntry.create({
      data: {
        userId,
        date: new Date(date || dateKey()),
        slot, name, portion,
        calories,
        proteinG: proteinG || 0,
        fatG: fatG || 0,
        carbsG: carbsG || 0,
        fiberG: fiberG ?? null,
        satFatG: satFatG ?? null,
        sugarG: sugarG ?? null,
        sodiumMg: sodiumMg ?? null,
        potassiumMg: potassiumMg ?? null,
        mealTime: mealTime ? new Date(mealTime) : new Date(),
      },
    });
    return { content: [{ type: 'text', text: `Logged "${name}" to ${slot}: ${calories} cal, ${proteinG || 0}g P, ${fatG || 0}g F, ${carbsG || 0}g C${fiberG != null ? `, ${fiberG}g fibre` : ''}${satFatG != null ? `, ${satFatG}g sat fat` : ''}${sodiumMg != null ? `, ${sodiumMg}mg Na` : ''}` }] };
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
    for (const e of entries) { await prisma.diaryEntry.create({ data: { userId, date: new Date(toDate), slot, name: e.name, portion: e.portion, calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG, fiberG: e.fiberG, satFatG: e.satFatG, sugarG: e.sugarG, sodiumMg: e.sodiumMg, potassiumMg: e.potassiumMg } }); }
    return { content: [{ type: 'text', text: `Copied ${entries.length} items from ${slot} ${fromDate} to ${toDate}` }] };
  });

  server.tool('get_diary_range', 'Get diary entries across a date range with daily totals. Useful for "this week" or "last 30 days" analyses.', {
    startDate: z.string().describe('YYYY-MM-DD inclusive'),
    endDate: z.string().describe('YYYY-MM-DD inclusive'),
  }, async ({ startDate, endDate }) => {
    const userId = await getUserId();
    const entries = await prisma.diaryEntry.findMany({
      where: { userId, date: { gte: new Date(startDate), lte: new Date(endDate) } },
      orderBy: [{ date: 'asc' }, { slot: 'asc' }],
    });
    const byDate = {};
    for (const e of entries) {
      const k = e.date.toISOString().slice(0, 10);
      if (!byDate[k]) byDate[k] = { entries: [], totals: { calories: 0, proteinG: 0, fatG: 0, carbsG: 0, fiberG: 0, satFatG: 0, sugarG: 0, sodiumMg: 0, potassiumMg: 0 } };
      byDate[k].entries.push({ id: e.id, slot: e.slot, name: e.name, portion: e.portion, calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG, fiberG: e.fiberG, satFatG: e.satFatG, sugarG: e.sugarG, sodiumMg: e.sodiumMg, potassiumMg: e.potassiumMg, mealTime: e.mealTime });
      const t = byDate[k].totals;
      t.calories += e.calories || 0; t.proteinG += e.proteinG || 0; t.fatG += e.fatG || 0; t.carbsG += e.carbsG || 0;
      t.fiberG += e.fiberG || 0; t.satFatG += e.satFatG || 0; t.sugarG += e.sugarG || 0;
      t.sodiumMg += e.sodiumMg || 0; t.potassiumMg += e.potassiumMg || 0;
    }
    return { content: [{ type: 'text', text: JSON.stringify({ startDate, endDate, days: byDate }, null, 2) }] };
  });

  server.tool('search_food', 'Search the food database. Hits the same pipeline the app uses: ~96 curated NZ staples first, then 1,278 NZ Food Composition Database entries, then Open Food Facts, then Claude fallback. Returns full nutrition (cal/P/F/C + fibre/sat fat/sugar/sodium/potassium per 100g/ml) and serving sizes ready to pass into log_food.', {
    query: z.string().describe('Free text — e.g. "chicken breast", "kumara", "tasty cheese"'),
  }, async ({ query }) => {
    const { searchAll } = await import('./routes/foods.js');
    const out = await searchAll(query, prisma);
    return { content: [{ type: 'text', text: JSON.stringify({ source: out.source || out.cached, products: (out.products || []).slice(0, 10) }, null, 2) }] };
  });

  server.tool('get_water', 'Get water intake total + entries for a date.', {
    date: z.string().optional(),
  }, async ({ date }) => {
    const userId = await getUserId();
    const d = date || dateKey();
    const logs = await prisma.waterLog.findMany({ where: { userId, date: new Date(d) }, orderBy: { timestamp: 'asc' } });
    const totalMl = logs.reduce((s, l) => s + l.amountMl, 0);
    return { content: [{ type: 'text', text: JSON.stringify({ date: d, totalMl, entries: logs.map(l => ({ id: l.id, amountMl: l.amountMl, timestamp: l.timestamp })) }, null, 2) }] };
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
    return { content: [{ type: 'text', text: JSON.stringify(supps.map(s => ({ id: s.id, name: s.name, dose: s.activeDose, ingredient: s.activeIngredient, takenToday: loggedIds.has(s.id) })), null, 2) }] };
  });

  // ====== SUPPLEMENTS WRITE ======

  server.tool('create_supplement', 'Add a new supplement to the stack.', {
    name: z.string(), activeDose: z.string(), activeIngredient: z.string().optional(), brand: z.string().optional(),
  }, async ({ name, activeDose, activeIngredient, brand }) => {
    const userId = await getUserId();
    const sup = await prisma.supplement.create({ data: { userId, name, activeDose, activeIngredient, brand, source: 'mcp' } });
    return { content: [{ type: 'text', text: `Created supplement: ${name} (${activeDose})` }] };
  });

  server.tool('update_supplement', 'Update a supplement (name, dose, active status).', {
    id: z.string().describe('Supplement ID'), name: z.string().optional(), activeDose: z.string().optional(),
    activeIngredient: z.string().optional(), isActive: z.boolean().optional(),
  }, async ({ id, ...data }) => {
    const clean = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await prisma.supplement.update({ where: { id }, data: clean });
    return { content: [{ type: 'text', text: `Updated supplement ${id}` }] };
  });

  server.tool('toggle_supplement', 'Mark a supplement as taken/untaken today (defaults to "now"). Use log_supplement for richer fields.', {
    supplementId: z.string().describe('Supplement ID'),
  }, async ({ supplementId }) => {
    const userId = await getUserId();
    const existing = await prisma.supplementLog.findFirst({ where: { userId, supplementId, date: new Date(dateKey()) } });
    if (existing) {
      await prisma.supplementLog.delete({ where: { id: existing.id } });
      return { content: [{ type: 'text', text: 'Marked as not taken today.' }] };
    }
    await prisma.supplementLog.create({ data: { userId, supplementId, date: new Date(dateKey()), takenAt: new Date() } });
    return { content: [{ type: 'text', text: 'Marked as taken today.' }] };
  });

  server.tool('log_supplement', 'Log a supplement on a specific date with full timing context — when it was taken, optional end time for sipped/extended supps (e.g. Sodii drink over 2 hours), with-food flag, and notes.', {
    supplementId: z.string(),
    date: z.string().optional().describe('YYYY-MM-DD diary date. Defaults to today.'),
    takenAt: z.string().optional().describe('ISO 8601 timestamp of when actually taken. Defaults to now.'),
    endTime: z.string().optional().describe('ISO 8601 — for sipped supps. Omit for instant doses.'),
    withFood: z.boolean().optional(),
    notes: z.string().optional(),
  }, async ({ supplementId, date, takenAt, endTime, withFood, notes }) => {
    const userId = await getUserId();
    const dateBucket = date ? new Date(date + 'T00:00:00') : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const log = await prisma.supplementLog.create({
      data: {
        userId, supplementId, date: dateBucket,
        takenAt: takenAt ? new Date(takenAt) : new Date(),
        endTime: endTime ? new Date(endTime) : null,
        withFood: !!withFood,
        notes: notes || null,
      },
    });
    return { content: [{ type: 'text', text: `Logged supplement ${supplementId} at ${log.takenAt.toISOString()}${endTime ? ` until ${log.endTime.toISOString()}` : ''}` }] };
  });

  server.tool('update_supplement_log', 'Edit an existing supplement log (timing, end time, notes, with-food).', {
    id: z.string().describe('SupplementLog id'),
    takenAt: z.string().optional(),
    endTime: z.string().nullable().optional(),
    withFood: z.boolean().optional(),
    notes: z.string().nullable().optional(),
  }, async ({ id, ...data }) => {
    const patch = {};
    if (data.takenAt !== undefined) patch.takenAt = data.takenAt ? new Date(data.takenAt) : null;
    if (data.endTime !== undefined) patch.endTime = data.endTime ? new Date(data.endTime) : null;
    if (data.withFood !== undefined) patch.withFood = !!data.withFood;
    if (data.notes !== undefined) patch.notes = data.notes || null;
    await prisma.supplementLog.update({ where: { id }, data: patch });
    return { content: [{ type: 'text', text: `Updated supplement log ${id}` }] };
  });

  server.tool('get_supp_compliance', 'Compliance percentage and per-supp adherence over the last N days.', {
    days: z.number().optional().describe('Window in days. Default 7.'),
  }, async ({ days }) => {
    const userId = await getUserId();
    const n = days || 7;
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - (n - 1));
    const supps = await prisma.supplement.findMany({ where: { userId, isActive: true } });
    const logs = await prisma.supplementLog.findMany({ where: { userId, date: { gte: start } } });
    const counts = supps.map(s => {
      const taken = logs.filter(l => l.supplementId === s.id).length;
      return { id: s.id, name: s.name, dose: s.activeDose, takenDays: taken, windowDays: n, compliance: r1((taken / n) * 100) };
    });
    const overall = supps.length > 0 ? r1(counts.reduce((s, c) => s + c.compliance, 0) / counts.length) : 0;
    return { content: [{ type: 'text', text: JSON.stringify({ windowDays: n, overallCompliancePct: overall, perSupp: counts }, null, 2) }] };
  });

  // ====== PROFILE & GOALS ======

  server.tool('update_profile', 'Update user profile info.', {
    name: z.string().optional(), heightCm: z.number().optional(), weightKg: z.number().optional(),
    weightGoalKg: z.number().optional(), sex: z.string().optional(), dob: z.string().optional(),
  }, async (data) => {
    const userId = await getUserId();
    const clean = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    if (clean.dob) clean.dob = new Date(clean.dob);
    await prisma.profile.upsert({ where: { userId }, create: { userId, ...clean }, update: clean });
    return { content: [{ type: 'text', text: `Profile updated: ${Object.keys(clean).join(', ')}` }] };
  });

  server.tool('update_goals', 'Update daily nutrition goals (creates a new effective-from-now record). Includes the extended targets (fibre/sat fat/sugar/sodium/potassium).', {
    calories: z.number().optional(),
    proteinG: z.number().optional(),
    fatG: z.number().optional(),
    carbsG: z.number().optional(),
    waterMl: z.number().optional(),
    fiberG: z.number().optional(),
    satFatG: z.number().optional(),
    sugarG: z.number().optional(),
    sodiumMg: z.number().optional(),
    potassiumMg: z.number().optional(),
  }, async (data) => {
    const userId = await getUserId();
    // Carry over current values for any field not being changed.
    const current = await prisma.goals.findFirst({ where: { userId }, orderBy: { effectiveFrom: 'desc' } });
    const base = current
      ? { calories: current.calories, proteinG: current.proteinG, fatG: current.fatG, carbsG: current.carbsG, waterMl: current.waterMl, fiberG: current.fiberG, satFatG: current.satFatG, sugarG: current.sugarG, sodiumMg: current.sodiumMg, potassiumMg: current.potassiumMg }
      : { calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500, fiberG: 30, satFatG: 15, sugarG: 25, sodiumMg: 2300, potassiumMg: 3500 };
    const clean = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
    await prisma.goals.create({ data: { userId, ...base, ...clean, effectiveFrom: new Date() } });
    return { content: [{ type: 'text', text: `Goals updated: ${Object.entries(clean).map(([k, v]) => `${k}=${v}`).join(', ')}` }] };
  });

  // ====== DIARY DELETE ======

  server.tool('delete_diary_entry', 'Delete a food diary entry by ID.', { id: z.string() }, async ({ id }) => {
    await prisma.diaryEntry.delete({ where: { id } });
    return { content: [{ type: 'text', text: `Deleted diary entry ${id}` }] };
  });

  // ====== RECIPES ======

  server.tool('get_recipes', 'Get all recipes with ingredients and nutrition.', {}, async () => {
    const userId = await getUserId();
    const recipes = await prisma.recipe.findMany({ where: { userId }, include: { ingredients: true } });
    return { content: [{ type: 'text', text: JSON.stringify(recipes.map(r => ({
      id: r.id, name: r.name, servings: r.servings,
      ingredients: r.ingredients.map(i => ({ name: i.name, grams: i.grams, calories: i.calories, proteinG: i.proteinG, fatG: i.fatG, carbsG: i.carbsG })),
    })), null, 2) }] };
  });

  server.tool('create_recipe', 'Create a new recipe with ingredients.', {
    name: z.string(), servings: z.number().optional(),
    ingredients: z.array(z.object({ name: z.string(), grams: z.number().optional(), calories: z.number(), proteinG: z.number().optional(), fatG: z.number().optional(), carbsG: z.number().optional() })),
  }, async ({ name, servings, ingredients }) => {
    const userId = await getUserId();
    const recipe = await prisma.recipe.create({
      data: { userId, name, servings: servings || 1, ingredients: { create: ingredients.map(i => ({ ...i, proteinG: i.proteinG || 0, fatG: i.fatG || 0, carbsG: i.carbsG || 0, source: 'mcp' })) } },
    });
    return { content: [{ type: 'text', text: `Created recipe "${name}" with ${ingredients.length} ingredients` }] };
  });

  server.tool('delete_recipe', 'Delete a recipe.', { id: z.string() }, async ({ id }) => {
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
    await prisma.recipe.delete({ where: { id } });
    return { content: [{ type: 'text', text: `Deleted recipe ${id}` }] };
  });

  // ====== SYMPTOMS ======

  server.tool('log_symptom', 'Log a symptom (reflux, bloating, energy_high, energy_low, headache, mood_good, mood_bad, gut_good).', {
    type: z.string().describe('Symptom type'), severity: z.number().optional().describe('1-5, default 3'), notes: z.string().optional(),
  }, async ({ type, severity, notes }) => {
    const userId = await getUserId();
    await prisma.symptomLog.create({ data: { userId, type, severity: severity || 3, notes, timestamp: new Date() } });
    return { content: [{ type: 'text', text: `Logged symptom: ${type} (severity ${severity || 3})` }] };
  });

  server.tool('get_symptoms', 'Get recent symptom logs.', { limit: z.number().optional() }, async ({ limit }) => {
    const userId = await getUserId();
    const symptoms = await prisma.symptomLog.findMany({ where: { userId }, orderBy: { timestamp: 'desc' }, take: limit || 20 });
    return { content: [{ type: 'text', text: JSON.stringify(symptoms.map(s => ({ type: s.type, severity: s.severity, notes: s.notes, date: s.timestamp })), null, 2) }] };
  });

  // ====== BLOODS ======

  server.tool('get_blood_tests', 'Get all blood test results.', {}, async () => {
    const userId = await getUserId();
    const tests = await prisma.bloodTest.findMany({ where: { userId }, orderBy: { date: 'desc' } });
    return { content: [{ type: 'text', text: JSON.stringify(tests.map(t => ({ id: t.id, date: t.date, markers: t.markers, source: t.source })), null, 2) }] };
  });

  server.tool('create_blood_test', 'Log blood test results with biomarkers.', {
    date: z.string().describe('Test date YYYY-MM-DD'),
    markers: z.record(z.number()).describe('Object of marker name to value, e.g. {"testosterone": 25.5, "vitaminD": 89}'),
  }, async ({ date, markers }) => {
    const userId = await getUserId();
    await prisma.bloodTest.create({ data: { userId, date: new Date(date), markers, source: 'mcp' } });
    return { content: [{ type: 'text', text: `Logged blood test (${date}) with ${Object.keys(markers).length} markers` }] };
  });

  server.tool('get_blood_marker_history', 'Get history for a specific blood marker over time.', {
    marker: z.string().describe('Marker name, e.g. "testosterone"'),
  }, async ({ marker }) => {
    const userId = await getUserId();
    const tests = await prisma.bloodTest.findMany({ where: { userId }, orderBy: { date: 'asc' } });
    const history = tests.filter(t => t.markers && t.markers[marker] !== undefined).map(t => ({ date: t.date, value: t.markers[marker] }));
    return { content: [{ type: 'text', text: JSON.stringify({ marker, history }, null, 2) }] };
  });

  // ====== KNOWLEDGE BASE ======

  server.tool('get_knowledge_docs', 'Get all knowledge base documents (coaching context).', {}, async () => {
    const userId = await getUserId();
    const docs = await prisma.knowledgeDoc.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } });
    return { content: [{ type: 'text', text: JSON.stringify(docs.map(d => ({ id: d.id, title: d.title, category: d.category, content: d.content })), null, 2) }] };
  });

  server.tool('save_knowledge_doc', 'Save or update a knowledge base document.', {
    title: z.string(), content: z.string(), category: z.string().optional(),
    id: z.string().optional().describe('Pass ID to update existing doc'),
  }, async ({ title, content, category, id }) => {
    const userId = await getUserId();
    if (id) {
      await prisma.knowledgeDoc.update({ where: { id }, data: { title, content, category } });
      return { content: [{ type: 'text', text: `Updated doc: "${title}"` }] };
    }
    await prisma.knowledgeDoc.create({ data: { userId, title, content, category: category || 'general' } });
    return { content: [{ type: 'text', text: `Created doc: "${title}"` }] };
  });

  // ====== TRAINING EXTRA ======

  server.tool('finish_workout', 'Finish/end the current workout session.', {
    sessionId: z.string().optional().describe('Session ID. If omitted, finishes today\'s active session.'),
    durationMins: z.number().optional().describe('Duration in minutes. Auto-calculated if omitted.'),
  }, async ({ sessionId, durationMins }) => {
    const userId = await getUserId();
    let session = sessionId ? await prisma.workoutSession.findFirst({ where: { id: sessionId, userId } }) : await prisma.workoutSession.findFirst({ where: { userId, date: new Date(dateKey()), durationMins: null }, orderBy: { createdAt: 'desc' } });
    if (!session) return { content: [{ type: 'text', text: 'No active session found.' }] };
    const mins = durationMins || Math.round((Date.now() - new Date(session.createdAt).getTime()) / 60000);
    await prisma.workoutSession.update({ where: { id: session.id }, data: { durationMins: mins } });
    return { content: [{ type: 'text', text: `Finished workout (${mins} min)` }] };
  });

  server.tool('delete_workout', 'Delete a workout session and all its sets.', { sessionId: z.string() }, async ({ sessionId }) => {
    await prisma.workoutSessionSet.deleteMany({ where: { sessionId } });
    await prisma.workoutSession.delete({ where: { id: sessionId } });
    return { content: [{ type: 'text', text: `Deleted workout session` }] };
  });

  return server;
}

/**
 * Stateless Streamable HTTP MCP endpoint for claude.ai custom connectors.
 *
 * Auth: Bearer token. The token is generated in Settings (POST
 * /api/auth/mcp-token) and stored as a SHA-256 hash on the User
 * row. The raw token is supplied via `Authorization: Bearer <token>`
 * by claude.ai's custom connector config.
 *
 * If no token has ever been generated, the endpoint accepts any
 * request and operates against the first user (legacy single-user
 * behaviour) — keeps local Claude Code stdio bridge working until
 * the user opts into auth via Settings.
 */
async function authBearerOrFallback(req, prisma) {
  try {
    const auth = req.headers.authorization || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const hash = crypto.createHash('sha256').update(match[1].trim()).digest('hex');
      const user = await prisma.user.findFirst({ where: { mcpTokenHash: hash } });
      if (user) return user;
    }
    // No bearer or invalid: only require token if any user has set one.
    const anyTokenSet = await prisma.user.findFirst({ where: { mcpTokenHash: { not: null } }, select: { id: true } });
    if (anyTokenSet) return null;
    // Fallback: first user, legacy behaviour for personal-app deploys
    return prisma.user.findFirst();
  } catch (err) {
    // Schema migration mid-deploy, Prisma client out of sync, etc.
    // Be permissive — fall back to first user so the connector still
    // works rather than 5xx-ing claude.ai out.
    console.warn('MCP auth check failed, falling back to first user:', err.message);
    try { return await prisma.user.findFirst(); } catch { return null; }
  }
}

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
    // Fix: ensure Accept includes application/json (stateless mode rejects pure text/event-stream with 406)
    if (req.headers.accept && !req.headers.accept.includes('application/json')) {
      req.headers.accept = 'application/json, ' + req.headers.accept;
    }
    console.log(`MCP ${req.method} from ${req.ip}`, req.method === 'POST' ? JSON.stringify(req.body).substring(0, 200) : '');

    const user = await authBearerOrFallback(req, prisma);
    if (!user) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized — supply Authorization: Bearer <token>. Generate a token in Vitals → Settings → Goals.' },
      });
    }

    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      // Pass the authenticated user id so all tool calls scope to them.
      const server = createMcpServer(prisma, user.id);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      await server.close();
    } catch (err) {
      console.error('MCP error:', err.message);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message } });
    }
  });

  console.log('MCP remote endpoint mounted at /mcp (Bearer auth + single-user fallback)');
}
