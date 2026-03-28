import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const r1 = n => Math.round(n * 10) / 10;
const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden' };
const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#232a33', fontSize: 15, boxSizing: 'border-box', color: '#e8ecf1' };
const t1 = '#e8ecf1', t2 = 'rgba(255,255,255,0.45)', t3 = 'rgba(255,255,255,0.2)', ac = '#2dba8e';

function recipeNutrition(rec) {
  if (!rec?.ingredients?.length) return { cal: 0, protein: 0, fat: 0, carbs: 0 };
  const t = rec.ingredients.reduce((a, i) => ({
    cal: a.cal + (i.calories || 0), protein: a.protein + (i.proteinG || 0),
    fat: a.fat + (i.fatG || 0), carbs: a.carbs + (i.carbsG || 0),
  }), { cal: 0, protein: 0, fat: 0, carbs: 0 });
  const s = rec.servings || 1;
  return { cal: r1(t.cal / s), protein: r1(t.protein / s), fat: r1(t.fat / s), carbs: r1(t.carbs / s) };
}

export default function More({ goTo, onRefresh, openRecipeEdit }) {
  const { logout } = useAuth();
  const [section, setSection] = useState(null); // null = menu, or 'profile','goals','recipes','supps','weight','data'
  const [profile, setProfile] = useState({ name: '', dob: '', sex: 'Male', heightCm: '', weightKg: '', weightGoalKg: '' });
  const [goals, setGoals] = useState({ calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 });
  const [supplements, setSupplements] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [weighIns, setWeighIns] = useState([]);
  const [wiVal, setWiVal] = useState('');
  const [suppForm, setSuppForm] = useState({ name: '', ingredient: '', dose: '' });
  const [addingSupp, setAddingSupp] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => {
    Promise.all([api.getProfile(), api.getGoals(), api.getSupplements(), api.getRecipes(), api.getWeighIns(30)])
      .then(([p, g, s, r, w]) => {
        if (p) setProfile({ name: p.name || '', dob: p.dob ? p.dob.split('T')[0] : '', sex: p.sex || 'Male', heightCm: p.heightCm || '', weightKg: p.weightKg || '', weightGoalKg: p.weightGoalKg || '' });
        if (g) setGoals({ calories: g.calories, proteinG: g.proteinG, fatG: g.fatG, carbsG: g.carbsG, waterMl: g.waterMl || 2500 });
        setSupplements(s); setRecipes(r); setWeighIns(w);
      });
  }, []);

  function flash(msg) { setSaved(msg); setTimeout(() => setSaved(''), 2000); }

  const menuItem = (label, subtitle, onClick) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '18px 18px', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)', color: t1 }}>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
        {subtitle && <div style={{ fontSize: 11, color: t2, marginTop: 2, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>{subtitle}</div>}
      </div>
      <span style={{ color: t3, fontSize: 16 }}>›</span>
    </button>
  );

  const backBtn = (
    <button onClick={() => setSection(null)} style={{ background: 'none', border: 'none', color: t2, fontSize: 22, padding: '0 4px' }}>←</button>
  );

  const saveBtn = (label, onClick) => (
    <button onClick={onClick} style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: ac, color: '#fff', fontSize: 15, fontWeight: 700, marginTop: 8 }}>{label}</button>
  );

  // Main menu
  if (!section) return (
    <div style={{ paddingBottom: 92 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: t1, letterSpacing: -0.3 }}>More</div>
        <button onClick={logout} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: t2, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Logout</button>
      </div>

      {saved && <div style={{ margin: '8px 16px', padding: '10px 16px', borderRadius: 12, background: 'rgba(45,186,142,0.12)', color: ac, fontSize: 14, fontWeight: 600 }}>{saved}</div>}

      <div style={{ ...card, marginTop: 12 }}>
        {menuItem('Profile', profile.name || 'Set up your profile', () => setSection('profile'))}
        {menuItem('Goals', `${goals.calories} cal · ${goals.proteinG}g P`, () => setSection('goals'))}
        {menuItem('Recipes', `${recipes.length} recipes`, () => setSection('recipes'))}
        {menuItem('Supplements', `${supplements.filter(s => s.isActive).length} active`, () => setSection('supps'))}
        {menuItem('Log Weight', weighIns.length > 0 ? `${weighIns[0].weightKg}kg` : 'No weigh-ins', () => setSection('weight'))}
      </div>

      <div style={{ ...card, marginTop: 8 }}>
        {menuItem('Data', 'Export or clear data', () => setSection('data'))}
      </div>
    </div>
  );

  // Sub-sections
  return (
    <div style={{ paddingBottom: 92 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
        {backBtn}
        <div style={{ fontSize: 18, fontWeight: 800, color: t1, letterSpacing: -0.3, flex: 1 }}>{section === 'profile' ? 'Profile' : section === 'goals' ? 'Goals' : section === 'recipes' ? 'Recipes' : section === 'supps' ? 'Supplements' : section === 'weight' ? 'Log Weight' : 'Data'}</div>
      </div>

      {saved && <div style={{ margin: '0 16px 12px', padding: '10px 16px', borderRadius: 12, background: 'rgba(45,186,142,0.12)', color: ac, fontSize: 14, fontWeight: 600 }}>{saved}</div>}

      <div style={{ padding: '0 16px' }}>
        {/* Profile */}
        {section === 'profile' && (
          <div>
            {[{ k: 'name', l: 'Name', t: 'text', p: 'Ben' }, { k: 'dob', l: 'Date of Birth', t: 'date' }, { k: 'heightCm', l: 'Height (cm)', t: 'number', p: '176' }, { k: 'weightKg', l: 'Current Weight (kg)', t: 'number', p: '102' }, { k: 'weightGoalKg', l: 'Weight Goal (kg)', t: 'number', p: '95' }].map(f => (
              <div key={f.k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1.5 }}>{f.l}</label>
                <input type={f.t} value={profile[f.k] || ''} onChange={e => setProfile(p => ({ ...p, [f.k]: e.target.value === '' ? '' : f.t === 'number' ? parseFloat(e.target.value) : e.target.value }))} placeholder={f.p} style={{ ...inp, marginTop: 4 }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1.5 }}>Sex</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {['Male', 'Female'].map(s => (
                  <button key={s} onClick={() => setProfile(p => ({ ...p, sex: s }))}
                    style={{ padding: '8px 20px', borderRadius: 12, border: profile.sex === s ? '1px solid #2dba8e' : '1px solid rgba(255,255,255,0.08)', background: profile.sex === s ? 'rgba(45,186,142,0.12)' : 'rgba(255,255,255,0.04)', color: profile.sex === s ? ac : t2, fontSize: 13, fontWeight: 600 }}>{s}</button>
                ))}
              </div>
            </div>
            {saveBtn('Save Profile', async () => { await api.updateProfile(profile); flash('Profile saved'); onRefresh(); })}
          </div>
        )}

        {/* Goals */}
        {section === 'goals' && (
          <div>
            {[{ k: 'calories', l: 'Daily Calories', p: '2300' }, { k: 'proteinG', l: 'Protein (g)', p: '150' }, { k: 'fatG', l: 'Fat (g)', p: '80' }, { k: 'carbsG', l: 'Carbs (g)', p: '250' }, { k: 'waterMl', l: 'Water Goal (mL)', p: '2500' }].map(f => (
              <div key={f.k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1.5 }}>{f.l}</label>
                <input type="number" value={goals[f.k] || ''} onChange={e => setGoals(g => ({ ...g, [f.k]: parseFloat(e.target.value) || 0 }))} placeholder={f.p} style={{ ...inp, marginTop: 4 }} />
              </div>
            ))}
            {saveBtn('Save Goals', async () => { await api.updateGoals(goals); flash('Goals saved'); onRefresh(); })}
          </div>
        )}

        {/* Recipes */}
        {section === 'recipes' && (
          <div>
            <button onClick={() => openRecipeEdit({ id: null, name: '', servings: 1, ingredients: [] })}
              style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(45,186,142,0.2)', background: 'rgba(45,186,142,0.06)', color: ac, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>+ New Recipe</button>
            {recipes.map(r => {
              const ps = recipeNutrition(r);
              return (
                <div key={r.id} onClick={() => openRecipeEdit(r)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '16px 18px', marginBottom: 8, cursor: 'pointer' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t1 }}>{r.name || 'Untitled'}</div>
                  <div style={{ fontSize: 12, color: t2, marginTop: 4 }}>{r.servings} serve{r.servings !== 1 ? 's' : ''} · {ps.cal} cal · {ps.protein}g P</div>
                </div>
              );
            })}
            {!recipes.length && <div style={{ color: t3, fontSize: 14, padding: 30, textAlign: 'center' }}>No recipes yet.</div>}
          </div>
        )}

        {/* Supplements */}
        {section === 'supps' && (
          <div>
            {supplements.filter(s => s.isActive).map(sup => (
              <div key={sup.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{sup.name}</div>
                  <div style={{ fontSize: 12, color: t2, marginTop: 2 }}>{sup.activeDose}{sup.activeIngredient ? ` · ${sup.activeIngredient}` : ''}</div>
                </div>
                <button onClick={async () => { await api.deleteSupplement(sup.id); setSupplements(await api.getSupplements()); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 18 }}>×</button>
              </div>
            ))}
            {!supplements.filter(s => s.isActive).length && !addingSupp && <div style={{ color: t3, fontSize: 14, padding: 20, textAlign: 'center' }}>No supplements yet.</div>}
            {addingSupp ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18, marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: t1 }}>Add Supplement</div>
                <input value={suppForm.name} onChange={e => setSuppForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" style={{ ...inp, marginBottom: 8 }} />
                <input value={suppForm.dose} onChange={e => setSuppForm(f => ({ ...f, dose: e.target.value }))} placeholder="Dose (e.g. 30mg)" style={{ ...inp, marginBottom: 8 }} />
                <input value={suppForm.ingredient} onChange={e => setSuppForm(f => ({ ...f, ingredient: e.target.value }))} placeholder="Active ingredient" style={{ ...inp, marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAddingSupp(false); setSuppForm({ name: '', ingredient: '', dose: '' }); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                  <button onClick={async () => {
                    if (!suppForm.name || !suppForm.dose) return;
                    await api.createSupplement({ name: suppForm.name, activeIngredient: suppForm.ingredient, activeDose: suppForm.dose });
                    setSupplements(await api.getSupplements()); setSuppForm({ name: '', ingredient: '', dose: '' }); setAddingSupp(false);
                  }} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 700 }}>Add</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingSupp(true)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(45,186,142,0.2)', background: 'rgba(45,186,142,0.06)', color: ac, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>+ Add Supplement</button>
            )}
          </div>
        )}

        {/* Weight */}
        {section === 'weight' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input type="number" value={wiVal} onChange={e => setWiVal(e.target.value)} placeholder="Weight (kg)" style={{ ...inp, flex: 1 }} step="0.1" />
              <button onClick={async () => {
                if (!wiVal) return;
                await api.logWeighIn(parseFloat(wiVal));
                setWeighIns(await api.getWeighIns(30)); setProfile(p => ({ ...p, weightKg: parseFloat(wiVal) })); setWiVal(''); flash('Weigh-in logged');
              }} style={{ padding: '12px 20px', borderRadius: 12, background: ac, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700 }}>Log</button>
            </div>
            {weighIns.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{w.weightKg} kg</div>
                  <div style={{ fontSize: 12, color: t2 }}>{w.date?.split('T')[0]}</div>
                </div>
                <button onClick={async () => { await api.deleteWeighIn(w.id); setWeighIns(await api.getWeighIns(30)); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Data */}
        {section === 'data' && (
          <div>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: t1 }}>Your Data</div>
              <div style={{ fontSize: 13, color: t2, lineHeight: 1.6 }}>{weighIns.length} weigh-ins · {supplements.length} supplements · {recipes.length} recipes</div>
            </div>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(248,81,73,0.2)', background: 'rgba(248,81,73,0.06)', color: '#f85149', fontSize: 14, fontWeight: 600 }}>Clear All Data</button>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '2px solid #f85149', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f85149', marginBottom: 6 }}>Are you sure?</div>
                <div style={{ fontSize: 13, color: t2, marginBottom: 16 }}>This permanently deletes all data.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                  <button onClick={async () => { await api.clearAll(); setConfirmClear(false); flash('All data cleared'); onRefresh(); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#f85149', color: '#fff', fontSize: 14, fontWeight: 600 }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
