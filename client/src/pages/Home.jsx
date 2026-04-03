import { useState, useEffect } from 'react';
import { api } from '../api';

const MEAL_COLORS = ['#3b82f6', '#e0a526', '#8b5ef6', '#2dba8e', '#ef4444', '#ec4899'];
const MEAL_TIMES = ['7:00 AM', '11:30 AM', '3:30 PM', '7:30 PM', '9:00 PM', '10:00 PM'];
const r1 = n => Math.round(n * 10) / 10;

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(k, n) {
  const d = new Date(k + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d);
}
function fmtDate(k) {
  const d = new Date(k + 'T12:00:00'), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

const card = { background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };

const SYMPTOM_MAP = {
  reflux: { label: 'Reflux', icon: '🔥', color: '#ef4444' },
  bloating: { label: 'Bloating', icon: '🫧', color: '#8b5cf6' },
  energy_high: { label: 'Energy ↑', icon: '⚡', color: '#e0a526' },
  energy_low: { label: 'Energy ↓', icon: '😴', color: '#6b7280' },
  mood_good: { label: 'Mood ↑', icon: '😊', color: '#2dba8e' },
  mood_bad: { label: 'Mood ↓', icon: '😤', color: '#ef4444' },
  headache: { label: 'Headache', icon: '🤕', color: '#ec4899' },
  gut_good: { label: 'Gut Good', icon: '✅', color: '#2dba8e' },
};

export default function Home({ openPicker }) {
  const [curDate, setCurDate] = useState(dateKey());
  const [diary, setDiary] = useState({});
  const [profile, setProfile] = useState({});
  const [goals, setGoals] = useState({ calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 });
  const [waterLogs, setWaterLogs] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [suppLogs, setSuppLogs] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [del, setDel] = useState(null);
  const [mealCount, setMealCount] = useState(4);

  const isToday = curDate === dateKey();
  const SLOTS = Array.from({ length: mealCount }, (_, i) => `Meal ${i + 1}`);

  useEffect(() => { loadData(); }, [curDate]);

  async function loadData() {
    const [d, p, g, symp] = await Promise.all([
      api.getDiary(curDate), api.getProfile(), api.getGoals(), api.getSymptoms(20),
    ]);
    // Map old slot names to new if needed
    const mapped = {};
    const slotMapping = { 'Breakfast': 'Meal 1', 'Lunch': 'Meal 2', 'Dinner': 'Meal 3', 'Snacks': 'Meal 4' };
    Object.entries(d || {}).forEach(([slot, items]) => {
      const newSlot = slotMapping[slot] || slot;
      mapped[newSlot] = [...(mapped[newSlot] || []), ...items];
    });
    setDiary(mapped);
    if (p) setProfile(p);
    if (g) setGoals(g);
    setSymptoms(symp);
    if (isToday) {
      const [w, s, sl] = await Promise.all([
        api.getWater(curDate), api.getSupplements(), api.getSupplementLogs(curDate),
      ]);
      setWaterLogs(w); setSupplements(s.filter(x => x.isActive)); setSuppLogs(sl);
    }
    // Week data
    const dow = new Date().getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    const ws = shiftDate(dateKey(), mo);
    const we = shiftDate(ws, 6);
    api.getDiaryRange(ws, we).then(entries => setWeekEntries(entries)).catch(() => {});
  }

  // Totals
  const tot = { cal: 0, protein: 0, fat: 0, carbs: 0 };
  SLOTS.forEach(sl => (diary[sl] || []).forEach(i => {
    tot.cal += i.calories || 0; tot.protein += i.proteinG || 0;
    tot.fat += i.fatG || 0; tot.carbs += i.carbsG || 0;
  }));
  Object.keys(tot).forEach(k => tot[k] = r1(tot[k]));

  const totalWater = waterLogs.reduce((s, w) => s + w.amountMl, 0);
  const waterPct = goals.waterMl > 0 ? Math.min(100, Math.round((totalWater / goals.waterMl) * 100)) : 0;

  // Per-meal targets
  const mealsLeft = SLOTS.filter(sl => !(diary[sl]?.length > 0)).length;
  const perMealCal = mealsLeft > 0 ? r1(Math.max(0, goals.calories - tot.cal) / mealsLeft) : 0;
  const perMealProt = mealsLeft > 0 ? r1(Math.max(0, goals.proteinG - tot.protein) / mealsLeft) : 0;

  // Day status
  const calLeft = r1(goals.calories - tot.cal);
  const protLeft = r1(goals.proteinG - tot.protein);

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
    const d = await api.getDiary(curDate);
    const mapped = {};
    const slotMapping = { 'Breakfast': 'Meal 1', 'Lunch': 'Meal 2', 'Dinner': 'Meal 3', 'Snacks': 'Meal 4' };
    Object.entries(d || {}).forEach(([slot, items]) => {
      const newSlot = slotMapping[slot] || slot;
      mapped[newSlot] = [...(mapped[newSlot] || []), ...items];
    });
    setDiary(mapped);
  }

  const daySymptoms = symptoms.filter(s => s.timestamp?.split('T')[0] === curDate);

  // Macro progress bar component
  const MacroBar = ({ label, current, goal, color, unit = '' }) => {
    const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
    return (
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>{label}</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{current}{unit} <span style={{ color: '#9ca3af' }}>/ {goal}</span></span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: '#f0f0f2', overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 3, background: pct > 100 ? '#ef4444' : color, width: `${pct}%`, transition: 'width 0.3s' }} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingBottom: 92 }}>
      {/* Delete modal */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, margin: 0, padding: 24, width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6, color: '#1a1a1a' }}>Delete?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>{del.label}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDel(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#fff', color: '#1a1a1a', fontSize: 14, fontWeight: 500 }}>Cancel</button>
              <button onClick={del.action} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 500 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header: date + greeting */}
      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>
          {profile.name ? `Hey ${profile.name}` : 'Vitals'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setCurDate(d => shiftDate(d, -1))} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18 }}>‹</button>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a', padding: '4px 14px', border: '1px solid #e5e5e7', borderRadius: 16, background: '#fff' }}>{fmtDate(curDate)}</span>
          <button onClick={() => setCurDate(d => shiftDate(d, 1))} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18 }}>›</button>
        </div>
      </div>

      {/* Macro progress bars — the hero section */}
      <div style={{ ...card, marginTop: 12 }}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Daily Targets</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: calLeft >= 0 ? '#2dba8e' : '#ef4444' }}>
              {calLeft >= 0 ? `${calLeft} cal left` : `${Math.abs(calLeft)} over`}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <MacroBar label="Calories" current={tot.cal} goal={goals.calories} color="#3b82f6" />
            <MacroBar label="Protein" current={tot.protein} goal={goals.proteinG} color="#e0a526" unit="g" />
            <MacroBar label="Fat" current={tot.fat} goal={goals.fatG} color="#2dba8e" unit="g" />
            <MacroBar label="Carbs" current={tot.carbs} goal={goals.carbsG} color="#8b5ef6" unit="g" />
          </div>
        </div>
      </div>

      {/* Meals */}
      <div style={{ padding: '14px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>Meals</span>
        {mealCount < 6 && (
          <button onClick={() => setMealCount(c => c + 1)} style={{ background: 'none', border: 'none', color: '#2dba8e', fontSize: 12, fontWeight: 600 }}>+ Add Meal</button>
        )}
      </div>

      <div style={card}>
        {SLOTS.map((slot, i) => {
          const items = diary[slot] || [];
          const color = MEAL_COLORS[i] || '#6b7280';
          const time = MEAL_TIMES[i] || '';
          const empty = items.length === 0;
          const mealCal = r1(items.reduce((s, item) => s + (item.calories || 0), 0));
          const mealProt = r1(items.reduce((s, item) => s + (item.proteinG || 0), 0));
          const mealFat = r1(items.reduce((s, item) => s + (item.fatG || 0), 0));
          const mealCarbs = r1(items.reduce((s, item) => s + (item.carbsG || 0), 0));

          return (
            <div key={slot}>
              {/* Meal header */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px 8px', borderTop: i > 0 ? '1px solid #f0f0f2' : 'none', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                  <div style={{ width: 4, height: 28, borderRadius: 2, background: color }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{slot}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{time}</div>
                  </div>
                </div>
                {/* Macro badges */}
                {!empty ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.08)', padding: '2px 6px', borderRadius: 4 }}>{mealCal}🔥</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#e0a526', background: 'rgba(224,165,38,0.08)', padding: '2px 6px', borderRadius: 4 }}>{mealProt}P</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2dba8e', background: 'rgba(45,186,142,0.08)', padding: '2px 6px', borderRadius: 4 }}>{mealFat}F</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#8b5ef6', background: 'rgba(139,94,246,0.08)', padding: '2px 6px', borderRadius: 4 }}>{mealCarbs}C</span>
                  </div>
                ) : isToday ? (
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>Target: {perMealCal}cal · {perMealProt}g P</span>
                ) : null}
              </div>

              {/* Food items */}
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 18px 6px 42px' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, color: '#1a1a1a' }}>{item.name}</span>
                    {item.portion && <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{item.portion}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: '#6b7280', marginRight: 8 }}>{item.calories}</span>
                  <button onClick={() => setDel({ label: item.name, action: () => deleteEntry(item.id) })} style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: 14 }}>×</button>
                </div>
              ))}

              {/* Add food button */}
              <button onClick={() => openPicker(slot, curDate)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: empty ? '12px 18px' : '8px 18px', width: '100%',
                background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, fontWeight: 500,
              }}>
                + Add food
              </button>
            </div>
          );
        })}
      </div>

      {/* Water + Supplements row */}
      {isToday && (
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 0' }}>
          {/* Water compact card */}
          <div style={{ flex: 1, background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>💧 Water</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: waterPct >= 100 ? '#2dba8e' : '#3b82f6' }}>{r1(totalWater / 1000)}L</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: '#f0f0f2', overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${waterPct}%`, background: waterPct >= 100 ? '#2dba8e' : '#3b82f6' }} />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[250, 500].map(ml => (
                <button key={ml} onClick={() => addWater(ml)} style={{ flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid rgba(59,130,246,0.15)', background: 'rgba(59,130,246,0.04)', color: '#3b82f6', fontSize: 11, fontWeight: 600 }}>+{ml}ml</button>
              ))}
            </div>
          </div>

          {/* Supplements compact card */}
          {supplements.length > 0 && (
            <div style={{ flex: 1, background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>💊 Supps</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: suppLogs.length === supplements.length ? '#2dba8e' : '#9ca3af' }}>{suppLogs.length}/{supplements.length}</span>
              </div>
              {supplements.slice(0, 3).map(sup => {
                const taken = suppLogs.find(l => l.supplementId === sup.id);
                return (
                  <button key={sup.id} onClick={() => toggleSupplement(sup)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '3px 0',
                    background: 'none', border: 'none', textAlign: 'left',
                  }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, border: taken ? 'none' : '1.5px solid #d1d5db', background: taken ? '#2dba8e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {taken && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                    </div>
                    <span style={{ fontSize: 11, color: taken ? '#9ca3af' : '#1a1a1a', textDecoration: taken ? 'line-through' : 'none' }}>{sup.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Symptoms */}
      {daySymptoms.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {daySymptoms.map(s => {
              const st = SYMPTOM_MAP[s.type];
              return (
                <span key={s.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: `${st?.color || '#888'}10`, border: `1px solid ${st?.color || '#888'}20`, color: st?.color || '#888', fontWeight: 500 }}>
                  {st?.icon} {st?.label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Day status bar */}
      {tot.cal > 0 && (
        <div style={{ margin: '10px 16px 0', padding: '10px 16px', background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: calLeft >= 0 ? (calLeft < goals.calories * 0.1 ? '#2dba8e' : '#3b82f6') : '#ef4444' }}>
            🔥 {calLeft >= 0 ? (calLeft < goals.calories * 0.1 ? 'On track' : `${calLeft} left`) : `${Math.abs(calLeft)} over`}
          </span>
          <div style={{ width: 1, height: 14, background: '#e5e5e7' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: protLeft <= goals.proteinG * 0.1 ? '#2dba8e' : '#e0a526' }}>
            P {protLeft <= goals.proteinG * 0.1 ? 'On track' : `${protLeft}g left`}
          </span>
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}
