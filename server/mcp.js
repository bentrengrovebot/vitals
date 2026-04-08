import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const r1 = n => Math.round(n * 10) / 10;

/**
 * Register all 14 MCP tools on the given McpServer instance.
 * Uses the prisma client passed in (shared with the rest of the Express app).
 */
function registerTools(server, prisma) {
  // Helper: get the first user (single-user app)
  async function getUserId() {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error('No user found. Sign up in the app first.');
    return user.id;
  }

  // ====== NUTRITION TOOLS ======

  server.tool(
    'get_diary',
    'Get food diary entries for a specific date. Returns all meals (Breakfast, Lunch, Dinner, Snacks) with calories and macros.',
    { date: z.string().optional().describe('Date in YYYY-MM-DD format. Defaults to today.') },
    async ({ date }) => {
      const userId = await getUserId();
      const d = date || dateKey();
      const entries = await prisma.diaryEntry.findMany({
        where: { userId, date: new Date(d) },
        orderBy: { slot: 'asc' },
      });
      const bySlot = {};
      entries.forEach(e => {
        if (!bySlot[e.slot]) bySlot[e.slot] = [];
        bySlot[e.slot].push({ name: e.name, portion: e.portion, calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG });
      });
      const totals = entries.reduce((t, e) => ({
        calories: t.calories + (e.calories || 0),
        proteinG: t.proteinG + (e.proteinG || 0),
        fatG: t.fatG + (e.fatG || 0),
        carbsG: t.carbsG + (e.carbsG || 0),
      }), { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 });
      return { content: [{ type: 'text', text: JSON.stringify({ date: d, meals: bySlot, totals: { calories: r1(totals.calories), proteinG: r1(totals.proteinG), fatG: r1(totals.fatG), carbsG: r1(totals.carbsG) } }, null, 2) }] };
    }
  );

  server.tool(
    'log_food',
    'Log a food item to the diary. Provide the meal slot, food name, and nutritional info.',
    {
      slot: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']).describe('Meal slot'),
      name: z.string().describe('Food name, e.g. "Chicken breast 200g"'),
      calories: z.number().describe('Total calories'),
      proteinG: z.number().optional().describe('Protein in grams'),
      fatG: z.number().optional().describe('Fat in grams'),
      carbsG: z.number().optional().describe('Carbs in grams'),
      portion: z.string().optional().describe('Portion description, e.g. "200g"'),
      date: z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
    },
    async ({ slot, name, calories, proteinG, fatG, carbsG, portion, date }) => {
      const userId = await getUserId();
      const entry = await prisma.diaryEntry.create({
        data: { userId, date: new Date(date || dateKey()), slot, name, portion, calories, proteinG: proteinG || 0, fatG: fatG || 0, carbsG: carbsG || 0 },
      });
      return { content: [{ type: 'text', text: `Logged "${name}" to ${slot}: ${calories} cal, ${proteinG || 0}g P, ${fatG || 0}g F, ${carbsG || 0}g C` }] };
    }
  );

  server.tool(
    'get_goals',
    'Get the user\'s daily nutrition goals (calories, protein, fat, carbs, water).',
    {},
    async () => {
      const userId = await getUserId();
      const goals = await prisma.goals.findFirst({ where: { userId }, orderBy: { effectiveFrom: 'desc' } });
      const profile = await prisma.profile.findUnique({ where: { userId } });
      return { content: [{ type: 'text', text: JSON.stringify({ goals, profile: profile ? { name: profile.name, weightKg: profile.weightKg, weightGoalKg: profile.weightGoalKg, heightCm: profile.heightCm } : null }, null, 2) }] };
    }
  );

  server.tool(
    'log_water',
    'Log water intake in millilitres.',
    {
      amountMl: z.number().describe('Water amount in ml, e.g. 500'),
      date: z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
    },
    async ({ amountMl, date }) => {
      const userId = await getUserId();
      await prisma.waterLog.create({
        data: { userId, date: new Date(date || dateKey()), amountMl, timestamp: new Date() },
      });
      const logs = await prisma.waterLog.findMany({ where: { userId, date: new Date(date || dateKey()) } });
      const total = logs.reduce((s, l) => s + l.amountMl, 0);
      return { content: [{ type: 'text', text: `Logged ${amountMl}ml water. Today's total: ${total}ml` }] };
    }
  );

  server.tool(
    'copy_meal',
    'Copy all entries from a meal slot on one date to another date. Useful for repeating meals.',
    {
      fromDate: z.string().describe('Source date YYYY-MM-DD'),
      toDate: z.string().describe('Target date YYYY-MM-DD'),
      slot: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snacks']).describe('Meal slot to copy'),
    },
    async ({ fromDate, toDate, slot }) => {
      const userId = await getUserId();
      const entries = await prisma.diaryEntry.findMany({
        where: { userId, date: new Date(fromDate), slot },
      });
      if (entries.length === 0) return { content: [{ type: 'text', text: `No entries found for ${slot} on ${fromDate}` }] };
      for (const e of entries) {
        await prisma.diaryEntry.create({
          data: { userId, date: new Date(toDate), slot, name: e.name, portion: e.portion, calories: e.calories, proteinG: e.proteinG, fatG: e.fatG, carbsG: e.carbsG, recipeId: e.recipeId },
        });
      }
      return { content: [{ type: 'text', text: `Copied ${entries.length} items from ${slot} on ${fromDate} to ${toDate}` }] };
    }
  );

  // ====== TRAINING TOOLS ======

  server.tool(
    'get_training_sessions',
    'Get recent workout sessions with sets. Returns up to 10 most recent.',
    { date: z.string().optional().describe('Optional: filter by date YYYY-MM-DD') },
    async ({ date }) => {
      const userId = await getUserId();
      const where = { userId };
      if (date) where.date = new Date(date);
      const sessions = await prisma.workoutSession.findMany({
        where, include: { sets: true }, orderBy: { date: 'desc' }, take: 10,
      });
      const exIds = [...new Set(sessions.flatMap(s => s.sets.map(set => set.exerciseId)))];
      const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
      const exMap = Object.fromEntries(exercises.map(e => [e.id, e.name]));
      const result = sessions.map(s => ({
        id: s.id, name: s.name, date: s.date, durationMins: s.durationMins,
        exercises: Object.entries(
          s.sets.reduce((g, set) => {
            const name = exMap[set.exerciseId] || set.exerciseId;
            if (!g[name]) g[name] = [];
            if (set.reps) g[name].push({ weightKg: set.weightKg, reps: set.reps, rir: set.rir });
            return g;
          }, {})
        ).map(([name, sets]) => ({ name, sets })),
      }));
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'start_workout',
    'Start a new workout session. Optionally start from a plan day.',
    {
      name: z.string().optional().describe('Workout name, e.g. "Push Day". Defaults to "Workout".'),
      planDayId: z.string().optional().describe('Plan day ID to pre-load exercises from'),
      date: z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
    },
    async ({ name, planDayId, date }) => {
      const userId = await getUserId();
      const d = date || dateKey();

      if (planDayId) {
        const day = await prisma.workoutDay.findUnique({
          where: { id: planDayId },
          include: { exercises: { orderBy: { orderIndex: 'asc' } } },
        });
        if (!day) return { content: [{ type: 'text', text: 'Plan day not found' }] };
        const session = await prisma.workoutSession.create({
          data: { userId, date: new Date(d), planDayId, name: name || day.name },
        });
        for (const ex of day.exercises) {
          for (let s = 0; s < ex.targetSets; s++) {
            await prisma.workoutSessionSet.create({
              data: { sessionId: session.id, exerciseId: ex.exerciseId, setIndex: s, completed: false },
            });
          }
        }
        return { content: [{ type: 'text', text: `Started "${day.name}" with ${day.exercises.length} exercises pre-loaded. Session ID: ${session.id}` }] };
      }

      const session = await prisma.workoutSession.create({
        data: { userId, date: new Date(d), name: name || 'Workout' },
      });
      return { content: [{ type: 'text', text: `Started workout "${session.name}". Session ID: ${session.id}` }] };
    }
  );

  server.tool(
    'log_set',
    'Log a set for an exercise in the current or specified workout session. Can reference exercise by name.',
    {
      sessionId: z.string().optional().describe('Session ID. If omitted, uses today\'s active session.'),
      exerciseName: z.string().describe('Exercise name, e.g. "Bench Press"'),
      weightKg: z.number().describe('Weight in kg'),
      reps: z.number().describe('Number of reps'),
      rir: z.number().optional().describe('Reps in reserve (0-5)'),
    },
    async ({ sessionId, exerciseName, weightKg, reps, rir }) => {
      const userId = await getUserId();

      let session;
      if (sessionId) {
        session = await prisma.workoutSession.findFirst({ where: { id: sessionId, userId } });
      } else {
        session = await prisma.workoutSession.findFirst({
          where: { userId, date: new Date(dateKey()), durationMins: null },
          orderBy: { createdAt: 'desc' },
        });
      }
      if (!session) {
        session = await prisma.workoutSession.create({
          data: { userId, date: new Date(dateKey()), name: 'Workout' },
        });
      }

      let exercise = await prisma.exercise.findFirst({
        where: { name: { equals: exerciseName, mode: 'insensitive' }, OR: [{ userId: null }, { userId }] },
      });
      if (!exercise) {
        exercise = await prisma.exercise.create({
          data: { name: exerciseName, muscleGroup: 'other', equipment: 'other' },
        });
      }

      const lastSet = await prisma.workoutSessionSet.findFirst({
        where: { sessionId: session.id, exerciseId: exercise.id },
        orderBy: { setIndex: 'desc' },
      });
      const setIndex = lastSet ? lastSet.setIndex + 1 : 1;

      await prisma.workoutSessionSet.create({
        data: { sessionId: session.id, exerciseId: exercise.id, setIndex, weightKg, reps, rir, completed: true },
      });

      return { content: [{ type: 'text', text: `Logged: ${exerciseName} — ${weightKg}kg × ${reps}${rir != null ? ` @${rir} RIR` : ''} (set ${setIndex})` }] };
    }
  );

  server.tool(
    'log_workout',
    'Log a complete workout with multiple exercises and sets in one go. Useful for "I did bench 4x8 at 80kg and squats 3x10 at 100kg".',
    {
      name: z.string().optional().describe('Workout name'),
      date: z.string().optional().describe('Date YYYY-MM-DD. Defaults to today.'),
      exercises: z.array(z.object({
        name: z.string().describe('Exercise name'),
        sets: z.array(z.object({
          weightKg: z.number().describe('Weight in kg'),
          reps: z.number().describe('Reps'),
          rir: z.number().optional().describe('RIR'),
        })),
      })).describe('Array of exercises with their sets'),
    },
    async ({ name, date, exercises }) => {
      const userId = await getUserId();
      const d = date || dateKey();

      const session = await prisma.workoutSession.create({
        data: { userId, date: new Date(d), name: name || 'Workout' },
      });

      const logged = [];
      for (const ex of exercises) {
        let exercise = await prisma.exercise.findFirst({
          where: { name: { equals: ex.name, mode: 'insensitive' }, OR: [{ userId: null }, { userId }] },
        });
        if (!exercise) {
          exercise = await prisma.exercise.create({ data: { name: ex.name, muscleGroup: 'other', equipment: 'other' } });
        }
        for (let i = 0; i < ex.sets.length; i++) {
          const s = ex.sets[i];
          await prisma.workoutSessionSet.create({
            data: { sessionId: session.id, exerciseId: exercise.id, setIndex: i + 1, weightKg: s.weightKg, reps: s.reps, rir: s.rir, completed: true },
          });
        }
        logged.push(`${ex.name}: ${ex.sets.map(s => `${s.weightKg}kg×${s.reps}`).join(', ')}`);
      }

      await prisma.workoutSession.update({ where: { id: session.id }, data: { durationMins: 45 } });

      return { content: [{ type: 'text', text: `Logged workout "${session.name}":\n${logged.join('\n')}` }] };
    }
  );

  server.tool(
    'get_training_volume',
    'Get weekly training volume — total sets per muscle group over the last N days.',
    { days: z.number().optional().describe('Number of days to look back. Default 7.') },
    async ({ days }) => {
      const userId = await getUserId();
      const n = days || 7;
      const since = new Date();
      since.setDate(since.getDate() - n);

      const sets = await prisma.workoutSessionSet.findMany({
        where: { session: { userId, date: { gte: since } }, completed: true, isWarmup: false },
      });
      const exIds = [...new Set(sets.map(s => s.exerciseId))];
      const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
      const exMap = Object.fromEntries(exercises.map(e => [e.id, e]));

      const volume = {};
      sets.forEach(s => {
        const ex = exMap[s.exerciseId];
        const group = ex?.muscleGroup || 'other';
        volume[group] = (volume[group] || 0) + 1;
      });
      const total = Object.values(volume).reduce((s, v) => s + v, 0);

      return { content: [{ type: 'text', text: JSON.stringify({ period: `${n} days`, totalSets: total, byMuscle: volume }, null, 2) }] };
    }
  );

  server.tool(
    'get_workout_plan',
    'Get the user\'s current workout plan with all days and exercises.',
    {},
    async () => {
      const userId = await getUserId();
      const plans = await prisma.workoutPlan.findMany({
        where: { userId, isActive: true },
        include: { days: { orderBy: { dayIndex: 'asc' }, include: { exercises: { orderBy: { orderIndex: 'asc' } } } } },
      });
      if (plans.length === 0) return { content: [{ type: 'text', text: 'No active workout plan found.' }] };

      const plan = plans[0];
      const exIds = plan.days.flatMap(d => d.exercises.map(e => e.exerciseId));
      const exercises = await prisma.exercise.findMany({ where: { id: { in: exIds } } });
      const exMap = Object.fromEntries(exercises.map(e => [e.id, e.name]));

      const result = {
        name: plan.name, description: plan.description,
        days: plan.days.map(d => ({
          id: d.id, name: d.name, dayIndex: d.dayIndex,
          exercises: d.exercises.map(e => ({
            name: exMap[e.exerciseId] || e.exerciseId,
            targetSets: e.targetSets, targetReps: e.targetReps, targetRir: e.targetRir,
          })),
        })),
      };
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'search_exercises',
    'Search the exercise library by name or muscle group.',
    {
      query: z.string().optional().describe('Search term for exercise name'),
      muscleGroup: z.string().optional().describe('Filter by muscle group: chest, back, shoulders, quads, hamstrings, glutes, biceps, triceps, abs, calves, cardio'),
    },
    async ({ query, muscleGroup }) => {
      const userId = await getUserId();
      const where = { OR: [{ userId: null }, { userId }] };
      if (query) where.name = { contains: query, mode: 'insensitive' };
      if (muscleGroup) where.muscleGroup = muscleGroup;
      const exercises = await prisma.exercise.findMany({ where, orderBy: { name: 'asc' }, take: 20 });
      return { content: [{ type: 'text', text: JSON.stringify(exercises.map(e => ({ id: e.id, name: e.name, muscleGroup: e.muscleGroup, equipment: e.equipment, isCompound: e.isCompound })), null, 2) }] };
    }
  );

  // ====== BODY TOOLS ======

  server.tool(
    'log_weight',
    'Log a body weight measurement.',
    { weightKg: z.number().describe('Weight in kg') },
    async ({ weightKg }) => {
      const userId = await getUserId();
      await prisma.weighIn.create({ data: { userId, date: new Date(dateKey()), weightKg } });
      return { content: [{ type: 'text', text: `Logged weight: ${weightKg}kg` }] };
    }
  );

  server.tool(
    'get_weight_history',
    'Get recent body weight measurements.',
    { limit: z.number().optional().describe('Number of entries. Default 14.') },
    async ({ limit }) => {
      const userId = await getUserId();
      const entries = await prisma.weighIn.findMany({
        where: { userId }, orderBy: { date: 'desc' }, take: limit || 14,
      });
      return { content: [{ type: 'text', text: JSON.stringify(entries.map(e => ({ date: e.date, weightKg: e.weightKg })), null, 2) }] };
    }
  );

  server.tool(
    'get_supplements',
    'Get the user\'s supplement list and today\'s log status.',
    {},
    async () => {
      const userId = await getUserId();
      const supps = await prisma.supplement.findMany({ where: { userId, isActive: true } });
      const logs = await prisma.supplementLog.findMany({ where: { userId, date: new Date(dateKey()) } });
      const loggedIds = new Set(logs.map(l => l.supplementId));
      return {
        content: [{ type: 'text', text: JSON.stringify(supps.map(s => ({
          name: s.name, dose: s.activeDose, ingredient: s.activeIngredient, takenToday: loggedIds.has(s.id),
        })), null, 2) }],
      };
    }
  );
}

/**
 * Set up the remote MCP endpoint on the given Express app.
 *
 * Mounts a Streamable HTTP transport at /mcp that supports:
 *   - POST /mcp  (JSON-RPC messages from client)
 *   - GET  /mcp  (SSE stream for server-to-client messages)
 *   - DELETE /mcp (session termination)
 *
 * Protected by a bearer token from the MCP_TOKEN env var.
 */
export function setupMCP(app, prisma) {
  const MCP_TOKEN = process.env.MCP_TOKEN;

  // Auth middleware for MCP routes
  function mcpAuth(req, res, next) {
    if (!MCP_TOKEN) {
      // If no token configured, reject all requests for safety
      console.warn('MCP_TOKEN not set — remote MCP endpoint is disabled');
      return res.status(503).json({ error: 'MCP endpoint not configured' });
    }
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${MCP_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  }

  // Track transports by session ID for stateful mode
  const transports = new Map();

  // Create a new McpServer + transport per session
  function createSessionServer() {
    const mcpServer = new McpServer({
      name: 'vitals',
      version: '1.0.0',
    });
    registerTools(mcpServer, prisma);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    mcpServer.connect(transport);
    return transport;
  }

  // Handle POST /mcp — JSON-RPC requests from client
  app.post('/mcp', mcpAuth, async (req, res) => {
    try {
      // Check if this is an initialization request (no session ID yet)
      const sessionId = req.headers['mcp-session-id'];

      let transport;
      if (sessionId && transports.has(sessionId)) {
        // Existing session
        transport = transports.get(sessionId);
      } else if (!sessionId) {
        // New session — check if this is an initialize request
        transport = createSessionServer();
        // The transport will generate a session ID after handling the init request
        // We need to handle the request first, then store by session ID
      } else {
        // Invalid session ID
        return res.status(404).json({ error: 'Session not found' });
      }

      await transport.handleRequest(req, res, req.body);

      // After handling, if this was a new transport, store it by its session ID
      if (!sessionId && transport.sessionId) {
        transports.set(transport.sessionId, transport);
      }
    } catch (err) {
      console.error('MCP POST error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Handle GET /mcp — SSE stream for server-to-client messages
  app.get('/mcp', mcpAuth, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId || !transports.has(sessionId)) {
        return res.status(400).json({ error: 'Invalid or missing session ID' });
      }
      const transport = transports.get(sessionId);
      await transport.handleRequest(req, res);
    } catch (err) {
      console.error('MCP GET error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Handle DELETE /mcp — session termination
  app.delete('/mcp', mcpAuth, async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'];
      if (!sessionId || !transports.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const transport = transports.get(sessionId);
      await transport.close();
      transports.delete(sessionId);
      res.status(200).json({ ok: true });
    } catch (err) {
      console.error('MCP DELETE error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  console.log('MCP remote endpoint mounted at /mcp');
}
