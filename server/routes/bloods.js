import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// GET /api/bloods — List all blood tests for the user, ordered by date desc
router.get('/', async (req, res) => {
  try {
    const tests = await req.prisma.bloodTest.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
    });
    res.json(tests);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bloods/marker/:name — Get history for a specific marker across all blood tests
router.get('/marker/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const tests = await req.prisma.bloodTest.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'asc' },
    });

    const history = tests
      .filter((t) => t.markers && t.markers[name])
      .map((t) => ({
        id: t.id,
        date: t.date,
        ...t.markers[name],
      }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bloods/:id — Get single blood test
router.get('/:id', async (req, res) => {
  try {
    const test = await req.prisma.bloodTest.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!test) return res.status(404).json({ error: 'Blood test not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bloods — Create blood test with manual markers
router.post('/', async (req, res) => {
  try {
    const { date, markers, source } = req.body;
    if (!date || !markers) {
      return res.status(400).json({ error: 'date and markers are required' });
    }
    const test = await req.prisma.bloodTest.create({
      data: {
        userId: req.userId,
        date: new Date(date),
        source: source || 'manual',
        markers,
      },
    });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bloods/extract — Upload PDF content for AI extraction
router.post('/extract', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    const client = getClient();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a medical lab result parser. Extract key biomarkers from this blood test document. Return ONLY JSON: {"date":"YYYY-MM-DD","markers":{"iron":{"value":12,"unit":"umol/L","range":"10-30","status":"normal"},...}}. Common markers to extract: iron, ferritin, B12, vitamin D, cholesterol (total, HDL, LDL), triglycerides, HbA1c, glucose, liver function (ALT, AST, GGT), kidney function (creatinine, eGFR), testosterone, TSH, full blood count (haemoglobin, white cells, platelets). If a marker is not present in the document, omit it. Use the reference ranges shown in the document.`,
      messages: [{ role: 'user', content }],
    });

    const text = message.content[0].text;
    // Parse JSON from AI response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(422).json({ error: 'Could not parse AI response' });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    res.json(extracted);
  } catch (err) {
    console.error('Blood PDF extraction error:', err);
    res.status(500).json({ error: 'Failed to extract blood test data' });
  }
});

// DELETE /api/bloods/:id — Delete blood test
router.delete('/:id', async (req, res) => {
  try {
    const test = await req.prisma.bloodTest.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!test) return res.status(404).json({ error: 'Blood test not found' });

    await req.prisma.bloodTest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
