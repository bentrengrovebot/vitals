import { useState, useEffect } from 'react';
import { api } from '../api';

const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const SLOT_COLORS = { Breakfast: '#e0a526', Lunch: '#5b9ef0', Dinner: '#8b5ef6', Snacks: '#2dba8e' };
const SLOT_ICONS = { Breakfast: null, Lunch: null, Dinner: null, Snacks: null };
const r1 = n => Math.round(n * 10) / 10;

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(k, n) {
  const d = new Date(k + 'T00:00:00'); d.setDate(d.getDate() + n); return dateKey(d);
}
function fmtDate(k) {
  const d = new Date(k + 'T00:00:00'), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Shared styles
const card = { background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
const secHeader = { fontSize: 10, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 2, padding: '22px 20px 10px' };

const SYMPTOM_MAP = {
  reflux: { label: 'Reflux', icon: '🔥', color: '#f07068' },
  bloating: { label: 'Bloating', icon: '🫧', color: '#a78bfa' },
  energy_high: { label: 'Energy ↑', icon: '⚡', color: '#e0a526' },
  energy_low: { label: 'Energy ↓', icon: '😴', color: '#6b7280' },
  mood_good: { label: 'Mood ↑', icon: '😊', color: '#2dba8e' },
  mood_bad: { label: 'Mood ↓', icon: '😤', color: '#f07068' },
  headache: { label: 'Headache', icon: '🤕', color: '#ec4899' },
  gut_good: { label: 'Gut Good', icon: '✅', color: '#2dba8e' },
};

export default function Home({ openPicker }) {
  const [curDate, setCurDate] = useState(dateKey());
  const [diary, setDiary] = useState({ Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [profile, setProfile] = useState({});
  const [goals, setGoals] = useState({ calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 });
  const [waterLogs, setWaterLogs] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [suppLogs, setSuppLogs] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [whoop, setWhoop] = useState(null);
  const [weekEntries, setWeekEntries] = useState([]);
  const [habitDots, setHabitDots] = useState([]);
  const [del, setDel] = useState(null);

  const isToday = curDate === dateKey();

  useEffect(() => { loadData(); }, [curDate]);

  async function loadData() {
    const [d, p, g, symp] = await Promise.all([
      api.getDiary(curDate), api.getProfile(), api.getGoals(), api.getSymptoms(20),
    ]);
    setDiary(d); if (p) setProfile(p); if (g) setGoals(g); setSymptoms(symp);
    if (isToday) {
      const [w, s, sl] = await Promise.all([
        api.getWater(curDate), api.getSupplements(), api.getSupplementLogs(curDate),
      ]);
      setWaterLogs(w); setSupplements(s.filter(x => x.isActive)); setSuppLogs(sl);
      api.getWhoopDaily(curDate).then(setWhoop).catch(() => setWhoop(null));
    }
    // Load week data for nutrition bars
    const dow = new Date().getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    const ws = shiftDate(dateKey(), mo);
    const we = shiftDate(ws, 6);
    api.getDiaryRange(ws, we).then(entries => setWeekEntries(entries)).catch(() => {});
    // Load 30-day habit dots
    const h = [];
    for (let i = 29; i >= 0; i--) h.push(shiftDate(dateKey(), -i));
    setHabitDots(h);
  }

  // Totals
  const tot = { cal: 0, protein: 0, fat: 0, carbs: 0 };
  SLOTS.forEach(sl => (diary[sl] || []).forEach(i => {
    tot.cal += i.calories || 0; tot.protein += i.proteinG || 0;
    tot.fat += i.fatG || 0; tot.carbs += i.carbsG || 0;
  }));
  Object.keys(tot).forEach(k => tot[k] = r1(tot[k]));

  const slotCal = sl => r1((diary[sl] || []).reduce((s, i) => s + (i.calories || 0), 0));
  const slotProtein = sl => r1((diary[sl] || []).reduce((s, i) => s + (i.proteinG || 0), 0));
  const calPct = goals.calories > 0 ? Math.min(100, Math.round((tot.cal / goals.calories) * 100)) : 0;
  const protPct = goals.proteinG > 0 ? Math.min(100, Math.round((tot.protein / goals.proteinG) * 100)) : 0;
  const totalWater = waterLogs.reduce((s, w) => s + w.amountMl, 0);
  const waterPct = goals.waterMl > 0 ? Math.min(100, Math.round((totalWater / goals.waterMl) * 100)) : 0;

  // Per-meal targets (divide daily goal equally across 4 slots)
  const perSlotCalTarget = goals.calories > 0 ? r1(goals.calories / 4) : 0;
  const perSlotProtTarget = goals.proteinG > 0 ? r1(goals.proteinG / 4) : 0;

  // Remaining per meal (auto-rebalance across unfilled slots)
  const mealsLeft = SLOTS.filter(sl => !(diary[sl]?.length > 0)).length;
  const perMealCal = mealsLeft > 0 ? r1(Math.max(0, goals.calories - tot.cal) / mealsLeft) : 0;

  // Day tracking status
  const calStatus = tot.cal >= goals.calories * 0.9 && tot.cal <= goals.calories * 1.1 ? 'on_track' : tot.cal < goals.calories * 0.9 ? 'under' : 'over';
  const protStatus = tot.protein >= goals.proteinG * 0.9 ? 'on_track' : 'under';

  // Week dots
  const getWeekDots = () => {
    const dow = new Date().getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    const ws = shiftDate(dateKey(), mo);
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
      const dk = shiftDate(ws, i);
      return { label, dk, isToday: dk === dateKey() };
    });
  };

  // Streak
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    const hasFood = SLOTS.some(sl => diary[sl]?.length > 0);
    if (hasFood) setStreak(prev => Math.max(prev, 1));
  }, [diary]);

  async function addWater(ml) {
    await api.logWater(ml);
    setWaterLogs(await api.getWater(curDate));
  }

  async function toggleSupplement(sup) {
    const taken = suppLogs.find(l => l.supplementId === sup.id);
    if (taken) await api.deleteSupplementLog(taken.id);
    else await api.logSupplement(sup.id);
    setSuppLogs(await api.getSupplementLogs(curDate));
  }

  async function deleteEntry(id) {
    await api.deleteDiaryEntry(id);
    setDel(null);
    setDiary(await api.getDiary(curDate));
  }

  const daySymptoms = symptoms.filter(s => s.timestamp?.split('T')[0] === curDate);

  // Ring component
  const Ring = ({ pct, color, value, unit, label }) => {
    const circ = 2 * Math.PI * 44;
    const dash = (pct / 100) * circ;
    return (
      <div style={{ textAlign: 'center', flex: 1, maxWidth: 130 }}>
        <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto' }}>
          <svg viewBox="0 0 120 120" width="110" height="110">
            <circle cx="60" cy="60" r="44" fill="none" stroke="#e5e5e7" strokeWidth="6" />
            <circle cx="60" cy="60" r="44" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1, letterSpacing: -0.5, color }}>{value}</div>
            {unit && <div style={{ fontSize: 9, fontWeight: 400, color: '#6b7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{unit}</div>}
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginTop: 8 }}>{label} <span style={{ color: '#9ca3af' }}>›</span></div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 92 }}>
      {/* Delete modal */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, margin: 0, padding: 24, width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6, color: '#1a1a1a' }}>Delete?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>{del.label}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDel(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', color: '#1a1a1a', fontSize: 14, fontWeight: 500 }}>Cancel</button>
              <button onClick={del.action} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 500 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}>
            {(profile.name || 'U').substring(0, 2).toUpperCase()}
          </div>
          {streak > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 16, fontWeight: 700 }}>🔥 {streak}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCurDate(d => shiftDate(d, -1))} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20 }}>‹</button>
          <span style={{ fontSize: 11, fontWeight: 400, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 1.2, padding: '5px 18px', border: '1px solid #e5e5e7', borderRadius: 20, background: '#ffffff' }}>{fmtDate(curDate)}</span>
          <button onClick={() => setCurDate(d => shiftDate(d, 1))} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20 }}>›</button>
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Brand */}
      <div style={{ textAlign: 'center', padding: '8px 0 2px', fontSize: 15, fontWeight: 500, letterSpacing: 3, textTransform: 'uppercase', color: '#6b7280' }}>Vitals</div>

      {/* Three Rings */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '16px 12px 4px' }}>
        <Ring pct={calPct} color="#5b9ef0" value={`${calPct}%`} label="Calories" />
        <Ring pct={protPct} color="#e0a526" value={`${protPct}%`} label="Protein" />
        <Ring pct={waterPct} color="#2dba8e" value={r1(totalWater / 1000)} unit="litres" label="Water" />
      </div>

      {whoop && (
        <div style={card}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: 2, textTransform: 'uppercase', color: '#6b7280', border: '1px solid #e5e5e7', padding: '3px 8px', borderRadius: 6 }}>Whoop</span>
              <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>Synced</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'Sleep', value: whoop.sleepPerformance ? `${Math.round(whoop.sleepPerformance)}%` : '—', color: '#5b9ef0' },
                { label: 'Recovery', value: whoop.recoveryScore ? `${whoop.recoveryScore}%` : '—', color: '#e0a526' },
                { label: 'Strain', value: whoop.strain ? whoop.strain.toFixed(1) : '—', color: '#2dba8e' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center', padding: '10px 4px', background: '#f5f5f7', borderRadius: 10, border: '1px solid #e5e5e7' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: m.color }}>{m.value}</div>
                  <div style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginTop: 4 }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Weekly Nutrition */}
      {(() => {
        const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
        const dow = new Date().getDay();
        const mo = dow === 0 ? -6 : 1 - dow;
        const ws = shiftDate(dateKey(), mo);
        const weekDays = days.map((label, i) => {
          const dk = shiftDate(ws, i);
          const dayEntries = weekEntries.filter(e => e.date?.split('T')[0] === dk);
          let cal = 0, p = 0, f = 0, c = 0;
          dayEntries.forEach(e => { cal += e.calories || 0; p += e.proteinG || 0; f += e.fatG || 0; c += e.carbsG || 0; });
          return { label, dk, cal: r1(cal), p: r1(p), f: r1(f), c: r1(c), isToday: dk === dateKey() };
        });
        const maxCal = Math.max(goals.calories, ...weekDays.map(d => d.cal));
        const hasData = weekDays.some(d => d.cal > 0);
        // Always show — empty bars show targets exist
        return (
          <>
            <div style={secHeader}>This Week</div>
            <div style={card}>
              <div style={{ padding: '16px 14px 12px' }}>
                <div style={{ display: 'flex', gap: 3 }}>
                  {weekDays.map((d, i) => {
                    const pct = maxCal > 0 ? Math.min(100, (d.cal / maxCal) * 100) : 0;
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ height: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 6, background: '#e5e5e7', borderRadius: 4 }}>
                          <div style={{ width: '100%', maxWidth: 20, borderRadius: 4, background: d.cal > goals.calories ? '#f85149' : d.isToday ? '#5b9ef0' : d.cal > 0 ? 'rgba(91,158,240,0.4)' : 'transparent', height: `${Math.max(pct, d.cal > 0 ? 3 : 0)}%`, transition: 'height 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 500, color: d.isToday ? '#1a1a1a' : '#9ca3af' }}>{d.label}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '0 2px' }}>
                  {[
                    { label: 'Cal', val: weekDays.reduce((s, d) => s + d.cal, 0), goal: goals.calories * 7, color: '#5b9ef0' },
                    { label: 'P', val: weekDays.reduce((s, d) => s + d.p, 0), goal: goals.proteinG * 7, color: '#e0a526' },
                    { label: 'F', val: weekDays.reduce((s, d) => s + d.f, 0), goal: goals.fatG * 7, color: '#2dba8e' },
                    { label: 'C', val: weekDays.reduce((s, d) => s + d.c, 0), goal: goals.carbsG * 7, color: '#8b5ef6' },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: m.color }}>{r1(m.val)}</div>
                      <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 1 }}>/ {r1(m.goal)} {m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Dashboard */}
      <div style={secHeader}>Dashboard</div>
      <div style={card}>
        {[
          { label: 'Calories', val: tot.cal.toLocaleString(), sub: goals.calories.toLocaleString(), color: '#5b9ef0', unit: '' },
          { label: 'Protein', val: tot.protein, sub: `${goals.proteinG}g`, color: '#e0a526', unit: 'g' },
          { label: 'Fat', val: tot.fat, sub: `${goals.fatG}g`, color: '#2dba8e', unit: 'g' },
          { label: 'Carbs', val: tot.carbs, sub: `${goals.carbsG}g`, color: '#8b5ef6', unit: 'g' },
        ].map((m, i) => (
          <div key={m.label} style={{ display: 'flex', alignItems: 'center', padding: '16px 18px', gap: 14, borderTop: i > 0 ? '1px solid #e5e5e7' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.2, color: '#6b7280', flex: 1 }}>{m.label}</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1, color: '#1a1a1a' }}>{m.val}<span style={{ fontSize: 16, color: '#9ca3af' }}>{m.unit}</span></div>
              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginTop: 1 }}>{m.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Meals */}
      <div style={secHeader}>Today's Meals</div>
      <div style={card}>
        {SLOTS.map((slot, i) => {
          const items = diary[slot] || [];
          const cal = slotCal(slot);
          const prot = slotProtein(slot);
          const color = SLOT_COLORS[slot];
          const empty = items.length === 0;
          // Per-meal status
          const mealCalStatus = !empty ? (cal >= perSlotCalTarget * 0.85 && cal <= perSlotCalTarget * 1.15 ? 'on_track' : cal < perSlotCalTarget * 0.85 ? 'under' : 'over') : null;

          return (
            <div key={slot}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', gap: 12, borderTop: i > 0 ? '1px solid #e5e5e7' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 10, background: `${color}14`, borderLeft: `3px solid ${color}` }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: empty ? `${color}50` : color, lineHeight: 1 }}>{empty ? '—' : cal}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.2, color: '#6b7280' }}>{slot}</span>
                    {mealCalStatus && (
                      <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                        background: mealCalStatus === 'on_track' ? 'rgba(45,186,142,0.1)' : mealCalStatus === 'under' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                        color: mealCalStatus === 'on_track' ? '#2dba8e' : mealCalStatus === 'under' ? '#3b82f6' : '#ef4444',
                      }}>{mealCalStatus === 'on_track' ? 'On track' : mealCalStatus === 'under' ? `${r1(perSlotCalTarget - cal)} under` : `${r1(cal - perSlotCalTarget)} over`}</span>
                    )}
                  </div>
                  {empty && isToday && <div style={{ fontSize: 11, color: '#2dba8e', fontWeight: 500, marginTop: 2 }}>Target: {perMealCal} cal · {r1(perSlotProtTarget)}g P</div>}
                  {!empty && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{prot}g P · {r1((diary[slot] || []).reduce((s, i) => s + (i.fatG || 0), 0))}g F · {r1((diary[slot] || []).reduce((s, i) => s + (i.carbsG || 0), 0))}g C</div>}
                </div>
                {!empty && <span style={{ color: '#9ca3af', fontSize: 16 }}>›</span>}
              </div>
              {/* Meal items */}
              {items.length > 0 && (
                <div style={{ padding: '0 18px 10px' }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #e5e5e7' }}>
                      <span style={{ fontSize: 14, color: '#1a1a1a', fontWeight: 500 }}>{item.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{item.calories} cal</span>
                        <button onClick={() => setDel({ label: item.name, action: () => deleteEntry(item.id) })} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 16 }}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Add button for empty slots */}
              {empty && (
                <button onClick={() => openPicker(slot, curDate)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 18px', color: '#6b7280', fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1, width: '100%', background: 'none', border: 'none', borderTop: '1px solid #e5e5e7' }}>
                  + Add Food
                </button>
              )}
              {/* Add more button for filled slots */}
              {!empty && (
                <button onClick={() => openPicker(slot, curDate)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 18px', color: '#6b7280', fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1, width: '100%', background: 'none', border: 'none', borderTop: '1px solid #e5e5e7' }}>
                  + Add More
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Water */}
      {isToday && (
        <div style={card}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b9ef0" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
                <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280' }}>Water</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#5b9ef0' }}>{r1(totalWater / 1000)}<span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>/ {r1(goals.waterMl / 1000)}L</span></span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: '#e5e5e7', margin: '8px 0 12px', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${waterPct}%`, background: 'linear-gradient(90deg, #3a7bd5, #2dba8e)' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[250, 500, 750].map(ml => (
                <button key={ml} onClick={() => addWater(ml)} style={{ flex: 1, padding: 10, borderRadius: 10, border: '1px solid rgba(58,123,213,0.2)', background: 'rgba(58,123,213,0.06)', color: '#5b9ef0', fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>
                  + {ml}ml
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Supplements */}
      {isToday && supplements.length > 0 && (
        <div style={card}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280' }}>Supplements</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2dba8e' }}>{suppLogs.length}/{supplements.length}</span>
            </div>
            {supplements.map(sup => {
              const taken = suppLogs.find(l => l.supplementId === sup.id);
              return (
                <div key={sup.id} onClick={() => toggleSupplement(sup)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderTop: '1px solid #e5e5e7', cursor: 'pointer' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 6, border: taken ? 'none' : '2px solid #d1d5db', background: taken ? '#2dba8e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {taken && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: taken ? '#9ca3af' : '#1a1a1a', textDecoration: taken ? 'line-through' : 'none' }}>{sup.name}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>{sup.activeDose}{sup.activeIngredient ? ` · ${sup.activeIngredient}` : ''}</div>
                  </div>
                  {taken && <span style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(taken.takenAt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Symptoms */}
      {daySymptoms.length > 0 && (
        <div style={card}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280', marginBottom: 12 }}>Symptoms Today</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {daySymptoms.map(s => {
                const st = SYMPTOM_MAP[s.type];
                return (
                  <span key={s.id} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 10, background: `${st?.color || '#888'}14`, border: `1px solid ${st?.color || '#888'}25`, color: st?.color || '#888', fontWeight: 500, letterSpacing: 0.3 }}>
                    {st?.icon} {st?.label} {s.severity}/5
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Habit Streaks */}
      <div style={card}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280' }}>Logging Streak</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>30 days</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-start' }}>
            {habitDots.map(dk => {
              const dayEntries = weekEntries.length > 0 || true; // simplified — just show the dots
              return (
                <div key={dk} style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: dk === dateKey() ? '#5b9ef0' : '#e5e5e7',
                  border: dk === dateKey() ? 'none' : '1px solid #e5e5e7',
                }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* Day Status Bar */}
      {tot.cal > 0 && (
        <div style={{ margin: '8px 16px 0', padding: '12px 16px', background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, color: calStatus === 'on_track' ? '#2dba8e' : calStatus === 'under' ? '#3b82f6' : '#ef4444' }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: calStatus === 'on_track' ? '#2dba8e' : calStatus === 'under' ? '#3b82f6' : '#ef4444' }}>
              {calStatus === 'on_track' ? 'On track' : calStatus === 'under' ? `${r1(goals.calories - tot.cal)} under` : `${r1(tot.cal - goals.calories)} over`}
            </span>
          </div>
          <div style={{ width: 1, height: 16, background: '#e5e5e7' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#e0a526' }}>P</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: protStatus === 'on_track' ? '#2dba8e' : '#3b82f6' }}>
              {protStatus === 'on_track' ? 'On track' : `${r1(goals.proteinG - tot.protein)}g left`}
            </span>
          </div>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
