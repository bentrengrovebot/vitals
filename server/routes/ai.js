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
    prisma.whoopDaily.findMany({ where: { userId, date: { gte: new Date(today.getTime() - 30 * 86400000) } }, orderBy: { date: 'asc' } }),
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

FILE & IMAGE CAPABILITIES:
- Users can attach images and documents to their messages. You CAN see and analyze them.
- Photo of a meal → estimate nutrition and offer to log it using the log_food tool
- Photo of a nutrition label → read the macros and offer to create a recipe or log the food
- Photo of a supplement label → extract name, dosage, ingredients and offer to add it
- Blood test PDF/photo → extract markers and offer to log them
- Meal plan document → read it and use build_meal_plan or create_recipe tools to set it all up
- When you receive an image, ALWAYS describe what you see and take action with your tools

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

// AI Tool definitions for Claude tool use
const TOOLS = [
  {
    name: "log_food",
    description: "Log a food item to the user's diary. Use when the user describes what they ate, e.g. 'I had eggs on toast for breakfast'. Estimate the nutrition using NZ food data.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD format. Default to today." },
        slot: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snacks"], description: "Meal slot" },
        name: { type: "string", description: "Food name" },
        portion: { type: "string", description: "Portion description e.g. '2 eggs on 1 slice toast'" },
        calories: { type: "number" },
        proteinG: { type: "number" },
        fatG: { type: "number" },
        carbsG: { type: "number" },
      },
      required: ["date", "slot", "name", "calories", "proteinG", "fatG", "carbsG"]
    }
  },
  {
    name: "create_recipe",
    description: "Create a new recipe with ingredients. Use when user says 'build me a recipe for...' or 'create a meal with...'",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        servings: { type: "number", description: "Number of servings. Default 1." },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              grams: { type: "number" },
              calories: { type: "number" },
              proteinG: { type: "number" },
              fatG: { type: "number" },
              carbsG: { type: "number" },
            },
            required: ["name", "grams", "calories", "proteinG", "fatG", "carbsG"]
          }
        }
      },
      required: ["name", "servings", "ingredients"]
    }
  },
  {
    name: "log_weight",
    description: "Record a weight measurement. Use when user says 'I weighed 98.5 today' or 'log my weight'.",
    input_schema: {
      type: "object",
      properties: {
        weightKg: { type: "number" },
      },
      required: ["weightKg"]
    }
  },
  {
    name: "log_water",
    description: "Log water intake. Use when user says 'log 500ml water' or 'I drank a glass of water'.",
    input_schema: {
      type: "object",
      properties: {
        amountMl: { type: "number", description: "Amount in millilitres" },
      },
      required: ["amountMl"]
    }
  },
  {
    name: "log_symptom",
    description: "Record a symptom. Use when user reports feeling unwell, e.g. 'getting reflux', 'tired', 'bloated'.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["reflux", "bloating", "energy_high", "energy_low", "mood_good", "mood_bad", "headache", "gut_good"] },
        severity: { type: "number", description: "1-5 scale" },
        notes: { type: "string" },
      },
      required: ["type", "severity"]
    }
  },
  {
    name: "update_goals",
    description: "Update the user's daily nutrition targets. Use when user says 'set my calories to 2100' or 'increase protein target'.",
    input_schema: {
      type: "object",
      properties: {
        calories: { type: "number" },
        proteinG: { type: "number" },
        fatG: { type: "number" },
        carbsG: { type: "number" },
        waterMl: { type: "number" },
      },
      required: []
    }
  },
  {
    name: "toggle_supplement",
    description: "Mark a supplement as taken or not taken today. Use when user says 'I took my iron' or 'mark creatine as done'.",
    input_schema: {
      type: "object",
      properties: {
        supplementName: { type: "string", description: "Name of the supplement to toggle" },
      },
      required: ["supplementName"]
    }
  },
  {
    name: "build_meal_plan",
    description: "Create a full day's meal plan and log all meals to the diary. Use when user says 'build me a meal plan for today' or 'plan my meals'. Creates diary entries for each meal.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "YYYY-MM-DD" },
        targetCalories: { type: "number" },
        targetProteinG: { type: "number" },
        meals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              slot: { type: "string", enum: ["Breakfast", "Lunch", "Dinner", "Snacks"] },
              name: { type: "string" },
              portion: { type: "string" },
              calories: { type: "number" },
              proteinG: { type: "number" },
              fatG: { type: "number" },
              carbsG: { type: "number" },
            },
            required: ["slot", "name", "calories", "proteinG", "fatG", "carbsG"]
          }
        }
      },
      required: ["date", "meals"]
    }
  },
  {
    name: "save_memory",
    description: "Save important information about the user for future reference. Use when user shares preferences, conditions, history, or anything the AI should remember long-term. Examples: 'I'm lactose intolerant', 'I train at 6am', 'I get reflux from spicy food', 'I'm training for a half marathon'.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Category: 'preferences', 'conditions', 'training', 'history', 'notes'" },
        value: { type: "string", description: "The information to remember" },
      },
      required: ["key", "value"]
    }
  },
  {
    name: "search_food",
    description: "Look up nutrition information for a food item. Use when the user asks 'how many calories in...' or you need nutrition data to log food.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Food name to search" },
        grams: { type: "number", description: "Amount in grams. Default 100." },
      },
      required: ["query"]
    }
  },
];

