import { useState } from 'react';
import { api } from '../api';

const GOALS = [
  { id: 'fat_loss', label: 'Fat Loss', sub: 'Lose fat + preserve muscle', icon: '🔥' },
  { id: 'muscle_gain', label: 'Muscle Gain', sub: 'Gain muscle + gain weight', icon: '💪' },
  { id: 'maintenance', label: 'Maintenance', sub: 'Power workouts + enhance recovery', icon: '⚡' },
  { id: 'health', label: 'Health Optimization', sub: 'Overall health + longevity', icon: '🧠' },
];

const BODY_FAT = [
  { id: 'under15', label: 'Less than 15%', range: [8, 15] },
  { id: '15to22', label: '15 - 22%', range: [15, 22] },
  { id: '22to30', label: '22 - 30%', range: [22, 30] },
  { id: 'over30', label: 'Greater than 30%', range: [30, 40] },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    goal: '',
    name: '',
    sex: 'Male',
    weight: '',
    height: '',
    age: '',
    bodyFat: '',
    targetWeight: '',
    recommendation: null,
  });

  const update = (key, val) => setData(d => ({ ...d, [key]: val }));

  async function calculateTargets() {
    setLoading(true);
    try {
      // Use AI to calculate personalized targets
      const response = await fetch('/api/ai/estimate-targets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: data.goal,
          sex: data.sex,
          weight: parseFloat(data.weight),
          height: parseFloat(data.height),
          age: parseInt(data.age),
          bodyFat: data.bodyFat,
          targetWeight: data.targetWeight ? parseFloat(data.targetWeight) : null,
        }),
      });
      const result = await response.json();
      update('recommendation', result);
    } catch (err) {
      // Fallback calculation
      const weight = parseFloat(data.weight) || 100;
      const bmr = data.sex === 'Male'
        ? 10 * weight + 6.25 * (parseFloat(data.height) || 176) - 5 * (parseInt(data.age) || 30) + 5
        : 10 * weight + 6.25 * (parseFloat(data.height) || 165) - 5 * (parseInt(data.age) || 30) - 161;
      const tdee = bmr * 1.55;
      const calories = data.goal === 'fat_loss' ? Math.round(tdee - 500)
        : data.goal === 'muscle_gain' ? Math.round(tdee + 300)
        : Math.round(tdee);
      const protein = Math.round(weight * 1.6);
      const fat = Math.round(calories * 0.25 / 9);
      const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
      update('recommendation', { calories, protein, fat, carbs, tdee: Math.round(tdee) });
    }
    setLoading(false);
  }

  async function finishOnboarding() {
    setLoading(true);
    try {
      // Save profile
      await api.updateProfile({
        name: data.name,
        sex: data.sex,
        weightKg: parseFloat(data.weight) || null,
        heightCm: parseFloat(data.height) || null,
        weightGoalKg: data.targetWeight ? parseFloat(data.targetWeight) : null,
        dob: data.age ? new Date(new Date().getFullYear() - parseInt(data.age), 0, 1).toISOString() : null,
      });

      // Save goals
      if (data.recommendation) {
        await api.updateGoals({
          calories: data.recommendation.calories,
          proteinG: data.recommendation.protein,
          fatG: data.recommendation.fat,
          carbsG: data.recommendation.carbs,
          waterMl: 2500,
        });
      }

      // Save context to AI memory
      await api.chat([{
        role: 'user',
        content: `Remember this about me: My goal is ${data.goal.replace('_', ' ')}. I'm ${data.sex}, ${data.age} years old, ${data.height}cm, ${data.weight}kg. Body fat approximately ${data.bodyFat || 'unknown'}. ${data.targetWeight ? `Target weight: ${data.targetWeight}kg.` : ''}`
      }]);

      onComplete();
    } catch (err) {
      console.error('Onboarding error:', err);
      onComplete(); // Continue anyway
    }
    setLoading(false);
  }

  const inp = { width: '100%', padding: '16px 18px', borderRadius: 14, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 16, color: '#1a1a1a', boxSizing: 'border-box' };
  const btn = { width: '100%', padding: 18, borderRadius: 14, border: 'none', background: '#2dba8e', color: '#fff', fontSize: 16, fontWeight: 600 };
  const t2 = '#6b7280';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f7', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {step > 1 ? (
          <button onClick={() => setStep(s => s - 1)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#1a1a1a' }}>←</button>
        ) : <div style={{ width: 30 }} />}
        <span style={{ fontSize: 13, color: t2 }}>Step {step} of 5</span>
        <div style={{ width: 30 }} />
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ height: 3, borderRadius: 2, background: '#e5e5e7', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(step / 5) * 100}%`, background: '#2dba8e', borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '0 20px', maxWidth: 430, margin: '0 auto', width: '100%' }}>

        {/* Step 1: Goal */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>What's your goal?</h2>
            <p style={{ fontSize: 14, color: t2, marginBottom: 24 }}>We'll personalize everything based on this.</p>
            {GOALS.map(g => (
              <button key={g.id} onClick={() => update('goal', g.id)} style={{
                display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '18px 18px',
                marginBottom: 10, borderRadius: 14,
                border: data.goal === g.id ? '2px solid #2dba8e' : '1px solid #e5e5e7',
                background: data.goal === g.id ? 'rgba(45,186,142,0.04)' : '#ffffff',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 24 }}>{g.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>{g.label}</div>
                  <div style={{ fontSize: 13, color: t2, marginTop: 2 }}>{g.sub}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: data.goal === g.id ? 'none' : '2px solid #d1d5db', background: data.goal === g.id ? '#2dba8e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {data.goal === g.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: About you */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>Tell us about yourself</h2>
            <p style={{ fontSize: 14, color: t2, marginBottom: 24 }}>We'll use this to calculate your targets.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Name</label>
              <input value={data.name} onChange={e => update('name', e.target.value)} placeholder="Ben" style={{ ...inp, marginTop: 6 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Sex</label>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                {['Male', 'Female'].map(s => (
                  <button key={s} onClick={() => update('sex', s)} style={{
                    flex: 1, padding: '14px', borderRadius: 14,
                    border: data.sex === s ? '2px solid #2dba8e' : '1px solid #e5e5e7',
                    background: data.sex === s ? 'rgba(45,186,142,0.04)' : '#ffffff',
                    fontSize: 15, fontWeight: 500, color: '#1a1a1a',
                  }}>{s}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Weight (kg)</label>
                <input type="number" value={data.weight} onChange={e => update('weight', e.target.value)} placeholder="104" style={{ ...inp, marginTop: 6 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Height (cm)</label>
                <input type="number" value={data.height} onChange={e => update('height', e.target.value)} placeholder="176" style={{ ...inp, marginTop: 6 }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Age</label>
              <input type="number" value={data.age} onChange={e => update('age', e.target.value)} placeholder="30" style={{ ...inp, marginTop: 6 }} />
            </div>
          </div>
        )}

        {/* Step 3: Body composition */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>Body fat estimate</h2>
            <p style={{ fontSize: 14, color: t2, marginBottom: 24 }}>Don't worry if you're not sure — a rough estimate is fine.</p>
            {BODY_FAT.map(bf => (
              <button key={bf.id} onClick={() => update('bodyFat', bf.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '18px 18px', marginBottom: 10, borderRadius: 14,
                border: data.bodyFat === bf.id ? '2px solid #2dba8e' : '1px solid #e5e5e7',
                background: data.bodyFat === bf.id ? 'rgba(45,186,142,0.04)' : '#ffffff',
                textAlign: 'left',
              }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: '#1a1a1a' }}>{bf.label}</span>
                <div style={{ width: 22, height: 22, borderRadius: '50%', border: data.bodyFat === bf.id ? 'none' : '2px solid #d1d5db', background: data.bodyFat === bf.id ? '#2dba8e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {data.bodyFat === bf.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>
              </button>
            ))}
            <button onClick={() => { update('bodyFat', 'unknown'); }} style={{
              width: '100%', padding: '14px', marginTop: 4, borderRadius: 14,
              border: data.bodyFat === 'unknown' ? '2px solid #2dba8e' : '1px solid #e5e5e7',
              background: 'transparent', fontSize: 14, color: t2, fontWeight: 500,
            }}>I'm not sure — skip this</button>
          </div>
        )}

        {/* Step 4: AI calculates targets */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>Your targets</h2>
            <p style={{ fontSize: 14, color: t2, marginBottom: 24 }}>Based on your profile, here's what we recommend.</p>

            {!data.recommendation && !loading && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <button onClick={calculateTargets} style={{ ...btn, maxWidth: 280 }}>Calculate My Targets</button>
              </div>
            )}

            {loading && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: t2 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>🧠</div>
                Calculating your personalized targets...
              </div>
            )}

            {data.recommendation && (
              <>
                <div style={{ background: '#ffffff', border: '2px solid #2dba8e', borderRadius: 16, padding: 20, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#2dba8e', textTransform: 'uppercase', letterSpacing: 1 }}>Recommended</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div><div style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a' }}>{data.recommendation.calories}</div><div style={{ fontSize: 12, color: t2 }}>calories/day</div></div>
                    <div><div style={{ fontSize: 28, fontWeight: 700, color: '#e0a526' }}>{data.recommendation.protein}g</div><div style={{ fontSize: 12, color: t2 }}>protein</div></div>
                    <div><div style={{ fontSize: 28, fontWeight: 700, color: '#2dba8e' }}>{data.recommendation.fat}g</div><div style={{ fontSize: 12, color: t2 }}>fat</div></div>
                    <div><div style={{ fontSize: 28, fontWeight: 700, color: '#8b5ef6' }}>{data.recommendation.carbs}g</div><div style={{ fontSize: 12, color: t2 }}>carbs</div></div>
                  </div>
                </div>

                {data.goal === 'fat_loss' && data.targetWeight && (
                  <div style={{ background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Your plan</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t2 }}>
                      <div><span style={{ fontWeight: 600, color: '#1a1a1a' }}>{data.weight}kg</span><br/>Start</div>
                      <div style={{ textAlign: 'center' }}><span style={{ fontWeight: 600, color: '#2dba8e' }}>↓ {(parseFloat(data.weight) - parseFloat(data.targetWeight)).toFixed(1)}kg</span><br/>Change</div>
                      <div style={{ textAlign: 'right' }}><span style={{ fontWeight: 600, color: '#1a1a1a' }}>{data.targetWeight}kg</span><br/>Goal</div>
                    </div>
                  </div>
                )}

                {data.goal === 'fat_loss' && !data.targetWeight && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: t2, textTransform: 'uppercase', letterSpacing: 1 }}>Target Weight (optional)</label>
                    <input type="number" value={data.targetWeight} onChange={e => update('targetWeight', e.target.value)} placeholder="95" style={{ ...inp, marginTop: 6 }} />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a1a1a' }}>Let's review your plan</h2>
            <p style={{ fontSize: 14, color: t2, marginBottom: 24 }}>Everything looks good? Let's get started.</p>

            {[
              { label: 'Goal', value: GOALS.find(g => g.id === data.goal)?.label || data.goal, icon: '🎯' },
              { label: 'Profile', value: `${data.sex}, ${data.age}y, ${data.height}cm, ${data.weight}kg`, icon: '👤' },
              { label: 'Calories', value: `${data.recommendation?.calories || '—'} cal/day`, icon: '🔥' },
              { label: 'Protein', value: `${data.recommendation?.protein || '—'}g/day`, icon: '💪' },
              { label: 'Fat', value: `${data.recommendation?.fat || '—'}g/day`, icon: '🥑' },
              { label: 'Carbs', value: `${data.recommendation?.carbs || '—'}g/day`, icon: '🍚' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', marginBottom: 8, background: '#ffffff', border: '1px solid #e5e5e7', borderRadius: 14 }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: t2, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', marginTop: 2 }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom button */}
      <div style={{ padding: '16px 20px 32px', maxWidth: 430, margin: '0 auto', width: '100%' }}>
        {step < 4 && (
          <button onClick={() => setStep(s => s + 1)} disabled={
            (step === 1 && !data.goal) ||
            (step === 2 && (!data.name || !data.weight || !data.height || !data.age)) ||
            (step === 3 && !data.bodyFat)
          } style={{
            ...btn,
            opacity: (step === 1 && !data.goal) || (step === 2 && (!data.name || !data.weight || !data.height || !data.age)) || (step === 3 && !data.bodyFat) ? 0.5 : 1,
          }}>Next</button>
        )}
        {step === 4 && data.recommendation && (
          <button onClick={() => setStep(5)} style={btn}>Looks Good</button>
        )}
        {step === 5 && (
          <button onClick={finishOnboarding} disabled={loading} style={btn}>
            {loading ? 'Setting up...' : 'Start My Journey'}
          </button>
        )}
      </div>
    </div>
  );
}
