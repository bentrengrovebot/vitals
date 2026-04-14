import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

// ----- NZ Food Composition Database --------------------------------------
// Parsed from the Concise NZ Food Composition Tables 14th Ed 2021.
// 1,278 foods, NZ-accurate macros + fibre/satFat/sodium/sugar. Loaded
// once at module init — trivial memory cost (~600KB), zero network.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NZFCD_PATH = path.resolve(__dirname, '..', '..', 'data', 'nzfcd.json');
let NZFCD = [];
try {
  NZFCD = JSON.parse(fs.readFileSync(NZFCD_PATH, 'utf8'));
  console.log(`Loaded NZFCD: ${NZFCD.length} foods`);
} catch (err) {
  console.warn('NZFCD not loaded:', err.message);
}

// Only true beverages should display as ml. NZFCD uses "1 cup (250 mL)"
// as a measuring-spoon reference on solid foods too, so serving-label
// matching flips solids to ml. Category is the reliable signal.
function isBeverageCategory(cat) {
  return /^BEVERAGES/i.test(cat || '');
}

function mapNzfcd(f) {
  const beverage = isBeverageCategory(f.category);
  // If it's a beverage, rewrite the default "100g" serving as "100ml"
  // so the UI labels match the unit users actually think in.
  const servings = beverage
    ? f.servings.map(s => s.label === '100g' ? { label: '100ml', grams: 100 } : s)
    : f.servings;
  return {
    name: f.name,
    brand: '',
    per100g: {
      calories: f.per100g.calories,
      protein: f.per100g.protein,
      fat: f.per100g.fat,
      carbs: f.per100g.carbs,
      // Extra nutrients — sat fat / fiber / sugar / sodium. Consumed by
      // Diary's second macro row and DiaryEntry storage.
      fiber: f.per100g.fiber,
      sugar: f.per100g.sugar,
      satFat: f.per100g.satFat,
      sodium: f.per100g.sodium,
    },
    defaultServing: 100,
    servingUnit: beverage ? 'ml' : 'g',
    servings,
    source: 'nzfcd',
  };
}

// Generate typo/plural variants for each query word so "potatoe",
// "potatos", "potatoes" all match "potato". Only strips trailing
// chars — we want to match broader, not narrower.
function wordVariants(w) {
  const v = new Set([w]);
  if (w.length >= 5) {
    if (w.endsWith('es')) v.add(w.slice(0, -2));
    if (w.endsWith('s')) v.add(w.slice(0, -1));
    if (w.endsWith('e')) v.add(w.slice(0, -1));
    if (w.endsWith('ies')) { v.add(w.slice(0, -3) + 'y'); }
  }
  return [...v];
}

function nameMatchesQuery(name, queryWords) {
  const lower = name.toLowerCase();
  // Each query word must match via any of its variants.
  return queryWords.every(w => wordVariants(w).some(v => lower.includes(v)));
}

// Rank by simplicity (shorter names are more generic) and whether the
// first query word prefixes the name (exact hits win).
function searchNzfcd(q) {
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
  if (!words.length || !NZFCD.length) return [];

  const scored = [];
  for (const f of NZFCD) {
    const name = f.name.toLowerCase();
    if (!nameMatchesQuery(name, words)) continue;

    let score = name.length / 10;
    if (name.startsWith(words[0])) score -= 5;
    // Penalize commercial/fast-food entries for unqualified queries —
    // they're usually less useful than plain ingredients.
    if (/®|™|kentucky fried|mcdonald/i.test(f.name)) score += 2;

    scored.push({ food: f, score });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, 8).map(s => mapNzfcd(s.food));
}

// ----- Staples: whole foods that don't exist in OFF ----------------------
// These sit at the top of every matching query — they're the stuff you
// actually cook with. Kept small and focused on Ben's meal plan v8 +
// common NZ staples.

