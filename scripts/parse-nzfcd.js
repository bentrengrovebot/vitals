// Parse the Concise NZ Food Composition Tables CSV -> nzfcd.json
//
// Input format:
//   Row 1: header (column names)
//   Row 2: blank
//   Row 3: units row (g, kJ, mg, µg)
//   Row 4: blank
//   Then interleaved:
//     - Category row:   "A,BAKERY PRODUCTS,,,..."       (FoodID = single letter, rest blank)
//     - Main food row:  "A1122,"Name",100,..."           (FoodID = letter + digits, Measure = 100)
//     - Serving row:    ",\"1 bagel (...)\",88.9,..."   (blank FoodID, Measure = grams)
//
// Output: array of { id, name, category, per100g: {...}, servings: [...] }

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '..', 'Concisen Tables 14th Edition wi-Table 1.csv');
const OUT_PATH = path.join(__dirname, '..', 'data', 'nzfcd.json');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// Turn a CSV numeric cell into a number or null.
// "trace" -> null (not zero — trace means "present in unmeasurable amounts")
// "" -> null
function num(v) {
  if (v == null || v === '' || v === 'trace') return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

// kJ -> kcal using the book's conversion (1 kcal = 4.18 kJ per Table 2 on page viii).
const kjToKcal = kj => kj == null ? null : Math.round((kj / 4.18) * 10) / 10;

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);

  // Resolve column indices from the header. Normalize inner whitespace
  // because the source has cells like "Sodium   Na" and trailing spaces.
  const norm = s => s.replace(/\s+/g, ' ').trim().toLowerCase();
  const headers = parseCsvLine(lines[0]).map(norm);
  const idx = name => {
    const want = norm(name);
    const i = headers.findIndex(h => h === want);
    if (i === -1) throw new Error(`Header not found: "${name}"`);
    return i;
  };

  const COL = {
    id:        idx('FoodID'),
    name:      idx('Short Food Name'),
    measure:   idx('Measure'),
    energy:    idx('Energy'),           // kJ
    energyN:   idx('Energy (NIP)'),     // kJ (package panel)
    protein:   idx('Protein'),
    fat:       idx('Fat'),
    carbs:     idx('Carbohydrate, available'),
    fiber:     idx('Dietary fibre'),
    sugar:     idx('Sugars'),
    satFat:    idx('SFA'),
    sodium:    idx('Sodium Na'),
    potassium: idx('Potassium K'),
  };

  const foods = [];
  let currentCategory = '';
  let current = null; // food currently accumulating servings

  for (let lineNo = 4; lineNo < lines.length; lineNo++) {
    const line = lines[lineNo];
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    if (row.length < 20) continue; // malformed

    const id = row[COL.id];
    const name = row[COL.name];

    // Category header: single-letter ID, no measure.
    if (id && /^[A-Z]$/.test(id) && !row[COL.measure]) {
      currentCategory = name;
      continue;
    }

    // Main food row: letter + digits and Measure = 100.
    if (id && /^[A-Z]\d+/.test(id)) {
      const energyKj = num(row[COL.energyN]) ?? num(row[COL.energy]);
      current = {
        id,
        name,
        category: currentCategory,
        per100g: {
          calories: kjToKcal(energyKj),
          protein:  num(row[COL.protein]),
          fat:      num(row[COL.fat]),
          carbs:    num(row[COL.carbs]),
          fiber:    num(row[COL.fiber]),
          sugar:    num(row[COL.sugar]),
          satFat:   num(row[COL.satFat]),
          sodium:   num(row[COL.sodium]),
          potassium: num(row[COL.potassium]),
        },
        servings: [{ label: '100g', grams: 100 }],
      };
      foods.push(current);
      continue;
    }

    // Serving row: blank ID, a description in Name, grams in Measure.
    if (!id && name && current) {
      const grams = num(row[COL.measure]);
      if (grams != null && grams > 0) {
        current.servings.push({ label: name, grams });
      }
    }
  }

  // Filter out foods that failed to capture core macros — these would break
  // the diary math if ever selected.
  const clean = foods.filter(f =>
    f.per100g.calories != null &&
    f.per100g.protein != null &&
    f.per100g.fat != null &&
    f.per100g.carbs != null
  );

  // Stable sort by id for diffable JSON output.
  clean.sort((a, b) => a.id.localeCompare(b.id));

  fs.writeFileSync(OUT_PATH, JSON.stringify(clean, null, 2));

  console.log(`Parsed ${foods.length} foods, ${clean.length} with complete macros.`);
  console.log(`Dropped ${foods.length - clean.length} for missing core macros.`);
  console.log(`Categories: ${[...new Set(clean.map(f => f.category))].length}`);
  console.log(`Output: ${OUT_PATH} (${(fs.statSync(OUT_PATH).size / 1024).toFixed(1)} KB)`);
}

main();
