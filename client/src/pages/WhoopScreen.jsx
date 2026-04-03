import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shiftDate(k, n) {
  const clean = k.split('T')[0];
  const d = new Date(clean + 'T12:00:00'); d.setDate(d.getDate() + n); return dateKey(d);
}
function cleanDate(k) { return k ? k.split('T')[0] : ''; }
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
  const d = new Date(k.split('T')[0] + 'T12:00:00');
  return ['S','M','T','W','T','F','S'][d.getDay()];
}
function fmtMins(mins) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// Recovery color: green (67+), yellow (34-66), red (<34)
function recoveryColor(score) {
  if (!score) return '#d1d5db';
  if (score >= 67) return '#2dba8e';
  if (score >= 34) return '#e0a526';
  return '#f85149';
}

const card = { background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden' };

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
        api.getWhoopDaily(cleanDate(curDate)).catch(() => null),
      ]);
      setStatus(s);
      setData(d);
    } catch { setStatus({ connected: false }); }

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const dk = shiftDate(dateKey(), -i);
      try {
        const d = await api.getWhoopDaily(dk);
        days.push({ date: dk, ...d });
      } catch { days.push({ date: dk }); }
    }
    setWeekData(days);
  }

  async function syncNow() {
    setSyncing(true);
    try {
      await api.syncWhoop();
      await loadData();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
    setSyncing(false);
  }

  // Ring component matching Whoop style
  const Ring = ({ value, max, color, display, size = 110 }) => {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const r = (size - 14) / 2;
    const circ = 2 * Math.PI * r;
    const dash = (pct / 100) * circ;
    return (
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e5e7" strokeWidth="7" />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: size * 0.28, fontWeight: 600, color, lineHeight: 1 }}>{display}</div>
        </div>
      </div>
    );
  };

  // Not connected at all (never connected)
  if (!status?.connected && !status?.expired) {
    return (
      <div style={{ paddingBottom: 92 }}>
        <div style={{ padding: '20px 20px 0' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3 }}>Whoop</div>
        </div>
        <div style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⌚</div>
          <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>Connect your Whoop to see sleep, recovery, and strain data here.</div>
          <button onClick={() => { window.location.href = '/api/whoop/auth'; }} style={{ padding: '14px 32px', borderRadius: 12, background: '#2dba8e', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none' }}>Connect Whoop</button>
        </div>
      </div>
    );
  }

  const recColor = recoveryColor(data?.recoveryScore);

  return (
    <div style={{ paddingBottom: 92 }}>
      {/* Expired token banner */}
      {status?.expired && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <span style={{ fontSize: 12, color: '#92400e' }}>Connection expired — data may be outdated</span>
          <button onClick={() => { window.location.href = '/api/whoop/auth'; }} style={{ background: 'none', border: 'none', color: '#2dba8e', fontSize: 12, fontWeight: 600 }}>Reconnect</button>
        </div>
      )}
      {/* Top bar — like Whoop */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px 4px' }}>
        <button onClick={syncNow} disabled={syncing} style={{ background: 'none', border: 'none', color: '#2dba8e', fontSize: 11, fontWeight: 500 }}>{syncing ? 'Syncing...' : 'Sync'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCurDate(d => shiftDate(d, -1))} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20 }}>‹</button>
          <span style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.2, color: '#1a1a1a', padding: '5px 16px', border: '1px solid #e5e5e7', borderRadius: 20, background: '#ffffff' }}>{fmtDate(curDate)}</span>
          <button onClick={() => setCurDate(d => shiftDate(d, 1))} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 20 }}>›</button>
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* WHOOP brand */}
      <div style={{ textAlign: 'center', padding: '6px 0 4px', fontSize: 14, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: '#9ca3af' }}>Whoop</div>

      {/* Three rings */}
      {data ? (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 16px 4px' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Ring value={data.sleepPerformance || 0} max={100} color="#5b9ef0" display={data.sleepPerformance ? `${Math.round(data.sleepPerformance)}%` : '—'} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginTop: 6 }}>Sleep <span style={{ color: '#d1d5db' }}>›</span></div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Ring value={data.recoveryScore || 0} max={100} color={recColor} display={data.recoveryScore ? `${data.recoveryScore}%` : '—'} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginTop: 6 }}>Recovery <span style={{ color: '#d1d5db' }}>›</span></div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Ring value={data.strain || 0} max={21} color="#58a6ff" display={data.strain ? data.strain.toFixed(1) : '—'} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginTop: 6 }}>Strain <span style={{ color: '#d1d5db' }}>›</span></div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '30px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No data for this day</div>
      )}

      {/* Health Monitor + Stress Monitor — like Whoop's two-card row */}
      {data && (
        <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0' }}>
          <div style={{ ...card, margin: 0, flex: 1, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 10 }}>Recovery <span style={{ color: '#d1d5db' }}>›</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: recColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: recColor }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: recColor }}>{data.recoveryScore >= 67 ? 'GREEN' : data.recoveryScore >= 34 ? 'YELLOW' : 'RED'}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{data.recoveryScore || 0}% Recovery</div>
          </div>
          <div style={{ ...card, margin: 0, flex: 1, padding: '14px 16px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 10 }}>Strain <span style={{ color: '#d1d5db' }}>›</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: '#58a6ff' }}>{data.strain ? data.strain.toFixed(1) : '—'}</span>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Day Strain</div>
          </div>
        </div>
      )}

      {/* Sleep card — like Whoop's "TONIGHT'S SLEEP" */}
      {data && data.sleepDurationMins && (
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ ...card, margin: 0, padding: '16px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280', marginBottom: 14 }}>Sleep <span style={{ color: '#d1d5db' }}>›</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 600, color: '#5b9ef0', lineHeight: 1 }}>{fmtMins(data.sleepDurationMins)}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Duration</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: data.sleepPerformance >= 70 ? '#2dba8e' : '#e0a526', lineHeight: 1 }}>{data.sleepPerformance ? `${Math.round(data.sleepPerformance)}%` : '—'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Performance</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: data.sleepEfficiency >= 85 ? '#2dba8e' : '#e0a526', lineHeight: 1 }}>{data.sleepEfficiency ? `${Math.round(data.sleepEfficiency)}%` : '—'}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Efficiency</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activity card — like Whoop's "TODAY'S ACTIVITIES" */}
      {data && (
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ ...card, margin: 0, padding: 0 }}>
            <div style={{ padding: '14px 18px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1.5, color: '#6b7280' }}>Today's Activity</div>
            {data.sportName ? (
              <div style={{ padding: '0 18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(88,166,255,0.1)', borderLeft: '3px solid #58a6ff', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>🏋️</span>
                    <span style={{ fontSize: 18, fontWeight: 600, color: '#58a6ff' }}>{data.workoutStrain ? data.workoutStrain.toFixed(1) : '—'}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{data.sportName}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {data.workoutDurationMins && `${data.workoutDurationMins} min`}
                      {data.workoutCalories && ` · ${Math.round(data.workoutCalories)} cal`}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '0 18px 16px', fontSize: 13, color: '#9ca3af' }}>No activity logged</div>
            )}
          </div>
        </div>
      )}

      {/* Metrics grid — HRV, RHR, Calories */}
      {data && (
        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'HRV', value: data.hrv ? Math.round(data.hrv) : '—', unit: 'ms', color: '#2dba8e' },
              { label: 'RHR', value: data.restingHr || '—', unit: 'bpm', color: '#e0a526' },
              { label: 'Calories', value: data.calories ? Math.round(data.calories) : '—', unit: 'cal', color: '#8b5ef6' },
            ].map(m => (
              <div key={m.label} style={{ ...card, margin: 0, padding: '14px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: m.color, lineHeight: 1 }}>{m.value}</div>
                <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{m.unit}</div>
                <div style={{ fontSize: 9, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af', marginTop: 6 }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7-Day Recovery Overview */}
      <div style={{ padding: '20px 20px 8px', fontSize: 10, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 2, color: '#6b7280' }}>Last 7 Days</div>
      <div style={{ ...card, margin: '0 16px' }}>
        <div style={{ padding: '14px 10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {weekData.map(d => {
              const dk = cleanDate(d.date);
              const isSelected = dk === cleanDate(curDate);
              const isToday = dk === dateKey();
              const rc = recoveryColor(d.recoveryScore);
              return (
                <div key={dk} onClick={() => setCurDate(dk)} style={{ textAlign: 'center', padding: '8px 2px', borderRadius: 10, background: isSelected ? '#f0f0f2' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}>
                  <div style={{ fontSize: 9, fontWeight: 500, color: isToday ? '#1a1a1a' : '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>{dayLabel(dk)}</div>
                  {/* Mini recovery ring */}
                  <div style={{ position: 'relative', width: 32, height: 32, margin: '0 auto' }}>
                    <svg viewBox="0 0 32 32" width="32" height="32">
                      <circle cx="16" cy="16" r="12" fill="none" stroke="#e5e5e7" strokeWidth="3" />
                      {d.recoveryScore && <circle cx="16" cy="16" r="12" fill="none" stroke={rc} strokeWidth="3" strokeDasharray={`${(d.recoveryScore / 100) * 75.4} 75.4`} strokeLinecap="round" transform="rotate(-90 16 16)" />}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 600, color: rc }}>{d.recoveryScore || '—'}</div>
                  </div>
                  <div style={{ fontSize: 8, color: '#d1d5db', marginTop: 4 }}>{d.strain ? d.strain.toFixed(1) : ''}</div>
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
