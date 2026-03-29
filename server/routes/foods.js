import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// GET /api/foods/search?q=chicken breast&page=1
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1 } = req.query;
    if (!q || q.length < 2) return res.json({ products: [] });

    // Search Open Food Facts
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&page=${page}&fields=product_name,brands,nutriments,serving_size,serving_quantity,image_small_url,code`;
    const response = await fetch(url);
    const data = await response.json();

    const products = (data.products || [])
      .filter(p => p.product_name && p.nutriments)
      .map(p => ({
        name: p.product_name,
        brand: p.brands || '',
        barcode: p.code || '',
        servingSize: p.serving_size || '',
        servingQuantity: p.serving_quantity || 100,
        image: p.image_small_url || '',
        per100g: {
          calories: Math.round(p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal'] || 0),
          protein: Math.round((p.nutriments.proteins_100g || 0) * 10) / 10,
          fat: Math.round((p.nutriments.fat_100g || 0) * 10) / 10,
          carbs: Math.round((p.nutriments.carbohydrates_100g || 0) * 10) / 10,
        },
      }));

    res.json({ products });
  } catch (err) {
    console.error('Food search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// POST /api/foods/ai-search — Use AI to estimate nutrition when database doesn't have it
router.post('/ai-search', async (req, res) => {
  try {
    const { name, grams } = req.body;
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
