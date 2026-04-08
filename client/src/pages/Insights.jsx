import { useState, useEffect } from 'react';
import { api } from '../api';

const r1 = n => Math.round(n * 10) / 10;

export default function Insights({ goTo }) {
  const [volume, setVolume] = useState({});
  const [sessions, setSessions] = useState([]);
  const [goals, setGoals] = useState(null);

  useEffect(() => {
    Promise.all([
      api.getTrainingVolume(7).catch(() => ({})),
      api.getTrainingSessions().catch(() => []),
      api.getGoals().catch(() => null),
    ]).then(([v, s, g]) => { setVolume(v); setSessions(s); setGoals(g); });
  }, []);

  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' };
  const t1 = '#111827', t2 = '#6b7280', t3 = '#9ca3af', ac = '#3b82f6', brd = '#eaeaef';

  const totalSets = Object.values(volume).reduce((s, v) => s + v, 0);
  const workoutsThisWeek = sessions.filter(s => {
    const d = new Date(s.date);
    const now = new Date();
    const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).length;

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Insights</div>
      </div>

      {/* MCP info card */}
      <div style={{ padding: '12px 20px' }}>
        <div style={{ ...card, padding: '20px 18px', background: 'linear-gradient(135deg,#3b82f6 0%,#8b5cf6 100%)', color: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>AI via Claude Desktop</div>
          <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.6 }}>
            Ask Claude anything about your nutrition and training data. Connect with the Vitals MCP server in Claude Desktop settings.
          </div>
          <div style={{ marginTop: 12, fontSize: 11, opacity: 0.6, fontWeight: 500 }}>
            Try: "How's my weekly volume?" · "Log bench 4×8 at 80kg" · "What did I eat yesterday?"
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ padding: '0 20px 8px', fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>This Week</div>
      <div style={{ padding: '0 20px', display: 'flex', gap: 8 }}>
        <div style={{ ...card, flex: 1, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: ac }}>{workoutsThisWeek}</div>
          <div style={{ fontSize: 11, color: t3, marginTop: 4, fontWeight: 600 }}>Workouts</div>
        </div>
        <div style={{ ...card, flex: 1, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>{totalSets}</div>
          <div style={{ fontSize: 11, color: t3, marginTop: 4, fontWeight: 600 }}>Sets</div>
        </div>
        <div style={{ ...card, flex: 1, padding: '16px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{Object.keys(volume).length}</div>
          <div style={{ fontSize: 11, color: t3, marginTop: 4, fontWeight: 600 }}>Muscles</div>
        </div>
      </div>

      {/* Volume breakdown */}
      {Object.keys(volume).length > 0 && (
        <div style={{ padding: '12px 20px' }}>
          <div style={{ ...card, padding: '16px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: t3, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Volume by Muscle</div>
            {Object.entries(volume).sort((a, b) => b[1] - a[1]).map(([muscle, sets]) => (
              <div key={muscle} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 10 }}>
                <span style={{ width: 80, fontSize: 12, color: t2, fontWeight: 500, textTransform: 'capitalize' }}>{muscle}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: brd, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: ac, width: `${Math.min(100, (sets / 20) * 100)}%` }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t1, width: 24, textAlign: 'right' }}>{sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
