import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();

function verifyCronSecret(req) {
  const secret = req.headers['x-cron-secret'] || req.body?.secret;
  return process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

// POST /api/cron/weekly — Run weekly check-ins for all users
router.post('/weekly', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Invalid cron secret' });

  try {
    const prisma = req.prisma || new PrismaClient();
    const users = await prisma.user.findMany({ select: { id: true } });
    const results = [];
    for (const user of users) {
      try {
        const { runWeeklyCheckin } = await import('./weekly.js');
        const checkin = await runWeeklyCheckin(prisma, user.id);
        results.push({ userId: user.id, status: 'ok', checkinId: checkin.id });
      } catch (err) {
        results.push({ userId: user.id, status: 'error', error: err.message });
      }
    }
    res.json({ processed: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Cron job failed' });
  }
});

// POST /api/cron/whoop-sync — Auto-sync Whoop data for all connected users
router.post('/whoop-sync', async (req, res) => {
  if (!verifyCronSecret(req)) return res.status(401).json({ error: 'Invalid cron secret' });

  try {
    const prisma = req.prisma || new PrismaClient();
    const tokens = await prisma.whoopToken.findMany();
    const results = [];

    for (const token of tokens) {
      try {
        // Dynamic import to avoid circular deps
        const whoopModule = await import('./whoop.js');
        const { syncWhoopData } = whoopModule;
        if (syncWhoopData) {
          await syncWhoopData(prisma, token);
          results.push({ userId: token.userId, status: 'ok' });
        } else {
          // Fallback: do the sync inline
          const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 2); // last 2 days for hourly sync

          const headers = { Authorization: `Bearer ${token.accessToken}` };

          const fetchData = async (endpoint) => {
            const url = `${WHOOP_API_BASE}/${endpoint}?start=${start.toISOString()}&end=${end.toISOString()}`;
            const r = await fetch(url, { headers });
            if (r.status === 401) {
              // Try refresh
              if (token.refreshToken) {
                const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: token.refreshToken,
                    client_id: process.env.WHOOP_CLIENT_ID,
                    client_secret: process.env.WHOOP_CLIENT_SECRET,
                  }),
                });
                if (refreshRes.ok) {
                  const data = await refreshRes.json();
                  await prisma.whoopToken.update({
                    where: { id: token.id },
                    data: {
                      accessToken: data.access_token,
                      refreshToken: data.refresh_token || token.refreshToken,
                      expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
                    },
                  });
                  const r2 = await fetch(url, { headers: { Authorization: `Bearer ${data.access_token}` } });
                  if (r2.ok) return r2.json();
                }
              }
              throw new Error('Token expired');
            }
            if (!r.ok) throw new Error(`${r.status}`);
            return r.json();
          };

          let sleepRecords = [], recoveryRecords = [], cycleRecords = [], workoutRecords = [];
          try { const d = await fetchData('activity/sleep'); sleepRecords = d.records || d || []; } catch {}
          try { const d = await fetchData('recovery'); recoveryRecords = d.records || d || []; } catch {}
          try { const d = await fetchData('cycle'); cycleRecords = d.records || d || []; } catch {}
          try { const d = await fetchData('activity/workout'); workoutRecords = d.records || d || []; } catch {}

          const dailyMap = {};
          const getDateKey = (iso) => iso?.slice(0, 10);

          for (const s of sleepRecords) {
            const dk = getDateKey(s.end || s.created_at);
            if (!dk) continue;
            if (!dailyMap[dk]) dailyMap[dk] = {};
            const score = s.score || {};
            dailyMap[dk].sleepDurationMins = score.stage_summary ? Math.round((score.stage_summary.total_in_bed_time_milli || 0) / 60000) : null;
            dailyMap[dk].sleepPerformance = score.sleep_performance_percentage ?? null;
            dailyMap[dk].sleepEfficiency = score.sleep_efficiency_percentage ?? null;
          }
          for (const r of recoveryRecords) {
            const dk = getDateKey(r.created_at);
            if (!dk) continue;
            if (!dailyMap[dk]) dailyMap[dk] = {};
            const score = r.score || {};
            dailyMap[dk].recoveryScore = score.recovery_score ?? null;
            dailyMap[dk].hrv = score.hrv_rmssd_milli ?? null;
            dailyMap[dk].restingHr = score.resting_heart_rate ?? null;
          }
          for (const c of cycleRecords) {
            const dk = getDateKey(c.start || c.created_at);
            if (!dk) continue;
            if (!dailyMap[dk]) dailyMap[dk] = {};
            const score = c.score || {};
            dailyMap[dk].strain = score.strain ?? null;
            dailyMap[dk].calories = score.kilojoule ? score.kilojoule * 0.239006 : null;
          }
          for (const w of workoutRecords) {
            const dk = getDateKey(w.start || w.created_at);
            if (!dk) continue;
            if (!dailyMap[dk]) dailyMap[dk] = {};
            const score = w.score || {};
            dailyMap[dk].sportName = w.sport_name ?? null;
            dailyMap[dk].workoutStrain = score.strain ?? null;
            dailyMap[dk].workoutCalories = score.kilojoule ? score.kilojoule * 0.239006 : null;
            dailyMap[dk].workoutDurationMins = w.end && w.start ? Math.round((new Date(w.end) - new Date(w.start)) / 60000) : null;
          }

          for (const [dk, data] of Object.entries(dailyMap)) {
            const date = new Date(dk + 'T00:00:00.000Z');
            await prisma.whoopDaily.upsert({
              where: { userId_date: { userId: token.userId, date } },
              create: { userId: token.userId, date, ...data },
              update: data,
            });
          }

          results.push({ userId: token.userId, status: 'ok', days: Object.keys(dailyMap).length });
        }
      } catch (err) {
        results.push({ userId: token.userId, status: 'error', error: err.message });
      }
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    res.status(500).json({ error: 'Whoop sync cron failed' });
  }
});

export default router;
