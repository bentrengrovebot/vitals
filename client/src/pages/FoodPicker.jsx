import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

function recipeNutrition(rec) {
  if (!rec?.ingredients?.length) return { cal: 0, protein: 0, fat: 0, carbs: 0 };
  const t = rec.ingredients.reduce((a, i) => ({
    cal: a.cal + (i.calories || 0), protein: a.protein + (i.proteinG || 0),
    fat: a.fat + (i.fatG || 0), carbs: a.carbs + (i.carbsG || 0),
  }), { cal: 0, protein: 0, fat: 0, carbs: 0 });
  const s = rec.servings || 1;
  return { cal: r1(t.cal / s), protein: r1(t.protein / s), fat: r1(t.fat / s), carbs: r1(t.carbs / s) };
}

export default function FoodPicker({ slot, date, onBack }) {
  const [tab, setTab] = useState('search');
  const [search, setSearch] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [myFoods, setMyFoods] = useState([]);
  const [recent, setRecent] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [selectedMyFood, setSelectedMyFood] = useState(null);
  const [myFoodServings, setMyFoodServings] = useState('1');
  const [grams, setGrams] = useState('100');
  const searchTimer = useRef(null);
  // In-memory cache: normalized query -> products. Shrinks the
  // perceived latency to zero on same-session repeat searches.
  const searchCache = useRef(new Map());

  useEffect(() => {
    api.getRecipes().then(setRecipes);
    api.getMyFoods().then(setMyFoods);
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    api.getDiaryRange(start, end).then(entries => {
      const seen = new Set();
      const deduped = [];
      entries.forEach(e => {
        if (!seen.has(e.name)) { seen.add(e.name); deduped.push(e); }
      });
      setRecent(deduped.slice(0, 20));
    });
  }, []);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search' || search.length < 2) { setResults([]); return; }
    const key = search.trim().toLowerCase().replace(/\s+/g, ' ');
    if (searchCache.current.has(key)) {
      setResults(searchCache.current.get(key));
      setSearching(false);
      return;
    }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.searchFoods(search);
        const products = data.products || [];
        searchCache.current.set(key, products);
        setResults(products);
      } catch { setResults([]); }
      setSearching(false);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search, tab]);

  async function addItem(item) {
    try {
      await api.addDiaryEntry({
        date, slot,
        name: item.name,
        portion: item.portion,
        calories: item.cal ?? item.calories ?? 0,
        proteinG: item.protein ?? item.proteinG ?? 0,
        fatG: item.fat ?? item.fatG ?? 0,
        carbsG: item.carbs ?? item.carbsG ?? 0,
        fiberG: item.fiber ?? item.fiberG ?? null,
        satFatG: item.satFat ?? item.satFatG ?? null,
        sugarG: item.sugar ?? item.sugarG ?? null,
        sodiumMg: item.sodium ?? item.sodiumMg ?? null,
      });
      onBack();
    } catch (err) {
      console.error('Failed to add diary entry:', err);
      alert('Could not add food. Please try again.');
    }
  }

  function selectDbFood(product) {
    setSelectedFood(product);
    setGrams(String(product.defaultServing || 100));
  }

  function addDbFood() {
    if (!selectedFood) return;
    const g = parseFloat(grams) || 100;
    const mult = g / 100;
    const unit = selectedFood.servingUnit || 'g';
    const p = selectedFood.per100g;
    const scale = v => v == null ? null : r1(v * mult);
    addItem({
      name: `${selectedFood.name}${selectedFood.brand ? ` (${selectedFood.brand})` : ''}`,
      portion: `${g}${unit}`,
      cal: scale(p.calories),
      protein: scale(p.protein),
      fat: scale(p.fat),
      carbs: scale(p.carbs),
      fiber: scale(p.fiber),
      satFat: scale(p.satFat),
      sugar: scale(p.sugar),
      sodium: scale(p.sodium),
    });
  }

  const pill = (active) => ({
    padding: '7px 16px', borderRadius: 16, fontSize: 12, fontWeight: 500,
    border: active ? '1px solid #E53935' : '1px solid #e5e5e7',
    background: active ? 'rgba(45,186,142,0.1)' : '#f0f0f2',
    color: active ? '#E53935' : '#6b7280',
  });
  const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 15, boxSizing: 'border-box', color: '#1a1a1a' };
  const t2 = '#6b7280', t3 = '#9ca3af', ac = '#E53935', brd = '#e5e5e7';

  return (
    <div style={{ paddingBottom: 100, background: '#f5f5f7', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top, 16px) + 8px) 20px 16px', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: t2, fontSize: 22 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 600, flex: 1, color: '#1a1a1a' }}>Add to {slot}</div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search foods..." style={{ ...inp, marginBottom: 14 }} autoFocus />
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{ id: 'search', l: 'Search' }, { id: 'myfoods', l: 'My Foods' }, { id: 'recipes', l: 'Recipes' }, { id: 'recent', l: 'Recent' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={pill(tab === t.id)}>{t.l}</button>
          ))}
        </div>

        {/* Food portion modal */}
        {selectedFood && (
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: 18, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>{selectedFood.name}</div>
            {selectedFood.brand && <div style={{ fontSize: 12, color: t2, marginBottom: 10 }}>{selectedFood.brand}</div>}
            <div style={{ fontSize: 11, color: t2, marginBottom: 12 }}>
              Per 100{selectedFood.servingUnit || 'g'}: {selectedFood.per100g.calories} cal · {selectedFood.per100g.protein}g P · {selectedFood.per100g.fat}g F · {selectedFood.per100g.carbs}g C
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 10, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>{selectedFood.servingUnit === 'ml' ? 'ml' : 'Grams'}</label>
                <input type="number" value={grams} onChange={e => setGrams(e.target.value)} style={{ ...inp, marginTop: 4 }} />
              </div>
              <div style={{ flex: 1.5, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-end' }}>
                {(selectedFood.servings || []).map((s, i) => (
                  <button key={i} onClick={() => setGrams(String(s.grams))} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${brd}`, background: grams === String(s.grams) ? ac + '14' : '#f5f5f5', color: grams === String(s.grams) ? ac : t2, fontSize: 10, fontWeight: 600 }}>{s.label}</button>
                ))}
                {(!selectedFood.servings || !selectedFood.servings.length) && [50, 100, 150, 200].map(g => {
                  const unit = selectedFood.servingUnit || 'g';
                  return (
                    <button key={g} onClick={() => setGrams(String(g))} style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${brd}`, background: grams === String(g) ? ac + '14' : '#f5f5f5', color: grams === String(g) ? ac : t2, fontSize: 10, fontWeight: 600 }}>{g}{unit}</button>
                  );
                })}
              </div>
            </div>
            {/* Preview with selected grams */}
            {(() => {
              const g = parseFloat(grams) || 100;
              const mult = g / 100;
              return (
                <div style={{ background: '#f0f0f2', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{r1(selectedFood.per100g.calories * mult)}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase', letterSpacing: 0.5 }}>cal</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#e0a526' }}>{r1(selectedFood.per100g.protein * mult)}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase', letterSpacing: 0.5 }}>protein</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#E53935' }}>{r1(selectedFood.per100g.fat * mult)}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase', letterSpacing: 0.5 }}>fat</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#8b5ef6' }}>{r1(selectedFood.per100g.carbs * mult)}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase', letterSpacing: 0.5 }}>carbs</div></div>
                </div>
              );
            })()}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedFood(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', color: '#1a1a1a', fontSize: 14, fontWeight: 500 }}>Cancel</button>
              <button onClick={addDbFood} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 600 }}>Add</button>
            </div>
          </div>
        )}

        {/* Search results */}
        {tab === 'search' && (
          <>
            {searching && <div style={{ color: t2, fontSize: 13, padding: 20, textAlign: 'center' }}>Searching...</div>}
            {!searching && search.length >= 2 && results.length === 0 && (
              <div style={{ color: t3, fontSize: 13, padding: 20, textAlign: 'center' }}>No results. Try a different search term.</div>
            )}
            {!searching && search.length < 2 && (
              <div style={{ color: t3, fontSize: 13, padding: 20, textAlign: 'center' }}>Type to search foods from the database</div>
            )}
            {results.map((p, idx) => (
              <button key={idx} onClick={() => selectDbFood(p)} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${brd}`, width: '100%', background: 'none', border: 'none', borderBottom: `1px solid ${brd}`, textAlign: 'left', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#5b9ef0' }}>{p.per100g.calories}🔥</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#e0a526' }}>{p.per100g.protein}P</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#E53935' }}>{p.per100g.fat}F</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#8b5ef6' }}>{p.per100g.carbs}C</span>
                    {p.brand && <span style={{ fontSize: 10, color: t3 }}>· {p.brand}</span>}
                    <span style={{ fontSize: 10, color: t3 }}>/ 100{p.servingUnit || 'g'}</span>
                  </div>
                </div>
                <span style={{ color: t3, fontSize: 14, flexShrink: 0 }}>›</span>
              </button>
            ))}
          </>
        )}

        {/* Recipes */}
        {/* My Foods */}
        {tab === 'myfoods' && (
          <>
            {/* My Food portion picker */}
            {selectedMyFood && (() => {
              const s = parseFloat(myFoodServings) || 1;
              const cal = r1(selectedMyFood.calories * s);
              const pro = r1(selectedMyFood.proteinG * s);
              const fat = r1(selectedMyFood.fatG * s);
              const carb = r1(selectedMyFood.carbsG * s);
              return (
                <div style={{ background: '#fff', border: `1px solid ${brd}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#212121', marginBottom: 4 }}>{selectedMyFood.name}</div>
                  <div style={{ fontSize: 11, color: t2, marginBottom: 12 }}>Per {selectedMyFood.servingSize}{selectedMyFood.unit}: {selectedMyFood.calories} cal · {selectedMyFood.proteinG}P · {selectedMyFood.fatG}F · {selectedMyFood.carbsG}C</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: t2, textTransform: 'uppercase' }}>Servings</label>
                      <input type="number" value={myFoodServings} onChange={e => setMyFoodServings(e.target.value)} step="0.5" style={{ ...inp, marginTop: 4 }} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4, alignContent: 'flex-end' }}>
                      {[0.5, 1, 1.5, 2].map(v => (
                        <button key={v} onClick={() => setMyFoodServings(String(v))} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${brd}`, background: myFoodServings === String(v) ? ac + '14' : '#f5f5f5', color: myFoodServings === String(v) ? ac : t2, fontSize: 11, fontWeight: 600 }}>{v}×</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: '#f5f5f5', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-around' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#42A5F5' }}>{cal}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase' }}>cal</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#E53935' }}>{pro}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase' }}>P</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#FFA726' }}>{fat}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase' }}>F</div></div>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 18, fontWeight: 700, color: '#66BB6A' }}>{carb}</div><div style={{ fontSize: 9, color: t2, textTransform: 'uppercase' }}>C</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setSelectedMyFood(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${brd}`, background: '#fff', color: '#212121', fontSize: 14, fontWeight: 500 }}>Cancel</button>
                    <button onClick={() => { addItem({ name: selectedMyFood.name, cal, protein: pro, fat, carbs: carb, portion: `${r1(selectedMyFood.servingSize * s)}${selectedMyFood.unit}` }); setSelectedMyFood(null); setMyFoodServings('1'); }}
                      style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 600 }}>Add</button>
                  </div>
                </div>
              );
            })()}
            {myFoods.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase())).map(f => (
              <div key={f.id} onClick={() => { setSelectedMyFood(f); setMyFoodServings('1'); }} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${brd}`, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#212121' }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: t2, marginTop: 2 }}>{f.servingSize}{f.unit} · {f.calories} cal · {f.proteinG}g P · {f.fatG}g F · {f.carbsG}g C</div>
                </div>
                <span style={{ color: ac, fontSize: 18 }}>›</span>
              </div>
            ))}
            {!myFoods.length && <div style={{ color: t3, fontSize: 13, padding: 24, textAlign: 'center' }}>No custom foods yet. Create them in Settings.</div>}
          </>
        )}

        {tab === 'recipes' && (
          <>
            {recipes.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map(r => {
              const ps = recipeNutrition(r);
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${brd}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: t2, marginTop: 2 }}>{ps.cal} cal · {ps.protein}g P · {ps.fat}g F · {ps.carbs}g C</div>
                  </div>
                  <button onClick={() => addItem({ name: r.name, cal: ps.cal, protein: ps.protein, fat: ps.fat, carbs: ps.carbs, portion: `1/${r.servings} serve` })}
                    style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(45,186,142,0.12)', border: 'none', color: ac, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              );
            })}
            {!recipes.length && <div style={{ color: t3, fontSize: 13, padding: 24, textAlign: 'center' }}>No recipes yet. Create them in More → Recipes.</div>}
          </>
        )}

        {/* Recent */}
        {tab === 'recent' && (
          <>
            {recent.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase())).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${brd}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: t2 }}>{item.calories} cal · {item.proteinG}g P</div>
                </div>
                <button onClick={() => addItem({ name: item.name, cal: item.calories, protein: item.proteinG, fat: item.fatG, carbs: item.carbsG, portion: item.portion })}
                  style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(45,186,142,0.12)', border: 'none', color: ac, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            ))}
            {!recent.length && <div style={{ color: t3, fontSize: 13, padding: 24, textAlign: 'center' }}>No recent entries.</div>}
          </>
        )}
      </div>
    </div>
  );
}
