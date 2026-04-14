import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const r1 = n => Math.round(n * 10) / 10;
const normalize = q => q.trim().toLowerCase().replace(/\s+/g, ' ');

// L1 cache: in-process Map. Cleared on redeploy. Bounded.
const memCache = new Map();
const MAX_MEM_CACHE = 1000;

function memSet(key, products) {
  if (memCache.size >= MAX_MEM_CACHE) {
    memCache.delete(memCache.keys().next().value);
  }
  memCache.set(key, products);
}

// ----- Open Food Facts ---------------------------------------------------

function mapOffProduct(p) {
  const n = p.nutriments || {};
  const cal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
  const protein = n['proteins_100g'];
  const fat = n['fat_100g'];
  const carbs = n['carbohydrates_100g'];
  // Skip entries missing core nutrition.
  if (cal == null || protein == null || fat == null || carbs == null) return null;

  const name = (p.product_name || p.product_name_en || '').trim();
  if (!name) return null;

  const brand = (p.brands || '').split(',')[0].trim();
  const unit = /ml|l$|liquid|drink|beverage/i.test(p.quantity || '') ? 'ml' : 'g';
  const defaultServing = typeof p.serving_quantity === 'number' ? p.serving_quantity : 100;

  const servings = [];
  if (p.serving_size && p.serving_quantity) {
    servings.push({ label: p.serving_size, grams: p.serving_quantity });
  }
  servings.push({ label: `100${unit}`, grams: 100 });

  return {
    name,
    brand,
    per100g: {
      calories: r1(cal),
      protein: r1(protein),
      fat: r1(fat),
      carbs: r1(carbs),
    },
    defaultServing,
    servingUnit: unit,
    servings,
  };
}

async function searchOpenFoodFacts(q) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=15&sort_by=popularity_key`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Vitals-App/1.0 (health tracker)' },
      signal: ctrl.signal,
    });
    if (!r.ok) return [];
    const data = await r.json();
    const products = (data.products || [])
      .map(mapOffProduct)
      .filter(Boolean)
      .slice(0, 8);
    return products;
  } catch (err) {
    console.warn('Open Food Facts search failed:', err.message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// ----- Claude fallback ---------------------------------------------------

async function searchClaude(q) {
  const client = getClient();
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: `You are a food nutrition database. Given a search query, return 5-8 matching foods with nutrition per 100g AND common serving sizes. ALWAYS include generic/unbranded options (e.g. "Black coffee", "White bread", "Whole milk") alongside NZ branded products where relevant (Anchor, Pams, Countdown, Wattie's, Lewis Road, Farrah's, Tegel, Hellers). For beverages, include per-100ml nutrition. Respond ONLY with JSON array, no markdown:
[{"name":"Food name","brand":"Brand or empty","per100g":{"calories":number,"protein":number,"fat":number,"carbs":number},"defaultServing":number,"servingUnit":"g or ml","servings":[{"label":"1 piece","grams":7},{"label":"1 cup","grams":140}]}]
Include 2-4 common serving sizes per food ("1 breast", "1 medium", "1 slice", "1 cup", "15 almonds", "1 scoop (30g)", "1 tbsp", "1 mug (240ml)"). Round to 1 decimal place.`,
    messages: [{ role: 'user', content: q }],
  });
  const text = (response.content[0]?.text || '').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

// ----- Route -------------------------------------------------------------

// GET /api/foods/search?q=chicken breast
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ products: [] });

    const key = normalize(q);

    // L1: in-memory
    if (memCache.has(key)) {
      return res.json({ products: memCache.get(key), cached: 'mem' });
    }

    // L2: Postgres
    const cached = await req.prisma.foodSearchCache.findUnique({ where: { query: key } });
    if (cached) {
      memSet(key, cached.results);
      return res.json({ products: cached.results, cached: 'db' });
    }

    // L3: Open Food Facts (fast, free)
    let products = await searchOpenFoodFacts(q);
    let source = 'openfoodfacts';

    // Fallback to Claude only when OFF returns nothing useful.
    if (products.length === 0) {
      try {
        products = await searchClaude(q);
        source = 'claude';
      } catch (err) {
        console.error('Claude fallback failed:', err);
        products = [];
      }
    }

    // Persist. Don't cache empty results (let user retry later).
    if (products.length > 0) {
      memSet(key, products);
      await req.prisma.foodSearchCache.upsert({
        where: { query: key },
        create: { query: key, source, results: products },
        update: { source, results: products, updatedAt: new Date() },
      }).catch(err => console.warn('Cache write failed:', err.message));
    }

    res.json({ products, source });
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
