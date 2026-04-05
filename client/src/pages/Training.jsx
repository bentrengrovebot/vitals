import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const MUSCLE_GROUPS = ['all', 'chest', 'back', 'shoulders', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'abs', 'calves', 'cardio'];

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Training() {
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [volume, setVolume] = useState({});
  const [addingSet, setAddingSet] = useState(null); // exerciseId being added to
  const [setForm, setSetForm] = useState({ reps: '', weightKg: '', rir: '' });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, v] = await Promise.all([
      api.getTrainingSessions(),
      api.getTrainingVolume(7),
    ]);
    setSessions(s);
    setVolume(v);
    // Load today's session if exists
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
    // Add first set automatically
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
    (sets || []).forEach(s => {
      if (!groups[s.exerciseId]) groups[s.exerciseId] = { exerciseId: s.exerciseId, sets: [] };
      groups[s.exerciseId].sets.push(s);
    });
    return Object.values(groups);
  }

  const card = { background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
  const inp = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e5e7', background: '#fff', fontSize: 14, color: '#1a1a1a', width: '100%', boxSizing: 'border-box' };

  // Exercise picker overlay
  if (showExercisePicker) {
    return (
      <div style={{ paddingBottom: 92, background: '#f5f5f7', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 12 }}>
          <button onClick={() => setShowExercisePicker(false)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#1a1a1a' }}>←</button>
          <span style={{ fontSize: 16, fontWeight: 600, flex: 1 }}>Add Exercise</span>
        </div>
        <div style={{ padding: '0 16px' }}>
          <input value={searchQ} onChange={e => { setSearchQ(e.target.value); searchExercises(e.target.value, muscleFilter); }} placeholder="Search exercises..." style={{ ...inp, marginBottom: 10 }} autoFocus />
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 10, marginBottom: 8 }}>
            {MUSCLE_GROUPS.map(mg => (
              <button key={mg} onClick={() => { setMuscleFilter(mg); searchExercises(searchQ, mg); }}
                style={{ padding: '5px 12px', borderRadius: 12, fontSize: 11, fontWeight: 500, flexShrink: 0,
                  border: muscleFilter === mg ? '1px solid #2dba8e' : '1px solid #e5e5e7',
                  background: muscleFilter === mg ? 'rgba(45,186,142,0.08)' : '#fff',
                  color: muscleFilter === mg ? '#2dba8e' : '#6b7280',
                }}>{mg === 'all' ? 'All' : mg.charAt(0).toUpperCase() + mg.slice(1)}</button>
            ))}
          </div>
          {exercises.map(ex => (
            <button key={ex.id} onClick={() => addExerciseToSession(ex)}
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '14px 0', borderBottom: '1px solid #f0f0f2', background: 'none', border: 'none', borderBottom: '1px solid #f0f0f2', textAlign: 'left', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{ex.muscleGroup} · {ex.equipment}{ex.isCompound ? ' · compound' : ''}</div>
              </div>
              <span style={{ color: '#2dba8e', fontSize: 18 }}>+</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Active workout session
  if (activeSession) {
    const exerciseGroups = groupSetsByExercise(activeSession.sets);

    return (
      <div style={{ paddingBottom: 92, background: '#f5f5f7', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ background: '#ffffff', borderBottom: '1px solid #e5e5e7', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{activeSession.name}</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                {Math.round((Date.now() - new Date(activeSession.createdAt).getTime()) / 60000)} min elapsed
              </div>
            </div>
            <button onClick={finishWorkout} style={{ padding: '8px 16px', borderRadius: 10, background: '#2dba8e', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600 }}>Finish</button>
          </div>
        </div>

        {/* Exercise cards */}
        <div style={{ padding: '8px 16px 0' }}>
          {exerciseGroups.map(group => {
            // Get exercise name from the sets (we'll need to look it up)
            const exSets = group.sets;
            return (
              <div key={group.exerciseId} style={{ ...card, marginBottom: 8 }}>
                <div style={{ padding: '14px 16px 8px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Exercise</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{group.exerciseId.substring(0, 8)}...</div>
                </div>

                {/* Set rows header */}
                <div style={{ display: 'flex', padding: '4px 16px', gap: 8 }}>
                  <span style={{ width: 30, fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Set</span>
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Weight</span>
                  <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Reps</span>
                  <span style={{ width: 40, fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>RIR</span>
                  <span style={{ width: 24 }}></span>
                </div>

                {/* Set rows */}
                {exSets.map((set, idx) => (
                  <div key={set.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 16px', gap: 8, borderTop: '1px solid #f0f0f2' }}>
                    <span style={{ width: 30, fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{idx + 1}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{set.weightKg ? `${set.weightKg}kg` : '—'}</span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1a1a1a' }}>{set.reps || '—'}</span>
                    <span style={{ width: 40, fontSize: 14, color: '#9ca3af' }}>{set.rir !== null && set.rir !== undefined ? set.rir : '—'}</span>
                    <button onClick={() => deleteSet(set.id)} style={{ width: 24, background: 'none', border: 'none', color: '#d1d5db', fontSize: 14 }}>×</button>
                  </div>
                ))}

                {/* Add set form */}
                {addingSet === group.exerciseId ? (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px 12px', gap: 6 }}>
                    <input type="number" placeholder="kg" value={setForm.weightKg} onChange={e => setSetForm(f => ({ ...f, weightKg: e.target.value }))} style={{ ...inp, flex: 1, padding: '8px 10px' }} />
                    <input type="number" placeholder="reps" value={setForm.reps} onChange={e => setSetForm(f => ({ ...f, reps: e.target.value }))} style={{ ...inp, flex: 1, padding: '8px 10px' }} />
                    <input type="number" placeholder="RIR" value={setForm.rir} onChange={e => setSetForm(f => ({ ...f, rir: e.target.value }))} style={{ ...inp, width: 50, padding: '8px 10px' }} />
                    <button onClick={() => addSetToExercise(group.exerciseId)} style={{ padding: '8px 12px', borderRadius: 8, background: '#2dba8e', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600 }}>+</button>
                  </div>
                ) : (
                  <button onClick={() => { setAddingSet(group.exerciseId); setSetForm({ reps: '', weightKg: '', rir: '' }); }}
                    style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', borderTop: '1px solid #f0f0f2', color: '#2dba8e', fontSize: 12, fontWeight: 600 }}>+ Add Set</button>
                )}
              </div>
            );
          })}

          {/* Add exercise button */}
          <button onClick={openExercisePicker} style={{
            width: '100%', padding: 14, borderRadius: 14, border: '1px dashed #d1d5db',
            background: '#fff', color: '#6b7280', fontSize: 13, fontWeight: 500, marginTop: 4,
          }}>+ Add Exercise</button>
        </div>
      </div>
    );
  }

  // Main training screen (no active session)
  return (
    <div style={{ paddingBottom: 92, background: '#f5f5f7', minHeight: '100vh' }}>
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Training</div>
      </div>

      {/* Start workout */}
      <div style={{ padding: '0 16px 12px' }}>
        <button onClick={() => startWorkout('Workout')} style={{
          width: '100%', padding: 18, borderRadius: 14, border: 'none',
          background: '#1a1a1a', color: '#fff', fontSize: 16, fontWeight: 600,
        }}>Start Workout</button>
      </div>

      {/* Weekly volume */}
      {Object.keys(volume).length > 0 && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{ ...card, padding: '14px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Weekly Volume (sets)</div>
            {Object.entries(volume).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => (
              <div key={muscle} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 10 }}>
                <span style={{ width: 80, fontSize: 12, color: '#6b7280', textTransform: 'capitalize' }}>{muscle}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f0f0f2', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: sets >= 10 ? '#2dba8e' : sets >= 5 ? '#e0a526' : '#3b82f6', width: `${Math.min(100, (sets / 20) * 100)}%` }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', width: 24, textAlign: 'right' }}>{sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div style={{ padding: '8px 16px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Recent Workouts</div>
        {sessions.length > 0 ? sessions.slice(0, 10).map(s => (
          <div key={s.id} style={{ ...card, padding: '14px 16px', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {new Date(s.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {s.durationMins && ` · ${s.durationMins} min`}
                  {s.sets && ` · ${s.sets.length} sets`}
                </div>
              </div>
              <button onClick={() => { setActiveSession(s); }} style={{ background: 'none', border: 'none', color: '#2dba8e', fontSize: 12, fontWeight: 600 }}>View</button>
            </div>
          </div>
        )) : (
          <div style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 24 }}>No workouts yet. Start your first one!</div>
        )}
      </div>
    </div>
  );
}
