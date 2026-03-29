import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const card = { background: '#1e2228', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden' };
const secHeader = { fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, padding: '22px 20px 10px' };

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(k, n) {
  const clean = k.split('T')[0];
  const d = new Date(clean + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d);
}
function cleanDate(k) {
  if (!k) return '';
  return k.split('T')[0];
}
function fmtDate(k) {
  if (!k) return 'Today';
  const clean = k.split('T')[0];
  const d = new Date(clean + 'T12:00:00'), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}
function dayLabel(k) {
  if (!k) return '?';
  const clean = k.split('T')[0];
  const d = new Date(clean + 'T12:00:00');
  return ['S','M','T','W','T','F','S'][d.getDay()];
}

export default function WhoopScreen() {
  const [curDate, setCurDate] = useState(dateKey());
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [weekData, setWeekData] = useState([]);

  useEffect(() => { loadData(); }, [curDate]);

  async function loadData() {
    try {
      const [s, d] = await Promise.all([
        api.getWhoopStatus(),
        api.getWhoopDaily(curDate).catch(() => null),
      ]);
      setStatus(s);
      setData(d);
    } catch { setStatus({ connected: false }); }

    // Load 7 days for weekly view
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const dk = shiftDate(dateKey(), -i);
      try {
        const d = await api.getWhoopDaily(dk);
        days.push({ date: dk, ...d });
      } catch {
        days.push({ date: dk });
      }
    }
    setWeekData(days);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const result = await api.syncWhoop();
      console.log('Whoop sync result:', result);
      await loadData();
    } catch (err) {
      console.error('Whoop sync failed:', err);
      alert('Sync failed: ' + err.message);
    }
    setSyncing(false);
  }

  const Ring = ({ value, max, color, label, display }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const circ = 2 * Math.PI * 44;
    const dash = (pct / 100) * circ;
    return (
      <div style={{ textAlign: 'center', flex: 1 }}>
        <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto' }}>
          <svg viewBox="0 0 120 120" width="90" height="90">
            <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
            <circle cx="60" cy="60" r="44" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 600, color }}>{display}</div>
          </div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{label}</div>
      </div>
    );
  };

  if (!status?.connected) {
    return (
      <div style={{ paddingBottom: 92 }}>
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.3 }}>Whoop</div>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⌚</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginBottom: 20, lineHeight: 1.6 }}>Connect your Whoop to see sleep, recovery, and strain data here.</div>
          <button onClick={() => { window.location.href = '/api/whoop/auth'; }} style={{ display: 'inline-block', padding: '14px 32px', borderRadius: 12, background: '#2dba8e', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none' }}>Connect Whoop</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 92 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 6px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: 6 }}>Whoop</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCurDate(d => shiftDate(d, -1))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>‹</button>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#ffffff' }}>{fmtDate(curDate)}</span>
          <button onClick={() => setCurDate(d => shiftDate(d, 1))} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 20 }}>›</button>
        </div>
        <button onClick={syncNow} disabled={syncing} style={{ background: 'none', border: 'none', color: '#2dba8e', fontSize: 11, fontWeight: 600 }}>{syncing ? 'Syncing...' : 'Sync'}</button>
      </div>

      {/* Rings */}
      {data && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '20px 12px 8px' }}>
          <Ring value={data.sleepPerformance || 0} max={100} color="#5b9ef0" label="Sleep" display={data.sleepPerformance ? `${Math.round(data.sleepPerformance)}%` : '—'} />
          <Ring value={data.recoveryScore || 0} max={100} color="#2dba8e" label="Recovery" display={data.recoveryScore ? `${data.recoveryScore}%` : '—'} />
          <Ring value={data.strain || 0} max={21} color="#e0a526" label="Strain" display={data.strain ? data.strain.toFixed(1) : '—'} />
        </div>
      )}

      {!data && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>No data for this day. Try syncing.</div>
      )}

      {/* Detail metrics */}
      {data && (
        <>
          <div style={secHeader}>DETAILS</div>
          <div style={card}>
            {[
              { label: 'Sleep Duration', value: data.sleepDurationMins ? `${Math.floor(data.sleepDurationMins / 60)}h ${data.sleepDurationMins % 60}m` : '—', color: '#5b9ef0' },
              { label: 'Sleep Efficiency', value: data.sleepEfficiency ? `${Math.round(data.sleepEfficiency)}%` : '—', color: '#5b9ef0' },
              { label: 'HRV', value: data.hrv ? `${Math.round(data.hrv)} ms` : '—', color: '#2dba8e' },
              { label: 'Resting HR', value: data.restingHr ? `${data.restingHr} bpm` : '—', color: '#e0a526' },
              { label: 'Calories Burned', value: data.calories ? `${Math.round(data.calories)} cal` : '—', color: '#8b5ef6' },
            ].map((m, i) => (
              <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>{m.label}</span>
                <span style={{ fontSize: 18, fontWeight: 600, color: m.color }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Workout */}
          {data.sportName && (
            <>
              <div style={secHeader}>ACTIVITY</div>
              <div style={card}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{data.sportName}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                    {data.workoutStrain && <span>Strain: <span style={{ color: '#e0a526', fontWeight: 600 }}>{data.workoutStrain.toFixed(1)}</span></span>}
                    {data.workoutCalories && <span>{Math.round(data.workoutCalories)} cal</span>}
                    {data.workoutDurationMins && <span>{data.workoutDurationMins} min</span>}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* 7-day overview */}
      <div style={secHeader}>LAST 7 DAYS</div>
      <div style={card}>
        <div style={{ padding: '16px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {weekData.map(d => {
              const dk = cleanDate(d.date);
              return (
              <div key={dk} style={{ textAlign: 'center', padding: '8px 0', borderRadius: 8, background: dk === cleanDate(curDate) ? 'rgba(255,255,255,0.06)' : 'transparent', cursor: 'pointer' }} onClick={() => setCurDate(dk)}>
                <div style={{ fontSize: 9, fontWeight: 500, color: dk === dateKey() ? '#ffffff' : 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 6 }}>
                  {dayLabel(dk)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: d.recoveryScore ? (d.recoveryScore >= 67 ? '#2dba8e' : d.recoveryScore >= 34 ? '#e0a526' : '#f85149') : 'rgba(255,255,255,0.15)' }}>
                  {d.recoveryScore ? `${d.recoveryScore}%` : '—'}
                </div>
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                  {d.strain ? d.strain.toFixed(1) : ''}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
