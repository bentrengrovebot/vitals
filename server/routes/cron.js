import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { runWeeklyCheckin } from './weekly.js';

const router = Router();

// POST /api/cron/weekly — Called by Railway cron or external cron service
router.post('/weekly', async (req, res) => {
  // Verify cron secret
  const secret = req.headers['x-cron-secret'] || req.body?.secret;
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Invalid cron secret' });
  }

  try {
    const prisma = req.prisma || new PrismaClient();
    const users = await prisma.user.findMany({ select: { id: true } });

    const results = [];
    for (const user of users) {
      try {
        const checkin = await runWeeklyCheckin(prisma, user.id);
        results.push({ userId: user.id, status: 'ok', checkinId: checkin.id });
      } catch (err) {
        console.error(`Weekly check-in failed for user ${user.id}:`, err.message);
        results.push({ userId: user.id, status: 'error', error: err.message });
      }
    }

    res.json({ processed: results.length, results });
  } catch (err) {
    console.error('Cron weekly error:', err);
    res.status(500).json({ error: 'Cron job failed' });
  }
});

export default router;
