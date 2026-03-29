import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';
const SCOPES = 'read:recovery read:cycles read:workout read:sleep read:body_measurement read:profile';

// Helper: refresh access token
async function refreshAccessToken(prisma, whoopToken) {
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: whoopToken.refreshToken,
      client_id: process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    // Token refresh failed — mark as expired
    await prisma.whoopToken.delete({ where: { id: whoopToken.id } });
    return null;
  }

  const data = await res.json();
  const updated = await prisma.whoopToken.update({
    where: { id: whoopToken.id },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });
  return updated;
}

// Helper: make authenticated Whoop API call with auto-refresh
async function whoopFetch(prisma, whoopToken, url) {
  let token = whoopToken;

  // If token is expired, refresh first
  if (new Date() >= new Date(token.expiresAt)) {
    token = await refreshAccessToken(prisma, token);
    if (!token) throw new Error('Token expired and refresh failed');
  }

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });

  // If 401, try refresh once
  if (res.status === 401) {
    token = await refreshAccessToken(prisma, token);
    if (!token) throw new Error('Token expired and refresh failed');
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whoop API ${res.status}: ${text}`);
  }

  return res.json();
}

// GET /test — Debug endpoint
router.get('/test', (req, res) => {
  res.json({
    clientId: process.env.WHOOP_CLIENT_ID ? 'SET' : 'MISSING',
    clientSecret: process.env.WHOOP_CLIENT_SECRET ? 'SET' : 'MISSING',
    redirectUri: process.env.WHOOP_REDIRECT_URI || 'MISSING',
    cookies: Object.keys(req.cookies || {}),
    hasToken: !!req.cookies?.token,
  });
});

// GET /auth — Initiate OAuth2 flow (redirects to Whoop)
router.get('/auth', async (req, res) => {
  console.log('Whoop auth hit. WHOOP_CLIENT_ID:', process.env.WHOOP_CLIENT_ID ? 'SET' : 'MISSING');
  console.log('WHOOP_REDIRECT_URI:', process.env.WHOOP_REDIRECT_URI || 'MISSING');
  console.log('Cookies:', Object.keys(req.cookies || {}));

  if (!process.env.WHOOP_CLIENT_ID || !process.env.WHOOP_REDIRECT_URI) {
    return res.status(500).send('Whoop not configured. Add WHOOP_CLIENT_ID and WHOOP_REDIRECT_URI to env vars.');
  }

  // Try to get userId from cookie
  let userId = null;
  const token = req.cookies?.token;
  console.log('Token cookie present:', !!token);

  if (token) {
    try {
      const jwt = await import('jsonwebtoken');
      const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
      userId = decoded.userId;
      console.log('Decoded userId:', userId);
    } catch (err) {
      console.log('JWT verify failed:', err.message);
    }
  }

  if (!userId) {
    console.log('No userId — redirecting to home with error');
    return res.status(401).send('Not authenticated. Please log in first, then try connecting Whoop again.');
  }

  const authUrl = `${WHOOP_AUTH_URL}?${new URLSearchParams({
    response_type: 'code',
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    scope: SCOPES,
    state: userId,
  }).toString()}`;

  console.log('Redirecting to Whoop:', authUrl.substring(0, 100) + '...');
  res.redirect(authUrl);
});

// GET /callback — OAuth2 callback (no auth middleware — redirected from Whoop)
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    const userId = state;
    if (!userId) return res.status(400).json({ error: 'Missing state (userId)' });

    // Exchange code for tokens
    const tokenRes = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.WHOOP_REDIRECT_URI,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return res.status(400).json({ error: 'Token exchange failed', details: err });
    }

    const data = await tokenRes.json();

    // Upsert token
    await req.prisma.whoopToken.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
        scopes: SCOPES,
      },
      update: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || '',
        expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
        scopes: SCOPES,
      },
    });

    // Redirect back to app
    res.redirect('/?whoop=connected');
  } catch (err) {
    console.error('Whoop callback error:', err);
    res.status(500).json({ error: 'OAuth callback failed', details: err.message });
  }
});

// POST /sync — Manual sync: pull last 7 days
router.post('/sync', authMiddleware, async (req, res) => {
  try {
    const token = await req.prisma.whoopToken.findUnique({
      where: { userId: req.userId },
    });
    if (!token) return res.status(400).json({ error: 'Whoop not connected' });

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);

    const startISO = start.toISOString();
    const endISO = end.toISOString();

    console.log('Whoop sync: fetching data from', startISO, 'to', endISO);

    // Fetch each endpoint individually with error handling
    let sleepRecords = [], recoveryRecords = [], cycleRecords = [], workoutRecords = [];

    try {
      const sleepData = await whoopFetch(req.prisma, token, `${WHOOP_API_BASE}/activity/sleep?start=${startISO}&end=${endISO}`);
      sleepRecords = sleepData.records || sleepData || [];
      console.log('Whoop sleep records:', sleepRecords.length);
    } catch (err) { console.error('Whoop sleep fetch failed:', err.message); }

    try {
      const recoveryData = await whoopFetch(req.prisma, token, `${WHOOP_API_BASE}/recovery?start=${startISO}&end=${endISO}`);
      recoveryRecords = recoveryData.records || recoveryData || [];
      console.log('Whoop recovery records:', recoveryRecords.length);
    } catch (err) { console.error('Whoop recovery fetch failed:', err.message); }

    try {
      const cycleData = await whoopFetch(req.prisma, token, `${WHOOP_API_BASE}/cycle?start=${startISO}&end=${endISO}`);
      cycleRecords = cycleData.records || cycleData || [];
      console.log('Whoop cycle records:', cycleRecords.length);
    } catch (err) { console.error('Whoop cycle fetch failed:', err.message); }

    try {
      const workoutData = await whoopFetch(req.prisma, token, `${WHOOP_API_BASE}/activity/workout?start=${startISO}&end=${endISO}`);
      workoutRecords = workoutData.records || workoutData || [];
      console.log('Whoop workout records:', workoutRecords.length);
    } catch (err) { console.error('Whoop workout fetch failed:', err.message); }

    // Build a map of date -> aggregated data
    const dailyMap = {};

    const getDateKey = (isoString) => isoString.slice(0, 10);

    for (const s of sleepRecords) {
      const dateKey = getDateKey(s.end || s.created_at || s.updated_at);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      const score = s.score || {};
      dailyMap[dateKey].sleepDurationMins = score.stage_summary
        ? Math.round((score.stage_summary.total_in_bed_time_milli || 0) / 60000)
        : null;
      dailyMap[dateKey].sleepPerformance = score.sleep_performance_percentage ?? null;
      dailyMap[dateKey].sleepEfficiency = score.sleep_efficiency_percentage ?? null;
      dailyMap[dateKey].rawSleep = s;
    }

    for (const r of recoveryRecords) {
      const dateKey = getDateKey(r.created_at || r.updated_at || r.cycle?.start);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      const score = r.score || {};
      dailyMap[dateKey].recoveryScore = score.recovery_score ?? null;
      dailyMap[dateKey].hrv = score.hrv_rmssd_milli ?? null;
      dailyMap[dateKey].restingHr = score.resting_heart_rate ?? null;
      dailyMap[dateKey].rawRecovery = r;
    }

    for (const c of cycleRecords) {
      const dateKey = getDateKey(c.start || c.created_at);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      const score = c.score || {};
      dailyMap[dateKey].strain = score.strain ?? null;
      dailyMap[dateKey].calories = score.kilojoule ? score.kilojoule * 0.239006 : null;
      dailyMap[dateKey].rawCycle = c;
    }

    for (const w of workoutRecords) {
      const dateKey = getDateKey(w.start || w.created_at);
      if (!dailyMap[dateKey]) dailyMap[dateKey] = {};
      const score = w.score || {};
      dailyMap[dateKey].sportName = w.sport_name ?? null;
      dailyMap[dateKey].workoutStrain = score.strain ?? null;
      dailyMap[dateKey].workoutCalories = score.kilojoule ? score.kilojoule * 0.239006 : null;
      dailyMap[dateKey].workoutDurationMins = w.end && w.start
        ? Math.round((new Date(w.end) - new Date(w.start)) / 60000)
        : null;
      dailyMap[dateKey].rawWorkout = w;
    }

    // Upsert daily records
    let synced = 0;
    for (const [dateKey, data] of Object.entries(dailyMap)) {
      const date = new Date(dateKey + 'T00:00:00.000Z');
      const rawData = {};
      if (data.rawSleep) rawData.sleep = data.rawSleep;
      if (data.rawRecovery) rawData.recovery = data.rawRecovery;
      if (data.rawCycle) rawData.cycle = data.rawCycle;
      if (data.rawWorkout) rawData.workout = data.rawWorkout;

      await req.prisma.whoopDaily.upsert({
        where: {
          userId_date: { userId: req.userId, date },
        },
        create: {
          userId: req.userId,
          date,
          sleepDurationMins: data.sleepDurationMins ?? null,
          sleepPerformance: data.sleepPerformance ?? null,
          sleepEfficiency: data.sleepEfficiency ?? null,
          recoveryScore: data.recoveryScore ?? null,
          hrv: data.hrv ?? null,
          restingHr: data.restingHr ?? null,
          strain: data.strain ?? null,
          calories: data.calories ?? null,
          sportName: data.sportName ?? null,
          workoutStrain: data.workoutStrain ?? null,
          workoutCalories: data.workoutCalories ?? null,
          workoutDurationMins: data.workoutDurationMins ?? null,
          rawData: Object.keys(rawData).length > 0 ? rawData : undefined,
        },
        update: {
          sleepDurationMins: data.sleepDurationMins ?? null,
          sleepPerformance: data.sleepPerformance ?? null,
          sleepEfficiency: data.sleepEfficiency ?? null,
          recoveryScore: data.recoveryScore ?? null,
          hrv: data.hrv ?? null,
          restingHr: data.restingHr ?? null,
          strain: data.strain ?? null,
          calories: data.calories ?? null,
          sportName: data.sportName ?? null,
          workoutStrain: data.workoutStrain ?? null,
          workoutCalories: data.workoutCalories ?? null,
          workoutDurationMins: data.workoutDurationMins ?? null,
          rawData: Object.keys(rawData).length > 0 ? rawData : undefined,
        },
      });
      synced++;
    }

    res.json({ success: true, daysSynced: synced });
  } catch (err) {
    console.error('Whoop sync error:', err);
    res.status(500).json({ error: 'Sync failed', details: err.message });
  }
});

// GET /daily/:date — Get Whoop data for a specific date
router.get('/daily/:date', authMiddleware, async (req, res) => {
  try {
    const date = new Date(req.params.date + 'T00:00:00.000Z');
    const record = await req.prisma.whoopDaily.findUnique({
      where: {
        userId_date: { userId: req.userId, date },
      },
    });
    res.json(record || null);
  } catch (err) {
    console.error('Whoop daily error:', err);
    res.status(500).json({ error: 'Failed to get daily data' });
  }
});

// GET /status — Check if Whoop is connected
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const token = await req.prisma.whoopToken.findUnique({
      where: { userId: req.userId },
    });
    if (!token) return res.json({ connected: false });

    const expired = new Date() >= new Date(token.expiresAt);
    res.json({
      connected: true,
      expired,
      scopes: token.scopes,
      updatedAt: token.updatedAt,
    });
  } catch (err) {
    console.error('Whoop status error:', err);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// POST /disconnect — Remove Whoop tokens
router.post('/disconnect', authMiddleware, async (req, res) => {
  try {
    await req.prisma.whoopToken.deleteMany({
      where: { userId: req.userId },
    });
    // Also optionally clear daily data
    await req.prisma.whoopDaily.deleteMany({
      where: { userId: req.userId },
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Whoop disconnect error:', err);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

export default router;
