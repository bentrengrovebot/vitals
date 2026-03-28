import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Insights({ goTo }) {
  const [insights, setInsights] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getInsights().then(setInsights); }, []);

  async function runAnalysis() {
    setLoading(true);
    try {
      const insight = await api.insight(days);
      setInsights(prev => [insight, ...prev]);
    } catch (e) {
      alert('Analysis failed. Please try again.');
    }
    setLoading(false);
  }

  const card = { background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' };
  const t1 = '#e6edf3', t2 = '#8b949e', t3 = '#484f58', ac = '#2dba8e';

  const pill = (active) => ({
    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: active ? '1px solid #2dba8e' : '1px solid rgba(255,255,255,0.1)',
    background: active ? 'rgba(45,186,142,0.15)' : 'rgba(255,255,255,0.05)',
    color: active ? '#2dba8e' : '#8b949e',
  });

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 20, gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: t1 }}>Insights</div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: t1 }}>Run Analysis</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)} style={pill(days === d)}>{d}d</button>
            ))}
          </div>
          <button onClick={runAnalysis} disabled={loading}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: loading ? t3 : ac, color: loading ? t2 : '#fff', fontSize: 15, fontWeight: 700 }}>
            {loading ? 'Analysing...' : `Analyse last ${days} days`}
          </button>
        </div>
        {insights.map(ins => (
          <div key={ins.id} style={{ ...card, padding: 18, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: t2, marginBottom: 8 }}>
              {new Date(ins.timestamp).toLocaleDateString('en-NZ')} · {ins.daysAnalysed}-day
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: t1, whiteSpace: 'pre-wrap' }}>{ins.response}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