// Execute a tool call against the database
async function executeTool(toolName, toolInput, prisma, userId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (toolName) {
    case 'log_food': {
      const entry = await prisma.diaryEntry.create({
        data: {
          userId,
          date: new Date(toolInput.date),
          slot: toolInput.slot,
          name: toolInput.name,
          portion: toolInput.portion || null,
          calories: toolInput.calories,
          proteinG: toolInput.proteinG,
          fatG: toolInput.fatG,
          carbsG: toolInput.carbsG,
          mealTime: new Date(),
        },
      });
      return { success: true, message: `Logged ${toolInput.name} to ${toolInput.slot}` };
    }
    case 'create_recipe': {
      const recipe = await prisma.recipe.create({
        data: {
          userId,
          name: toolInput.name,
          servings: toolInput.servings || 1,
          ingredients: {
            create: toolInput.ingredients.map(i => ({
              name: i.name, grams: i.grams, calories: i.calories,
              proteinG: i.proteinG, fatG: i.fatG, carbsG: i.carbsG,
              source: 'ai_estimated',
            })),
          },
        },
        include: { ingredients: true },
      });
      return { success: true, message: `Created recipe "${toolInput.name}" with ${toolInput.ingredients.length} ingredients` };
    }
    case 'log_weight': {
      const weighIn = await prisma.weighIn.create({
        data: { userId, date: today, weightKg: toolInput.weightKg },
      });
      await prisma.profile.updateMany({
        where: { userId },
        data: { weightKg: toolInput.weightKg },
      });
      return { success: true, message: `Logged weight: ${toolInput.weightKg}kg` };
    }
    case 'log_water': {
      await prisma.waterLog.create({
        data: { userId, amountMl: toolInput.amountMl },
      });
      return { success: true, message: `Logged ${toolInput.amountMl}ml water` };
    }
    case 'log_symptom': {
      await prisma.symptomLog.create({
        data: { userId, type: toolInput.type, severity: toolInput.severity, notes: toolInput.notes || null },
      });
      return { success: true, message: `Logged ${toolInput.type} (severity ${toolInput.severity}/5)` };
    }
    case 'update_goals': {
      const current = await prisma.goals.findFirst({ where: { userId }, orderBy: { effectiveFrom: 'desc' } });
      const newGoals = {
        calories: toolInput.calories || current?.calories || 2300,
        proteinG: toolInput.proteinG || current?.proteinG || 150,
        fatG: toolInput.fatG || current?.fatG || 80,
        carbsG: toolInput.carbsG || current?.carbsG || 250,
        waterMl: toolInput.waterMl || current?.waterMl || 2500,
      };
      await prisma.goals.create({ data: { userId, ...newGoals } });
      return { success: true, message: `Updated goals: ${newGoals.calories}cal, ${newGoals.proteinG}g P, ${newGoals.fatG}g F, ${newGoals.carbsG}g C` };
    }
    case 'toggle_supplement': {
      const sup = await prisma.supplement.findFirst({
        where: { userId, isActive: true, name: { contains: toolInput.supplementName, mode: 'insensitive' } },
      });
      if (!sup) return { success: false, message: `Supplement "${toolInput.supplementName}" not found` };
      const existing = await prisma.supplementLog.findFirst({
        where: { userId, supplementId: sup.id, date: today },
      });
      if (existing) {
        await prisma.supplementLog.delete({ where: { id: existing.id } });
        return { success: true, message: `Unmarked ${sup.name} as taken` };
      } else {
        await prisma.supplementLog.create({
          data: { userId, supplementId: sup.id, date: today, takenAt: new Date() },
        });
        return { success: true, message: `Marked ${sup.name} as taken` };
      }
    }
    case 'build_meal_plan': {
      for (const meal of toolInput.meals) {
        await prisma.diaryEntry.create({
          data: {
            userId,
            date: new Date(toolInput.date),
            slot: meal.slot,
            name: meal.name,
            portion: meal.portion || null,
            calories: meal.calories,
            proteinG: meal.proteinG,
            fatG: meal.fatG,
            carbsG: meal.carbsG,
            mealTime: new Date(),
          },
        });
      }
      const totalCal = toolInput.meals.reduce((s, m) => s + m.calories, 0);
      return { success: true, message: `Built meal plan: ${toolInput.meals.length} meals, ${Math.round(totalCal)} cal total` };
    }
    case 'save_memory': {
      const existing = await prisma.userContext.findUnique({ where: { userId } });
      const context = existing?.context || {};
      if (!context[toolInput.key]) context[toolInput.key] = [];
      context[toolInput.key].push({ value: toolInput.value, savedAt: new Date().toISOString() });
      await prisma.userContext.upsert({
        where: { userId },
        create: { userId, context },
        update: { context },
      });
      return { success: true, message: `Remembered: ${toolInput.value}` };
    }
    case 'search_food': {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const grams = toolInput.grams || 100;
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: 'Nutrition database. Given food+grams, respond ONLY JSON: {"cal":number,"protein":number,"fat":number,"carbs":number}. Use NZ food data. Round to 1dp.',
        messages: [{ role: 'user', content: `"${toolInput.query}", ${grams}g` }],
      });
      const text = (response.content[0]?.text || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);
      return { success: true, message: `${toolInput.query} (${grams}g): ${parsed.cal}cal, ${parsed.protein}g P, ${parsed.fat}g F, ${parsed.carbs}g C`, data: parsed };
    }
    default:
      return { success: false, message: `Unknown tool: ${toolName}` };
  }
}

