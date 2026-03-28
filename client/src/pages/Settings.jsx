import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';

const r1 = n => Math.round(n * 10) / 10;

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(k) {
  const d = new Date(k + 'T00:00:00'), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Settings({ goTo, onRefresh }) {
  const { logout } = useAuth();
  const [tab, setTab] = useState('profile');
  const [profile, setProfile] = useState({ name: '', dob: '', sex: 'Male', heightCm: '', weightKg: '', weightGoalKg: '' });
  const [goals, setGoals] = useState({ calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 });
  const [supplements, setSupplements] = useState([]);
  const [weighIns, setWeighIns] = useState([]);
  const [wiVal, setWiVal] = useState('');
  const [suppForm, setSuppForm] = useState({ name: '', ingredient: '', dose: '' });
  const [addingSupp, setAddingSupp] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saved, setSaved] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [p, g, s, w] = await Promise.all([
      api.getProfile(), api.getGoals(), api.getSupplements(), api.getWeighIns(30),
    ]);
    if (p) setProfile({
      name: p.name || '', dob: p.dob ? p.dob.split('T')[0] : '', sex: p.sex || 'Male',
      heightCm: p.heightCm || '', weightKg: p.weightKg || '', weightGoalKg: p.weightGoalKg || '',
    });
    if (g) setGoals({ calories: g.calories, proteinG: g.proteinG, fatG: g.fatG, carbsG: g.carbsG, waterMl: g.waterMl || 2500 });
    setSupplements(s);
    setWeighIns(w);
  }

  function flash(msg) { setSaved(msg); setTimeout(() => setSaved(''), 2000); }

  const card = { background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' };
  const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#161b22', fontSize: 15, boxSizing: 'border-box', color: '#e6edf3' };
  const ac = '#2dba8e', gn = '#2dba8e', or = '#e0a526', rd = '#f85149', t1 = '#e6edf3', t2 = '#8b949e', t3 = '#484f58', bl = '#58a6ff', brd = 'rgba(255,255,255,0.08)';

  const pill = (active) => ({
    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: active ? '1px solid #2dba8e' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(45,186,142,0.15)' : 'rgba(255,255,255,0.05)',
    color: active ? '#2dba8e' : '#8b949e',
  });

  // Weight chart
  const renderWeightChart = () => {
    if (weighIns.length < 2) return null;
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
      w: w.weightKg, t: w.trend, d: w.date?.split('T')[0] || '',
    }));
    const trendLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.ty}`).join(' ');
    const wkCh = withTrend.length >= 7 ? r1(withTrend[withTrend.length - 1].trend - withTrend[Math.max(0, withTrend.length - 8)].trend) : null;

    return (
      <div style={{ ...card, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t1 }}>Weight Trend</div>
          {wkCh !== null && <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: wkCh < 0 ? 'rgba(45,186,142,0.15)' : wkCh > 0 ? 'rgba(248,81,73,0.15)' : brd, color: wkCh < 0 ? ac : wkCh > 0 ? rd : t2 }}>{wkCh > 0 ? '+' : ''}{wkCh} kg/wk</div>}
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
          {[0, 0.25, 0.5, 0.75, 1].map((p, i) => { const y = pad + p * (H - pad * 2); return (<g key={i}><line x1={pad} y1={y} x2={W - pad} y2={y} stroke={t3} strokeWidth="1" strokeDasharray="4,4" /><text x={pad - 4} y={y + 4} textAnchor="end" fontSize="9" fill={t2}>{r1(mx - p * rng)}</text></g>); })}
          {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={t3} stroke="#0d1117" strokeWidth="2" />)}
          <path d={trendLine} fill="none" stroke={bl} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {pts.map((p, i) => <circle key={`t${i}`} cx={p.x} cy={p.ty} r="4" fill={bl} stroke="#0d1117" strokeWidth="2" />)}
          {profile.weightGoalKg && (() => { const gy = pad + (1 - (profile.weightGoalKg - mn) / rng) * (H - pad * 2); if (gy > 0 && gy < H) return (<><line x1={pad} y1={gy} x2={W - pad} y2={gy} stroke={ac} strokeWidth="1.5" strokeDasharray="6,4" /><text x={W - pad + 4} y={gy + 4} fontSize="9" fill={ac}>Goal</text></>); return null; })()}
          {pts.filter((_, i) => i === 0 || i === pts.length - 1 || i === Math.floor(pts.length / 2)).map((p, i) => <text key={`d${i}`} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill={t2}>{p.d.slice(5)}</text>)}
        </svg>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: t2 }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: t3, marginRight: 4, verticalAlign: 'middle' }} />Daily</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: bl, marginRight: 4, verticalAlign: 'middle' }} />7-day trend</span>
          {profile.weightGoalKg && withTrend.length > 0 && <span>{r1(withTrend[withTrend.length - 1].trend - profile.weightGoalKg)}kg to go</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 100, background: '#0d1117', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 20, gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, flex: 1, color: t1 }}>Settings</div>
        <button onClick={logout} style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${brd}`, background: 'rgba(255,255,255,0.05)', color: t2, fontSize: 12, fontWeight: 600 }}>Log out</button>
      </div>

      {saved && <div style={{ margin: '0 20px 12px', padding: '10px 16px', borderRadius: 12, background: 'rgba(45,186,142,0.15)', color: ac, fontSize: 14, fontWeight: 600 }}>{saved}</div>}

      <div style={{ display: 'flex', gap: 6, padding: '0 20px', marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ id: 'profile', l: 'Profile' }, { id: 'goals', l: 'Goals' }, { id: 'supps', l: 'Supplements' }, { id: 'weight', l: 'Weight' }, { id: 'data', l: 'Data' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={pill(tab === t.id)}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* Profile */}
        {tab === 'profile' && (
          <div>
            {[{ k: 'name', l: 'Name', t: 'text', p: 'Ben' }, { k: 'dob', l: 'Date of Birth', t: 'date' }, { k: 'heightCm', l: 'Height (cm)', t: 'number', p: '176' }, { k: 'weightKg', l: 'Current Weight (kg)', t: 'number', p: '102.2' }, { k: 'weightGoalKg', l: 'Weight Goal (kg)', t: 'number', p: '95' }].map(f => (
              <div key={f.k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>{f.l}</label>
                <input type={f.t} value={profile[f.k] || ''} onChange={e => setProfile(p => ({ ...p, [f.k]: e.target.value === '' ? '' : f.t === 'number' ? parseFloat(e.target.value) : e.target.value }))} placeholder={f.p} style={{ ...inp, marginTop: 4 }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Sex</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {['Male', 'Female'].map(s => <button key={s} onClick={() => setProfile(p => ({ ...p, sex: s }))} style={pill(profile.sex === s)}>{s}</button>)}
              </div>
            </div>
            <button onClick={async () => { await api.updateProfile(profile); flash('Profile saved'); onRefresh(); }}
              style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: ac, color: '#fff', fontSize: 15, fontWeight: 700 }}>Save Profile</button>
          </div>
        )}

        {/* Goals */}
        {tab === 'goals' && (
          <div>
            {[{ k: 'calories', l: 'Daily Calories', p: '2300' }, { k: 'proteinG', l: 'Protein (g)', p: '150' }, { k: 'fatG', l: 'Fat (g)', p: '80' }, { k: 'carbsG', l: 'Carbs (g)', p: '250' }].map(f => (
              <div key={f.k} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>{f.l}</label>
                <input type="number" value={goals[f.k] || ''} onChange={e => setGoals(g => ({ ...g, [f.k]: parseFloat(e.target.value) || 0 }))} placeholder={f.p} style={{ ...inp, marginTop: 4 }} />
              </div>
            ))}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Daily Water Goal (mL)</label>
              <input type="number" value={goals.waterMl} onChange={e => setGoals(g => ({ ...g, waterMl: parseInt(e.target.value) || 2500 }))} placeholder="2500" style={{ ...inp, marginTop: 4 }} />
            </div>
            <button onClick={async () => { await api.updateGoals(goals); flash('Goals saved'); onRefresh(); }}
              style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: ac, color: '#fff', fontSize: 15, fontWeight: 700 }}>Save Goals</button>
          </div>
        )}

        {/* Supplements */}
        {tab === 'supps' && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Your Supplements</div>
            {supplements.filter(s => s.isActive).map(sup => (
              <div key={sup.id} style={{ ...card, padding: '14px 16px', marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{sup.name}</div>
                    <div style={{ fontSize: 12, color: t2, marginTop: 2 }}>{sup.activeDose}{sup.activeIngredient ? ` · ${sup.activeIngredient}` : ''}</div>
                  </div>
                  <button onClick={async () => { await api.deleteSupplement(sup.id); setSupplements(await api.getSupplements()); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 16 }}>×</button>
                </div>
              </div>
            ))}
            {supplements.filter(s => s.isActive).length === 0 && !addingSupp && <div style={{ color: t3, fontSize: 14, padding: 20, textAlign: 'center' }}>No supplements added yet.</div>}
            {addingSupp ? (
              <div style={{ ...card, padding: 18, marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: t1 }}>Add Supplement</div>
                <input value={suppForm.name} onChange={e => setSuppForm(f => ({ ...f, name: e.target.value }))} placeholder="Name (e.g. GO Healthy GO Iron)" style={{ ...inp, marginBottom: 8 }} />
                <input value={suppForm.dose} onChange={e => setSuppForm(f => ({ ...f, dose: e.target.value }))} placeholder="Dose (e.g. 30mg)" style={{ ...inp, marginBottom: 8 }} />
                <input value={suppForm.ingredient} onChange={e => setSuppForm(f => ({ ...f, ingredient: e.target.value }))} placeholder="Active ingredient (optional)" style={{ ...inp, marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setAddingSupp(false); setSuppForm({ name: '', ingredient: '', dose: '' }); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${brd}`, background: 'rgba(255,255,255,0.05)', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                  <button onClick={async () => {
                    if (!suppForm.name || !suppForm.dose) return;
                    await api.createSupplement({ name: suppForm.name, activeIngredient: suppForm.ingredient, activeDose: suppForm.dose });
                    setSupplements(await api.getSupplements());
                    setSuppForm({ name: '', ingredient: '', dose: '' });
                    setAddingSupp(false);
                  }} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 700 }}>Add</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingSupp(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 0', background: 'none', border: 'none', color: ac, fontSize: 14, fontWeight: 600 }}>+ Add supplement</button>
            )}
            {supplements.filter(s => !s.isActive).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Inactive</div>
                {supplements.filter(s => !s.isActive).map(sup => (
                  <div key={sup.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${brd}` }}>
                    <span style={{ fontSize: 13, color: t3 }}>{sup.name} · {sup.activeDose}</span>
                    <button onClick={async () => { await api.updateSupplement(sup.id, { isActive: true }); setSupplements(await api.getSupplements()); }} style={{ background: 'none', border: 'none', color: ac, fontSize: 12, fontWeight: 600 }}>Reactivate</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Weight */}
        {tab === 'weight' && (
          <div>
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t1 }}>Log Weigh-in</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={wiVal} onChange={e => setWiVal(e.target.value)} placeholder="Weight (kg)" style={{ ...inp, flex: 1 }} step="0.1" />
                <button onClick={async () => {
                  if (!wiVal) return;
                  await api.logWeighIn(parseFloat(wiVal));
                  setWeighIns(await api.getWeighIns(30));
                  setProfile(p => ({ ...p, weightKg: parseFloat(wiVal) }));
                  setWiVal('');
                }} style={{ padding: '12px 20px', borderRadius: 12, background: ac, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700 }}>Log</button>
              </div>
            </div>
            {renderWeightChart()}
            <div style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>History</div>
            {weighIns.map(w => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${brd}` }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>{w.weightKg} kg</div>
                  <div style={{ fontSize: 12, color: t2 }}>{fmtDate(w.date?.split('T')[0] || '')}</div>
                </div>
                <button onClick={async () => { await api.deleteWeighIn(w.id); setWeighIns(await api.getWeighIns(30)); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 16 }}>×</button>
              </div>
            ))}
            {!weighIns.length && <div style={{ color: t3, fontSize: 14, padding: 20, textAlign: 'center' }}>No weigh-ins yet.</div>}
          </div>
        )}

        {/* Data */}
        {tab === 'data' && (
          <div>
            <div style={{ ...card, padding: 18, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: t1 }}>Your Data</div>
              <div style={{ fontSize: 13, color: t2, lineHeight: 1.6, marginBottom: 16 }}>
                {weighIns.length} weigh-ins · {supplements.length} supplements
              </div>
            </div>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.08)', color: rd, fontSize: 14, fontWeight: 600 }}>Clear All Data</button>
            ) : (
              <div style={{ ...card, padding: 18, border: `2px solid ${rd}` }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: rd, marginBottom: 6 }}>Are you sure?</div>
                <div style={{ fontSize: 13, color: t2, marginBottom: 16 }}>Permanently deletes all diary, recipes, symptoms, weigh-ins, and insights.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${brd}`, background: 'rgba(255,255,255,0.05)', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                  <button onClick={async () => { await api.clearAll(); setConfirmClear(false); flash('All data cleared'); loadData(); onRefresh(); }} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: rd, color: '#fff', fontSize: 14, fontWeight: 600 }}>Delete</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
