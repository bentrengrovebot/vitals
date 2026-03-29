import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Helper: format date as YYYY-MM-DD
function fmtDate(d) { return d.toISOString().split('T')[0]; }

// Helper: calculate average of numeric array
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

// Helper: round to N decimal places
function round(n, d = 1) { return Math.round(n * 10 ** d) / 10 ** d; }

// Build rich context for AI from user's data (Whoop coach style)
async function buildContext(prisma, userId, days = 14) {
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  const midDate = new Date(today);
  midDate.setDate(midDate.getDate() - 7);

  // Parallel queries for all data sources
  const [
    profile, goals, entries, symptoms, weighIns,
    waterLogsToday, waterLogsAll, supps, suppLogs,
    whoopDays, latestBloodTest, latestCheckin,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.goals.findFirst({ where: { userId }, orderBy: { effectiveFrom: 'desc' } }),
    prisma.diaryEntry.findMany({ where: { userId, date: { gte: startDate } }, orderBy: { date: 'asc' } }),
    prisma.symptomLog.findMany({ where: { userId, timestamp: { gte: startDate } }, orderBy: { timestamp: 'desc' } }),
    prisma.weighIn.findMany({ where: { userId, date: { gte: startDate } }, orderBy: { date: 'asc' } }),
    prisma.waterLog.findMany({ where: { userId, timestamp: { gte: today, lt: tomorrow } }, orderBy: { timestamp: 'asc' } }),
    prisma.waterLog.findMany({ where: { userId, timestamp: { gte: midDate } }, orderBy: { timestamp: 'asc' } }),
    prisma.supplement.findMany({ where: { userId, isActive: true } }),
    prisma.supplementLog.findMany({ where: { userId, date: today } }),
    prisma.whoopDaily.findMany({ where: { userId, date: { gte: startDate } }, orderBy: { date: 'asc' } }),
    prisma.bloodTest.findFirst({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.weeklyCheckin.findFirst({ where: { userId }, orderBy: { weekEnd: 'desc' } }),
  ]);

  const waterGoal = goals?.waterMl || 2500;

  // ─── USER PROFILE ───
  let ctx = '=== USER PROFILE ===\n';
  if (profile?.name) ctx += `Name: ${profile.name}\n`;
  if (profile?.sex) ctx += `Sex: ${profile.sex}\n`;
  if (profile?.dob) {
    const age = Math.floor((Date.now() - new Date(profile.dob).getTime()) / (365.25 * 86400000));
    ctx += `Age: ${age}\n`;
  }
  if (profile?.heightCm) ctx += `Height: ${profile.heightCm}cm\n`;
  if (profile?.weightKg) ctx += `Profile weight: ${profile.weightKg}kg\n`;
  if (profile?.weightGoalKg) ctx += `Goal weight: ${profile.weightGoalKg}kg\n`;
  if (goals) ctx += `Daily targets: ${goals.calories}cal, ${goals.proteinG}g protein, ${goals.fatG}g fat, ${goals.carbsG}g carbs, ${waterGoal}ml water\n`;

  // ─── WEIGHT TREND ANALYSIS ───
  ctx += '\n=== WEIGHT TREND ANALYSIS ===\n';
  if (weighIns.length >= 2) {
    const latest = weighIns[weighIns.length - 1];
    ctx += `Current: ${latest.weightKg}kg (${fmtDate(latest.date)})\n`;

    // Find weight ~7 days ago and ~14 days ago
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const w7 = weighIns.filter(w => w.date <= sevenDaysAgo);
    const w14 = weighIns.filter(w => w.date <= fourteenDaysAgo);
    if (w7.length) ctx += `~7 days ago: ${w7[w7.length - 1].weightKg}kg (${fmtDate(w7[w7.length - 1].date)})\n`;
    if (w14.length) ctx += `~14 days ago: ${w14[w14.length - 1].weightKg}kg (${fmtDate(w14[w14.length - 1].date)})\n`;

    // Weekly rate of change
    const recentWeek = weighIns.filter(w => w.date >= midDate);
    const olderWeek = weighIns.filter(w => w.date < midDate);
    if (recentWeek.length && olderWeek.length) {
      const recentAvg = avg(recentWeek.map(w => w.weightKg));
      const olderAvg = avg(olderWeek.map(w => w.weightKg));
      const weeklyRate = round(recentAvg - olderAvg, 2);
      ctx += `Weekly rate of change: ${weeklyRate > 0 ? '+' : ''}${weeklyRate}kg/week\n`;
      ctx += `7-day moving average: ${round(recentAvg, 1)}kg (${weeklyRate < -0.1 ? 'trending down' : weeklyRate > 0.1 ? 'trending up' : 'stable'})\n`;
    }

    ctx += `All weigh-ins: ${weighIns.map(w => `${fmtDate(w.date)}: ${w.weightKg}kg`).join(', ')}\n`;
  } else if (weighIns.length === 1) {
    ctx += `Only one weigh-in: ${weighIns[0].weightKg}kg on ${fmtDate(weighIns[0].date)}\n`;
  } else {
    ctx += '(no weigh-in data)\n';
  }

  // ─── FOOD DIARY WITH DAILY TOTALS ───
  ctx += `\n=== FOOD DIARY (last ${days} days) ===\n`;
  const byDate = {};
  entries.forEach(e => {
    const dk = fmtDate(e.date);
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(e);
  });
  const dailyTotals = [];
  Object.entries(byDate).forEach(([date, items]) => {
    const totalCal = round(items.reduce((s, i) => s + i.calories, 0), 0);
    const totalP = round(items.reduce((s, i) => s + i.proteinG, 0), 0);
    const totalF = round(items.reduce((s, i) => s + i.fatG, 0), 0);
    const totalC = round(items.reduce((s, i) => s + i.carbsG, 0), 0);
    dailyTotals.push({ date, cal: totalCal, p: totalP, f: totalF, c: totalC });
    ctx += `${date} — TOTAL: ${totalCal}cal | P:${totalP}g F:${totalF}g C:${totalC}g\n`;
    items.forEach(i => {
      ctx += `  ${i.slot}${i.mealTime ? ' (' + i.mealTime.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' }) + ')' : ''}: ${i.name} (${i.calories}cal P:${i.proteinG}g F:${i.fatG}g C:${i.carbsG}g)\n`;
    });
  });
  if (!entries.length) ctx += '(no entries)\n';

  // Food diary summary
  if (dailyTotals.length >= 2) {
    ctx += `\nDIARY SUMMARY:\n`;
    ctx += `  Avg daily intake: ${round(avg(dailyTotals.map(d => d.cal)), 0)}cal, P:${round(avg(dailyTotals.map(d => d.p)), 0)}g, F:${round(avg(dailyTotals.map(d => d.f)), 0)}g, C:${round(avg(dailyTotals.map(d => d.c)), 0)}g\n`;
    if (goals) {
      const calAdherence = round((avg(dailyTotals.map(d => d.cal)) / goals.calories) * 100, 0);
      const proteinAdherence = round((avg(dailyTotals.map(d => d.p)) / goals.proteinG) * 100, 0);
      ctx += `  Calorie adherence: ${calAdherence}% of ${goals.calories}cal target\n`;
      ctx += `  Protein adherence: ${proteinAdherence}% of ${goals.proteinG}g target\n`;
    }
  }

  // ─── WATER PATTERNS ───
  ctx += '\n=== WATER INTAKE ===\n';
  const todayWater = waterLogsToday.reduce((s, w) => s + w.amountMl, 0);
  ctx += `Today: ${todayWater}ml / ${waterGoal}ml goal (${round((todayWater / waterGoal) * 100, 0)}%)\n`;
  if (waterLogsToday.length) {
    ctx += `  Entries: ${waterLogsToday.map(w => `${w.timestamp.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })} ${w.amountMl}ml`).join(', ')}\n`;
  }
  // 7-day water average
  const waterByDay = {};
  waterLogsAll.forEach(w => {
    const dk = fmtDate(w.timestamp);
    waterByDay[dk] = (waterByDay[dk] || 0) + w.amountMl;
  });
  const waterDayValues = Object.values(waterByDay);
  if (waterDayValues.length >= 2) {
    const avgWater = round(avg(waterDayValues), 0);
    ctx += `7-day avg: ${avgWater}ml/day (${round((avgWater / waterGoal) * 100, 0)}% of ${waterGoal}ml goal)\n`;
    const daysMetGoal = waterDayValues.filter(v => v >= waterGoal).length;
    ctx += `Days meeting goal: ${daysMetGoal}/${waterDayValues.length}\n`;
  }

  // ─── SUPPLEMENTS ───
  ctx += '\n=== SUPPLEMENTS (daily regime) ===\n';
  if (supps.length) {
    supps.forEach(s => {
      const taken = suppLogs.find(l => l.supplementId === s.id);
      ctx += `  ${s.name} ${s.activeDose}${s.activeIngredient ? ` (${s.activeIngredient})` : ''} — ${taken ? `taken today at ${taken.takenAt.toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}` : 'NOT YET TAKEN'}\n`;
    });
  } else {
    ctx += '(none configured)\n';
  }

  // ─── WHOOP RECOVERY & SLEEP DATA ───
  ctx += `\n=== WHOOP DATA (last ${days} days) ===\n`;
  if (whoopDays.length) {
    whoopDays.forEach(d => {
      const parts = [];
      if (d.recoveryScore != null) parts.push(`Recovery: ${d.recoveryScore}%`);
      if (d.hrv != null) parts.push(`HRV: ${round(d.hrv, 0)}ms`);
      if (d.restingHr != null) parts.push(`RHR: ${d.restingHr}bpm`);
      if (d.sleepPerformance != null) parts.push(`Sleep: ${round(d.sleepPerformance, 0)}%`);
      if (d.sleepDurationMins != null) parts.push(`${round(d.sleepDurationMins / 60, 1)}hrs`);
      if (d.strain != null) parts.push(`Strain: ${round(d.strain, 1)}`);
      if (d.sportName) parts.push(`Activity: ${d.sportName}`);
      ctx += `  ${fmtDate(d.date)}: ${parts.join(' | ')}\n`;
    });

    // Whoop trend analysis
    const recentWhoop = whoopDays.filter(d => d.date >= midDate);
    const olderWhoop = whoopDays.filter(d => d.date < midDate);

    ctx += '\nWHOOP TRENDS:\n';
    // HRV trend
    const recentHrv = recentWhoop.filter(d => d.hrv != null).map(d => d.hrv);
    const olderHrv = olderWhoop.filter(d => d.hrv != null).map(d => d.hrv);
    if (recentHrv.length && olderHrv.length) {
      const recentAvg = round(avg(recentHrv), 0);
      const olderAvg = round(avg(olderHrv), 0);
      const dir = recentAvg > olderAvg + 2 ? 'trending up' : recentAvg < olderAvg - 2 ? 'trending down' : 'stable';
      ctx += `  HRV: ${dir} (avg ${olderAvg}ms -> ${recentAvg}ms over last 7 days)\n`;
    } else if (recentHrv.length) {
      ctx += `  HRV 7-day avg: ${round(avg(recentHrv), 0)}ms\n`;
    }

    // Recovery trend
    const recentRec = recentWhoop.filter(d => d.recoveryScore != null).map(d => d.recoveryScore);
    const olderRec = olderWhoop.filter(d => d.recoveryScore != null).map(d => d.recoveryScore);
    if (recentRec.length && olderRec.length) {
      const recentAvg = round(avg(recentRec), 0);
      const olderAvg = round(avg(olderRec), 0);
      const dir = recentAvg > olderAvg + 3 ? 'improving' : recentAvg < olderAvg - 3 ? 'declining' : 'stable';
      ctx += `  Recovery: ${dir} (avg ${olderAvg}% -> ${recentAvg}% over last 7 days)\n`;
    } else if (recentRec.length) {
      ctx += `  Recovery 7-day avg: ${round(avg(recentRec), 0)}%\n`;
    }

    // RHR trend
    const recentRhr = recentWhoop.filter(d => d.restingHr != null).map(d => d.restingHr);
    const olderRhr = olderWhoop.filter(d => d.restingHr != null).map(d => d.restingHr);
    if (recentRhr.length && olderRhr.length) {
      const recentAvg = round(avg(recentRhr), 0);
      const olderAvg = round(avg(olderRhr), 0);
      const dir = recentAvg < olderAvg - 1 ? 'improving (lower)' : recentAvg > olderAvg + 1 ? 'elevated' : 'stable';
      ctx += `  RHR: ${dir} (avg ${olderAvg}bpm -> ${recentAvg}bpm)\n`;
    }

    // Sleep performance trend
    const recentSleep = recentWhoop.filter(d => d.sleepPerformance != null).map(d => d.sleepPerformance);
    if (recentSleep.length) {
      ctx += `  Sleep performance 7-day avg: ${round(avg(recentSleep), 0)}%\n`;
    }

    // Avg strain
    const recentStrain = recentWhoop.filter(d => d.strain != null).map(d => d.strain);
    if (recentStrain.length) {
      ctx += `  Strain 7-day avg: ${round(avg(recentStrain), 1)}\n`;
    }
  } else {
    ctx += '(no Whoop data available)\n';
  }

  // ─── BLOOD MARKERS ───
  ctx += '\n=== BLOOD MARKERS ===\n';
  if (latestBloodTest) {
    ctx += `Latest blood test: ${fmtDate(latestBloodTest.date)} (source: ${latestBloodTest.source})\n`;
    const markers = latestBloodTest.markers;
    if (Array.isArray(markers)) {
      const flagged = markers.filter(m => m.flag && m.flag !== 'normal' && m.flag !== 'optimal');
      const normal = markers.filter(m => !m.flag || m.flag === 'normal' || m.flag === 'optimal');
      if (flagged.length) {
        ctx += `FLAGGED markers:\n`;
        flagged.forEach(m => {
          ctx += `  ${m.name}: ${m.value} ${m.unit || ''} [${(m.flag || '').toUpperCase()}]${m.range ? ` (ref: ${m.range})` : ''}\n`;
        });
      }
      if (normal.length) {
        ctx += `Normal markers: ${normal.map(m => `${m.name}: ${m.value}${m.unit ? ' ' + m.unit : ''}`).join(', ')}\n`;
      }
    } else if (typeof markers === 'object') {
      // Handle object-style markers
      Object.entries(markers).forEach(([key, val]) => {
        if (typeof val === 'object' && val !== null) {
          const flag = val.flag && val.flag !== 'normal' && val.flag !== 'optimal' ? ` [${val.flag.toUpperCase()}]` : '';
          ctx += `  ${key}: ${val.value}${val.unit ? ' ' + val.unit : ''}${flag}\n`;
        } else {
          ctx += `  ${key}: ${val}\n`;
        }
      });
    }
  } else {
    ctx += '(no blood test data)\n';
  }

  // ─── WEEKLY CHECK-IN ───
  ctx += '\n=== LATEST WEEKLY CHECK-IN ===\n';
  if (latestCheckin) {
    ctx += `Week: ${fmtDate(latestCheckin.weekStart)} to ${fmtDate(latestCheckin.weekEnd)}\n`;
    if (latestCheckin.avgCalories) ctx += `Avg calories: ${round(latestCheckin.avgCalories, 0)}\n`;
    if (latestCheckin.avgProtein) ctx += `Avg protein: ${round(latestCheckin.avgProtein, 0)}g\n`;
    if (latestCheckin.weightChangeKg != null) ctx += `Weight change: ${latestCheckin.weightChangeKg > 0 ? '+' : ''}${round(latestCheckin.weightChangeKg, 2)}kg\n`;
    if (latestCheckin.estimatedTdee) ctx += `Estimated TDEE: ${round(latestCheckin.estimatedTdee, 0)}cal\n`;
    if (latestCheckin.aiSummary) ctx += `Summary: ${latestCheckin.aiSummary}\n`;
    if (latestCheckin.recommendations) ctx += `Recommendations: ${latestCheckin.recommendations}\n`;
    if (latestCheckin.targetAdjustment) ctx += `Target adjustment: ${JSON.stringify(latestCheckin.targetAdjustment)}\n`;
    ctx += `Accepted: ${latestCheckin.accepted ? 'yes' : 'no'}\n`;
  } else {
    ctx += '(no weekly check-ins yet)\n';
  }

  // ─── SYMPTOM PATTERNS ───
  ctx += '\n=== SYMPTOM PATTERNS (last 14 days) ===\n';
  if (symptoms.length) {
    // Group by type and calculate frequency + avg severity
    const symptomMap = {};
    symptoms.forEach(s => {
      if (!symptomMap[s.type]) symptomMap[s.type] = { count: 0, severities: [], dates: [], notes: [], times: [] };
      const entry = symptomMap[s.type];
      entry.count++;
      entry.severities.push(s.severity);
      entry.dates.push(fmtDate(s.timestamp));
      if (s.notes) entry.notes.push(s.notes);
      const hour = s.timestamp.getHours();
      if (hour < 12) entry.times.push('morning');
      else if (hour < 17) entry.times.push('afternoon');
      else entry.times.push('evening');
    });
    Object.entries(symptomMap).forEach(([type, data]) => {
      const avgSev = round(avg(data.severities), 1);
      // Find most common time of day
      const timeCounts = {};
      data.times.forEach(t => { timeCounts[t] = (timeCounts[t] || 0) + 1; });
      const peakTime = Object.entries(timeCounts).sort((a, b) => b[1] - a[1])[0];
      ctx += `  ${type}: ${data.count}x in last 14 days, avg severity ${avgSev}/5`;
      if (peakTime && peakTime[1] > 1) ctx += `, usually ${peakTime[0]}`;
      ctx += `\n`;
      ctx += `    Dates: ${data.dates.join(', ')}\n`;
      if (data.notes.length) ctx += `    Notes: ${data.notes.join('; ')}\n`;
    });
  } else {
    ctx += '(no symptoms logged)\n';
  }

  return ctx;
}