// POST /api/ai/chat
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    const context = await buildContext(req.prisma, req.userId, 14);
    const client = getClient();

    // Load persistent memory
    const userCtx = await req.prisma.userContext.findUnique({ where: { userId: req.userId } });
    let memoryCtx = '';
    if (userCtx?.context) {
      memoryCtx = '\n=== PERSISTENT MEMORY (things the user has told you to remember) ===\n';
      Object.entries(userCtx.context).forEach(([key, items]) => {
        memoryCtx += `${key}:\n`;
        items.forEach(item => { memoryCtx += `  - ${item.value}\n`; });
      });
    }

    // Load knowledge base documents
    let knowledgeCtx = '';
    try {
      const docs = await req.prisma.knowledgeDoc.findMany({ where: { userId: req.userId }, orderBy: { updatedAt: 'desc' }, take: 10 });
      if (docs.length) {
        knowledgeCtx = '\n=== KNOWLEDGE BASE (user-provided reference documents) ===\n';
        docs.forEach(doc => {
          knowledgeCtx += `\n--- ${doc.title} (${doc.category}) ---\n${doc.content}\n`;
        });
        knowledgeCtx += '=== END KNOWLEDGE BASE ===\n';
      }
    } catch {}

    let apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const actions = [];

    // Tool use loop - keep calling until no more tool use
    let finalText = '';
    for (let i = 0; i < 5; i++) { // max 5 tool rounds
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `${CHAT_SYSTEM}\n\n${context}\n${memoryCtx}\n${knowledgeCtx}`,
        messages: apiMessages,
        tools: TOOLS,
      });

      // Collect text blocks and tool use blocks
      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');

      if (textBlocks.length) {
        finalText += textBlocks.map(b => b.text).join('\n');
      }

      if (toolBlocks.length === 0) break; // No tools to execute - done

      // Execute tools and collect results
      const toolResults = [];
      for (const tool of toolBlocks) {
        const result = await executeTool(tool.name, tool.input, req.prisma, req.userId);
        actions.push({ tool: tool.name, input: tool.input, result });
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result),
        });
      }

      // Add assistant response + tool results to messages for next round
      apiMessages = [
        ...apiMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
    }

    res.json({ response: finalText, actions });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: 'AI request failed', details: err.message });
  }
});

// POST /api/ai/estimate-targets — Calculate personalized nutrition targets
router.post('/estimate-targets', authMiddleware, async (req, res) => {
  try {
    const { goal, sex, weight, height, age, bodyFat, targetWeight } = req.body;
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You are a nutrition calculator. Given user stats and goal, calculate daily calorie and macro targets. Use Mifflin-St Jeor for BMR, apply activity multiplier (1.55 moderate), then adjust for goal. Respond ONLY with JSON: {"calories":number,"protein":number,"fat":number,"carbs":number,"tdee":number,"explanation":"brief 1-line reasoning"}',
      messages: [{ role: 'user', content: `Goal: ${goal}, Sex: ${sex}, Weight: ${weight}kg, Height: ${height}cm, Age: ${age}, Body fat: ${bodyFat || 'unknown'}${targetWeight ? `, Target weight: ${targetWeight}kg` : ''}` }],
    });
    const text = (response.content[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('Estimate targets error:', err);
    // Fallback calculation
    const w = parseFloat(req.body.weight) || 100;
    const h = parseFloat(req.body.height) || 176;
    const a = parseInt(req.body.age) || 30;
    const bmr = req.body.sex === 'Male' ? 10 * w + 6.25 * h - 5 * a + 5 : 10 * w + 6.25 * h - 5 * a - 161;
    const tdee = Math.round(bmr * 1.55);
    const cal = req.body.goal === 'fat_loss' ? tdee - 500 : req.body.goal === 'muscle_gain' ? tdee + 300 : tdee;
    res.json({ calories: Math.round(cal), protein: Math.round(w * 1.6), fat: Math.round(cal * 0.25 / 9), carbs: Math.round((cal - w * 1.6 * 4 - cal * 0.25) / 4), tdee });
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
