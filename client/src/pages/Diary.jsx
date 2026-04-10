import { useState, useEffect } from 'react';
import { api } from '../api';

const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const r1 = n => Math.round(n * 10) / 10;

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(k, n) {
  const d = new Date(k + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateKey(d);
}
function fmtDate(k) {
  const d = new Date(k + 'T00:00:00'), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}
function greet() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Diary({ openPicker, goTo }) {
  const [curDate, setCurDate] = useState(dateKey());
  const [diary, setDiary] = useState({ Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [profile, setProfile] = useState({});
  const [goals, setGoals] = useState({ calories: 2300, proteinG: 150, fatG: 80, carbsG: 250, waterMl: 2500 });
  const [waterLogs, setWaterLogs] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [suppLogs, setSuppLogs] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [weekData, setWeekData] = useState(null);
  const [yesterdayDiary, setYesterdayDiary] = useState({ Breakfast: [], Lunch: [], Dinner: [], Snacks: [] });
  const [mp, setMp] = useState(0);
  const [waterExpanded, setWaterExpanded] = useState(false);
  const [del, setDel] = useState(null);
  const [editFood, setEditFood] = useState(null);
  // Locked meals — persisted in localStorage per date
  const lockKey = `locks_${curDate}`;
  const [lockedMeals, setLockedMeals] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(lockKey) || '[]')); } catch { return new Set(); }
  });

  const isToday = curDate === dateKey();

  useEffect(() => {
    loadData();
    try { setLockedMeals(new Set(JSON.parse(localStorage.getItem(`locks_${curDate}`) || '[]'))); } catch { setLockedMeals(new Set()); }
  }, [curDate]);

  async function loadData() {
    const yesterdayDate = shiftDate(curDate, -1);
    const [d, p, g, symp, yd] = await Promise.all([
      api.getDiary(curDate),
      api.getProfile(),
      api.getGoals(),
      api.getSymptoms(20),
      api.getDiary(yesterdayDate),
    ]);
    setDiary(d);
    if (p) setProfile(p);
    if (g) setGoals(g);
    setSymptoms(symp);
    setYesterdayDiary(yd);

    if (isToday) {
      const [w, s, sl] = await Promise.all([
        api.getWater(curDate),
        api.getSupplements(),
        api.getSupplementLogs(curDate),
      ]);
      setWaterLogs(w);
      setSupplements(s.filter(x => x.isActive));
      setSuppLogs(sl);
    }

    // Load week data
    loadWeekData(g || goals);
  }

  async function loadWeekData(g) {
    const today = dateKey();
    const dow = new Date().getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    const weekStart = shiftDate(today, mo);
    const weekEnd = shiftDate(weekStart, 6);
    try {
      const entries = await api.getDiaryRange(weekStart, weekEnd);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const dk = shiftDate(weekStart, i);
        const dayEntries = entries.filter(e => e.date.split('T')[0] === dk);
        let cal = 0, protein = 0;
        dayEntries.forEach(e => { cal += e.calories; protein += e.proteinG; });
        days.push({
          dk, cal: r1(cal), protein: r1(protein),
          hasData: dayEntries.length > 0,
          dayName: new Date(dk + 'T00:00:00').toLocaleDateString('en-NZ', { weekday: 'short' }).charAt(0),
        });
      }
      const totalCal = days.reduce((s, d) => s + d.cal, 0);
      const logged = days.filter(d => d.hasData).length;
      if (logged >= 1) setWeekData({ days, totalCal: r1(totalCal), logged, weekGoal: g.calories * 7 });
      else setWeekData(null);
    } catch { setWeekData(null); }
  }

  // Totals
  const tot = { cal: 0, protein: 0, fat: 0, carbs: 0 };
  SLOTS.forEach(sl => (diary[sl] || []).forEach(i => {
    tot.cal += i.calories || 0; tot.protein += i.proteinG || 0;
    tot.fat += i.fatG || 0; tot.carbs += i.carbsG || 0;
  }));
  Object.keys(tot).forEach(k => tot[k] = r1(tot[k]));

  // Per-slot macro totals
  const slotMacros = (sl) => {
    let c = 0, p = 0, f = 0, cb = 0;
    (diary[sl] || []).forEach(i => { c += i.calories || 0; p += i.proteinG || 0; f += i.fatG || 0; cb += i.carbsG || 0; });
    return { cal: r1(c), protein: r1(p), fat: r1(f), carbs: r1(cb) };
  };

  const slotTot = (sl) => {
    let c = 0, p = 0;
    (diary[sl] || []).forEach(i => { c += i.calories || 0; p += i.proteinG || 0; });
    return { cal: r1(c), protein: r1(p) };
  };

  const pct = goals.calories > 0 ? Math.min(100, Math.round((tot.cal / goals.calories) * 100)) : 0;

  // Remaining = goal minus everything eaten
  const remaining = {
    cal: r1(Math.max(0, goals.calories - tot.cal)),
    protein: r1(Math.max(0, goals.proteinG - tot.protein)),
    fat: r1(Math.max(0, goals.fatG - tot.fat)),
    carbs: r1(Math.max(0, goals.carbsG - tot.carbs)),
  };

  // Base per-meal target (equal split)
  const basePM = {
    cal: r1(goals.calories / SLOTS.length),
    protein: r1(goals.proteinG / SLOTS.length),
    fat: r1(goals.fatG / SLOTS.length),
    carbs: r1(goals.carbsG / SLOTS.length),
  };

  // When meals are locked, calculate shortfall and redistribute
  const shortfall = { cal: 0, protein: 0, fat: 0, carbs: 0 };
  SLOTS.forEach(sl => {
    if (lockedMeals.has(sl)) {
      const sm = slotMacros(sl);
      shortfall.cal += basePM.cal - sm.cal;
      shortfall.protein += basePM.protein - sm.protein;
      shortfall.fat += basePM.fat - sm.fat;
      shortfall.carbs += basePM.carbs - sm.carbs;
    }
  });

  const unlockedMeals = SLOTS.filter(sl => !lockedMeals.has(sl));
  const perMeal = {
    cal: r1(basePM.cal + (shortfall.cal / Math.max(1, unlockedMeals.length))),
    protein: r1(basePM.protein + (shortfall.protein / Math.max(1, unlockedMeals.length))),
    fat: r1(basePM.fat + (shortfall.fat / Math.max(1, unlockedMeals.length))),
    carbs: r1(basePM.carbs + (shortfall.carbs / Math.max(1, unlockedMeals.length))),
  };

  function toggleLock(slot) {
    setLockedMeals(prev => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot); else next.add(slot);
      localStorage.setItem(lockKey, JSON.stringify([...next]));
      return next;
    });
  }

  // Streak (simplified — count today backwards)
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    // Simple streak: if today has entries, count from today, else 0
    if (diary.Breakfast?.length || diary.Lunch?.length || diary.Dinner?.length || diary.Snacks?.length) {
      setStreak(prev => Math.max(prev, 1));
    }
  }, [diary]);

  // Water
  const totalWater = waterLogs.reduce((s, w) => s + w.amountMl, 0);
  const waterPct = goals.waterMl > 0 ? Math.min(100, Math.round((totalWater / goals.waterMl) * 100)) : 0;

  async function addWater(ml) {
    await api.logWater(ml);
    const w = await api.getWater(curDate);
    setWaterLogs(w);
  }

  async function toggleSupplement(sup) {
    const taken = suppLogs.find(l => l.supplementId === sup.id);
    if (taken) {
      await api.deleteSupplementLog(taken.id);
    } else {
      await api.logSupplement(sup.id);
    }
    const sl = await api.getSupplementLogs(curDate);
    setSuppLogs(sl);
  }

  async function saveEditFood() {
    if (!editFood) return;
    await api.updateDiaryEntry(editFood.id, {
      name: editFood.name, portion: editFood.portion,
      calories: parseFloat(editFood.calories) || 0,
      proteinG: parseFloat(editFood.proteinG) || 0,
      fatG: parseFloat(editFood.fatG) || 0,
      carbsG: parseFloat(editFood.carbsG) || 0,
    });
    setEditFood(null);
    const d = await api.getDiary(curDate);
    setDiary(d);
    loadWeekData(goals);
  }

  async function deleteEntry(id) {
    await api.deleteDiaryEntry(id);
    setDel(null);
    const d = await api.getDiary(curDate);
    setDiary(d);
    loadWeekData(goals);
  }

  const card = { background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' };
  const CAL = '#42A5F5', PRO = '#E53935', FAT = '#FFA726', CARB = '#66BB6A';
  const t1 = '#212121', t2 = '#757575', t3 = '#BDBDBD', brd = '#EEEEEE', rd = '#E53935', gn = '#66BB6A', ac = '#E53935';
  const pill = (color, label, val, faded) => (
    <div style={{ padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700, background: color + '14', color, opacity: faded ? 0.4 : 1 }}>
      <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7 }}>{label}</span> {val}
    </div>
  );

  // Day symptoms
  const daySymptoms = symptoms.filter(s => s.timestamp?.split('T')[0] === curDate);
  const SYMPTOM_MAP = {
    reflux: { label: 'Reflux', icon: '🔥', color: '#ef4444' },
    bloating: { label: 'Bloating', icon: '🫧', color: '#8b5cf6' },
    energy_high: { label: 'Energy ↑', icon: '⚡', color: '#f59e0b' },
    energy_low: { label: 'Energy ↓', icon: '😴', color: '#6b7280' },
    mood_good: { label: 'Mood ↑', icon: '😊', color: '#22c55e' },
    mood_bad: { label: 'Mood ↓', icon: '😤', color: '#ef4444' },
    headache: { label: 'Headache', icon: '🤕', color: '#ec4899' },
    gut_good: { label: 'Gut Good', icon: '✅', color: '#10b981' },
  };

  // Week days for calendar
  const getWeekDays = () => {
    const dow = new Date(curDate + 'T00:00:00').getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    return Array.from({ length: 7 }, (_, i) => {
      const dk = shiftDate(curDate, mo + i);
      const wd = weekData?.days?.find(d => d.dk === dk);
      return { dk, num: new Date(dk + 'T00:00:00').getDate(), letter: ['M','T','W','T','F','S','S'][i], isSelected: dk === curDate, isToday: dk === dateKey(), cal: wd?.hasData ? wd.cal : null };
    });
  };

  return (
    <div style={{ paddingBottom: 100, background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Delete modal */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 24, width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: t1, marginBottom: 6 }}>Delete?</div>
            <div style={{ fontSize: 14, color: t2, marginBottom: 20 }}>{del.label}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDel(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${brd}`, background: '#fff', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={del.action} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: rd, color: '#fff', fontSize: 14, fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit food modal */}
      {editFood && (() => {
        const parseGrams = (p) => { const m = String(p || '').match(/(\d+)/); return m ? parseFloat(m[1]) : null; };
        const origGrams = parseGrams(editFood._origPortion);
        const curGrams = parseGrams(editFood.portion);
        const ratio = origGrams && curGrams && origGrams > 0 ? curGrams / origGrams : null;
        const displayCal = ratio ? r1(editFood._origCal * ratio) : editFood.calories;
        const displayP = ratio ? r1(editFood._origP * ratio) : editFood.proteinG;
        const displayF = ratio ? r1(editFood._origF * ratio) : editFood.fatG;
        const displayC = ratio ? r1(editFood._origC * ratio) : editFood.carbsG;

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setEditFood(null)}>
            <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 20, width: '100%', maxWidth: 400, borderRadius: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: t1, marginBottom: 12 }}>Edit Food</div>
              <input value={editFood.name} onChange={e => setEditFood(f => ({ ...f, name: e.target.value }))} placeholder="Name" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15, marginBottom: 8, boxSizing: 'border-box', color: t1 }} />
              <input value={editFood.portion || ''} onChange={e => {
                const newP = e.target.value;
                const newG = parseGrams(newP);
                if (origGrams && newG && origGrams > 0) {
                  const r = newG / origGrams;
                  setEditFood(f => ({ ...f, portion: newP, calories: r1(f._origCal * r), proteinG: r1(f._origP * r), fatG: r1(f._origF * r), carbsG: r1(f._origC * r) }));
                } else {
                  setEditFood(f => ({ ...f, portion: newP }));
                }
              }} placeholder="Portion (e.g. 200g)" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15, marginBottom: 4, boxSizing: 'border-box', color: t1 }} />
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(m => (
                  <button key={m} onClick={() => {
                    if (origGrams) {
                      const newG = r1(origGrams * m);
                      const unit = String(editFood._origPortion || '').replace(/[\d.]/g, '').trim() || 'g';
                      setEditFood(f => ({ ...f, portion: `${newG}${unit}`, calories: r1(f._origCal * m), proteinG: r1(f._origP * m), fatG: r1(f._origF * m), carbsG: r1(f._origC * m) }));
                    }
                  }} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: `1px solid ${brd}`, background: '#f5f5f5', color: t2, fontSize: 11, fontWeight: 600 }}>{m}×</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: CAL, marginBottom: 4 }}>CAL</div>
                  <input type="number" value={editFood.calories} onChange={e => setEditFood(f => ({ ...f, calories: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${brd}`, fontSize: 15, textAlign: 'center', boxSizing: 'border-box', color: t1 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: PRO, marginBottom: 4 }}>P</div>
                  <input type="number" value={editFood.proteinG} onChange={e => setEditFood(f => ({ ...f, proteinG: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${brd}`, fontSize: 15, textAlign: 'center', boxSizing: 'border-box', color: t1 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: FAT, marginBottom: 4 }}>F</div>
                  <input type="number" value={editFood.fatG} onChange={e => setEditFood(f => ({ ...f, fatG: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${brd}`, fontSize: 15, textAlign: 'center', boxSizing: 'border-box', color: t1 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: CARB, marginBottom: 4 }}>C</div>
                  <input type="number" value={editFood.carbsG} onChange={e => setEditFood(f => ({ ...f, carbsG: e.target.value }))} style={{ width: '100%', padding: '10px', borderRadius: 10, border: `1.5px solid ${brd}`, fontSize: 15, textAlign: 'center', boxSizing: 'border-box', color: t1 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditFood(null)} style={{ flex: 1, padding: 14, borderRadius: 12, border: `1.5px solid ${brd}`, background: '#fff', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                <button onClick={saveEditFood} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 700 }}>Save</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, color: t2, fontWeight: 500, letterSpacing: '0.2px' }}>{new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: t1, letterSpacing: '-0.5px', marginTop: 2 }}>{greet()}{profile.name ? `, ${profile.name}` : ''}</div>
        </div>
      </div>

      {/* Week Calendar (RP Diet style) */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '14px 16px 6px' }}>
        {getWeekDays().map(d => (
          <button key={d.dk} onClick={() => setCurDate(d.dk)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 46, padding: '4px 0', background: 'none', border: 'none' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: d.isToday ? ac : t3, textTransform: 'uppercase' }}>{d.letter}</div>
            <div style={{ width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, background: d.isSelected ? t1 : 'transparent', color: d.isSelected ? '#fff' : d.isToday ? ac : t2 }}>{d.num}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: d.cal != null ? t2 : t3 }}>{d.cal != null ? d.cal : '—'}</div>
          </button>
        ))}
      </div>

      {/* Macro Summary Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 20px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: 4, background: CAL }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: CAL }}>{tot.cal}</span>
          <span style={{ fontSize: 12, color: t3 }}>/{goals.calories}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: PRO }}>{tot.protein}</span>
          <span style={{ fontSize: 12, color: t3 }}>/{goals.proteinG}P</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: FAT }}>{tot.fat}</span>
          <span style={{ fontSize: 12, color: t3 }}>/{goals.fatG}F</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: CARB }}>{tot.carbs}</span>
          <span style={{ fontSize: 12, color: t3 }}>/{goals.carbsG}C</span>
        </div>
      </div>

      {/* Meal Cards */}
      <div style={{ padding: '0 16px' }}>
        {SLOTS.map(slot => {
          const items = diary[slot] || [];
          const sm = slotMacros(slot);
          const empty = items.length === 0;

          const locked = lockedMeals.has(slot);

          return (
            <div key={slot} style={{ ...card, marginBottom: 8, padding: 0, opacity: locked && empty ? 0.5 : 1 }}>
              {/* Meal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: empty && !locked ? t3 : locked && empty ? t3 : t1 }}>{slot}</span>
                  <button onClick={() => toggleLock(slot)} style={{
                    background: locked ? '#E8F5E9' : 'none', border: locked ? '1px solid #C8E6C9' : '1px solid ' + brd,
                    borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700,
                    color: locked ? '#43A047' : t3, display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    {locked ? (empty ? '✓ Skipped' : '✓ Done') : '○'}
                  </button>
                </div>
                {!empty && <span style={{ fontSize: 12, color: t2, fontWeight: 500 }}>{sm.cal} cal</span>}
              </div>

              {/* Macro pills — hide if locked & empty (skipped meal) */}
              {!(locked && empty) && (
                <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px' }}>
                  {pill(CAL, '\u26A1', empty ? perMeal.cal : sm.cal, empty)}
                  {pill(PRO, 'P', empty ? perMeal.protein : sm.protein, empty)}
                  {pill(FAT, 'F', empty ? perMeal.fat : sm.fat, empty)}
                  {pill(CARB, 'C', empty ? perMeal.carbs : sm.carbs, empty)}
                </div>
              )}
              {locked && empty && (
                <div style={{ padding: '0 16px 12px', fontSize: 12, color: t3, fontStyle: 'italic' }}>Skipped — macros redistributed</div>
              )}

              {/* Copy from yesterday */}
              {empty && (yesterdayDiary[slot] || []).length > 0 && (
                <button onClick={async () => { await api.copyMeal(shiftDate(curDate, -1), curDate, slot); const d = await api.getDiary(curDate); setDiary(d); loadWeekData(goals); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: CAL + '08', border: 'none', borderTop: `1px solid ${brd}`, width: '100%', fontSize: 11, color: CAL, fontWeight: 600 }}>
                  📋 Copy from yesterday ({(yesterdayDiary[slot] || []).length})
                </button>
              )}

              {/* Food items */}
              {items.map(item => (
                <div key={item.id} onClick={() => setEditFood({ ...item, _origPortion: item.portion, _origCal: item.calories, _origP: item.proteinG, _origF: item.fatG, _origC: item.carbsG })} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${brd}`, cursor: 'pointer' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t1 }}>{item.name}</div>
                    {item.portion && <div style={{ fontSize: 11, color: t3, marginTop: 1 }}>{item.portion}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: PRO, fontWeight: 700, marginRight: 8 }}>{item.proteinG}g</span>
                  <span style={{ fontSize: 12, color: t2, fontWeight: 500, marginRight: 6, minWidth: 30, textAlign: 'right' }}>{item.calories}</span>
                  <button onClick={(e) => { e.stopPropagation(); setDel({ label: item.name, action: () => deleteEntry(item.id) }); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 16, padding: '2px 0 2px 6px' }}>×</button>
                </div>
              ))}

              {/* Add button — hide on locked meals */}
              {!locked && (
                <button onClick={() => openPicker(slot, curDate)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', background: 'none', border: 'none', borderTop: `1px solid ${brd}`, color: ac, fontSize: 14, fontWeight: 600, width: '100%' }}>
                  <span style={{ fontSize: 17 }}>+</span> Add
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar — inline below meals */}
      {tot.cal > 0 && (
        <div style={{ margin: '4px 16px 8px', background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: CAL }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t1 }}>{remaining.cal} cal left</span>
          </div>
          <div style={{ width: 1, height: 16, background: brd }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: PRO }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: t1 }}>{remaining.protein}g P left</span>
          </div>
        </div>
      )}

      {/* Symptoms */}
      {daySymptoms.length > 0 && (
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t2, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>Symptoms</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {daySymptoms.map(s => {
              const st = SYMPTOM_MAP[s.type];
              return (
                <div key={s.id} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 10, background: (st?.color || t3) + '14', color: st?.color || t2, fontWeight: 600 }}>
                  {st?.icon} {st?.label} {s.severity}/5
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Supplements */}
      {isToday && supplements.length > 0 && (
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>💊</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: t1 }}>Supplements</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: suppLogs.length === supplements.length ? gn : t3 }}>{suppLogs.length}/{supplements.length}</span>
            </div>
            {supplements.map(sup => {
              const taken = suppLogs.find(l => l.supplementId === sup.id);
              return (
                <div key={sup.id} onClick={() => toggleSupplement(sup)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${brd}`, cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, border: taken ? 'none' : `2px solid ${brd}`, background: taken ? gn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {taken && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: taken ? t2 : t1, textDecoration: taken ? 'line-through' : 'none' }}>{sup.name}</div>
                    <div style={{ fontSize: 11, color: t3 }}>{sup.activeDose}{sup.activeIngredient ? ` · ${sup.activeIngredient}` : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
