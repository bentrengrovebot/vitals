import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// GET /api/bloods — List all blood tests
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

// POST /api/bloods — Create blood test
router.post('/', async (req, res) => {
  try {
    const { date, markers, source } = req.body;
    if (!date || !markers) return res.status(400).json({ error: 'date and markers required' });
    const test = await req.prisma.bloodTest.create({
      data: { userId: req.userId, date: new Date(date), source: source || 'manual', markers },
    });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bloods/marker/:name
router.get('/marker/:name', async (req, res) => {
  try {
    const tests = await req.prisma.bloodTest.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'asc' },
    });
    const history = tests
      .filter(t => t.markers?.[req.params.name])
      .map(t => ({ date: t.date, ...t.markers[req.params.name] }));
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bloods/:id
router.get('/:id', async (req, res) => {
  try {
    const test = await req.prisma.bloodTest.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!test) return res.status(404).json({ error: 'Not found' });
    res.json(test);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/bloods/extract — Upload file for AI extraction
router.post('/extract', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });
    if (content.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'File too large. Max ~7MB.' });

    console.log('Blood extract: length', content.length, 'header:', content.substring(0, 20));

    const client = getClient();

    // Detect file type from first chars only (don't process full string)
    const header = content.substring(0, 30);
    let userContent;

    if (header.startsWith('JVBERi')) {
      // PDF
      console.log('Blood extract: PDF detected');
      userContent = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: content } },
        { type: 'text', text: 'Extract all biomarkers from this blood test PDF.' },
      ];
    } else if (header.startsWith('/9j/') || header.startsWith('iVBOR') || header.startsWith('R0lGO') || header.startsWith('UklGR')) {
      // Image (JPEG, PNG, GIF, WebP)
      const mediaType = header.startsWith('iVBOR') ? 'image/png' : header.startsWith('R0lGO') ? 'image/gif' : header.startsWith('UklGR') ? 'image/webp' : 'image/jpeg';
      console.log('Blood extract: image detected as', mediaType);
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: content } },
        { type: 'text', text: 'Extract all biomarkers from this blood test image.' },
      ];
    } else if (content.length > 200 && /^[A-Za-z0-9+/]/.test(header)) {
      // Unknown base64 — try as JPEG
      console.log('Blood extract: unknown base64, trying as JPEG');
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: content } },
        { type: 'text', text: 'Extract all biomarkers from this blood test image.' },
      ];
    } else {
      // Plain text
      console.log('Blood extract: plain text');
      userContent = 'Extract biomarkers from this blood test:\n\n' + content;
    }

    console.log('Blood extract: calling Claude...');
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are a medical lab result parser. Extract key biomarkers. Return ONLY JSON: {"date":"YYYY-MM-DD","markers":{"iron":{"value":12,"unit":"umol/L","range":"10-30","status":"normal"},...}}. Markers: iron, ferritin, B12, vitamin D, cholesterol, HDL, LDL, triglycerides, HbA1c, glucose, ALT, AST, GGT, creatinine, eGFR, testosterone, TSH, haemoglobin, white cells, platelets. Omit missing. Status: below="low", within="normal", above="high".',
      messages: [{ role: 'user', content: userContent }],
    });

    console.log('Blood extract: response received');
    const text = message.content[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(422).json({ error: 'Could not parse response', raw: text.substring(0, 300) });

    res.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('Blood extract error:', err?.message || err);
    res.status(500).json({ error: 'Extraction failed: ' + (err?.message || 'Unknown') });
  }
});

// DELETE /api/bloods/:id
router.delete('/:id', async (req, res) => {
  try {
    const test = await req.prisma.bloodTest.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!test) return res.status(404).json({ error: 'Not found' });
    await req.prisma.bloodTest.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
