import { useState, useEffect, useRef } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const t1 = '#111827', t2 = '#6b7280', t3 = '#9ca3af', ac = '#3b82f6', gn = '#22c55e', or = '#f59e0b', rd = '#ef4444', brd = '#eaeaef';
const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' };
const MUSCLE_GROUPS = ['chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abs', 'calves', 'cardio'];
const MUSCLE_COLORS = { chest: '#3b82f6', back: '#8b5cf6', shoulders: '#f59e0b', quads: '#ef4444', hamstrings: '#ec4899', glutes: '#f97316', biceps: '#06b6d4', triceps: '#14b8a6', abs: '#84cc16', calves: '#a855f7', cardio: '#22c55e' };

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Training({ goTo }) {
  const [view, setView] = useState('home'); // home, session, picker
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({});
  const [searchQ, setSearchQ] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [volume, setVolume] = useState({});
  const [editingSet, setEditingSet] = useState(null); // {exerciseId, setId?, reps, weightKg, rir}
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => { loadData(); }, []);

  // Rest timer
  useEffect(() => {
    if (timerRunning && timer > 0) {
      timerRef.current = setTimeout(() => setTimer(t => t - 1), 1000);
    } else if (timer === 0 && timerRunning) {
      setTimerRunning(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [timer, timerRunning]);

  function startTimer(secs = 120) {
    setTimer(secs);
    setTimerRunning(true);
  }

  async function loadData() {
    const [s, v] = await Promise.all([
      api.getTrainingSessions(),
      api.getTrainingVolume(7),
    ]);
    setSessions(s);
    setVolume(v);
    // Build exercise map
    const ids = new Set();
    s.forEach(sess => (sess.sets || []).forEach(set => ids.add(set.exerciseId)));
    if (ids.size > 0) {
      const exs = await api.searchExercises('', '');
      const map = {};
      exs.forEach(e => { map[e.id] = e; });
      setExerciseMap(map);
    }
    // Resume today's active session
    const todaySession = s.find(sess => sess.date?.split('T')[0] === dateKey() && !sess.durationMins);
    if (todaySession) {
      setActiveSession(todaySession);
      setView('session');
    }
  }

  async function startWorkout(name) {
    const session = await api.createSession({ date: dateKey(), name: name || 'Workout' });
    setActiveSession(session);
    setSessions(prev => [session, ...prev]);
    setView('session');
  }

  async function openPicker() {
    setView('picker');
    setSearchQ('');
    setMuscleFilter('all');
    const exs = await api.searchExercises('', '');
    setExercises(exs);
  }

  async function searchExercises(q, muscle) {
    const exs = await api.searchExercises(q, muscle === 'all' ? '' : muscle);
    setExercises(exs);
  }

  async function addExercise(exercise) {
    if (!activeSession) return;
    setExerciseMap(prev => ({ ...prev, [exercise.id]: exercise }));
    await api.addSet(activeSession.id, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      reps: null, weightKg: null,
    });
    const updated = await api.getSessionById(activeSession.id);
    setActiveSession(updated);
    setView('session');
  }

  async function logSet(exerciseId, data) {
    if (!activeSession) return;
    await api.addSet(activeSession.id, {
      exerciseId,
      reps: data.reps ? parseInt(data.reps) : null,
      weightKg: data.weightKg ? parseFloat(data.weightKg) : null,
      rir: data.rir !== '' && data.rir != null ? parseInt(data.rir) : null,
    });
    const updated = await api.getSessionById(activeSession.id);
    setActiveSession(updated);
    setEditingSet(null);
    startTimer(120);
  }

  async function deleteSet(setId) {
    await api.deleteSet(setId);
    const updated = await api.getSessionById(activeSession.id);
    setActiveSession(updated);
  }

  async function finishWorkout() {
    if (!activeSession) return;
    const start = new Date(activeSession.createdAt);
    const mins = Math.round((Date.now() - start.getTime()) / 60000);
    await api.updateSession(activeSession.id, { durationMins: mins });
    setActiveSession(null);
    setView('home');
    setTimerRunning(false);
    setTimer(0);
    loadData();
  }

  function groupSets(sets) {
    const groups = {};
    const order = [];
    (sets || []).forEach(s => {
      if (!groups[s.exerciseId]) {
        groups[s.exerciseId] = [];
        order.push(s.exerciseId);
      }
      groups[s.exerciseId].push(s);
    });
    return order.map(id => ({ exerciseId: id, sets: groups[id] }));
  }

  const fmtTimer = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ============ EXERCISE PICKER ============
  if (view === 'picker') {
    return (
      <div style={{ paddingBottom: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
          <button onClick={() => setView('session')} style={{ background: 'none', border: 'none', color: t2, fontSize: 22 }}>←</button>
          <div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>Add Exercise</div>
        </div>
        <div style={{ padding: '0 20px 8px' }}>
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); searchExercises(e.target.value, muscleFilter); }}
            placeholder="Search exercises..."
            style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15, boxSizing: 'border-box' }}
            autoFocus />
        </div>
        {/* Muscle group filters */}
        <div style={{ display: 'flex', gap: 4, padding: '0 20px 12px', overflowX: 'auto' }}>
          {['all', ...MUSCLE_GROUPS].map(mg => (
            <button key={mg} onClick={() => { setMuscleFilter(mg); searchExercises(searchQ, mg); }}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, flexShrink: 0,
                border: muscleFilter === mg ? 'none' : `1.5px solid ${brd}`,
                background: muscleFilter === mg ? ac : '#fff',
                color: muscleFilter === mg ? '#fff' : t2,
              }}>{mg === 'all' ? 'All' : mg.charAt(0).toUpperCase() + mg.slice(1)}</button>
          ))}
        </div>
        {/* Exercise list */}
        <div style={{ padding: '0 20px' }}>
          <div style={card}>
            {exercises.length === 0 && (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: t3, fontSize: 13 }}>No exercises found</div>
            )}
            {exercises.map((ex, i) => (
              <button key={ex.id} onClick={() => addExercise(ex)}
                style={{
                  display: 'flex', alignItems: 'center', width: '100%', padding: '14px 16px',
                  background: 'none', border: 'none', borderTop: i > 0 ? `1px solid ${brd}` : 'none', textAlign: 'left', gap: 12,
                }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: MUSCLE_COLORS[ex.muscleGroup] || t3, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t1 }}>{ex.name}</div>
                  <div style={{ fontSize: 11, color: t3, marginTop: 1 }}>{ex.muscleGroup} · {ex.equipment}{ex.isCompound ? ' · compound' : ''}</div>
                </div>
                <span style={{ color: ac, fontSize: 20, fontWeight: 300 }}>+</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============ ACTIVE SESSION ============
  if (view === 'session' && activeSession) {
    const groups = groupSets(activeSession.sets);
    const elapsed = Math.round((Date.now() - new Date(activeSession.createdAt).getTime()) / 60000);
    const totalSets = (activeSession.sets || []).filter(s => s.reps).length;

    return (
      <div style={{ paddingBottom: 100 }}>
        {/* Session header */}
        <div style={{ background: 'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)', color: '#fff', padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>{activeSession.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, fontWeight: 500 }}>{elapsed} min · {totalSets} sets logged</div>
            </div>
            <button onClick={finishWorkout}
              style={{ padding: '10px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
              Finish
            </button>
          </div>

          {/* Rest timer */}
          {timerRunning && timer > 0 && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.15)', borderRadius: 12, padding: '10px 14px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
              <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{fmtTimer(timer)}</span>
              <span style={{ fontSize: 11, opacity: 0.7, fontWeight: 500 }}>rest</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => { setTimerRunning(false); setTimer(0); }} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600 }}>Skip</button>
            </div>
          )}
        </div>

        {/* Exercise groups */}
        <div style={{ padding: '8px 20px 0' }}>
          {groups.map(group => {
            const ex = exerciseMap[group.exerciseId];
            const name = ex?.name || 'Exercise';
            const muscle = ex?.muscleGroup || '';
            const mc = MUSCLE_COLORS[muscle] || t3;

            return (
              <div key={group.exerciseId} style={{ ...card, marginBottom: 10 }}>
                {/* Exercise header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 8px' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 5, background: mc }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: t1 }}>{name}</div>
                    {muscle && <div style={{ fontSize: 11, color: t3, marginTop: 1, textTransform: 'capitalize' }}>{muscle}</div>}
                  </div>
                </div>

                {/* Set table header */}
                <div style={{ display: 'flex', padding: '6px 16px', gap: 4 }}>
                  <span style={{ width: 32, fontSize: 10, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Set</span>
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>kg</span>
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reps</span>
                  <span style={{ width: 44, fontSize: 10, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>RIR</span>
                  <span style={{ width: 28 }} />
                </div>

                {/* Set rows */}
                {group.sets.map((set, idx) => (
                  <div key={set.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 4, borderTop: `1px solid ${brd}` }}>
                    <span style={{ width: 32, fontSize: 14, fontWeight: 700, color: set.reps ? ac : t3 }}>{idx + 1}</span>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: set.weightKg != null ? t1 : t3 }}>{set.weightKg != null ? set.weightKg : '—'}</span>
                    <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: set.reps ? t1 : t3 }}>{set.reps || '—'}</span>
                    <span style={{ width: 44, fontSize: 15, fontWeight: 500, color: set.rir != null ? t2 : t3 }}>{set.rir != null ? set.rir : '—'}</span>
                    <button onClick={() => deleteSet(set.id)} style={{ width: 28, background: 'none', border: 'none', color: '#d1d5db', fontSize: 16, padding: 0 }}>×</button>
                  </div>
                ))}

                {/* Add set row */}
                {editingSet?.exerciseId === group.exerciseId ? (
                  <div style={{ padding: '10px 16px 14px', borderTop: `1px solid ${brd}` }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      <input type="number" placeholder="kg" value={editingSet.weightKg}
                        onChange={e => setEditingSet(s => ({ ...s, weightKg: e.target.value }))}
                        style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15, textAlign: 'center', boxSizing: 'border-box' }} autoFocus />
                      <input type="number" placeholder="reps" value={editingSet.reps}
                        onChange={e => setEditingSet(s => ({ ...s, reps: e.target.value }))}
                        style={{ flex: 1, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15, textAlign: 'center', boxSizing: 'border-box' }} />
                      <input type="number" placeholder="RIR" value={editingSet.rir}
                        onChange={e => setEditingSet(s => ({ ...s, rir: e.target.value }))}
                        style={{ width: 60, padding: '12px 10px', borderRadius: 10, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15, textAlign: 'center', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditingSet(null)}
                        style={{ flex: 1, padding: 12, borderRadius: 12, border: `1.5px solid ${brd}`, background: '#fff', color: t2, fontSize: 14, fontWeight: 600 }}>Cancel</button>
                      <button onClick={() => logSet(group.exerciseId, editingSet)}
                        style={{ flex: 1, padding: 12, borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 14, fontWeight: 700 }}>Log Set</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setEditingSet({ exerciseId: group.exerciseId, weightKg: '', reps: '', rir: '' })}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '12px 16px', background: 'none', border: 'none', borderTop: `1px solid ${brd}`, color: ac, fontSize: 14, fontWeight: 600 }}>
                    <span style={{ fontSize: 17 }}>+</span> Add Set
                  </button>
                )}
              </div>
            );
          })}

          {/* Add exercise button */}
          <button onClick={openPicker}
            style={{ width: '100%', padding: 16, borderRadius: 16, border: `2px dashed ${brd}`, background: '#fff', color: t2, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
            + Add Exercise
          </button>
        </div>
      </div>
    );
  }

  // ============ HOME ============
  const totalSetsThisWeek = Object.values(volume).reduce((s, v) => s + v, 0);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Training</div>
      </div>

      {/* Start workout CTA */}
      <div style={{ padding: '12px 20px' }}>
        <button onClick={() => startWorkout('Workout')}
          style={{ width: '100%', padding: 18, borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)', color: '#fff', fontSize: 16, fontWeight: 800, boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
          Start Workout
        </button>
      </div>

      {/* Weekly volume card */}
      {Object.keys(volume).length > 0 && (
        <div style={{ padding: '0 20px 8px' }}>
          <div style={{ ...card, padding: '16px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Volume</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ac }}>{totalSetsThisWeek} sets</div>
            </div>
            {Object.entries(volume).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => {
              const mc = MUSCLE_COLORS[muscle] || t3;
              return (
                <div key={muscle} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: mc, flexShrink: 0 }} />
                  <span style={{ width: 72, fontSize: 12, color: t2, fontWeight: 500, textTransform: 'capitalize' }}>{muscle}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: brd, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: mc, width: `${Math.min(100, (sets / 20) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: t1, width: 24, textAlign: 'right' }}>{sets}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent workouts */}
      <div style={{ padding: '8px 20px 6px', fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Workouts</div>
      <div style={{ padding: '0 20px' }}>
        {sessions.length > 0 ? (
          <div style={card}>
            {sessions.slice(0, 10).map((s, i) => {
              const setCount = (s.sets || []).length;
              return (
                <button key={s.id} onClick={() => { setActiveSession(s); setView('session'); }}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', padding: '14px 16px',
                    background: 'none', border: 'none', borderTop: i > 0 ? `1px solid ${brd}` : 'none', textAlign: 'left', gap: 12,
                  }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, background: ac + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2.5" strokeLinecap="round"><path d="M6.5 6.5h11M6.5 17.5h11M4 10h1.5M4 14h1.5M18.5 10H20M18.5 14H20M7.5 10v4M16.5 10v4M9.5 8v8M14.5 8v8"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t1 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: t3, marginTop: 1 }}>
                      {new Date(s.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {s.durationMins ? ` · ${s.durationMins} min` : ''}
                      {setCount > 0 ? ` · ${setCount} sets` : ''}
                    </div>
                  </div>
                  <span style={{ color: t3, fontSize: 16 }}>›</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ ...card, padding: '30px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏋️</div>
            <div style={{ fontSize: 14, color: t2, lineHeight: 1.5 }}>No workouts yet.<br />Start your first one!</div>
          </div>
        )}
      </div>
    </div>
  );
}