const STAPLES = [
  // Proteins — chicken
  { name: 'Chicken breast, raw',                keywords: ['chicken', 'breast'],                             per100g: { calories: 120, protein: 23,   fat: 2.6,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 small (100g)', grams: 100 }, { label: '1 medium (150g)', grams: 150 }, { label: '1 large (200g)', grams: 200 }] },
  { name: 'Chicken breast, cooked',             keywords: ['chicken', 'breast'],                             per100g: { calories: 165, protein: 31,   fat: 3.6,  carbs: 0   }, defaultServing: 120, servingUnit: 'g', servings: [{ label: '1 small (80g)', grams: 80 }, { label: '1 medium (120g)', grams: 120 }, { label: '1 large (170g)', grams: 170 }] },
  { name: 'Chicken thigh, skinless, raw',       keywords: ['chicken', 'thigh', 'skinless'],                  per100g: { calories: 119, protein: 20,   fat: 4.3,  carbs: 0   }, defaultServing: 111, servingUnit: 'g', servings: [{ label: '1 small thigh (95g)', grams: 95 }, { label: '1 medium thigh (111g)', grams: 111 }, { label: '1 large thigh (131g)', grams: 131 }] },
  { name: 'Chicken thigh, skinless, cooked',    keywords: ['chicken', 'thigh', 'skinless'],                  per100g: { calories: 177, protein: 24,   fat: 8.2,  carbs: 0   }, defaultServing: 90,  servingUnit: 'g', servings: [{ label: '1 small thigh (70g)', grams: 70 }, { label: '1 medium thigh (90g)', grams: 90 }, { label: '1 large thigh (110g)', grams: 110 }] },
  { name: 'Chicken thigh, skin-on, raw',        keywords: ['chicken', 'thigh', 'skin'],                      per100g: { calories: 211, protein: 17,   fat: 15.5, carbs: 0   }, defaultServing: 130, servingUnit: 'g', servings: [{ label: '1 medium thigh (130g)', grams: 130 }, { label: '1 large thigh (160g)', grams: 160 }] },
  { name: 'Chicken thigh, skin-on, cooked',     keywords: ['chicken', 'thigh', 'skin'],                      per100g: { calories: 229, protein: 25,   fat: 14,   carbs: 0   }, defaultServing: 110, servingUnit: 'g', servings: [{ label: '1 medium thigh (110g)', grams: 110 }, { label: '1 large thigh (140g)', grams: 140 }] },
  { name: 'Chicken drumstick, cooked',          keywords: ['chicken', 'drumstick'],                          per100g: { calories: 172, protein: 28,   fat: 5.7,  carbs: 0   }, defaultServing: 55,  servingUnit: 'g', servings: [{ label: '1 small (45g)', grams: 45 }, { label: '1 medium (55g)', grams: 55 }, { label: '1 large (75g)', grams: 75 }] },
  { name: 'Chicken wing, cooked',               keywords: ['chicken', 'wing', 'wings'],                      per100g: { calories: 203, protein: 30,   fat: 8.1,  carbs: 0   }, defaultServing: 30,  servingUnit: 'g', servings: [{ label: '1 wing (30g)', grams: 30 }, { label: '3 wings (90g)', grams: 90 }, { label: '5 wings (150g)', grams: 150 }] },
  { name: 'Chicken mince, raw',                 keywords: ['chicken', 'mince', 'ground'],                    per100g: { calories: 143, protein: 17.4, fat: 8.1,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 handful (100g)', grams: 100 }, { label: '1 serve (150g)', grams: 150 }, { label: '1 pack (500g)', grams: 500 }] },
  { name: 'Chicken mince, cooked',              keywords: ['chicken', 'mince', 'ground'],                    per100g: { calories: 189, protein: 27,   fat: 8.7,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 handful (100g)', grams: 100 }, { label: '1 serve (150g)', grams: 150 }, { label: '1 cup (200g)', grams: 200 }] },
  { name: 'Chicken, whole roast (meat only)',   keywords: ['chicken', 'whole', 'roast', 'rotisserie'],       per100g: { calories: 190, protein: 29,   fat: 7.4,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '½ cup shredded (70g)', grams: 70 }, { label: '1 cup shredded (140g)', grams: 140 }, { label: '1 serve (150g)', grams: 150 }] },
  { name: 'Chicken tenderloin, raw',            keywords: ['chicken', 'tenderloin', 'tender', 'strips'],     per100g: { calories: 110, protein: 21,   fat: 1.7,  carbs: 0   }, defaultServing: 80,  servingUnit: 'g', servings: [{ label: '1 strip (40g)', grams: 40 }, { label: '2 strips (80g)', grams: 80 }, { label: '3 strips (120g)', grams: 120 }] },

  // Proteins — beef
  { name: 'Beef mince, lean, raw',              keywords: ['beef', 'mince', 'ground'],                       per100g: { calories: 137, protein: 21,   fat: 5.4,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 handful (100g)', grams: 100 }, { label: '1 serve (150g)', grams: 150 }, { label: '1 pack (500g)', grams: 500 }] },
  { name: 'Beef mince, lean, cooked',           keywords: ['beef', 'mince', 'ground'],                       per100g: { calories: 215, protein: 27,   fat: 11,   carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 handful (100g)', grams: 100 }, { label: '1 serve (150g)', grams: 150 }, { label: '1 cup (200g)', grams: 200 }] },
  { name: 'Beef sirloin steak, cooked',         keywords: ['beef', 'steak', 'sirloin'],                      per100g: { calories: 200, protein: 28,   fat: 9,    carbs: 0   }, defaultServing: 200, servingUnit: 'g', servings: [{ label: '1 small (150g)', grams: 150 }, { label: '1 medium (200g)', grams: 200 }, { label: '1 large (300g)', grams: 300 }] },
  { name: 'Beef ribeye, cooked',                keywords: ['beef', 'ribeye', 'rib-eye', 'scotch'],           per100g: { calories: 286, protein: 25,   fat: 20,   carbs: 0   }, defaultServing: 250, servingUnit: 'g', servings: [{ label: '1 medium (250g)', grams: 250 }, { label: '1 large (350g)', grams: 350 }] },
  { name: 'Beef eye fillet, cooked',            keywords: ['beef', 'eye', 'fillet', 'tenderloin'],           per100g: { calories: 179, protein: 28,   fat: 7,    carbs: 0   }, defaultServing: 180, servingUnit: 'g', servings: [{ label: '1 medium (180g)', grams: 180 }, { label: '1 large (250g)', grams: 250 }] },
  { name: 'Beef rump, cooked',                  keywords: ['beef', 'rump'],                                  per100g: { calories: 201, protein: 30,   fat: 8.5,  carbs: 0   }, defaultServing: 200, servingUnit: 'g', servings: [{ label: '1 medium (200g)', grams: 200 }, { label: '1 large (300g)', grams: 300 }] },

  // Proteins — fish & seafood
  { name: 'Salmon fillet, raw',                 keywords: ['salmon'],                                        per100g: { calories: 166, protein: 20,   fat: 9.5,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 small (100g)', grams: 100 }, { label: '1 fillet (150g)', grams: 150 }, { label: '1 large (200g)', grams: 200 }] },
  { name: 'Salmon fillet, cooked',              keywords: ['salmon'],                                        per100g: { calories: 208, protein: 22,   fat: 13,   carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 small (100g)', grams: 100 }, { label: '1 fillet (150g)', grams: 150 }, { label: '1 large (200g)', grams: 200 }] },
  { name: 'Tuna in springwater',                keywords: ['tuna'],                                          per100g: { calories: 116, protein: 26,   fat: 1,    carbs: 0   }, defaultServing: 95,  servingUnit: 'g', servings: [{ label: '½ can (47g)', grams: 47 }, { label: '1 can (95g)', grams: 95 }, { label: '100g', grams: 100 }] },
  { name: 'Tuna steak, fresh, cooked',          keywords: ['tuna', 'steak'],                                 per100g: { calories: 184, protein: 30,   fat: 6,    carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 small (100g)', grams: 100 }, { label: '1 steak (150g)', grams: 150 }] },
  { name: 'Hoki fillet, cooked',                keywords: ['hoki', 'fish'],                                  per100g: { calories: 100, protein: 21,   fat: 1.3,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 fillet (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Tarakihi fillet, cooked',            keywords: ['tarakihi', 'fish'],                              per100g: { calories: 108, protein: 22,   fat: 1.8,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 fillet (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Blue cod, cooked',                   keywords: ['cod', 'blue', 'fish'],                           per100g: { calories: 98,  protein: 22,   fat: 0.8,  carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 fillet (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Snapper, cooked',                    keywords: ['snapper', 'fish'],                               per100g: { calories: 110, protein: 22,   fat: 2,    carbs: 0   }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 fillet (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Prawns, cooked',                     keywords: ['prawns', 'shrimp'],                              per100g: { calories: 99,  protein: 24,   fat: 0.3,  carbs: 0.2 }, defaultServing: 100, servingUnit: 'g', servings: [{ label: '100g', grams: 100 }, { label: '150g', grams: 150 }] },

  // Proteins — eggs, dairy, other
  { name: 'Egg, whole',                keywords: ['egg', 'eggs'],                     per100g: { calories: 143, protein: 13,   fat: 10,   carbs: 0.7 }, defaultServing: 50,  servingUnit: 'g', servings: [{ label: '1 large egg (50g)', grams: 50 }, { label: '2 eggs (100g)', grams: 100 }, { label: '3 eggs (150g)', grams: 150 }] },
  { name: 'Egg white',                 keywords: ['egg', 'white'],                    per100g: { calories: 52,  protein: 11,   fat: 0.2,  carbs: 0.7 }, defaultServing: 33,  servingUnit: 'g', servings: [{ label: '1 white (33g)', grams: 33 }, { label: '100g', grams: 100 }] },
  { name: 'Cottage cheese, low fat',   keywords: ['cottage', 'cheese'],               per100g: { calories: 72,  protein: 12,   fat: 1,    carbs: 3.4 }, defaultServing: 200, servingUnit: 'g', servings: [{ label: '200g tub', grams: 200 }, { label: '100g', grams: 100 }] },
  { name: 'Greek yoghurt, plain',      keywords: ['greek', 'yoghurt', 'yogurt'],      per100g: { calories: 59,  protein: 10,   fat: 0.4,  carbs: 3.6 }, defaultServing: 170, servingUnit: 'g', servings: [{ label: '1 pot (170g)', grams: 170 }, { label: '100g', grams: 100 }] },
  { name: 'Whey protein isolate',      keywords: ['whey', 'protein', 'isolate'],      per100g: { calories: 373, protein: 88,   fat: 1,    carbs: 3   }, defaultServing: 30,  servingUnit: 'g', servings: [{ label: '1 scoop (30g)', grams: 30 }, { label: '2 scoops (60g)', grams: 60 }, { label: '40g', grams: 40 }] },

  // Carbs
  { name: 'White rice, cooked',        keywords: ['rice', 'white'],                   per100g: { calories: 130, protein: 2.7,  fat: 0.3,  carbs: 28  }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '½ cup (75g)', grams: 75 }, { label: '1 cup cooked (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Brown rice, cooked',        keywords: ['rice', 'brown'],                   per100g: { calories: 112, protein: 2.6,  fat: 0.9,  carbs: 24  }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '½ cup (75g)', grams: 75 }, { label: '1 cup cooked (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Potato, boiled',            keywords: ['potato'],                          per100g: { calories: 87,  protein: 1.9,  fat: 0.1,  carbs: 20  }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 medium (150g)', grams: 150 }, { label: '100g', grams: 100 }, { label: '200g', grams: 200 }] },
  { name: 'Potato, baked',             keywords: ['potato', 'baked'],                 per100g: { calories: 93,  protein: 2.5,  fat: 0.1,  carbs: 21  }, defaultServing: 173, servingUnit: 'g', servings: [{ label: '1 medium (173g)', grams: 173 }, { label: '100g', grams: 100 }] },
  { name: 'Kumara (sweet potato)',     keywords: ['kumara', 'sweet', 'potato'],       per100g: { calories: 86,  protein: 1.6,  fat: 0.1,  carbs: 20  }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 medium (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Rolled oats, dry',          keywords: ['oats', 'oatmeal', 'porridge'],     per100g: { calories: 379, protein: 13,   fat: 6.5,  carbs: 68  }, defaultServing: 40,  servingUnit: 'g', servings: [{ label: '½ cup (40g)', grams: 40 }, { label: '1 cup (80g)', grams: 80 }] },
  { name: 'White bread',               keywords: ['bread', 'white'],                  per100g: { calories: 265, protein: 9,    fat: 3.2,  carbs: 49  }, defaultServing: 30,  servingUnit: 'g', servings: [{ label: '1 slice (30g)', grams: 30 }, { label: '2 slices (60g)', grams: 60 }] },
  { name: 'Wholemeal bread',           keywords: ['bread', 'wholemeal', 'wholegrain'], per100g: { calories: 247, protein: 13,   fat: 3.4,  carbs: 41  }, defaultServing: 35,  servingUnit: 'g', servings: [{ label: '1 slice (35g)', grams: 35 }, { label: '2 slices (70g)', grams: 70 }] },
  { name: 'Pasta, cooked',             keywords: ['pasta', 'spaghetti'],              per100g: { calories: 131, protein: 5,    fat: 1.1,  carbs: 25  }, defaultServing: 200, servingUnit: 'g', servings: [{ label: '1 cup (200g)', grams: 200 }, { label: '100g', grams: 100 }] },

  // Veg
  { name: 'Broccoli, raw',             keywords: ['broccoli'],                        per100g: { calories: 34,  protein: 2.8,  fat: 0.4,  carbs: 7   }, defaultServing: 100, servingUnit: 'g', servings: [{ label: '1 cup (100g)', grams: 100 }, { label: '150g', grams: 150 }] },
  { name: 'Carrot, raw',               keywords: ['carrot', 'carrots'],               per100g: { calories: 41,  protein: 0.9,  fat: 0.2,  carbs: 10  }, defaultServing: 80,  servingUnit: 'g', servings: [{ label: '1 medium (80g)', grams: 80 }, { label: '100g', grams: 100 }] },
  { name: 'Spinach, raw',              keywords: ['spinach'],                         per100g: { calories: 23,  protein: 2.9,  fat: 0.4,  carbs: 3.6 }, defaultServing: 30,  servingUnit: 'g', servings: [{ label: '1 cup (30g)', grams: 30 }, { label: '100g', grams: 100 }] },
  { name: 'Tomato, raw',               keywords: ['tomato', 'tomatoes'],              per100g: { calories: 18,  protein: 0.9,  fat: 0.2,  carbs: 3.9 }, defaultServing: 120, servingUnit: 'g', servings: [{ label: '1 medium (120g)', grams: 120 }, { label: '100g', grams: 100 }] },
  { name: 'Capsicum (bell pepper)',    keywords: ['capsicum', 'pepper', 'bell'],      per100g: { calories: 31,  protein: 1,    fat: 0.3,  carbs: 6   }, defaultServing: 120, servingUnit: 'g', servings: [{ label: '1 medium (120g)', grams: 120 }, { label: '100g', grams: 100 }] },
  { name: 'Cucumber',                  keywords: ['cucumber'],                        per100g: { calories: 15,  protein: 0.7,  fat: 0.1,  carbs: 3.6 }, defaultServing: 100, servingUnit: 'g', servings: [{ label: '100g', grams: 100 }] },
  { name: 'Mushrooms, raw',            keywords: ['mushroom', 'mushrooms'],           per100g: { calories: 22,  protein: 3.1,  fat: 0.3,  carbs: 3.3 }, defaultServing: 100, servingUnit: 'g', servings: [{ label: '1 cup (70g)', grams: 70 }, { label: '100g', grams: 100 }] },

  // Fruit
  { name: 'Banana',                    keywords: ['banana'],                          per100g: { calories: 89,  protein: 1.1,  fat: 0.3,  carbs: 23  }, defaultServing: 118, servingUnit: 'g', servings: [{ label: '1 medium (118g)', grams: 118 }, { label: '1 large (136g)', grams: 136 }] },
  { name: 'Apple',                     keywords: ['apple'],                           per100g: { calories: 52,  protein: 0.3,  fat: 0.2,  carbs: 14  }, defaultServing: 182, servingUnit: 'g', servings: [{ label: '1 medium (182g)', grams: 182 }, { label: '100g', grams: 100 }] },
  { name: 'Blueberries',               keywords: ['blueberries', 'blueberry'],        per100g: { calories: 57,  protein: 0.7,  fat: 0.3,  carbs: 14  }, defaultServing: 100, servingUnit: 'g', servings: [{ label: '1 cup (148g)', grams: 148 }, { label: '100g', grams: 100 }] },
  { name: 'Strawberries',              keywords: ['strawberries', 'strawberry'],      per100g: { calories: 32,  protein: 0.7,  fat: 0.3,  carbs: 7.7 }, defaultServing: 150, servingUnit: 'g', servings: [{ label: '1 cup (150g)', grams: 150 }, { label: '100g', grams: 100 }] },
  { name: 'Avocado',                   keywords: ['avocado'],                         per100g: { calories: 160, protein: 2,    fat: 15,   carbs: 9   }, defaultServing: 100, servingUnit: 'g', servings: [{ label: '½ medium (100g)', grams: 100 }, { label: '1 whole (200g)', grams: 200 }] },

  // Fats & nuts
  { name: 'Almonds',                   keywords: ['almonds', 'almond'],               per100g: { calories: 579, protein: 21,   fat: 50,   carbs: 22  }, defaultServing: 30,  servingUnit: 'g', servings: [{ label: '15 almonds (18g)', grams: 18 }, { label: '1 handful (30g)', grams: 30 }, { label: '1 cup (143g)', grams: 143 }] },
  { name: 'Peanut butter, natural',    keywords: ['peanut', 'butter'],                per100g: { calories: 588, protein: 25,   fat: 50,   carbs: 20  }, defaultServing: 16,  servingUnit: 'g', servings: [{ label: '1 tbsp (16g)', grams: 16 }, { label: '2 tbsp (32g)', grams: 32 }] },
  { name: 'Olive oil',                 keywords: ['olive', 'oil'],                    per100g: { calories: 884, protein: 0,    fat: 100,  carbs: 0   }, defaultServing: 14,  servingUnit: 'g', servings: [{ label: '1 tsp (4.5g)', grams: 4.5 }, { label: '1 tbsp (14g)', grams: 14 }] },
  { name: 'Butter',                    keywords: ['butter'],                          per100g: { calories: 717, protein: 0.9,  fat: 81,   carbs: 0.1 }, defaultServing: 14,  servingUnit: 'g', servings: [{ label: '1 tsp (5g)', grams: 5 }, { label: '1 tbsp (14g)', grams: 14 }] },

  // Dairy & drinks
  { name: 'Whole milk (blue top)',     keywords: ['milk', 'whole', 'blue'],           per100g: { calories: 61,  protein: 3.2,  fat: 3.3,  carbs: 4.8 }, defaultServing: 250, servingUnit: 'ml', servings: [{ label: '1 glass (250ml)', grams: 250 }, { label: '1 cup (240ml)', grams: 240 }, { label: '100ml', grams: 100 }] },
  { name: 'Trim milk (green top)',     keywords: ['milk', 'trim', 'skim', 'green'],   per100g: { calories: 34,  protein: 3.4,  fat: 0.1,  carbs: 5   }, defaultServing: 250, servingUnit: 'ml', servings: [{ label: '1 glass (250ml)', grams: 250 }, { label: '100ml', grams: 100 }] },
  { name: 'Black coffee',              keywords: ['coffee', 'espresso', 'americano', 'long', 'black'], per100g: { calories: 2,   protein: 0.3,  fat: 0,    carbs: 0   }, defaultServing: 240, servingUnit: 'ml', servings: [{ label: '1 espresso (30ml)', grams: 30 }, { label: '1 long black (150ml)', grams: 150 }, { label: '1 mug (240ml)', grams: 240 }] },
  { name: 'Flat white (trim milk)',    keywords: ['coffee', 'flat', 'white'],         per100g: { calories: 45,  protein: 2.5,  fat: 1.5,  carbs: 4.5 }, defaultServing: 230, servingUnit: 'ml', servings: [{ label: '1 small (180ml)', grams: 180 }, { label: '1 regular (230ml)', grams: 230 }] },
  { name: 'Tea, black (no milk)',      keywords: ['tea'],                             per100g: { calories: 1,   protein: 0,    fat: 0,    carbs: 0.3 }, defaultServing: 240, servingUnit: 'ml', servings: [{ label: '1 mug (240ml)', grams: 240 }] },
];

// Micronutrient values for staples, per 100g/100ml.
// Cross-referenced against NZFCD entries where available, with
// USDA fallback for items NZFCD doesn't cover.
const STAPLE_MICROS = {
  // Chicken
  'Chicken breast, raw':                  { fiber: 0,   sugar: 0,   satFat: 0.6,  sodium: 74  },
  'Chicken breast, cooked':               { fiber: 0,   sugar: 0,   satFat: 1.0,  sodium: 74  },
  'Chicken thigh, skinless, raw':         { fiber: 0,   sugar: 0,   satFat: 1.2,  sodium: 88  },
  'Chicken thigh, skinless, cooked':      { fiber: 0,   sugar: 0,   satFat: 2.3,  sodium: 88  },
  'Chicken thigh, skin-on, raw':          { fiber: 0,   sugar: 0,   satFat: 4.3,  sodium: 72  },
  'Chicken thigh, skin-on, cooked':       { fiber: 0,   sugar: 0,   satFat: 3.9,  sodium: 84  },
  'Chicken drumstick, cooked':            { fiber: 0,   sugar: 0,   satFat: 1.5,  sodium: 89  },
  'Chicken wing, cooked':                 { fiber: 0,   sugar: 0,   satFat: 2.3,  sodium: 92  },
  'Chicken mince, raw':                   { fiber: 0,   sugar: 0,   satFat: 2.3,  sodium: 70  },
  'Chicken mince, cooked':                { fiber: 0,   sugar: 0,   satFat: 2.5,  sodium: 75  },
  'Chicken, whole roast (meat only)':     { fiber: 0,   sugar: 0,   satFat: 2.1,  sodium: 86  },
  'Chicken tenderloin, raw':              { fiber: 0,   sugar: 0,   satFat: 0.4,  sodium: 60  },
  // Beef
  'Beef mince, lean, raw':                { fiber: 0,   sugar: 0,   satFat: 2.1,  sodium: 66  },
  'Beef mince, lean, cooked':             { fiber: 0,   sugar: 0,   satFat: 4.3,  sodium: 76  },
  'Beef sirloin steak, cooked':           { fiber: 0,   sugar: 0,   satFat: 3.6,  sodium: 51  },
  'Beef ribeye, cooked':                  { fiber: 0,   sugar: 0,   satFat: 8,    sodium: 54  },
  'Beef eye fillet, cooked':              { fiber: 0,   sugar: 0,   satFat: 2.6,  sodium: 52  },
  'Beef rump, cooked':                    { fiber: 0,   sugar: 0,   satFat: 3.2,  sodium: 54  },
  // Fish & seafood
  'Salmon fillet, raw':                   { fiber: 0,   sugar: 0,   satFat: 2,    sodium: 45  },
  'Salmon fillet, cooked':                { fiber: 0,   sugar: 0,   satFat: 3.1,  sodium: 59  },
  'Tuna in springwater':                  { fiber: 0,   sugar: 0,   satFat: 0.3,  sodium: 247 },
  'Tuna steak, fresh, cooked':            { fiber: 0,   sugar: 0,   satFat: 1.5,  sodium: 50  },
  'Hoki fillet, cooked':                  { fiber: 0,   sugar: 0,   satFat: 0.2,  sodium: 85  },
  'Tarakihi fillet, cooked':              { fiber: 0,   sugar: 0,   satFat: 0.4,  sodium: 80  },
  'Blue cod, cooked':                     { fiber: 0,   sugar: 0,   satFat: 0.2,  sodium: 90  },
  'Snapper, cooked':                      { fiber: 0,   sugar: 0,   satFat: 0.5,  sodium: 95  },
  'Prawns, cooked':                       { fiber: 0,   sugar: 0,   satFat: 0.1,  sodium: 160 },
  // Eggs & dairy
  'Egg, whole':                           { fiber: 0,   sugar: 0.7, satFat: 3.1,  sodium: 142 },
  'Egg white':                            { fiber: 0,   sugar: 0.7, satFat: 0,    sodium: 166 },
  'Cottage cheese, low fat':              { fiber: 0,   sugar: 3.4, satFat: 0.6,  sodium: 330 },
  'Greek yoghurt, plain':                 { fiber: 0,   sugar: 3.6, satFat: 0.3,  sodium: 36  },
  'Whey protein isolate':                 { fiber: 0,   sugar: 3,   satFat: 0.5,  sodium: 180 },
  // Carbs
  'White rice, cooked':                   { fiber: 0.4, sugar: 0.1, satFat: 0.1,  sodium: 1   },
  'Brown rice, cooked':                   { fiber: 1.8, sugar: 0.4, satFat: 0.2,  sodium: 7   },
  'Potato, boiled':                       { fiber: 1.8, sugar: 0.9, satFat: 0,    sodium: 4   },
  'Potato, baked':                        { fiber: 2.2, sugar: 1.2, satFat: 0,    sodium: 10  },
  'Kumara (sweet potato)':                { fiber: 3,   sugar: 4.2, satFat: 0,    sodium: 55  },
  'Rolled oats, dry':                     { fiber: 10,  sugar: 1,   satFat: 1.2,  sodium: 6   },
  'White bread':                          { fiber: 2.4, sugar: 5,   satFat: 0.7,  sodium: 491 },
  'Wholemeal bread':                      { fiber: 6,   sugar: 4,   satFat: 0.7,  sodium: 400 },
  'Pasta, cooked':                        { fiber: 1.8, sugar: 0.6, satFat: 0.2,  sodium: 6   },
  // Veg
  'Broccoli, raw':                        { fiber: 2.6, sugar: 1.7, satFat: 0,    sodium: 33  },
  'Carrot, raw':                          { fiber: 2.8, sugar: 4.7, satFat: 0,    sodium: 69  },
  'Spinach, raw':                         { fiber: 2.2, sugar: 0.4, satFat: 0.1,  sodium: 79  },
  'Tomato, raw':                          { fiber: 1.2, sugar: 2.6, satFat: 0,    sodium: 5   },
  'Capsicum (bell pepper)':               { fiber: 2.1, sugar: 4.2, satFat: 0,    sodium: 4   },
  'Cucumber':                             { fiber: 0.5, sugar: 1.7, satFat: 0,    sodium: 2   },
  'Mushrooms, raw':                       { fiber: 1,   sugar: 2,   satFat: 0,    sodium: 5   },
  // Fruit
  'Banana':                               { fiber: 2.6, sugar: 12,  satFat: 0.1,  sodium: 1   },
  'Apple':                                { fiber: 2.4, sugar: 10,  satFat: 0,    sodium: 1   },
  'Blueberries':                          { fiber: 2.4, sugar: 10,  satFat: 0,    sodium: 1   },
  'Strawberries':                         { fiber: 2,   sugar: 4.9, satFat: 0,    sodium: 1   },
  'Avocado':                              { fiber: 6.7, sugar: 0.7, satFat: 2.1,  sodium: 7   },
  // Fats & nuts
  'Almonds':                              { fiber: 12,  sugar: 4.4, satFat: 3.8,  sodium: 1   },
  'Peanut butter, natural':               { fiber: 6,   sugar: 9,   satFat: 10,   sodium: 17  },
  'Olive oil':                            { fiber: 0,   sugar: 0,   satFat: 14,   sodium: 2   },
  'Butter':                               { fiber: 0,   sugar: 0.1, satFat: 51,   sodium: 643 },
  // Dairy & drinks
  'Whole milk (blue top)':                { fiber: 0,   sugar: 4.8, satFat: 1.9,  sodium: 43  },
  'Trim milk (green top)':                { fiber: 0,   sugar: 5,   satFat: 0.1,  sodium: 42  },
  'Black coffee':                         { fiber: 0,   sugar: 0,   satFat: 0,    sodium: 2   },
  'Flat white (trim milk)':               { fiber: 0,   sugar: 4.5, satFat: 1,    sodium: 42  },
  'Tea, black (no milk)':                 { fiber: 0,   sugar: 0,   satFat: 0,    sodium: 3   },
};

function augmentStaple(s) {
  const m = STAPLE_MICROS[s.name];
  if (!m) return s;
  return { ...s, per100g: { ...s.per100g, ...m } };
}

function findStaples(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return STAPLES
    .filter(s => words.some(w => s.keywords.some(k => k.includes(w) || w.includes(k))))
    .map(augmentStaple);
}

// ----- Open Food Facts ---------------------------------------------------

// Drop entries that are mostly non-Latin (Korean/Arabic/etc) or don't
// match any query word — OFF returns global results and we want the
// ones actually relevant to what the user typed. Every query word must
// match via its variants (plural/typo tolerance).
function isRelevant(name, queryWords) {
  if (!name) return false;
  const asciiChars = [...name].filter(c => /[\x20-\x7E]/.test(c)).length;
  if (asciiChars / name.length < 0.85) return false;
  return nameMatchesQuery(name, queryWords);
}

function mapOffProduct(p) {
  const n = p.nutriments || {};
  const cal = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : null);
  const protein = n['proteins_100g'];
  const fat = n['fat_100g'];
  const carbs = n['carbohydrates_100g'];
  if (cal == null || protein == null || fat == null || carbs == null) return null;
  if (cal > 900) return null; // sanity check — no whole food is >900 cal/100g

  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name) return null;

  const brand = (p.brands || '').split(',')[0].trim();
  const unit = /ml|l$|liquid|drink|beverage/i.test(p.quantity || '') ? 'ml' : 'g';
  const defaultServing = typeof p.serving_quantity === 'number' ? p.serving_quantity : 100;

  const servings = [];
  if (p.serving_size && p.serving_quantity) {
    servings.push({ label: p.serving_size, grams: p.serving_quantity });
  }
  servings.push({ label: `100${unit}`, grams: 100 });

  // OFF stores sodium in grams; convert to mg to match NZFCD.
  const sodiumG = n['sodium_100g'];
  const sodiumMg = typeof sodiumG === 'number' ? sodiumG * 1000 : null;

  return {
    name,
    brand,
    per100g: {
      calories: r1(cal),
      protein: r1(protein),
      fat: r1(fat),
      carbs: r1(carbs),
      fiber:  typeof n['fiber_100g'] === 'number' ? r1(n['fiber_100g']) : null,
      sugar:  typeof n['sugars_100g'] === 'number' ? r1(n['sugars_100g']) : null,
      satFat: typeof n['saturated-fat_100g'] === 'number' ? r1(n['saturated-fat_100g']) : null,
      sodium: sodiumMg != null ? r1(sodiumMg) : null,
    },
    defaultServing,
    servingUnit: unit,
    servings,
  };
}

async function searchOpenFoodFacts(q) {
  // lc=en + English-speaking countries to skew toward NZ-relevant results.
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&lc=en&countries_tags_en=new-zealand,australia,united-kingdom,united-states&sort_by=popularity_key`;
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 4000);
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Vitals-App/1.0 (health tracker)' },
      signal: ctrl.signal,
    });
    if (!r.ok) return [];
    const data = await r.json();
    const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const products = (data.products || [])
      .map(mapOffProduct)
      .filter(Boolean)
      .filter(p => isRelevant(p.name, queryWords))
      .slice(0, 6);
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

// ----- Merge + dedupe ----------------------------------------------------

function merge(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const p of list) {
      const key = `${(p.name || '').toLowerCase()}|${(p.brand || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

// ----- Route -------------------------------------------------------------

// GET /api/foods/search?q=chicken breast
//
// Lookup order (fastest first):
//   1. STAPLES       — ~45 hand-curated whole foods (in-memory, instant)
//   2. NZFCD         — 1,278 Concise NZ Food Composition Tables entries
//                      (in-memory, instant, NZ-accurate with micros)
//   3. memCache      — previous network results this process has seen
//   4. Postgres cache — previous network results from any deploy
//   5. Open Food Facts — ~3M branded products (network, ~400ms)
//   6. Claude Haiku   — fallback for the long tail (network, ~2-3s)
//
// Staples + NZFCD are always computed fresh — they're code-owned data,
// cheap to run, and shouldn't poison the network cache.
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ products: [] });

    const key = normalize(q);
    const staples = findStaples(q);
    const nzfcd = searchNzfcd(q);

    // Re-apply relevance check to cached network results too — older
    // cache entries pre-date the filter and can contain Korean noodles,
    // French biscuits, etc. Defensive re-filtering on read is cheap and
    // means bad data gets weeded out even without cache invalidation.
    const queryWords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const filterCached = arr => (arr || []).filter(p => isRelevant(p.name, queryWords));

    // L1: in-memory (network results only)
    if (memCache.has(key)) {
      return res.json({ products: merge(staples, nzfcd, filterCached(memCache.get(key))), cached: 'mem' });
    }

    // L2: Postgres (network results only)
    const cached = await req.prisma.foodSearchCache.findUnique({ where: { query: key } }).catch(() => null);
    if (cached) {
      memSet(key, cached.results);
      return res.json({ products: merge(staples, nzfcd, filterCached(cached.results)), cached: 'db' });
    }

    // If we already have 5+ in-memory hits, skip the network entirely.
    const localHits = staples.length + nzfcd.length;
    if (localHits >= 5) {
      return res.json({ products: merge(staples, nzfcd), source: 'local' });
    }

    // L3: Open Food Facts for the long-tail branded stuff NZFCD misses.
    let offResults = await searchOpenFoodFacts(q);
    let source = 'openfoodfacts';

    // Fallback to Claude only when nothing local OR OFF answered.
    if (localHits === 0 && offResults.length === 0) {
      try {
        offResults = await searchClaude(q);
        source = 'claude';
      } catch (err) {
        console.error('Claude fallback failed:', err);
        offResults = [];
      }
    }

    // Cache the network half (local sources are code-owned, don't re-cache).
    if (offResults.length > 0) {
      memSet(key, offResults);
      await req.prisma.foodSearchCache.upsert({
        where: { query: key },
        create: { query: key, source, results: offResults },
        update: { source, results: offResults, updatedAt: new Date() },
      }).catch(err => console.warn('Cache write failed:', err.message));
    }

    res.json({ products: merge(staples, nzfcd, offResults), source });
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
