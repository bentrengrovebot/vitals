import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Build context for AI from user's data
async function buildContext(prisma, userId, days = 7) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const goals = await prisma.goals.findFirst({
    where: { userId },
    orderBy: { effectiveFrom: 'desc' },
  });

  // Food diary
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const entries = await prisma.diaryEntry.findMany({
    where: { userId, date: { gte: startDate } },
    orderBy: { date: 'asc' },
  });

  // Symptoms
  const symptoms = await prisma.symptomLog.findMany({
    where: { userId },
    orderBy: { timestamp: 'desc' },
    take: 20,
  });

  // Weigh-ins
  const weighIns = await prisma.weighIn.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 14,
  });

  // Today's water
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const waterLogs = await prisma.waterLog.findMany({
    where: { userId, timestamp: { gte: today, lt: tomorrow } },
    orderBy: { timestamp: 'asc' },
  });
  const waterGoal = goals?.waterMl || 2500;
  const totalWater = waterLogs.reduce((s, w) => s + w.amountMl, 0);

  // Supplements
  const supps = await prisma.supplement.findMany({ where: { userId, isActive: true } });
  const suppLogs = await prisma.supplementLog.findMany({
    where: { userId, date: today },
  });

  let ctx = 'USER PROFILE:\n';
  if (profile?.name) ctx += `Name: ${profile.name}\n`;
  if (profile?.sex) ctx += `Sex: ${profile.sex}\n`;
  if (profile?.dob) {
    const age = Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 86400000));
    ctx += `Age: ${age}\n`;
  }
  if (profile?.heightCm) ctx += `Height: ${profile.heightCm}cm\n`;
  if (profile?.weightKg) ctx += `Weight: ${profile.weightKg}kg\n`;
  if (profile?.weightGoalKg) ctx += `Goal weight: ${profile.weightGoalKg}kg\n`;
  if (weighIns.length) ctx += `Recent weigh-ins: ${weighIns.slice(0, 10).map(w => `${w.date.toISOString().split('T')[0]}: ${w.weightKg}kg`).join(', ')}\n`;
  if (goals) ctx += `Goals: ${goals.calories}cal, ${goals.proteinG}g P, ${goals.fatG}g F, ${goals.carbsG}g C\n`;

  ctx += `\nFOOD DIARY (last ${days} days):\n`;
  const byDate = {};
  entries.forEach(e => {
    const dk = e.date.toISOString().split('T')[0];
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(e);
  });
  Object.entries(byDate).forEach(([date, items]) => {
    ctx += `${date}:\n`;
    items.forEach(i => {
      ctx += `  ${i.slot}: ${i.name} (${i.calories}cal P:${i.proteinG}g F:${i.fatG}g C:${i.carbsG}g)\n`;
    });
  });
  if (!entries.length) ctx += '(none)\n';

  ctx += `\nWATER (today):\n`;
  ctx += `  Total: ${totalWater}ml / ${waterGoal}ml goal\n`;
  if (waterLogs.length) {
    ctx += `  Entries: ${waterLogs.map(w => `${w.timestamp.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })} ${w.amountMl}ml`).join(', ')}\n`;
  }

  ctx += `\nSUPPLEMENTS (daily regime):\n`;
  supps.forEach(s => {
    const taken = suppLogs.find(l => l.supplementId === s.id);
    ctx += `  ${s.name} ${s.activeDose}${s.activeIngredient ? ` (${s.activeIngredient})` : ''} — ${taken ? `taken today at ${taken.takenAt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}` : 'NOT YET TAKEN'}\n`;
  });

  ctx += `\nSYMPTOMS (recent):\n`;
  if (symptoms.length) {
    symptoms.forEach(s => {
      ctx += `  ${s.timestamp.toISOString().split('T')[0]}: ${s.type} (${s.severity}/5)${s.notes ? ' — ' + s.notes : ''}\n`;
    });
  } else {
    ctx += '(none)\n';
  }

  return ctx;
}

