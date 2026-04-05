import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const t1 = '#1a1a1a', t2 = '#6b7280', t3 = '#9ca3af', ac = '#2dba8e';
const card = { background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden' };
const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 15, boxSizing: 'border-box', color: t1 };
const MUSCLE_GROUPS = ['all', 'chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abs', 'calves', 'cardio'];

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Training() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [exerciseMap, setExerciseMap] = useState({}); // id -> exercise
  const [searchQ, setSearchQ] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [volume, setVolume] = useState({});
  const [addingSet, setAddingSet] = useState(null);
  const [setForm, setSetForm] = useState({ reps: '', weightKg: '', rir: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, v] = await Promise.all([
      api.getTrainingSessions(),
      api.getTrainingVolume(7),
    ]);
    setSessions(s);
    setVolume(v);
    // Build exercise map from all session sets
    const ids = new Set();
    s.forEach(sess => (sess.sets || []).forEach(set => ids.add(set.exerciseId)));
    if (ids.size > 0) {
      const exs = await api.searchExercises('', '');
      const map = {};
      exs.forEach(e => { map[e.id] = e; });
      setExerciseMap(map);
    }
    // Resume today's session if exists
    const todaySession = s.find(sess => sess.date?.split('T')[0] === dateKey());
    if (todaySession) setActiveSession(todaySession);
  }

  async function startWorkout(name) {
    const session = await api.createSession({ date: dateKey(), name: name || 'Workout' });
    setActiveSession(session);
    setSessions(prev => [session, ...prev]);
  }

  async function openExercisePicker() {
    setShowExercisePicker(true);
    const exs = await api.searchExercises('', muscleFilter === 'all' ? '' : muscleFilter);
    setExercises(exs);
  }

  async function searchExercises(q, muscle) {
    const exs = await api.searchExercises(q, muscle === 'all' ? '' : muscle);
    setExercises(exs);
  }

  async function addExerciseToSession(exercise) {
    if (!activeSession) return;
    setExerciseMap(prev => ({ ...prev, [exercise.id]: exercise }));
    await api.addSet(activeSession.id, {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      muscleGroup: exercise.muscleGroup,
      reps: null,
      weightKg: null,
    });
    const updated = await api.getSessionById(activeSession.id);
    setActiveSession(updated);
    setShowExercisePicker(false);
    setSearchQ('');
  }

  async function addSetToExercise(exerciseId) {
    if (!activeSession) return;
    const f = setForm;
    await api.addSet(activeSession.id, {
      exerciseId,
      reps: f.reps ? parseInt(f.reps) : null,
      weightKg: f.weightKg ? parseFloat(f.weightKg) : null,
      rir: f.rir ? parseInt(f.rir) : null,
    });
    const updated = await api.getSessionById(activeSession.id);
    setActiveSession(updated);
    setSetForm({ reps: '', weightKg: '', rir: '' });
    setAddingSet(null);
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
    loadData();
  }

  // Group sets by exercise
  function groupSetsByExercise(sets) {
    const groups = {};
    const order = [];
    (sets || []).forEach(s => {
      if (!groups[s.exerciseId]) {
        groups[s.exerciseId] = { exerciseId: s.exerciseId, sets: [] };
        order.push(s.exerciseId);
      }
      groups[s.exerciseId].sets.push(s);
    });
    return order.map(id => groups[id]);
  }

  const backBtn = (
    <button onClick={() => setShowExercisePicker(false)} style={{ background: 'none', border: 'none', color: t2, fontSize: 22, padding: '0 4px' }}>←</button>
  );

  // Exercise picker overlay
  if (showExercisePicker) {
    return (
      <div style={{ paddingBottom: 92 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
          {backBtn}
          <div style={{ fontSize: 18, fontWeight: 800, color: t1, letterSpacing: -0.3, flex: 1 }}>Add Exercise</div>
        </div>
        <div style={{ padding: '0 16px' }}>
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); searchExercises(e.target.value, muscleFilter); }}
            placeholder="Search exercises..." style={{ ...inp, marginBottom: 10 }} autoFocus />
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 10, marginBottom: 4 }}>
            {MUSCLE_GROUPS.map(mg => (
              <button key={mg} onClick={() => { setMuscleFilter(mg); searchExercises(searchQ, mg); }}
                style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, flexShrink: 0,
                  border: muscleFilter === mg ? `1px solid ${ac}` : '1px solid #e5e5e7',
                  background: muscleFilter === mg ? 'rgba(45,186,142,0.08)' : '#fff',
                  color: muscleFilter === mg ? ac : t2,
                }}>{mg === 'all' ? 'All' : mg.charAt(0).toUpperCase() + mg.slice(1)}</button>
            ))}
          </div>
        </div>
        <div style={{ ...card, marginTop: 4 }}>
          {exercises.map((ex, i) => (
            <button key={ex.id} onClick={() => addExerciseToSession(ex)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 18px',
                background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #e5e5e7' : 'none', textAlign: 'left', color: t1 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: t2, marginTop: 2, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {ex.muscleGroup} · {ex.equipment}{ex.isCompound ? ' · compound' : ''}
                </div>
              </div>
              <span style={{ color: t3, fontSize: 16 }}>+</span>
            </button>
          ))}
          {exercises.length === 0 && (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: t3, fontSize: 13 }}>No exercises found</div>
          )}
        </div>
      </div>
    );
  }

  // Active workout session
  if (activeSession) {
    const exerciseGroups = groupSetsByExercise(activeSession.sets);

    return (
      <div style={{ paddingBottom: 92 }}>
        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t1, letterSpacing: -0.3 }}>{activeSession.name}</div>
              <div style={{ fontSize: 11, color: t3, marginTop: 2 }}>
                {Math.round((Date.now() - new Date(activeSession.createdAt).getTime()) / 60000)} min elapsed
              </div>
            </div>
            <button onClick={finishWorkout} style={{ padding: '10px 20px', borderRadius: 12, background: ac, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Finish</button>
          </div>
        </div>

        {/* Exercise cards */}
        {exerciseGroups.map(group => {
          const ex = exerciseMap[group.exerciseId];
          const exName = ex?.name || 'Unknown Exercise';
          const exMeta = ex ? `${ex.muscleGroup}` : '';
          return (
            <div key={group.exerciseId} style={{ ...card, marginTop: 8 }}>
              <div style={{ padding: '14px 18px 8px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t1, textTransform: 'uppercase', letterSpacing: 0.8 }}>{exName}</div>
                {exMeta && <div style={{ fontSize: 11, color: t3, marginTop: 2 }}>{exMeta}</div>}
              </div>

              {/* Set rows header */}
              <div style={{ display: 'flex', padding: '6px 18px', gap: 8 }}>
                <span style={{ width: 30, fontSize: 10, fontWeight: 500, color: t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>Set</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>kg</span>
                <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>Reps</span>
                <span style={{ width: 40, fontSize: 10, fontWeight: 500, color: t3, textTransform: 'uppercase', letterSpacing: 1.5 }}>RIR</span>
                <span style={{ width: 24 }}></span>
              </div>

              {/* Set rows */}
              {group.sets.map((set, idx) => (
                <div key={set.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 18px', gap: 8, borderTop: '1px solid #e5e5e7' }}>
                  <span style={{ width: 30, fontSize: 13, fontWeight: 600, color: t2 }}>{idx + 1}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: t1 }}>{set.weightKg != null ? set.weightKg : '—'}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: t1 }}>{set.reps || '—'}</span>
                  <span style={{ width: 40, fontSize: 15, color: t3 }}>{set.rir != null ? set.rir : '—'}</span>
                  <button onClick={() => deleteSet(set.id)} style={{ width: 24, background: 'none', border: 'none', color: '#d1d5db', fontSize: 14, padding: 0 }}>×</button>
                </div>
              ))}

              {/* Add set form */}
              {addingSet === group.exerciseId ? (
                <div style={{ display: 'flex', alignItems: 'center', padding: '10px 18px 14px', gap: 6 }}>
                  <input type="number" placeholder="kg" value={setForm.weightKg} onChange={e => setSetForm(f => ({ ...f, weightKg: e.target.value }))}
                    style={{ ...inp, flex: 1, padding: '10px 12px', fontSize: 14 }} />
                  <input type="number" placeholder="reps" value={setForm.reps} onChange={e => setSetForm(f => ({ ...f, reps: e.target.value }))}
                    style={{ ...inp, flex: 1, padding: '10px 12px', fontSize: 14 }} />
                  <input type="number" placeholder="RIR" value={setForm.rir} onChange={e => setSetForm(f => ({ ...f, rir: e.target.value }))}
                    style={{ ...inp, width: 60, padding: '10px 12px', fontSize: 14 }} />
                  <button onClick={() => addSetToExercise(group.exerciseId)}
                    style={{ padding: '10px 14px', borderRadius: 12, background: ac, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700 }}>+</button>
                </div>
              ) : (
                <button onClick={() => { setAddingSet(group.exerciseId); setSetForm({ reps: '', weightKg: '', rir: '' }); }}
                  style={{ width: '100%', padding: '12px 18px', background: 'none', border: 'none', borderTop: '1px solid #e5e5e7', color: ac, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>+ Add Set</button>
              )}
            </div>
          );
        })}

        {/* Add exercise button */}
        <div style={{ padding: '4px 16px 0' }}>
          <button onClick={openExercisePicker} style={{
            width: '100%', padding: 16, borderRadius: 14, border: '1px dashed #d1d5db',
            background: '#fff', color: t2, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
          }}>+ Add Exercise</button>
        </div>
      </div>
    );
  }

  // Main training screen (no active session)
  return (
    <div style={{ paddingBottom: 92 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: t1, letterSpacing: -0.3 }}>Training</div>
      </div>

      {/* Start workout */}
      <div style={{ padding: '4px 16px 12px' }}>
        <button onClick={() => startWorkout('Workout')} style={{
          width: '100%', padding: 16, borderRadius: 14, border: 'none',
          background: ac, color: '#fff', fontSize: 15, fontWeight: 700,
        }}>Start Workout</button>
      </div>

      {/* Weekly volume */}
      {Object.keys(volume).length > 0 && (
        <div style={card}>
          <div style={{ padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: t2, marginBottom: 12 }}>Weekly Volume (sets)</div>
            {Object.entries(volume).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => (
              <div key={muscle} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 10 }}>
                <span style={{ width: 80, fontSize: 11, color: t2, textTransform: 'capitalize', fontWeight: 500 }}>{muscle}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f0f0f2', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: sets >= 10 ? ac : sets >= 5 ? '#e0a526' : '#3b82f6', width: `${Math.min(100, (sets / 20) * 100)}%`, transition: 'width 0.3s ease' }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: t1, width: 24, textAlign: 'right' }}>{sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div style={{ padding: '12px 20px 6px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: t2 }}>Recent Workouts</div>
      {sessions.length > 0 ? (
        <div style={card}>
          {sessions.slice(0, 10).map((s, i) => (
            <button key={s.id} onClick={() => setActiveSession(s)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '16px 18px',
                background: 'none', border: 'none', borderTop: i > 0 ? '1px solid #e5e5e7' : 'none', color: t1, textAlign: 'left' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: t2, marginTop: 2, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {new Date(s.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {s.durationMins ? ` · ${s.durationMins} min` : ''}
                  {s.sets?.length ? ` · ${s.sets.length} sets` : ''}
                </div>
              </div>
              <span style={{ color: t3, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ padding: '30px 20px', textAlign: 'center', color: t3, fontSize: 13 }}>No workouts yet. Start your first one!</div>
      )}
    </div>
  );
}
