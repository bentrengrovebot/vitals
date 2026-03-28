import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Assemble a full week of data for a user
async function assembleWeekData(prisma, userId, weekEnd) {
  const end = new Date(weekEnd);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const profile = await prisma.profile.findUnique({ where: { userId } });
  const goals = await prisma.goals.findFirst({
    where: { userId },
    orderBy: { effectiveFrom: 'desc' },
  });

  const entries = await prisma.diaryEntry.findMany({
    where: { userId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  const symptoms = await prisma.symptomLog.findMany({
    where: { userId, timestamp: { gte: start, lte: end } },
    orderBy: { timestamp: 'asc' },
  });

  const weighIns = await prisma.weighIn.findMany({
    where: { userId, date: { gte: start, lte: end } },
    orderBy: { date: 'asc' },
  });

  const waterLogs = await prisma.waterLog.findMany({
    where: { userId, timestamp: { gte: start, lte: end } },
    orderBy: { timestamp: 'asc' },
  });

  const supplements = await prisma.supplement.findMany({ where: { userId, isActive: true } });
  const supplementLogs = await prisma.supplementLog.findMany({
    where: { userId, date: { gte: start, lte: end } },
  });

  // Build context string
  let ctx = 'USER PROFILE:\n';
  if (profile?.name) ctx += `Name: ${profile.name}\n`;
  if (profile?.sex) ctx += `Sex: ${profile.sex}\n`;
  if (profile?.dob) {
    const age = Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 86400000));
    ctx += `Age: ${age}\n`;
  }
  if (profile?.heightCm) ctx += `Height: ${profile.heightCm}cm\n`;
  if (profile?.weightKg) ctx += `Current weight: ${profile.weightKg}kg\n`;
  if (profile?.weightGoalKg) ctx += `Goal weight: ${profile.weightGoalKg}kg\n`;

  if (goals) {
    ctx += `\nCURRENT TARGETS:\n`;
    ctx += `  Calories: ${goals.calories}cal\n`;
    ctx += `  Protein: ${goals.proteinG}g\n`;
    ctx += `  Fat: ${goals.fatG}g\n`;
    ctx += `  Carbs: ${goals.carbsG}g\n`;
    ctx += `  Water: ${goals.waterMl}ml\n`;
  }

  // Group diary entries by date
  const byDate = {};
  entries.forEach(e => {
    const dk = e.date.toISOString().split('T')[0];
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(e);
  });

  ctx += `\nFOOD DIARY (${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}):\n`;
  Object.entries(byDate).forEach(([date, items]) => {
    const dayCal = items.reduce((s, i) => s + i.calories, 0);
    const dayPro = items.reduce((s, i) => s + i.proteinG, 0);
    const dayFat = items.reduce((s, i) => s + i.fatG, 0);
    const dayCarb = items.reduce((s, i) => s + i.carbsG, 0);
    ctx += `${date} (total: ${Math.round(dayCal)}cal P:${Math.round(dayPro)}g F:${Math.round(dayFat)}g C:${Math.round(dayCarb)}g):\n`;
    items.forEach(i => {
      ctx += `  ${i.slot}: ${i.name}${i.portion ? ' (' + i.portion + ')' : ''} — ${i.calories}cal P:${i.proteinG}g F:${i.fatG}g C:${i.carbsG}g\n`;
    });
  });
  if (!entries.length) ctx += '(no food logged)\n';

  ctx += `\nWEIGH-INS:\n`;
  if (weighIns.length) {
    weighIns.forEach(w => {
      ctx += `  ${w.date.toISOString().split('T')[0]}: ${w.weightKg}kg${w.trendKg ? ' (trend: ' + w.trendKg + 'kg)' : ''}\n`;
    });
  } else {
    ctx += '(none)\n';
  }

  ctx += `\nSYMPTOMS:\n`;
  if (symptoms.length) {
    symptoms.forEach(s => {
      ctx += `  ${s.timestamp.toISOString().split('T')[0]}: ${s.type} (${s.severity}/5)${s.notes ? ' — ' + s.notes : ''}\n`;
    });
  } else {
    ctx += '(none)\n';
  }

  // Water by date
  const waterByDate = {};
  waterLogs.forEach(w => {
    const dk = w.timestamp.toISOString().split('T')[0];
    if (!waterByDate[dk]) waterByDate[dk] = 0;
    waterByDate[dk] += w.amountMl;
  });
  ctx += `\nWATER:\n`;
  if (Object.keys(waterByDate).length) {
    Object.entries(waterByDate).forEach(([date, ml]) => {
      ctx += `  ${date}: ${ml}ml\n`;
    });
  } else {
    ctx += '(none)\n';
  }

  // Supplements
  ctx += `\nSUPPLEMENTS (daily regime):\n`;
  supplements.forEach(s => {
    const logs = supplementLogs.filter(l => l.supplementId === s.id);
    ctx += `  ${s.name} ${s.activeDose}${s.activeIngredient ? ' (' + s.activeIngredient + ')' : ''} — taken ${logs.length} of 7 days\n`;
  });

  // Compute stats
  const daysWithFood = Object.keys(byDate).length;
  const totalCal = entries.reduce((s, e) => s + e.calories, 0);
  const totalPro = entries.reduce((s, e) => s + e.proteinG, 0);
  const avgCalories = daysWithFood > 0 ? totalCal / daysWithFood : null;
  const avgProtein = daysWithFood > 0 ? totalPro / daysWithFood : null;

  let weightChangeKg = null;
  if (weighIns.length >= 2) {
    weightChangeKg = weighIns[weighIns.length - 1].weightKg - weighIns[0].weightKg;
  }

  return { ctx, start, end, avgCalories, avgProtein, weightChangeKg, goals };
}

const WEEKLY_SYSTEM = `You are Vitals — a deep-analysis health intelligence engine doing a weekly check-in review.
Be thorough, specific, and data-driven. NZ English. Adherence-neutral (no guilt, no shame — progress over perfection).

Analyse the full week of data and respond with EXACTLY this JSON structure (no markdown, no code fences, just raw JSON):
{
  "calorieAdherence": "Brief assessment of calorie adherence vs targets",
  "macroBalance": "Assessment of protein/fat/carbs balance",
  "estimatedTdee": 2400,
  "symptomPatterns": "Any food→symptom correlations or patterns noticed",
  "weightTrajectory": "Assessment of weight trend and what it means",
  "summary": "2-3 paragraph comprehensive weekly summary covering all aspects",
  "recommendation": "One specific, actionable recommendation for next week",
  "targetAdjustment": {
    "calories": 2100,
    "proteinG": 160,
    "reason": "Based on your TDEE estimate of 2400 and your goal of losing 0.5kg/week, a 300cal deficit targets ~2100cal. Protein increased to preserve lean mass."
  }
}

IMPORTANT:
- estimatedTdee must be a number (your best estimate from weight change vs intake data, or null if insufficient data)
- targetAdjustment should suggest new daily targets if warranted. Set to null if current targets are appropriate.
- targetAdjustment.calories and targetAdjustment.proteinG must be numbers
- Be specific — reference actual meals, actual weights, actual dates
- If data is insufficient for TDEE estimation, set estimatedTdee to null and explain in the summary`;

// Run weekly check-in for a specific user
export async function runWeeklyCheckin(prisma, userId) {
  const now = new Date();
  // Week ends yesterday (or today if run on Monday for last week)
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() - 1);

  const { ctx, start, end, avgCalories, avgProtein, weightChangeKg, goals } =
    await assembleWeekData(prisma, userId, weekEnd);

  const client = getClient();

  const response = await client.messages.create({
    model: 'claude-opus-4-20250514',
    max_tokens: 2000,
    system: WEEKLY_SYSTEM,
    messages: [{ role: 'user', content: ctx }],
  });

  const text = (response.content[0]?.text || '').trim();

  // Parse AI response
  let parsed;
  try {
    // Strip any accidental code fences
    const cleaned = text.replace(/^```json\s*|```\s*$/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // If parsing fails, store the raw response
    parsed = {
      summary: text,
      calorieAdherence: null,
      macroBalance: null,
      estimatedTdee: null,
      symptomPatterns: null,
      weightTrajectory: null,
      recommendation: null,
      targetAdjustment: null,
    };
  }

  const checkin = await prisma.weeklyCheckin.create({
    data: {
      userId,
      weekStart: start,
      weekEnd: end,
      avgCalories: avgCalories ? Math.round(avgCalories * 10) / 10 : null,
      avgProtein: avgProtein ? Math.round(avgProtein * 10) / 10 : null,
      weightChangeKg: weightChangeKg ? Math.round(weightChangeKg * 100) / 100 : null,
      estimatedTdee: parsed.estimatedTdee ? Number(parsed.estimatedTdee) : null,
      aiSummary: JSON.stringify({
        calorieAdherence: parsed.calorieAdherence,
        macroBalance: parsed.macroBalance,
        symptomPatterns: parsed.symptomPatterns,
        weightTrajectory: parsed.weightTrajectory,
        summary: parsed.summary,
      }),
      recommendations: parsed.recommendation || null,
      targetAdjustment: parsed.targetAdjustment || undefined,
      accepted: false,
    },
  });

  return checkin;
}

// POST /api/weekly/run — Manually trigger weekly check-in
router.post('/run', async (req, res) => {
  try {
    const checkin = await runWeeklyCheckin(req.prisma, req.userId);
    res.json(checkin);
  } catch (err) {
    console.error('Weekly check-in error:', err);
    res.status(500).json({ error: 'Weekly check-in failed' });
  }
});

// GET /api/weekly/latest — Get latest weekly check-in
router.get('/latest', async (req, res) => {
  try {
    const checkin = await req.prisma.weeklyCheckin.findFirst({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!checkin) return res.json(null);
    res.json(checkin);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/weekly/history — Get all weekly check-ins
router.get('/history', async (req, res) => {
  try {
    const checkins = await req.prisma.weeklyCheckin.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(checkins);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/weekly/:id/accept — Accept suggested target adjustment
router.post('/:id/accept', async (req, res) => {
  try {
    const checkin = await req.prisma.weeklyCheckin.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });

    if (!checkin) return res.status(404).json({ error: 'Check-in not found' });
    if (!checkin.targetAdjustment) return res.status(400).json({ error: 'No target adjustment to accept' });
    if (checkin.accepted) return res.status(400).json({ error: 'Already accepted' });

    const adj = checkin.targetAdjustment;

    // Get current goals to merge with adjustment
    const currentGoals = await req.prisma.goals.findFirst({
      where: { userId: req.userId },
      orderBy: { effectiveFrom: 'desc' },
    });

    // Create new goals record with adjusted values
    await req.prisma.goals.create({
      data: {
        userId: req.userId,
        calories: adj.calories || currentGoals?.calories || 2300,
        proteinG: adj.proteinG || currentGoals?.proteinG || 150,
        fatG: currentGoals?.fatG || 80,
        carbsG: currentGoals?.carbsG || 250,
        waterMl: currentGoals?.waterMl || 2500,
        effectiveFrom: new Date(),
      },
    });

    // Mark check-in as accepted
    const updated = await req.prisma.weeklyCheckin.update({
      where: { id: checkin.id },
      data: { accepted: true },
    });

    res.json(updated);
  } catch (err) {
    console.error('Accept target error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
