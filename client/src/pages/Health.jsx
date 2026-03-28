import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;
const card = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, margin: '0 16px 8px', overflow: 'hidden' };
const secHeader = { fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 2, padding: '22px 20px 10px' };
const t1 = '#e8ecf1', t2 = 'rgba(255,255,255,0.45)', t3 = 'rgba(255,255,255,0.2)', ac = '#2dba8e';

function fmtDate(k) {
  if (!k) return '';
  const d = new Date(k + 'T00:00:00'), t = new Date(), y = new Date();
  y.setDate(y.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Health() {
  const [weighIns, setWeighIns] = useState([]);
  const [insights, setInsights] = useState([]);
  const [profile, setProfile] = useState({});
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.getWeighIns(30), api.getInsights(), api.getProfile()])
      .then(([w, i, p]) => { setWeighIns(w); setInsights(i); if (p) setProfile(p); });
  }, []);

  async function runAnalysis() {
    setLoading(true);
    try {
      const insight = await api.insight(days);
      setInsights(prev => [insight, ...prev]);
    } catch { alert('Analysis failed.'); }
    setLoading(false);
  }

  // Weight chart
  const renderWeightChart = () => {
    if (weighIns.length < 2) return null;
    const sorted = [...weighIns].sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-14);
    const withTrend = sorted.map((w, i) => {
      const win = sorted.slice(Math.max(0, i - 6), i + 1);
      return { ...w, trend: r1(win.reduce((s, x) => s + x.weightKg, 0) / win.length) };
    });
    const allV = [...withTrend.map(w => w.weightKg), ...withTrend.map(w => w.trend)];
    const mn = Math.min(...allV) - 0.5, mx = Math.max(...allV) + 0.5, rng = mx - mn || 1;
    const W = 340, H = 120, pad = 30;
    const pts = withTrend.map((w, i) => ({
      x: pad + i * ((W - pad * 2) / (withTrend.length - 1 || 1)),
      y: pad + (1 - (w.weightKg - mn) / rng) * (H - pad * 2),
      ty: pad + (1 - (w.trend - mn) / rng) * (H - pad * 2),
    }));
    const trendLine = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.ty}`).join(' ');
    const wkCh = withTrend.length >= 7 ? r1(withTrend[withTrend.length - 1].trend - withTrend[Math.max(0, withTrend.length - 8)].trend) : null;

    return (
      <div style={card}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 2, color: t2 }}>Weight Trend</span>
            {wkCh !== null && <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: wkCh < 0 ? 'rgba(45,186,142,0.12)' : 'rgba(248,81,73,0.12)', color: wkCh < 0 ? ac : '#f85149' }}>{wkCh > 0 ? '+' : ''}{wkCh} kg/wk</span>}
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p, i) => { const y = pad + p * (H - pad * 2); return (<g key={i}><line x1={pad} y1={y} x2={W - pad} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4,4" /><text x={pad - 4} y={y + 4} textAnchor="end" fontSize="9" fill="rgba(255,255,255,0.3)">{r1(mx - p * rng)}</text></g>); })}
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="rgba(255,255,255,0.15)" stroke="#1b2129" strokeWidth="2" />)}
            <path d={trendLine} fill="none" stroke="#5b9ef0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={`t${i}`} cx={p.x} cy={p.ty} r="4" fill="#5b9ef0" stroke="#1b2129" strokeWidth="2" />)}
            {profile.weightGoalKg && (() => { const gy = pad + (1 - (profile.weightGoalKg - mn) / rng) * (H - pad * 2); if (gy > 0 && gy < H) return (<><line x1={pad} y1={gy} x2={W - pad} y2={gy} stroke={ac} strokeWidth="1.5" strokeDasharray="6,4" /><text x={W - pad + 4} y={gy + 4} fontSize="9" fill={ac}>Goal</text></>); return null; })()}
          </svg>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: t2 }}>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.15)', marginRight: 4, verticalAlign: 'middle' }} />Daily</span>
            <span><span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: '#5b9ef0', marginRight: 4, verticalAlign: 'middle' }} />Trend</span>
            {profile.weightGoalKg && withTrend.length > 0 && <span>{r1(withTrend[withTrend.length - 1].trend - profile.weightGoalKg)}kg to go</span>}
          </div>
        </div>
      </div>
    );
  };

  const pill = (active) => ({
    padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 700,
    border: active ? '1px solid #2dba8e' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(45,186,142,0.12)' : 'rgba(255,255,255,0.04)',
    color: active ? '#2dba8e' : t2,
    letterSpacing: 0.5,
  });

  return (
    <div style={{ paddingBottom: 92 }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: t1, letterSpacing: -0.3 }}>Health</div>
      </div>

      {/* Weight */}
      <div style={secHeader}>Weight</div>
      {weighIns.length >= 2 ? renderWeightChart() : (
        <div style={{ ...card, padding: '24px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: t2 }}>Log 2+ weigh-ins to see trends</div>
        </div>
      )}

      {/* Latest weight */}
      {weighIns.length > 0 && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 18px', gap: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(91,158,240,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5b9ef0' }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, color: t2, flex: 1 }}>Latest Weight</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1 }}>{weighIns[0].weightKg}<span style={{ fontSize: 16, color: t3 }}>kg</span></div>
              <div style={{ fontSize: 12, color: t3, fontWeight: 600, marginTop: 1 }}>{fmtDate(weighIns[0].date?.split('T')[0])}</div>
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      <div style={secHeader}>AI Insights</div>
      <div style={card}>
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)} style={pill(days === d)}>{d}d</button>
            ))}
          </div>
          <button onClick={runAnalysis} disabled={loading}
            style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: loading ? 'rgba(255,255,255,0.08)' : ac, color: loading ? t2 : '#fff', fontSize: 14, fontWeight: 700 }}>
            {loading ? 'Analysing...' : `Analyse last ${days} days`}
          </button>
        </div>
      </div>

      {insights.map(ins => (
        <div key={ins.id} style={card}>
          <div style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 10, color: t2, marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
              {new Date(ins.timestamp).toLocaleDateString('en-NZ')} · {ins.daysAnalysed}-day
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: t1, whiteSpace: 'pre-wrap' }}>{ins.response}</div>
          </div>
        </div>
      ))}

      <div style={{ height: 20 }} />
    </div>
  );
}
