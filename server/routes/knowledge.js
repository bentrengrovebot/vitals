import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/knowledge — List all docs
router.get('/', async (req, res) => {
  try {
    const docs = await req.prisma.knowledgeDoc.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/knowledge — Create doc
router.post('/', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const doc = await req.prisma.knowledgeDoc.create({
      data: { userId: req.userId, title, content, category: category || 'general' },
    });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/knowledge/:id — Update doc
router.put('/:id', async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const doc = await req.prisma.knowledgeDoc.update({
      where: { id: req.params.id },
      data: { title, content, category },
    });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/knowledge/:id
router.delete('/:id', async (req, res) => {
  try {
    await req.prisma.knowledgeDoc.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