const CHAT_SYSTEM = `You are Vitals — a personal health coach and intelligence assistant.
Be concise, direct, specific. Reference actual data. NZ English. Adherence-neutral (no guilt, no shame — progress over perfection).

SYMPTOM LOGGING: Users report symptoms conversationally ("getting reflux", "feeling tired", "bloated after lunch"). When they do:
1. Acknowledge it
2. Immediately correlate with recent food, water, supplement, and timing data
3. Reference specific meals, timestamps, and patterns
4. Tell them WHY it might be happening based on their data
5. Confirm: "I've logged [symptom] at [time]."

COACHING CAPABILITIES:
- Weekly check-in: calorie adherence, macro balance, weight trend, symptom patterns, estimated TDEE, one actionable recommendation, suggested target adjustment
- TDEE estimation: from weight trend vs intake data
- Day rebalancing: suggest how to adjust remaining meals
- Symptom correlation: identify food → symptom patterns
- Always reference actual meals, dates, numbers from the data`;

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const context = await buildContext(req.prisma, req.userId, 7);
    const client = getClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `${CHAT_SYSTEM}\n\n${context}`,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    const text = response.content.map(c => c.text || '').join('\n');

    // Check if AI detected a symptom to log
    const symptomTypes = ['reflux', 'bloating', 'energy_high', 'energy_low', 'mood_good', 'mood_bad', 'headache', 'gut_good'];
    const lastUserMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const detectedSymptom = symptomTypes.find(t => {
      const keywords = {
        reflux: ['reflux', 'heartburn', 'acid'],
        bloating: ['bloat', 'bloated', 'bloating'],
        energy_high: ['energy high', 'energetic', 'great energy'],
        energy_low: ['tired', 'fatigue', 'low energy', 'exhausted', 'sluggish'],
        mood_good: ['mood good', 'happy', 'great mood', 'feeling good'],
        mood_bad: ['mood bad', 'irritable', 'angry', 'frustrated', 'anxious'],
        headache: ['headache', 'head hurts', 'migraine'],
        gut_good: ['gut good', 'digestion good', 'stomach good'],
      };
      return keywords[t]?.some(k => lastUserMsg.includes(k));
    });

    if (detectedSymptom) {
      await req.prisma.symptomLog.create({
        data: { userId: req.userId, type: detectedSymptom, severity: 3 },
      });
    }

    res.json({ response: text, symptomLogged: detectedSymptom || null });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/insight
router.post('/insight', async (req, res) => {
  try {
    const { days } = req.body;
    const context = await buildContext(req.prisma, req.userId, days || 7);
    const client = getClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Personal health analyst & nutrition coach. Direct, specific, NZ English. Adherence-neutral.

Analyse: 1) Calorie/macro adherence 2) Estimated TDEE from weight trend 3) Food→symptom correlations 4) Meal timing 5) Weight trajectory 6) One actionable recommendation 7) Target adjustment suggestion`,
      messages: [{ role: 'user', content: context }],
    });

    const text = response.content.map(c => c.text || '').join('\n');

    const insight = await req.prisma.aiInsight.create({
      data: { userId: req.userId, daysAnalysed: days || 7, response: text },
    });

    res.json(insight);
  } catch (err) {
    console.error('AI insight error:', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/estimate
router.post('/estimate', async (req, res) => {
  try {
    const { name, grams } = req.body;
    const client = getClient();

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'Nutrition database. Given food+grams, respond ONLY JSON: {"cal":number,"protein":number,"fat":number,"carbs":number}. Use NZ food data where applicable (Anchor, Wattie\'s, Farrah\'s, Pams are NZ brands). Round to 1 decimal place.',
      messages: [{ role: 'user', content: `"${name}", ${grams}g` }],
    });

    const text = (response.content[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('AI estimate error:', err);
    res.status(500).json({ error: 'Estimation failed' });
  }
});

// GET /api/ai/insights
router.get('/insights', async (req, res) => {
  try {
    const insights = await req.prisma.aiInsight.findMany({
      where: { userId: req.userId },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
