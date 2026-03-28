import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;

function recipeNutrition(rec) {
  if (!rec?.ingredients?.length) return { cal: 0, protein: 0, fat: 0, carbs: 0 };
  const t = rec.ingredients.reduce((a, i) => ({
    cal: a.cal + (i.calories || 0), protein: a.protein + (i.proteinG || 0),
    fat: a.fat + (i.fatG || 0), carbs: a.carbs + (i.carbsG || 0),
  }), { cal: 0, protein: 0, fat: 0, carbs: 0 });
  const s = rec.servings || 1;
  return { cal: r1(t.cal / s), protein: r1(t.protein / s), fat: r1(t.fat / s), carbs: r1(t.carbs / s) };
}

export default function Recipes({ onEdit, goTo }) {
  const [recipes, setRecipes] = useState([]);

  useEffect(() => { api.getRecipes().then(setRecipes); }, []);

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
  const t2 = '#6b7280', ac = '#3b82f6';

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 20, gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>Recipes</div>
        <button onClick={() => onEdit({ id: null, name: '', servings: 1, ingredients: [] })}
          style={{ padding: '10px 18px', borderRadius: 12, background: ac, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }}>+ New</button>
      </div>
      <div style={{ padding: '0 20px' }}>
        {recipes.map(r => {
          const ps = recipeNutrition(r);
          return (
            <div key={r.id} onClick={() => onEdit(r)} style={{ ...card, padding: '16px 18px', marginBottom: 10, cursor: 'pointer' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{r.name || 'Untitled'}</div>
              <div style={{ fontSize: 12, color: t2, marginTop: 4 }}>{r.servings} serve{r.servings !== 1 ? 's' : ''} · {ps.cal} cal · {ps.protein}g P</div>
            </div>
          );
        })}
        {!recipes.length && <div style={{ color: '#9ca3af', fontSize: 14, padding: 30, textAlign: 'center' }}>No recipes yet.</div>}
      </div>
    </div>
  );
}
