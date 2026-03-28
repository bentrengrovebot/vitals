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

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
  const t1 = '#111827', t2 = '#6b7280', t3 = '#9ca3af', ac = '#3b82f6', brd = '#eaeaef';

  const pill = (active) => ({
    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: active ? 'none' : '1.5px solid #eaeaef',
    background: active ? ac : '#fff',
    color: active ? '#fff' : t2,
  });

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: 20, gap: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Insights</div>
      </div>
      <div style={{ padding: '0 20px' }}>
        <div style={{ ...card, padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Run Analysis</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)} style={pill(days === d)}>{d}d</button>
            ))}
          </div>
          <button onClick={runAnalysis} disabled={loading}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: loading ? brd : ac, color: loading ? t3 : '#fff', fontSize: 15, fontWeight: 700 }}>
            {loading ? 'Analysing...' : `Analyse last ${days} days`}
          </button>
        </div>
        {insights.map(ins => (
          <div key={ins.id} style={{ ...card, padding: 18, marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: t3, marginBottom: 8 }}>
              {new Date(ins.timestamp).toLocaleDateString('en-NZ')} · {ins.daysAnalysed}-day
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: t1, whiteSpace: 'pre-wrap' }}>{ins.response}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
