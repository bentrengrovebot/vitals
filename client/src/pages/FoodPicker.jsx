import { useState, useEffect } from 'react';
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
  const [tab, setTab] = useState('recipes');
  const [search, setSearch] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.getRecipes().then(setRecipes);
    // Get recent entries (last 30 days)
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    api.getDiaryRange(start, end).then(entries => {
      const seen = new Set();
      const deduped = [];
      entries.forEach(e => {
        if (!seen.has(e.name)) {
          seen.add(e.name);
          deduped.push(e);
        }
      });
      setRecent(deduped.slice(0, 20));
    });
  }, []);

  async function addItem(item) {
    await api.addDiaryEntry({
      date, slot,
      name: item.name,
      portion: item.portion,
      calories: item.cal || item.calories,
      proteinG: item.protein || item.proteinG,
      fatG: item.fat || item.fatG,
      carbsG: item.carbs || item.carbsG,
    });
    onBack();
  }

  const pill = (active) => ({
    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: active ? '1px solid #2dba8e' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(45,186,142,0.15)' : 'rgba(255,255,255,0.05)',
    color: active ? '#2dba8e' : '#8b949e',
  });
  const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#232a33', fontSize: 15, boxSizing: 'border-box', color: '#ffffff' };
  const t2 = '#8b949e', t3 = '#484f58', ac = '#2dba8e', brd = 'rgba(255,255,255,0.08)';

  const filterItems = (items, getName) => {
    if (!search) return items;
    return items.filter(i => getName(i).toLowerCase().includes(search.toLowerCase()));
  };

  return (
    <div style={{ paddingBottom: 20, background: '#191d21', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: t2, fontSize: 22 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 700, flex: 1, color: '#ffffff' }}>Add to {slot}</div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ ...inp, marginBottom: 14 }} autoFocus />
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[{ id: 'recipes', l: 'Recipes' }, { id: 'foods', l: 'Foods' }, { id: 'recent', l: 'Recent' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={pill(tab === t.id)}>{t.l}</button>
          ))}
        </div>

        {tab === 'recipes' && (
          <>
            {filterItems(recipes, r => r.name).map(r => {
              const ps = recipeNutrition(r);
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${brd}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: t2, marginTop: 2 }}>{ps.cal} cal · {ps.protein}g P · {ps.fat}g F · {ps.carbs}g C</div>
                  </div>
                  <button onClick={() => addItem({ name: r.name, cal: ps.cal, protein: ps.protein, fat: ps.fat, carbs: ps.carbs, portion: `1/${r.servings} serve` })}
                    style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(45,186,142,0.15)', border: 'none', color: ac, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
              );
            })}
            {!recipes.length && <div style={{ color: t3, fontSize: 14, padding: 24, textAlign: 'center' }}>No recipes yet.</div>}
          </>
        )}

        {tab === 'foods' && (
          <div style={{ color: t3, fontSize: 14, padding: 24, textAlign: 'center' }}>No custom foods yet. Create them in Settings.</div>
        )}

        {tab === 'recent' && (
          <>
            {filterItems(recent, r => r.name).map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${brd}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#ffffff' }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: t2 }}>{item.calories} cal · {item.proteinG}g P</div>
                </div>
                <button onClick={() => addItem({ name: item.name, cal: item.calories, protein: item.proteinG, fat: item.fatG, carbs: item.carbsG, portion: item.portion })}
                  style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(45,186,142,0.15)', border: 'none', color: ac, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            ))}
            {!recent.length && <div style={{ color: t3, fontSize: 14, padding: 24, textAlign: 'center' }}>No recent entries.</div>}
          </>
        )}
      </div>
    </div>
  );
}
