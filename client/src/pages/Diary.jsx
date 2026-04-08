import { useState, useEffect } from 'react';
import { api } from '../api';

const SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const SLOT_COL = { Breakfast: '#f59e0b', Lunch: '#3b82f6', Dinner: '#8b5cf6', Snacks: '#10b981' };
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

  const isToday = curDate === dateKey();

  useEffect(() => { loadData(); }, [curDate]);

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

  const slotTot = (sl) => {
    let c = 0, p = 0;
    (diary[sl] || []).forEach(i => { c += i.calories || 0; p += i.proteinG || 0; });
    return { cal: r1(c), protein: r1(p) };
  };

  const pct = goals.calories > 0 ? Math.min(100, Math.round((tot.cal / goals.calories) * 100)) : 0;

  // Remaining / per-meal targets
  const remaining = {
    cal: r1(Math.max(0, goals.calories - tot.cal)),
    protein: r1(Math.max(0, goals.proteinG - tot.protein)),
    fat: r1(Math.max(0, goals.fatG - tot.fat)),
    carbs: r1(Math.max(0, goals.carbsG - tot.carbs)),
  };
  const mealsLeft = SLOTS.filter(sl => !(diary[sl]?.length > 0)).length;
  const perMeal = {
    cal: r1(remaining.cal / Math.max(1, mealsLeft)),
    protein: r1(remaining.protein / Math.max(1, mealsLeft)),
    fat: r1(remaining.fat / Math.max(1, mealsLeft)),
    carbs: r1(remaining.carbs / Math.max(1, mealsLeft)),
  };

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

  async function deleteEntry(id) {
    await api.deleteDiaryEntry(id);
    setDel(null);
    const d = await api.getDiary(curDate);
    setDiary(d);
    loadWeekData(goals);
  }

  const card = { background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' };
  const ac = '#2dba8e', gn = '#2dba8e', or = '#e0a526', rd = '#f85149', t1 = '#e6edf3', t2 = '#8b949e', t3 = '#484f58', brd = 'rgba(255,255,255,0.08)';

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

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Delete modal */}
      {del && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setDel(null)}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, padding: 24, width: '100%', maxWidth: 300 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Delete?</div>
            <div style={{ fontSize: 14, color: t2, marginBottom: 20 }}>{del.label}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDel(null)} style={{ flex: 1, padding: 12, borderRadius: 12, border: `1px solid ${brd}`, background: 'rgba(255,255,255,0.05)', color: t1, fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={del.action} style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: rd, color: '#fff', fontSize: 14, fontWeight: 600 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: t3, fontWeight: 500, letterSpacing: '0.2px' }}>{new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', marginTop: 2 }}>{greet()}{profile.name ? `, ${profile.name}` : ''} 👋</div>
        </div>
        {streak > 0 && (
          <div style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)', borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>🔥</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{streak}</div>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>streak</div>
            </div>
          </div>
        )}
      </div>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px 20px 6px', gap: 20 }}>
        <button onClick={() => setCurDate(d => shiftDate(d, -1))} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${brd}`, color: t2, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 700, minWidth: 120, textAlign: 'center' }}>{fmtDate(curDate)}</div>
        <button onClick={() => setCurDate(d => shiftDate(d, 1))} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${brd}`, color: t2, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      {/* Calorie hero card */}
      <div style={{ padding: '8px 20px 4px' }} onClick={() => setMp(p => (p + 1) % 3)}>
        <div style={{ ...card, padding: '22px 20px', background: 'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)', color: '#fff', cursor: 'pointer' }}>
          {mp === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0 }}>
                <svg width="76" height="76" viewBox="0 0 76 76">
                  <circle cx="38" cy="38" r="33" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="7" />
                  <circle cx="38" cy="38" r="33" fill="none" stroke="#fff" strokeWidth="7" strokeDasharray={`${(pct / 100) * 207.3} 207.3`} strokeLinecap="round" transform="rotate(-90 38 38)" style={{ transition: 'all 0.4s' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{pct}%</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div><div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700, letterSpacing: '0.5px' }}>GOAL</div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{goals.calories}</div></div>
                  <div><div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700, letterSpacing: '0.5px' }}>EATEN</div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>{tot.cal}</div></div>
                  <div><div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700, letterSpacing: '0.5px' }}>LEFT</div><div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, color: goals.calories - tot.cal < 0 ? '#fca5a5' : '#fff' }}>{r1(goals.calories - tot.cal)}</div></div>
                </div>
              </div>
            </div>
          )}
          {mp === 1 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', marginBottom: 14 }}>MACROS</div>
              <div style={{ display: 'flex', gap: 12 }}>
                {[{ l: 'Protein', v: tot.protein, g: goals.proteinG, c: '#93c5fd' }, { l: 'Fat', v: tot.fat, g: goals.fatG, c: '#fde68a' }, { l: 'Carbs', v: tot.carbs, g: goals.carbsG, c: '#6ee7b7' }].map(m => {
                  const p = Math.min(100, Math.round((m.v / m.g) * 100));
                  return (
                    <div key={m.l} style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, opacity: 0.6, fontWeight: 700, letterSpacing: '0.5px' }}>{m.l}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>{m.v}<span style={{ fontSize: 12, opacity: 0.5 }}>/{m.g}g</span></div>
                      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.15)', marginTop: 6 }}>
                        <div style={{ height: 5, borderRadius: 3, background: m.c, width: `${p}%`, transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {mp === 2 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6, letterSpacing: '0.5px', marginBottom: 10 }}>REMAINING TODAY · {mealsLeft} MEAL{mealsLeft !== 1 ? 'S' : ''} LEFT</div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div><div style={{ fontSize: 10, opacity: 0.5, fontWeight: 600 }}>Total left</div><div style={{ fontSize: 22, fontWeight: 800 }}>{remaining.cal} <span style={{ fontSize: 11, opacity: 0.5 }}>cal</span></div></div>
                <div style={{ width: 1, background: 'rgba(255,255,255,0.2)' }} />
                <div><div style={{ fontSize: 10, opacity: 0.5, fontWeight: 600 }}>Per meal</div><div style={{ fontSize: 22, fontWeight: 800 }}>{perMeal.cal} <span style={{ fontSize: 11, opacity: 0.5 }}>cal</span></div><div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{perMeal.protein}g P · {perMeal.fat}g F · {perMeal.carbs}g C</div></div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 14 }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: mp === i ? '#fff' : 'rgba(255,255,255,0.25)' }} />)}
          </div>
        </div>
      </div>

      {/* Weekly calendar */}
      {weekData && (
        <div style={{ padding: '8px 20px 4px' }}>
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: weekData.weekGoal - weekData.totalCal > 0 ? gn : rd }}>{r1(weekData.weekGoal - weekData.totalCal)} cal left</div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {weekData.days.map((d, i) => {
                const p = goals.calories > 0 ? Math.min(100, Math.round((d.cal / goals.calories) * 100)) : 0;
                const isTdy = d.dk === dateKey();
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: isTdy ? ac : t3, marginBottom: 4 }}>{d.dayName}</div>
                    <div style={{ height: 40, borderRadius: 6, background: brd, position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', bottom: 0, width: '100%', height: `${p}%`, borderRadius: 6, background: p > 100 ? rd : isTdy ? `linear-gradient(180deg,${ac},#8b5cf6)` : d.hasData ? '#c7d2fe' : 'transparent', transition: 'height 0.3s' }} />
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: d.hasData ? t2 : t3, marginTop: 3 }}>{d.hasData ? d.cal : '-'}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: t3 }}>
              <span>Avg: {weekData.logged > 0 ? r1(weekData.totalCal / weekData.logged) : 0} cal/day</span>
              <span>{weekData.logged}/7 days</span>
            </div>
          </div>
        </div>
      )}

      {/* Meal slots */}
      <div style={{ padding: '6px 20px 0' }}>
        {SLOTS.map(slot => {
          const items = diary[slot] || [];
          const st = slotTot(slot);
          const col = SLOT_COL[slot];
          const empty = items.length === 0;
          const showTarget = empty && isToday && mealsLeft > 0 && tot.cal > 0;
          const pctUsed = goals.calories > 0 ? Math.round((tot.cal / goals.calories) * 100) : 0;
          const isLight = perMeal.cal < (goals.calories / 4) * 0.5 && mealsLeft <= 2 && pctUsed > 60;
          const isHeavy = perMeal.cal > (goals.calories / 4) * 1.5 && mealsLeft >= 2;

          return (
            <div key={slot} style={{ ...card, marginBottom: 8, padding: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: col }} />
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{slot}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                  <span style={{ color: ac, fontWeight: 700 }}>{st.protein}g P</span>
                  <span style={{ color: t2, fontWeight: 600 }}>{st.cal} cal</span>
                </div>
              </div>
              {showTarget && (
                <div style={{ margin: '2px 12px 8px', padding: '10px 14px', borderRadius: 12, background: isLight ? rd + '08' : isHeavy ? or + '08' : ac + '06', border: `1px solid ${isLight ? rd + '20' : isHeavy ? or + '20' : ac + '15'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isLight ? rd : isHeavy ? or : ac} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" /></svg>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isLight ? rd : isHeavy ? or : t1 }}>Target</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 800, color: isLight ? rd : isHeavy ? or : t1 }}>{perMeal.cal} cal</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: ac }}>{perMeal.protein}g P</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: or }}>{perMeal.fat}g F</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: gn }}>{perMeal.carbs}g C</span>
                  </div>
                  {isLight && <div style={{ fontSize: 10, color: rd, marginTop: 4, fontWeight: 500 }}>Light meal needed — you've used {pctUsed}% of your daily budget</div>}
                </div>
              )}
              {empty && (yesterdayDiary[slot] || []).length > 0 && (
                <button onClick={async () => { await api.copyMeal(shiftDate(curDate, -1), curDate, slot); const d = await api.getDiary(curDate); setDiary(d); loadWeekData(goals); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 16px', background: 'none', border: 'none', borderTop: `1px solid ${brd}`, color: ac, fontSize: 11, fontWeight: 600, width: '100%', cursor: 'pointer' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  Copy from yesterday ({(yesterdayDiary[slot] || []).length} item{(yesterdayDiary[slot] || []).length !== 1 ? 's' : ''})
                </button>
              )}
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderTop: `1px solid ${brd}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: t1 }}>{item.name}</div>
                    {item.portion && <div style={{ fontSize: 11, color: t3, marginTop: 1 }}>{item.portion}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: ac, fontWeight: 700, marginRight: 10 }}>{item.proteinG}g</span>
                  <span style={{ fontSize: 12, color: t2, fontWeight: 500, marginRight: 8, minWidth: 30, textAlign: 'right' }}>{item.calories}</span>
                  <button onClick={() => setDel({ label: item.name, action: () => deleteEntry(item.id) })} style={{ background: 'none', border: 'none', color: t3, fontSize: 16, padding: '2px 0 2px 6px' }}>×</button>
                </div>
              ))}
              <button onClick={() => openPicker(slot, curDate)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', borderTop: `1px solid ${brd}`, background: 'none', border: 'none', borderTop: `1px solid ${brd}`, color: ac, fontSize: 14, fontWeight: 600, width: '100%' }}>
                <span style={{ fontSize: 17 }}>+</span> Add
              </button>
            </div>
          );
        })}
      </div>

      {/* Symptoms */}
      {daySymptoms.length > 0 && (
        <div style={{ padding: '4px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.5px' }}>Symptoms</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {daySymptoms.map(s => {
              const st = SYMPTOM_MAP[s.type];
              return (
                <div key={s.id} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 10, background: (st?.color || t3) + '12', border: `1px solid ${(st?.color || t3)}25`, color: st?.color || t3, fontWeight: 600 }}>
                  {st?.icon} {st?.label} {s.severity}/5
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Water tracking */}
      {isToday && (
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Water</span>
              </div>
              <span style={{ fontSize: 15, fontWeight: 800, color: waterPct >= 100 ? gn : t1 }}>{r1(totalWater / 1000)}L <span style={{ fontSize: 11, fontWeight: 500, color: t3 }}>/ {r1(goals.waterMl / 1000)}L</span></span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: brd, marginBottom: 10 }}>
              <div style={{ height: 6, borderRadius: 3, background: waterPct >= 100 ? gn : ac, width: `${waterPct}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[250, 500, 750].map(ml => (
                <button key={ml} onClick={() => addWater(ml)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1.5px solid ${ac}20`, background: ac + '08', color: ac, fontSize: 13, fontWeight: 700 }}>
                  + {ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
                </button>
              ))}
            </div>
            {waterLogs.length > 0 && (
              <div>
                <button onClick={() => setWaterExpanded(!waterExpanded)} style={{ background: 'none', border: 'none', color: t3, fontSize: 11, fontWeight: 600, padding: '8px 0 0', width: '100%', textAlign: 'left' }}>
                  {waterExpanded ? 'Hide entries ▲' : `${waterLogs.length} entries today ▼`}
                </button>
                {waterExpanded && (
                  <div style={{ marginTop: 4 }}>
                    {waterLogs.map(w => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12, color: t2 }}>
                        <span>{new Date(w.timestamp).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true })} — {w.amountMl}ml</span>
                        <button onClick={async () => { await api.deleteWater(w.id); setWaterLogs(await api.getWater(curDate)); }} style={{ background: 'none', border: 'none', color: t3, fontSize: 14 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Supplements */}
      {isToday && supplements.length > 0 && (
        <div style={{ padding: '8px 20px 0' }}>
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" /><path d="m8.5 8.5 7 7" /></svg>
                <span style={{ fontSize: 14, fontWeight: 700 }}>Supplements</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: suppLogs.length === supplements.length ? gn : t3 }}>{suppLogs.length}/{supplements.length}</span>
            </div>
            {supplements.map(sup => {
              const taken = suppLogs.find(l => l.supplementId === sup.id);
              return (
                <div key={sup.id} onClick={() => toggleSupplement(sup)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${brd}`, cursor: 'pointer' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 7, border: taken ? 'none' : `2px solid ${brd}`, background: taken ? gn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {taken && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: taken ? t2 : t1, textDecoration: taken ? 'line-through' : 'none' }}>{sup.name}</div>
                    <div style={{ fontSize: 11, color: t3 }}>{sup.activeDose}{sup.activeIngredient ? ` · ${sup.activeIngredient}` : ''}</div>
                  </div>
                  {taken && <span style={{ fontSize: 10, color: t3 }}>{new Date(taken.takenAt).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
                </div>
              );
            })}
            <button onClick={() => goTo('settings')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0 0', background: 'none', border: 'none', color: ac, fontSize: 12, fontWeight: 600 }}>Manage supplements →</button>
          </div>
        </div>
      )}
    </div>
  );
}
