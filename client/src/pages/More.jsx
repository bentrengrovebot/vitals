import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const r1 = n => Math.round(n * 10) / 10;
const card = { background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden' };
const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 15, boxSizing: 'border-box', color: '#1a1a1a' };
const t1 = '#1a1a1a', t2 = '#6b7280', t3 = '#9ca3af', ac = '#2dba8e';

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
  const [whoopStatus, setWhoopStatus] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState([]);
  const [bloods, setBloods] = useState([]);
  const [editDoc, setEditDoc] = useState(null); // {id, title, content, category} or null
  const [docForm, setDocForm] = useState({ title: '', content: '', category: 'general' });
  const [saved, setSaved] = useState('');

  useEffect(() => {
    Promise.all([api.getProfile(), api.getGoals(), api.getSupplements(), api.getRecipes(), api.getWeighIns(30), api.getWhoopStatus().catch(() => null), api.getKnowledgeDocs().catch(() => []), api.getBloods().catch(() => [])])
      .then(([p, g, s, r, w, wh, kd, bl]) => {
        if (p) setProfile({ name: p.name || '', dob: p.dob ? p.dob.split('T')[0] : '', sex: p.sex || 'Male', heightCm: p.heightCm || '', weightKg: p.weightKg || '', weightGoalKg: p.weightGoalKg || '' });
        if (g) setGoals({ calories: g.calories, proteinG: g.proteinG, fatG: g.fatG, carbsG: g.carbsG, waterMl: g.waterMl || 2500 });
        setSupplements(s); setRecipes(r); setWeighIns(w); setWhoopStatus(wh); setKnowledgeDocs(kd || []); setBloods(bl || []);
      });
  }, []);

  function flash(msg) { setSaved(msg); setTimeout(() => setSaved(''), 2000); }

  const menuItem = (label, subtitle, onClick) => (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '18px 18px', background: 'none', border: 'none', borderTop: '1px solid #e5e5e7', color: t1 }}>
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
        <button onClick={logout} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #e5e5e7', background: '#ffffff', color: t2, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Logout</button>
      </div>

      {saved && <div style={{ margin: '8px 16px', padding: '10px 16px', borderRadius: 12, background: 'rgba(45,186,142,0.12)', color: ac, fontSize: 14, fontWeight: 600 }}>{saved}</div>}

      <div style={{ ...card, marginTop: 12 }}>
        {menuItem('Profile', profile.name || 'Set up your profile', () => setSection('profile'))}
        {menuItem('Goals', `${goals.calories} cal · ${goals.proteinG}g P`, () => setSection('goals'))}
        {menuItem('Recipes', `${recipes.length} recipes`, () => setSection('recipes'))}
        {menuItem('Supplements', `${supplements.filter(s => s.isActive).length} active`, () => setSection('supps'))}
        {menuItem('Log Weight', weighIns.length > 0 ? `${weighIns[0].weightKg}kg` : 'No weigh-ins', () => setSection('weight'))}
        {menuItem('Whoop', whoopStatus?.connected ? 'Connected' : 'Not connected', () => setSection('whoop'))}
        {menuItem('Blood Work', 'Lab results & biomarkers', () => setSection('bloods'))}
        {menuItem('Knowledge Base', 'Docs for your AI coach', () => setSection('knowledge'))}
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
        <div style={{ fontSize: 18, fontWeight: 800, color: t1, letterSpacing: -0.3, flex: 1 }}>{section === 'profile' ? 'Profile' : section === 'goals' ? 'Goals' : section === 'recipes' ? 'Recipes' : section === 'supps' ? 'Supplements' : section === 'weight' ? 'Log Weight' : section === 'whoop' ? 'Whoop' : section === 'bloods' ? 'Blood Work' : section === 'knowledge' ? 'Knowledge Base' : 'Data'}</div>
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
                    style={{ padding: '8px 20px', borderRadius: 12, border: profile.sex === s ? '1px solid #2dba8e' : '1px solid #e5e5e7', background: profile.sex === s ? 'rgba(45,186,142,0.1)' : '#f0f0f2', color: profile.sex === s ? ac : t2, fontSize: 13, fontWeight: 600 }}>{s}</button>
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
                <div key={r.id} onClick={() => openRecipeEdit(r)} style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '16px 18px', marginBottom: 8, cursor: 'pointer' }}>
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
              <div key={sup.id} style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{sup.name}</div>
                  <div style={{ fontSize: 12, color: t2, marginTop: 2 }}>{sup.activeDose}{sup.activeIngredient ? ` · ${sup.activeIngredient}` : ''}</div>
                </div>
                <button onClick={async () => { await api.deleteSupplement(sup.id); setSupplements(await api.getSupplements()); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 18 }}>×</button>
              </div>
            ))}
            {!supplements.filter(s => s.isActive).length && !addingSupp && <div style={{ color: t3, fontSize: 14, padding: 20, textAlign: 'center' }}>No supplements yet.</div>}
            {addingSupp ? (
              <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: 18, marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: t1 }}>Add Supplement</div>
                <input value={suppForm.name} onChange={e => setSuppForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" style={{ ...inp, marginBottom: 8 }} />
                <input value={suppForm.dose} onChange={e => setSuppForm(f => ({ ...f, dose: e.target.value }))} placeholder="Dose (e.g. 30mg)" style={{ ...inp, marginBottom: 8 }} />
                <input value={suppForm.ingredient} onChange={e => setSuppForm(f => ({ ...f, ingredient: e.target.value }))} placeholder="Active ingredient" style={{ ...inp, marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAddingSupp(false); setSuppForm({ name: '', ingredient: '', dose: '' }); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
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
            {/* Weight trend chart */}
            {weighIns.length < 2 && (
              <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '24px 18px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: t2, marginBottom: 12 }}>Weight Trend</div>
                <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="200" height="50" viewBox="0 0 200 50">
                    <line x1="10" y1="40" x2="190" y2="40" stroke="#e5e5e7" strokeWidth="1" strokeDasharray="4,4" />
                    <line x1="10" y1="25" x2="190" y2="25" stroke="#e5e5e7" strokeWidth="1" strokeDasharray="4,4" />
                    <line x1="10" y1="10" x2="190" y2="10" stroke="#e5e5e7" strokeWidth="1" strokeDasharray="4,4" />
                  </svg>
                </div>
                <div style={{ fontSize: 13, color: '#9ca3af' }}>Log {weighIns.length === 0 ? '2' : '1 more'} weigh-in{weighIns.length === 0 ? 's' : ''} to see your trend</div>
              </div>
            )}
            {weighIns.length >= 2 && (() => {
              const sorted = [...weighIns].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-14);
              const withTrend = sorted.map((w, i) => {
                const win = sorted.slice(Math.max(0, i - 6), i + 1);
                return { ...w, trend: r1(win.reduce((s, x) => s + x.weightKg, 0) / win.length) };
              });
              const allV = [...withTrend.map(w => w.weightKg), ...withTrend.map(w => w.trend)];
              const mn = Math.min(...allV) - 0.5, mx = Math.max(...allV) + 0.5, rng = mx - mn || 1;
              const W = 340, H = 120, pad = 30;
              const pts = withTrend.map((w, i) => ({
                x: pad + i * ((W - pad * 2) / (withTrend.length - 1 || 1)),
                y: pad + (1 - (w.weightKg - mn) / rng) * (H - pad * 2),
                ty: pad + (1 - (w.trend - mn) / rng) * (H - pad * 2),
              }));
              const trendLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.ty}`).join(' ');
              const wkCh = withTrend.length >= 7 ? r1(withTrend[withTrend.length - 1].trend - withTrend[Math.max(0, withTrend.length - 8)].trend) : null;
              return (
                <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: t2 }}>Weight Trend</span>
                    {wkCh !== null && <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: wkCh < 0 ? 'rgba(45,186,142,0.12)' : 'rgba(248,81,73,0.12)', color: wkCh < 0 ? ac : '#f85149' }}>{wkCh > 0 ? '+' : ''}{wkCh} kg/wk</span>}
                  </div>
                  <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
                    {[0, 0.25, 0.5, 0.75, 1].map((p, i) => { const y = pad + p * (H - pad * 2); return (<g key={i}><line x1={pad} y1={y} x2={W - pad} y2={y} stroke="#e5e5e7" strokeWidth="1" strokeDasharray="4,4" /><text x={pad - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9ca3af">{r1(mx - p * rng)}</text></g>); })}
                    {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#d1d5db" stroke="#f5f5f7" strokeWidth="2" />)}
                    <path d={trendLine} fill="none" stroke="#5b9ef0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((p, i) => <circle key={`t${i}`} cx={p.x} cy={p.ty} r="3.5" fill="#5b9ef0" stroke="#f5f5f7" strokeWidth="2" />)}
                    {profile.weightGoalKg && (() => { const gy = pad + (1 - (parseFloat(profile.weightGoalKg) - mn) / rng) * (H - pad * 2); if (gy > 0 && gy < H) return (<><line x1={pad} y1={gy} x2={W - pad} y2={gy} stroke={ac} strokeWidth="1.5" strokeDasharray="6,4" /><text x={W - pad + 4} y={gy + 4} fontSize="9" fill={ac}>Goal</text></>); return null; })()}
                  </svg>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 10, color: t2 }}>
                    <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: '#d1d5db', marginRight: 4, verticalAlign: 'middle' }} />Daily</span>
                    <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: '#5b9ef0', marginRight: 4, verticalAlign: 'middle' }} />Trend</span>
                    {profile.weightGoalKg && weighIns.length > 0 && <span>{r1(weighIns[0].weightKg - parseFloat(profile.weightGoalKg))}kg to go</span>}
                  </div>
                </div>
              );
            })()}

            {weighIns.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #e5e5e7' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{w.weightKg} kg</div>
                  <div style={{ fontSize: 12, color: t2 }}>{w.date?.split('T')[0]}</div>
                </div>
                <button onClick={async () => { await api.deleteWeighIn(w.id); setWeighIns(await api.getWeighIns(30)); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Whoop */}
        {section === 'whoop' && (
          <div>
            {whoopStatus?.connected ? (
              <div>
                <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: 18, marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Whoop Connected</div>
                  <div style={{ fontSize: 13, color: '#6b7280' }}>Token expires: {whoopStatus.expiresAt ? new Date(whoopStatus.expiresAt).toLocaleDateString('en-NZ') : 'Unknown'}</div>
                </div>
                <button onClick={async () => { await api.syncWhoop(); alert('Whoop data synced!'); }}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#2dba8e', color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Sync Now</button>
                <button onClick={async () => { await api.disconnectWhoop(); setWhoopStatus({ connected: false }); }}
                  style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(248,81,73,0.2)', background: 'rgba(248,81,73,0.06)', color: '#f85149', fontSize: 14, fontWeight: 600 }}>Disconnect Whoop</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>Connect your Whoop to sync sleep, recovery, and strain data.</div>
                <button onClick={() => { window.location.href = '/api/whoop/auth'; }} style={{ display: 'block', width: '100%', padding: 14, borderRadius: 12, background: '#2dba8e', color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', border: 'none' }}>Connect Whoop</button>
              </div>
            )}
          </div>
        )}

        {/* Blood Work */}
        {section === 'bloods' && (
          <div>
            {/* Upload area */}
            <div
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#2dba8e'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = '#e5e5e7'; }}
              onDrop={async e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = '#e5e5e7';
                const files = Array.from(e.dataTransfer.files);
                if (!files.length) return;
                flash('Analysing blood test...');
                for (const file of files) {
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const base64 = reader.result.split(',')[1];
                    try {
                      const result = await api.extractBloodPdf(base64);
                      if (result.date && result.markers) {
                        await api.createBloodTest({ date: result.date, markers: result.markers, source: 'pdf_upload' });
                        setBloods(await api.getBloods());
                        flash('Blood test saved!');
                      } else {
                        flash('Could not extract markers. Try a clearer image.');
                      }
                    } catch (err) {
                      flash('Analysis failed: ' + err.message);
                    }
                  };
                  reader.readAsDataURL(file);
                }
              }}
              onClick={() => document.getElementById('blood-file-input')?.click()}
              style={{
                border: '2px dashed #e5e5e7', borderRadius: 14, padding: '32px 20px',
                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                background: '#ffffff', transition: 'border-color 0.2s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>Upload blood test</div>
              <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
                Drag & drop a PDF, screenshot, or photo here<br/>
                or tap to browse files
              </div>
              <input
                id="blood-file-input"
                type="file"
                accept="image/*,.pdf"
                multiple
                style={{ display: 'none' }}
                onChange={async e => {
                  const files = Array.from(e.target.files || []);
                  if (!files.length) return;
                  flash('Analysing blood test...');
                  for (const file of files) {
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const base64 = reader.result.split(',')[1];
                      try {
                        const result = await api.extractBloodPdf(base64);
                        if (result.date && result.markers) {
                          await api.createBloodTest({ date: result.date, markers: result.markers, source: file.type.includes('pdf') ? 'pdf_upload' : 'image_upload' });
                          setBloods(await api.getBloods());
                          flash('Blood test saved!');
                        } else {
                          flash('Could not extract markers. Try a clearer image.');
                        }
                      } catch (err) {
                        flash('Analysis failed: ' + err.message);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {/* Existing blood tests */}
            {bloods.length > 0 ? bloods.map(b => (
              <div key={b.id} style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                    {new Date(b.date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>{b.source}</span>
                    <button onClick={async () => { await api.deleteBloodTest(b.id); setBloods(await api.getBloods()); }} style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: 14 }}>×</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {Object.entries(b.markers || {}).slice(0, 9).map(([key, m]) => (
                    <div key={key} style={{ padding: '6px 8px', borderRadius: 8, background: '#f5f5f7', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: m.status === 'normal' ? '#2dba8e' : m.status === 'low' ? '#e0a526' : '#ef4444' }}>{m.value}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', marginTop: 2 }}>{key.replace(/_/g, ' ')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 16 }}>No blood tests yet. Upload a PDF or photo above.</div>
            )}
          </div>
        )}

        {/* Knowledge Base */}
        {section === 'knowledge' && (
          <div>
            <p style={{ fontSize: 13, color: t2, marginBottom: 16, lineHeight: 1.6 }}>Add documents that your AI coach can reference — meal plans, health notes, training programs, dietary preferences, medical info.</p>

            {/* Edit/Create form */}
            {editDoc !== null ? (
              <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t1, marginBottom: 12 }}>{editDoc.id ? 'Edit Document' : 'New Document'}</div>
                <input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} placeholder="Title (e.g. My Meal Plan)" style={{ ...inp, marginBottom: 8 }} />
                <select value={docForm.category} onChange={e => setDocForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, marginBottom: 8 }}>
                  <option value="general">General</option>
                  <option value="goals">Goals</option>
                  <option value="training">Training</option>
                  <option value="diet">Diet / Nutrition</option>
                  <option value="medical">Medical</option>
                  <option value="notes">Notes</option>
                </select>
                <textarea value={docForm.content} onChange={e => setDocForm(f => ({ ...f, content: e.target.value }))} placeholder="Paste or type your document content here..." rows={10}
                  style={{ ...inp, resize: 'vertical', minHeight: 150, fontFamily: 'inherit', lineHeight: 1.6 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => { setEditDoc(null); setDocForm({ title: '', content: '', category: 'general' }); }}
                    style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', color: t1, fontSize: 14, fontWeight: 500 }}>Cancel</button>
                  <button onClick={async () => {
                    if (!docForm.title || !docForm.content) return;
                    if (editDoc.id) {
                      await api.updateKnowledgeDoc(editDoc.id, docForm);
                    } else {
                      await api.createKnowledgeDoc(docForm);
                    }
                    setKnowledgeDocs(await api.getKnowledgeDocs());
                    setEditDoc(null); setDocForm({ title: '', content: '', category: 'general' });
                    flash(editDoc.id ? 'Document updated' : 'Document added');
                  }} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 600 }}>
                    {editDoc.id ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setEditDoc({ id: null })}
                style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(45,186,142,0.2)', background: 'rgba(45,186,142,0.06)', color: ac, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>+ Add Document</button>
            )}

            {/* Document list */}
            {knowledgeDocs.map(doc => (
              <div key={doc.id} style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{doc.title}</div>
                    <div style={{ fontSize: 11, color: t2, marginTop: 2 }}>{doc.category} · {doc.content.length} chars · {new Date(doc.updatedAt).toLocaleDateString('en-NZ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditDoc(doc); setDocForm({ title: doc.title, content: doc.content, category: doc.category }); }}
                      style={{ background: 'none', border: 'none', color: ac, fontSize: 12, fontWeight: 600 }}>Edit</button>
                    <button onClick={async () => { await api.deleteKnowledgeDoc(doc.id); setKnowledgeDocs(await api.getKnowledgeDocs()); }}
                      style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, fontWeight: 600 }}>Delete</button>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: t2, marginTop: 8, lineHeight: 1.5, maxHeight: 60, overflow: 'hidden' }}>{doc.content.substring(0, 200)}{doc.content.length > 200 ? '...' : ''}</div>
              </div>
            ))}
            {!knowledgeDocs.length && editDoc === null && <div style={{ color: t3, fontSize: 13, textAlign: 'center', padding: 20 }}>No documents yet. Add meal plans, health notes, or anything you want the AI to know.</div>}
          </div>
        )}

        {/* Data */}
        {section === 'data' && (
          <div>
            <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: t1 }}>Your Data</div>
              <div style={{ fontSize: 13, color: t2, lineHeight: 1.6 }}>{weighIns.length} weigh-ins · {supplements.length} supplements · {recipes.length} recipes</div>
            </div>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(248,81,73,0.2)', background: 'rgba(248,81,73,0.06)', color: '#f85149', fontSize: 14, fontWeight: 600 }}>Clear All Data</button>
            ) : (
              <div style={{ background: '#ffffff', border: '2px solid #f85149', borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f85149', marginBottom: 6 }}>Are you sure?</div>
                <div style={{ fontSize: 13, color: t2, marginBottom: 16 }}>This permanently deletes all data.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
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