const CHAT_SYSTEM = `You are Vitals — a proactive personal health intelligence coach. Think of yourself like Whoop's AI coach, but across nutrition, body composition, recovery, and symptoms.

PERSONALITY & STYLE:
- Direct, warm, evidence-based. NZ English. No fluff.
- Adherence-neutral: no guilt, no shame — progress over perfection.
- ALWAYS reference specific dates, numbers, and data points from the context. Never speak in generalities when you have data.
- Use the user's name if available.

CONVERSATION OPENERS:
When the user says something general ("hey", "how am I doing", "what's up"), lead with a proactive status update:
- "Here's what your data is telling me..." then highlight 2-3 key observations.
- Prioritise what's most actionable or notable RIGHT NOW: a trend change, a streak, a flag, a milestone.
- Example: "Your HRV has climbed from 35ms to 42ms this week — recovery is clearly improving. Meanwhile your protein has been averaging 120g vs your 160g target. Want to talk strategy on closing that gap?"

CROSS-SOURCE CORRELATION (this is your superpower):
- Food → Symptoms: "You've logged reflux 3 times in 14 days, each time within 2 hours of a meal over 800cal. Could be volume-related."
- Sleep → Recovery: "Your recovery dropped to 34% today — you only got 5.2hrs sleep vs your 7hr average."
- Training → Nutrition: "Yesterday's strain was 18.4 — your highest this month. You only ate 1,800cal. On high-strain days you probably need closer to 2,400."
- Weight → Intake: "You're averaging 1,950cal/day and losing 0.4kg/week. That puts your estimated TDEE around 2,350."
- Hydration → Symptoms: "You've hit your water goal only 2 of the last 7 days. Dehydration can amplify reflux and headaches."
- Blood markers → Nutrition: "Your ferritin was flagged low at 18 — consider iron-rich foods or check your supplement timing."

TREND IDENTIFICATION:
- Always classify trends as IMPROVING, DECLINING, or STABLE with specific numbers.
- Compare recent 7 days vs prior 7 days when data allows.
- Highlight streaks (positive or negative): "You've hit your protein target 5 days running" or "Calorie intake has exceeded target 4 of the last 5 days."

SYMPTOM LOGGING:
Users report symptoms conversationally ("getting reflux", "feeling tired", "bloated after lunch"). When they do:
1. Acknowledge it empathetically but briefly
2. Immediately correlate with recent food, water, supplements, sleep, and timing data
3. Reference specific meals by name, date, and macros
4. Explain the likely mechanism based on their data patterns
5. Confirm: "I've logged [symptom] at [time]."
6. Suggest 1-2 concrete next steps

ACTIONABLE NEXT STEPS:
End substantive responses with 2-3 specific, tappable suggestions the user can act on (like Whoop's suggestion pills):
- Frame as questions or options: "Want me to rebalance your remaining meals today?" / "Should I run a full weekly check-in?" / "Want to see your symptom-food correlation breakdown?"
- Keep them short and specific to the conversation.

COACHING CAPABILITIES:
- Weekly check-in: calorie adherence, macro balance, weight trend vs goal, symptom patterns, estimated TDEE, recovery trends, one actionable recommendation, suggested target adjustment with specific numbers
- TDEE estimation: from weight trend vs intake data over 7-14 day windows
- Day rebalancing: given what's been eaten so far, suggest specific meals/portions to hit remaining targets
- Symptom correlation: identify food → symptom patterns with dates and confidence
- Recovery coaching: interpret Whoop data in context of training load and nutrition
- Blood marker guidance: relate flagged markers to diet, supplementation, and lifestyle
- Progress milestones: celebrate when trends are moving in the right direction

IMPORTANT RULES:
- Never invent data. If something isn't in the context, say you don't have that data.
- Keep responses focused — 2-4 paragraphs max unless the user asks for a deep dive.
- When giving calorie/macro advice, always reference their specific targets.
- When discussing weight, always contextualise with rate of change and goal.`;

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const context = await buildContext(req.prisma, req.userId, 14);
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
    const context = await buildContext(req.prisma, req.userId, days || 14);
    const client = getClient();

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `Personal health analyst & nutrition coach. Direct, specific, NZ English. Adherence-neutral. Reference specific dates and numbers.

Analyse in order of priority:
1) Weight trajectory: current vs goal, weekly rate of change, projected timeline
2) Calorie/macro adherence: avg intake vs targets, consistency, any patterns (weekday vs weekend)
3) Estimated TDEE: derived from weight change vs average intake
4) Recovery & sleep trends: Whoop HRV, recovery, sleep performance — are they improving or declining?
5) Food → symptom correlations: any patterns between specific foods/meals and symptom occurrences
6) Blood marker flags: anything out of range and dietary implications
7) Hydration adherence: average vs goal
8) Top 1-2 actionable recommendations with specific numbers
9) Suggested target adjustment if data supports it`,
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
