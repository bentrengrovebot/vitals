import { useState, useRef } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;

export default function RecipeEdit({ recipe, onBack }) {
  const [rec, setRec] = useState({
    id: recipe?.id || null,
    name: recipe?.name || '',
    servings: recipe?.servings || 1,
    ingredients: (recipe?.ingredients || []).map(i => ({
      name: i.name, grams: i.grams, calories: i.calories, proteinG: i.proteinG, fatG: i.fatG, carbsG: i.carbsG,
    })),
  });
  const [addIng, setAddIng] = useState(false);
  const [ingF, setIngF] = useState({ name: '', grams: '', cal: '', protein: '', fat: '', carbs: '' });
  const [est, setEst] = useState(false);
  const [del, setDel] = useState(false);
  // Bulk import: paste recipe text or upload a photo, AI parses into ingredients.
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importErr, setImportErr] = useState('');
  const fileInputRef = useRef(null);

  async function runImport(payload) {
    setImportBusy(true);
    setImportErr('');
    try {
      const parsed = await api.parseRecipe(payload);
      const newIngredients = (parsed.ingredients || []).map(i => ({
        name: i.name,
        grams: parseFloat(i.grams) || 0,
        calories: parseFloat(i.calories) || 0,
        proteinG: parseFloat(i.protein) || 0,
        fatG: parseFloat(i.fat) || 0,
        carbsG: parseFloat(i.carbs) || 0,
      }));
      setRec(r => ({
        ...r,
        name: r.name || parsed.name || '',
        servings: parsed.servings || r.servings || 1,
        ingredients: [...r.ingredients, ...newIngredients],
      }));
      setImportOpen(false);
      setImportText('');
    } catch (err) {
      setImportErr(err?.message || 'Parse failed. Try pasting the ingredients list more explicitly.');
    }
    setImportBusy(false);
  }

  function onPhotoPicked(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Strip the data URL prefix → pure base64.
      const b64 = String(reader.result).split(',')[1];
      runImport({ imageBase64: b64, imageMediaType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  }

  const perServe = () => {
    if (!rec.ingredients.length) return { cal: 0, protein: 0, fat: 0, carbs: 0 };
    const t = rec.ingredients.reduce((a, i) => ({
      cal: a.cal + (i.calories || 0), protein: a.protein + (i.proteinG || 0),
      fat: a.fat + (i.fatG || 0), carbs: a.carbs + (i.carbsG || 0),
    }), { cal: 0, protein: 0, fat: 0, carbs: 0 });
    const s = rec.servings || 1;
    return { cal: r1(t.cal / s), protein: r1(t.protein / s), fat: r1(t.fat / s), carbs: r1(t.carbs / s) };
  };

  const estimateNutrition = async () => {
    if (!ingF.name || !ingF.grams) return;
    setEst(true);
    try {
      // Pass the raw amount string — api.estimate routes to the
      // natural-language path when it's non-numeric ("½ cup").
      const data = await api.estimate(ingF.name, ingF.grams);
      setIngF(f => ({
        ...f,
        // If the AI resolved a free-form amount to grams, swap the
        // input to the numeric value so the ingredient saves correctly.
        grams: data.grams != null ? String(data.grams) : f.grams,
        cal: String(data.cal || 0),
        protein: String(data.protein || 0),
        fat: String(data.fat || 0),
        carbs: String(data.carbs || 0),
      }));
    } catch (e) { console.error(e); }
    setEst(false);
  };

  const addIngredient = () => {
    if (!ingF.name || !ingF.grams) return;
    setRec(r => ({
      ...r,
      ingredients: [...r.ingredients, {
        name: ingF.name, grams: parseFloat(ingF.grams) || 0,
        calories: parseFloat(ingF.cal) || 0, proteinG: parseFloat(ingF.protein) || 0,
        fatG: parseFloat(ingF.fat) || 0, carbsG: parseFloat(ingF.carbs) || 0,
      }],
    }));
    setIngF({ name: '', grams: '', cal: '', protein: '', fat: '', carbs: '' });
    setAddIng(false);
  };

  const save = async () => {
    const data = { name: rec.name, servings: rec.servings, ingredients: rec.ingredients };
    if (rec.id) {
      await api.updateRecipe(rec.id, data);
    } else {
      await api.createRecipe(data);
    }
    onBack();
  };

  const deleteRecipe = async () => {
    if (rec.id) await api.deleteRecipe(rec.id);
    onBack();
  };

  const ps = perServe();
  const card = { background: '#ffffff', borderRadius: 16, border: '1px solid #e5e5e7' };
  const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 15, boxSizing: 'border-box', color: '#1a1a1a' };
  const ac = '#E53935', or = '#FFA726', rd = '#E53935', t1 = '#212121', t2 = '#757575', t3 = '#BDBDBD', brd = '#EEEEEE';

  return (
    <div style={{ paddingBottom: 100, background: '#f5f5f7', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 'calc(env(safe-area-inset-top, 16px) + 8px) 20px 16px', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: t2, fontSize: 22 }}>←</button>
        <div style={{ fontSize: 17, fontWeight: 700, flex: 1, color: t1 }}>{rec.name || 'New Recipe'}</div>
        <button onClick={save} style={{ padding: '10px 18px', borderRadius: 12, background: ac, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }}>Save</button>
      </div>
      <div style={{ padding: '0 20px' }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Name</label>
        <input value={rec.name} onChange={e => setRec(r => ({ ...r, name: e.target.value }))} placeholder="e.g. Cottage snack" style={{ ...inp, marginTop: 4, marginBottom: 14 }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Servings</label>
        <input type="number" value={rec.servings} onChange={e => setRec(r => ({ ...r, servings: Math.max(1, parseInt(e.target.value) || 1) }))} style={{ ...inp, marginTop: 4, marginBottom: 16, width: 80 }} />

        {/* Bulk import — skip typing every ingredient by hand */}
        <div style={{ ...card, padding: 14, marginBottom: 16, background: 'linear-gradient(135deg, rgba(224,165,38,0.08) 0%, rgba(229,57,53,0.06) 100%)', border: `1px solid rgba(224,165,38,0.2)` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t1, marginBottom: 4 }}>✨ Import recipe</div>
          <div style={{ fontSize: 11, color: t2, marginBottom: 10 }}>Paste ingredients from a website, copy from another app, or snap a photo of a cookbook page. AI parses and fills in everything.</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setImportOpen(true)} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid rgba(224,165,38,0.3)`, background: '#fff', color: or, fontSize: 13, fontWeight: 700 }}>📋 Paste</button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importBusy} style={{ flex: 1, padding: 12, borderRadius: 10, border: `1px solid rgba(224,165,38,0.3)`, background: '#fff', color: importBusy ? t3 : or, fontSize: 13, fontWeight: 700 }}>{importBusy ? 'Reading…' : '📷 Photo / Image'}</button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onPhotoPicked} style={{ display: 'none' }} />
          </div>
          {importErr && <div style={{ fontSize: 11, color: rd, marginTop: 8 }}>{importErr}</div>}
        </div>

        {/* Paste modal */}
        {importOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => !importBusy && setImportOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 20, width: '100%', maxWidth: 500, borderRadius: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t1, marginBottom: 6 }}>Paste recipe</div>
              <div style={{ fontSize: 12, color: t2, marginBottom: 12 }}>Paste ingredients (and name + servings if you have them). Claude will figure out grams, calories, and macros per item.</div>
              <textarea
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={`e.g.

Cottage cheese pancakes (serves 2)

- 1 cup cottage cheese
- 2 eggs
- ½ cup rolled oats
- 1 tsp vanilla
- 1 tbsp honey`}
                style={{ width: '100%', minHeight: 180, padding: 12, borderRadius: 10, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 14, color: t1, boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', marginBottom: 12 }}
              />
              {importErr && <div style={{ fontSize: 12, color: rd, marginBottom: 10 }}>{importErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setImportOpen(false)} disabled={importBusy} style={{ flex: 1, padding: 14, borderRadius: 12, border: `1.5px solid ${brd}`, background: '#fff', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                <button onClick={() => runImport({ text: importText })} disabled={importBusy || !importText.trim()} style={{ flex: 2, padding: 14, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 700, opacity: importBusy || !importText.trim() ? 0.5 : 1 }}>{importBusy ? 'Parsing…' : '✨ Parse'}</button>
              </div>
            </div>
          </div>
        )}

        {rec.ingredients.length > 0 && (
          <div style={{ ...card, padding: '16px 18px', marginBottom: 16, background: 'linear-gradient(135deg,#E53935,#C62828)', color: '#fff', border: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Per Serve</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div><span style={{ fontSize: 24, fontWeight: 800 }}>{ps.cal}</span> <span style={{ fontSize: 12, opacity: 0.6 }}>Cal</span></div>
              <div><span style={{ fontSize: 18, fontWeight: 700 }}>{ps.protein}g</span> <span style={{ fontSize: 11, opacity: 0.6 }}>P</span></div>
              <div><span style={{ fontSize: 18, fontWeight: 700 }}>{ps.fat}g</span> <span style={{ fontSize: 11, opacity: 0.6 }}>F</span></div>
              <div><span style={{ fontSize: 18, fontWeight: 700 }}>{ps.carbs}g</span> <span style={{ fontSize: 11, opacity: 0.6 }}>C</span></div>
            </div>
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 }}>Ingredients</div>
        {rec.ingredients.map((ing, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${brd}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t1 }}>{ing.name}</div>
              <div style={{ fontSize: 12, color: t2 }}>{ing.grams}g · {ing.calories}cal · {ing.proteinG}g P · {ing.fatG}g F · {ing.carbsG}g C</div>
            </div>
            <button onClick={() => setRec(r => ({ ...r, ingredients: r.ingredients.filter((_, idx) => idx !== i) }))} style={{ background: 'none', border: 'none', color: t3, fontSize: 18 }}>×</button>
          </div>
        ))}

        {addIng ? (
          <div style={{ ...card, padding: 18, marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: t1 }}>Add Ingredient</div>
            <input value={ingF.name} onChange={e => setIngF(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Anchor Cottage Cheese" style={{ ...inp, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input type="text" inputMode="decimal" value={ingF.grams} onChange={e => setIngF(f => ({ ...f, grams: e.target.value }))} placeholder="½ cup, 150g, 2 tbsp…" style={{ ...inp, flex: 1 }} />
              <button onClick={estimateNutrition} disabled={!ingF.name || !ingF.grams || est}
                style={{ padding: '12px 16px', borderRadius: 12, border: `1px solid rgba(224,165,38,0.3)`, background: 'rgba(224,165,38,0.1)', color: ingF.name && ingF.grams ? or : t3, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {est ? '...' : '✨ AI'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
              {['cal', 'protein', 'fat', 'carbs'].map(k => (
                <div key={k}>
                  <label style={{ fontSize: 10, color: t2, fontWeight: 600, textTransform: 'uppercase' }}>{k}</label>
                  <input type="number" value={ingF[k]} onChange={e => setIngF(f => ({ ...f, [k]: e.target.value }))} style={{ ...inp, padding: '10px 8px', fontSize: 14, marginTop: 2 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setAddIng(false); setIngF({ name: '', grams: '', cal: '', protein: '', fat: '', carbs: '' }); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${brd}`, background: '#ffffff', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={addIngredient} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 700 }}>Add</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddIng(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 0', background: 'none', border: 'none', color: ac, fontSize: 14, fontWeight: 600 }}>+ Add ingredient</button>
        )}

        {rec.id && (
          <button onClick={deleteRecipe} style={{ marginTop: 24, padding: 12, borderRadius: 12, border: `1px solid rgba(248,81,73,0.3)`, background: 'rgba(248,81,73,0.08)', color: rd, fontSize: 14, fontWeight: 600, width: '100%' }}>Delete Recipe</button>
        )}
      </div>
    </div>
  );
}
