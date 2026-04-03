import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const MEAL_TIMES = ['7:00 AM', '11:30 AM', '3:30 PM', '7:30 PM', '9:00 PM', '10:00 PM'];

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
  return d.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' });
}
function dayNum(k) {
  return new Date(k + 'T12:00:00').getDate();
}
function dayLetter(k) {
  return ['S','M','T','W','T','F','S'][new Date(k + 'T12:00:00').getDay()];
}

export default function Home({ openPicker }) {
  const [curDate, setCurDate] = useState(dateKey());
  const [diary, setDiary] = useState({});
  const [profile, setProfile] = useState({});
  const [goals, setGoals] = useState({ calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 });
  const [waterLogs, setWaterLogs] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [suppLogs, setSuppLogs] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [del, setDel] = useState(null);
  const [mealCount, setMealCount] = useState(4);

  const isToday = curDate === dateKey();
  const SLOTS = Array.from({ length: mealCount }, (_, i) => `Meal ${i + 1}`);

  useEffect(() => { loadData(); }, [curDate]);

  async function loadData() {
    const [d, p, g, symp] = await Promise.all([
      api.getDiary(curDate), api.getProfile(), api.getGoals(), api.getSymptoms(20),
    ]);
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
  }

  // Totals
  const tot = { cal: 0, protein: 0, fat: 0, carbs: 0 };
  SLOTS.forEach(sl => (diary[sl] || []).forEach(i => {
    tot.cal += i.calories || 0; tot.protein += i.proteinG || 0;
    tot.fat += i.fatG || 0; tot.carbs += i.carbsG || 0;
  }));
  Object.keys(tot).forEach(k => tot[k] = r1(tot[k]));

  const totalWater = waterLogs.reduce((s, w) => s + w.amountMl, 0);

  // Per-meal targets (equal split)
  const perMealCal = r1(goals.calories / mealCount);
  const perMealP = r1(goals.proteinG / mealCount);
  const perMealF = r1(goals.fatG / mealCount);
  const perMealC = r1(goals.carbsG / mealCount);

  // Rebalanced targets for remaining empty meals
  const mealsLeft = SLOTS.filter(sl => !(diary[sl]?.length > 0)).length;
  const rebalCal = mealsLeft > 0 ? r1(Math.max(0, goals.calories - tot.cal) / mealsLeft) : 0;
  const rebalP = mealsLeft > 0 ? r1(Math.max(0, goals.proteinG - tot.protein) / mealsLeft) : 0;
  const rebalF = mealsLeft > 0 ? r1(Math.max(0, goals.fatG - tot.fat) / mealsLeft) : 0;
  const rebalC = mealsLeft > 0 ? r1(Math.max(0, goals.carbsG - tot.carbs) / mealsLeft) : 0;

  // Week days for calendar
  const getWeekDays = () => {
    const dow = new Date(curDate + 'T12:00:00').getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    return Array.from({ length: 7 }, (_, i) => {
      const dk = shiftDate(curDate, mo + i);
      return { dk, num: dayNum(dk), letter: dayLetter(dk), isSelected: dk === curDate, isToday: dk === dateKey() };
    });
  };

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

  // Status helpers
  const calOnTrack = tot.cal >= goals.calories * 0.9 && tot.cal <= goals.calories * 1.1;
  const protOnTrack = tot.protein >= goals.proteinG * 0.9;

  return (
    <div style={{ paddingBottom: 92, background: '#f5f5f7', minHeight: '100vh' }}>
      {/* Delete modal */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 14, padding: 24, width: '100%', maxWidth: 300, border: '1px solid #e5e5e7' }}>
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Delete?</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>{del.label}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDel(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: '1px solid #e5e5e7', background: '#fff', fontSize: 14, fontWeight: 500 }}>Cancel</button>
              <button onClick={del.action} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: '#ef4444', color: '#fff', fontSize: 14, fontWeight: 500 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Top header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e7' }}>
        {/* Date row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px 16px 8px', gap: 12 }}>
          <button onClick={() => setCurDate(d => shiftDate(d, -1))} style={{ background: 'none', border: 'none', fontSize: 20, color: '#1a1a1a', padding: '4px 8px' }}>‹</button>
          <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>{fmtDate(curDate)}</span>
          <button onClick={() => setCurDate(d => shiftDate(d, 1))} style={{ background: 'none', border: 'none', fontSize: 20, color: '#1a1a1a', padding: '4px 8px' }}>›</button>
        </div>

        {/* Week calendar pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '0 12px 10px' }}>
          {getWeekDays().map(d => (
            <button key={d.dk} onClick={() => setCurDate(d.dk)} style={{
              width: 40, padding: '6px 0', borderRadius: 20, border: 'none', textAlign: 'center',
              background: d.isSelected ? '#1a1a1a' : 'transparent',
              color: d.isSelected ? '#ffffff' : d.isToday ? '#2dba8e' : '#1a1a1a',
            }}>
              <div style={{ fontSize: 10, fontWeight: 500, color: d.isSelected ? 'rgba(255,255,255,0.6)' : '#9ca3af' }}>{d.letter}</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{d.num}</div>
            </button>
          ))}
        </div>

        {/* Macro progress bars */}
        <div style={{ display: 'flex', gap: 0, padding: '0 0 2px' }}>
          {[
            { label: '🔥', val: tot.cal, goal: goals.calories, color: '#3b82f6' },
            { label: 'P', val: tot.protein, goal: goals.proteinG, color: '#ef4444' },
            { label: 'F', val: tot.fat, goal: goals.fatG, color: '#e0a526' },
            { label: 'C', val: tot.carbs, goal: goals.carbsG, color: '#2dba8e' },
          ].map(m => {
            const pct = m.goal > 0 ? Math.min(100, (m.val / m.goal) * 100) : 0;
            return (
              <div key={m.label} style={{ flex: 1, textAlign: 'center', padding: '6px 4px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a' }}>
                  <span style={{ color: m.color }}>{m.label}</span> {m.val}/{m.goal}
                </div>
                <div style={{ height: 4, borderRadius: 2, background: '#f0f0f2', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 2, background: pct > 100 ? '#ef4444' : m.color, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step count target (optional — like RP) */}
      {isToday && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 18px', background: '#ffffff', borderBottom: '1px solid #e5e5e7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>💧</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: '#1a1a1a' }}>Water: {r1(totalWater / 1000)}L / {r1(goals.waterMl / 1000)}L</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[250, 500].map(ml => (
              <button key={ml} onClick={() => addWater(ml)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e5e7', background: '#fff', fontSize: 11, fontWeight: 500, color: '#3b82f6' }}>+{ml}</button>
            ))}
          </div>
        </div>
      )}

      {/* Weigh-in row (like RP) */}
      {isToday && (
        <div style={{ padding: '0 0', background: '#ffffff', borderBottom: '1px solid #e5e5e7' }}>
          {/* Supplements inline */}
          {supplements.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', gap: 8, overflowX: 'auto' }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, flexShrink: 0 }}>💊</span>
              {supplements.map(sup => {
                const taken = suppLogs.find(l => l.supplementId === sup.id);
                return (
                  <button key={sup.id} onClick={() => toggleSupplement(sup)} style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, flexShrink: 0,
                    border: taken ? '1px solid #2dba8e' : '1px solid #e5e5e7',
                    background: taken ? 'rgba(45,186,142,0.08)' : '#fff',
                    color: taken ? '#2dba8e' : '#6b7280',
                    textDecoration: taken ? 'line-through' : 'none',
                  }}>
                    {taken ? '✓ ' : ''}{sup.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Meal schedule */}
      <div style={{ background: '#ffffff', marginTop: 8 }}>
        {SLOTS.map((slot, i) => {
          const items = diary[slot] || [];
          const empty = items.length === 0;
          const mealCal = r1(items.reduce((s, item) => s + (item.calories || 0), 0));
          const mealP = r1(items.reduce((s, item) => s + (item.proteinG || 0), 0));
          const mealF = r1(items.reduce((s, item) => s + (item.fatG || 0), 0));
          const mealC = r1(items.reduce((s, item) => s + (item.carbsG || 0), 0));
          const time = MEAL_TIMES[i] || '';

          // Target macros for this meal (rebalanced if some meals eaten)
          const targetCal = tot.cal > 0 ? rebalCal : perMealCal;
          const targetP = tot.cal > 0 ? rebalP : perMealP;
          const targetF = tot.cal > 0 ? rebalF : perMealF;
          const targetC = tot.cal > 0 ? rebalC : perMealC;

          return (
            <div key={slot} style={{ borderBottom: '1px solid #f0f0f2' }}>
              {/* Meal header row */}
              <button onClick={() => openPicker(slot, curDate)} style={{
                display: 'flex', alignItems: 'center', width: '100%', padding: '14px 18px',
                background: 'none', border: 'none', textAlign: 'left', gap: 12,
              }}>
                {/* Meal icon + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                  <span style={{ fontSize: 13 }}>🍽</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{slot}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{time}</div>
                  </div>
                </div>

                {/* Macro display */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {!empty ? (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', background: 'rgba(59,130,246,0.06)', padding: '3px 8px', borderRadius: 6 }}>{mealCal}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'rgba(239,68,68,0.06)', padding: '3px 8px', borderRadius: 6 }}>{mealP}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#e0a526', background: 'rgba(224,165,38,0.06)', padding: '3px 8px', borderRadius: 6 }}>{mealF}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#2dba8e', background: 'rgba(45,186,142,0.06)', padding: '3px 8px', borderRadius: 6 }}>{mealC}</span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: '#d1d5db', background: '#f5f5f7', padding: '3px 8px', borderRadius: 6 }}>{Math.round(targetCal)}</span>
                      <span style={{ fontSize: 12, color: '#d1d5db', background: '#f5f5f7', padding: '3px 8px', borderRadius: 6 }}>{Math.round(targetP)}</span>
                      <span style={{ fontSize: 12, color: '#d1d5db', background: '#f5f5f7', padding: '3px 8px', borderRadius: 6 }}>{Math.round(targetF)}</span>
                      <span style={{ fontSize: 12, color: '#d1d5db', background: '#f5f5f7', padding: '3px 8px', borderRadius: 6 }}>{Math.round(targetC)}</span>
                    </>
                  )}
                </div>
              </button>

              {/* Food items (if any) */}
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '4px 18px 4px 52px', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, color: '#6b7280' }}>{item.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{item.calories} cal</span>
                  <button onClick={(e) => { e.stopPropagation(); setDel({ label: item.name, action: () => deleteEntry(item.id) }); }} style={{ background: 'none', border: 'none', color: '#d1d5db', fontSize: 13, padding: '2px' }}>×</button>
                </div>
              ))}
              {items.length > 0 && <div style={{ height: 6 }} />}
            </div>
          );
        })}

        {/* Add meal button */}
        {mealCount < 6 && (
          <button onClick={() => setMealCount(c => c + 1)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%',
            padding: '12px', background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, fontWeight: 500,
          }}>+ Add meal</button>
        )}
      </div>

      {/* Symptoms */}
      {symptoms.filter(s => s.timestamp?.split('T')[0] === curDate).length > 0 && (
        <div style={{ padding: '10px 18px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {symptoms.filter(s => s.timestamp?.split('T')[0] === curDate).map(s => {
              const map = { reflux: '🔥 Reflux', bloating: '🫧 Bloating', energy_high: '⚡ Energy ↑', energy_low: '😴 Energy ↓', headache: '🤕 Headache' };
              return <span key={s.id} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#fff', border: '1px solid #e5e5e7', color: '#6b7280' }}>{map[s.type] || s.type}</span>;
            })}
          </div>
        </div>
      )}

      {/* Bottom status bar — fixed above nav */}
      {tot.cal > 0 && (
        <div style={{ position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, padding: '0 16px', zIndex: 50 }}>
          <div style={{ padding: '10px 16px', background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12 }}>🔥</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: calOnTrack ? '#2dba8e' : tot.cal > goals.calories ? '#ef4444' : '#1a1a1a' }}>
                {calOnTrack ? 'on track' : tot.cal > goals.calories ? `${r1(tot.cal - goals.calories)} over` : `${r1(goals.calories - tot.cal)} left`}
              </span>
            </div>
            <div style={{ width: 1, height: 14, background: '#e5e5e7' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>P</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: protOnTrack ? '#2dba8e' : '#1a1a1a' }}>
                {protOnTrack ? 'on track' : `${r1(goals.proteinG - tot.protein)}g left`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
