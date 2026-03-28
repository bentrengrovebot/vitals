import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const PROMPTS = [
  "I'm getting reflux right now",
  "Feeling low energy",
  "Log bloating after lunch",
  "Weekly check-in",
  "Why do I get reflux?",
  "Am I hitting protein?",
  "Estimate my TDEE",
  "Should I adjust targets?",
];

export default function VitalsChat({ onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEnd = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    const newMsgs = [...messages, { role: 'user', content: msg }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const data = await api.chat(newMsgs);
      setMessages([...newMsgs, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages([...newMsgs, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
  }

  const t1 = '#111827', t3 = '#9ca3af', ac = '#3b82f6', brd = '#eaeaef', bg = '#f8f8fa';

  const pill = {
    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
    border: '1.5px solid #eaeaef', background: '#fff', color: '#6b7280',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12, borderBottom: `1px solid ${brd}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 22 }}>←</button>
        <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Vitals</div>
          <div style={{ fontSize: 11, color: t3 }}>Your health coach</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {!messages.length && (
          <div style={{ textAlign: 'center', padding: '36px 10px' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: t1, marginBottom: 6 }}>Your health coach</div>
            <div style={{ fontSize: 13, color: t3, lineHeight: 1.6, marginBottom: 16 }}>Log symptoms, ask about patterns, get coaching — all from here.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {PROMPTS.map(q => (
                <button key={q} onClick={() => { setInput(q); sendMessage(q); }} style={pill}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '12px 16px', borderRadius: 18, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              ...(m.role === 'user'
                ? { background: ac, color: '#fff', borderBottomRightRadius: 4 }
                : { background: bg, color: t1, borderBottomLeftRadius: 4 }),
            }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'inline-block', padding: '12px 16px', borderRadius: 18, background: bg, color: t3, fontSize: 14, borderBottomLeftRadius: 4 }}>Thinking...</div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <div style={{ padding: '12px 20px 28px', display: 'flex', gap: 8, borderTop: `1px solid ${brd}` }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Ask about your health..." style={{ flex: 1, padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${brd}`, background: '#fff', fontSize: 15 }} />
        <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
          style={{ width: 48, height: 48, borderRadius: 14, border: 'none', background: input.trim() ? ac : brd, color: input.trim() ? '#fff' : t3, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}
