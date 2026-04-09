import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;

export default function Insights({ goTo }) {
  const [volume, setVolume] = useState({});
  const [sessions, setSessions] = useState([]);
  const [weighIns, setWeighIns] = useState([]);

  useEffect(() => {
    Promise.all([
      api.getTrainingVolume(7).catch(() => ({})),
      api.getTrainingSessions().catch(() => []),
      api.getWeighIns(30).catch(() => []),
    ]).then(([v, s, w]) => { setVolume(v); setSessions(s); setWeighIns(w); });
  }, []);

  const card = { background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
  const t1 = '#212121', t2 = '#757575', t3 = '#BDBDBD', ac = '#E53935', brd = '#EEEEEE';
  const CAL = '#42A5F5', PRO = '#E53935';

  const totalSets = Object.values(volume).reduce((s, v) => s + v, 0);
  const workoutsThisWeek = sessions.filter(s => {
    const d = new Date(s.date);
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length;

  // Weight trend — 7-day moving average
  const sortedWeighIns = [...weighIns].sort((a, b) => new Date(a.date) - new Date(b.date));
  const movingAvg = sortedWeighIns.map((w, i) => {
    const window = sortedWeighIns.slice(Math.max(0, i - 6), i + 1);
    return { date: w.date, weight: w.weightKg, avg: r1(window.reduce((s, x) => s + x.weightKg, 0) / window.length) };
  });

  // Chart dimensions
  const chartW = 340, chartH = 140, padL = 40, padR = 10, padT = 10, padB = 24;
  const plotW = chartW - padL - padR, plotH = chartH - padT - padB;

  function renderWeightChart() {
    if (movingAvg.length < 2) return null;
    const weights = movingAvg.map(d => d.weight);
    const avgs = movingAvg.map(d => d.avg);
    const allVals = [...weights, ...avgs];
    const minW = Math.min(...allVals) - 0.5;
    const maxW = Math.max(...allVals) + 0.5;
    const range = maxW - minW || 1;

    const xScale = (i) => padL + (i / (movingAvg.length - 1)) * plotW;
    const yScale = (v) => padT + plotH - ((v - minW) / range) * plotH;

    const rawLine = movingAvg.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.weight)}`).join(' ');
    const avgLine = movingAvg.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(d.avg)}`).join(' ');

    // Y-axis labels
    const yLabels = [];
    const step = range > 4 ? 2 : 1;
    for (let v = Math.ceil(minW); v <= Math.floor(maxW); v += step) {
      yLabels.push(v);
    }

    // X-axis labels (first, middle, last dates)
    const xLabels = [0, Math.floor(movingAvg.length / 2), movingAvg.length - 1].map(i => ({
      x: xScale(i),
      label: new Date(movingAvg[i].date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }),
    }));

    return (
      <svg width="100%" viewBox={`0 0 ${chartW} ${chartH}`} style={{ display: 'block' }}>
        {/* Grid lines */}
        {yLabels.map(v => (
          <g key={v}>
            <line x1={padL} x2={chartW - padR} y1={yScale(v)} y2={yScale(v)} stroke="#f0f0f0" strokeWidth="1" />
            <text x={padL - 6} y={yScale(v) + 4} textAnchor="end" fontSize="9" fill={t3}>{v}</text>
          </g>
        ))}

        {/* Raw weight (dots + thin line) */}
        <path d={rawLine} fill="none" stroke={t3} strokeWidth="1" strokeDasharray="3,3" />
        {movingAvg.map((d, i) => (
          <circle key={i} cx={xScale(i)} cy={yScale(d.weight)} r="3" fill={t3} />
        ))}

        {/* Moving average (bold line) */}
        <path d={avgLine} fill="none" stroke={ac} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {movingAvg.length > 0 && (
          <circle cx={xScale(movingAvg.length - 1)} cy={yScale(movingAvg[movingAvg.length - 1].avg)} r="4" fill={ac} />
        )}

        {/* X labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={chartH - 4} textAnchor="middle" fontSize="9" fill={t3}>{l.label}</text>
        ))}
      </svg>
    );
  }

  const latest = movingAvg.length > 0 ? movingAvg[movingAvg.length - 1] : null;
  const oldest = movingAvg.length > 1 ? movingAvg[0] : null;
  const weightChange = latest && oldest ? r1(latest.avg - oldest.avg) : null;

  return (
    <div style={{ paddingBottom: 100, background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t1 }}>Insights</div>
      </div>

      {/* Weight Trend Card */}
      {movingAvg.length >= 2 && (
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ ...card, padding: '16px 16px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weight Trend</div>
                {latest && <div style={{ fontSize: 22, fontWeight: 800, color: t1, marginTop: 4 }}>{latest.avg} <span style={{ fontSize: 13, fontWeight: 500, color: t3 }}>kg</span></div>}
              </div>
              {weightChange !== null && (
                <div style={{ padding: '6px 12px', borderRadius: 20, background: weightChange <= 0 ? '#E8F5E9' : '#FBE9E7', color: weightChange <= 0 ? '#43A047' : '#E53935', fontSize: 13, fontWeight: 700 }}>
                  {weightChange > 0 ? '+' : ''}{weightChange} kg
                </div>
              )}
            </div>
            {renderWeightChart()}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2, background: t3, borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: t3 }}>Daily</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 12, height: 2.5, background: ac, borderRadius: 1 }} />
                <span style={{ fontSize: 10, color: t2 }}>7-day avg</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div style={{ padding: '12px 16px 0', fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week</div>
      <div style={{ padding: '6px 16px', display: 'flex', gap: 8 }}>
        <div style={{ ...card, flex: 1, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: CAL }}>{workoutsThisWeek}</div>
          <div style={{ fontSize: 11, color: t3, marginTop: 4, fontWeight: 600 }}>Workouts</div>
        </div>
        <div style={{ ...card, flex: 1, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>{totalSets}</div>
          <div style={{ fontSize: 11, color: t3, marginTop: 4, fontWeight: 600 }}>Sets</div>
        </div>
        <div style={{ ...card, flex: 1, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#66BB6A' }}>{Object.keys(volume).length}</div>
          <div style={{ fontSize: 11, color: t3, marginTop: 4, fontWeight: 600 }}>Muscles</div>
        </div>
      </div>

      {/* Volume breakdown */}
      {Object.keys(volume).length > 0 && (
        <div style={{ padding: '8px 16px' }}>
          <div style={{ ...card, padding: '16px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Volume by Muscle</div>
            {Object.entries(volume).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => (
              <div key={muscle} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 10 }}>
                <span style={{ width: 80, fontSize: 12, color: t2, fontWeight: 500, textTransform: 'capitalize' }}>{muscle}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: brd, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: CAL, width: `${Math.min(100, (sets / 20) * 100)}%` }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t1, width: 24, textAlign: 'right' }}>{sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No weight data message */}
      {movingAvg.length < 2 && (
        <div style={{ padding: '12px 16px' }}>
          <div style={{ ...card, padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>⚖️</div>
            <div style={{ fontSize: 14, color: t2, lineHeight: 1.5 }}>Log at least 2 weigh-ins to see your weight trend.</div>
            <button onClick={() => goTo('settings')} style={{ marginTop: 12, padding: '10px 20px', borderRadius: 12, border: 'none', background: ac, color: '#fff', fontSize: 13, fontWeight: 700 }}>Log Weight</button>
          </div>
        </div>
      )}
    </div>
  );
}
