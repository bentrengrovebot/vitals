import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// GET /api/foods/search?q=chicken breast
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ products: [] });

    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: `You are a food nutrition database. Given a search query, return 5-8 matching common foods/products with their nutrition per 100g. Know NZ brands (Anchor, Pams, Countdown, Wattie's, Lewis Road, Farrah's, Tegel, Hellers). Respond ONLY with JSON array, no markdown:
[{"name":"Food name","brand":"Brand or empty","per100g":{"calories":number,"protein":number,"fat":number,"carbs":number},"defaultServing":number,"servingUnit":"g or ml"}]
Include generic items AND branded items where applicable. Round to 1 decimal place.`,
      messages: [{ role: 'user', content: q }],
    });

    const text = (response.content[0]?.text || '').replace(/```json|```/g, '').trim();
    const products = JSON.parse(text);
    res.json({ products });
  } catch (err) {
    console.error('Food search error:', err);
    res.status(500).json({ error: 'Search failed', products: [] });
  }
});

// POST /api/foods/ai-search — Estimate nutrition for specific food + grams
router.post('/ai-search', async (req, res) => {
  try {
    const { name, grams } = req.body;
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: 'Nutrition database. Given food+grams, respond ONLY JSON: {"cal":number,"protein":number,"fat":number,"carbs":number}. Use NZ food data where applicable. Round to 1 decimal place.',
      messages: [{ role: 'user', content: `"${name}", ${grams}g` }],
    });

    const text = (response.content[0]?.text || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    res.json(parsed);
  } catch (err) {
    console.error('AI food search error:', err);
    res.status(500).json({ error: 'Estimation failed' });
  }
});

export default router;
