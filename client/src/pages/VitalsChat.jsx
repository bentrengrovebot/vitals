import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const PROMPTS = [
  "I'm getting reflux right now",
  "Feeling low energy",
  "Weekly check-in",
  "Build me a meal plan for today",
  "Why do I get reflux?",
  "Am I hitting protein?",
  "Estimate my TDEE",
  "Should I adjust targets?",
];

export default function VitalsChat({ onBack, isPanel }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState([]); // [{name, type, base64, preview}]
  const chatEnd = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        const mediaType = file.type || 'application/octet-stream';
        setAttachments(prev => [...prev, {
          name: file.name,
          type: mediaType,
          base64,
          preview: file.type.startsWith('image/') ? reader.result : null,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  function removeAttachment(idx) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if ((!msg && attachments.length === 0) || loading) return;
    setInput('');

    // Build content array for Claude API (text + images)
    const content = [];
    attachments.forEach(att => {
      if (att.type.startsWith('image/')) {
        content.push({ type: 'image', source: { type: 'base64', media_type: att.type, data: att.base64 } });
      } else {
        // For non-image files, include as text description
        content.push({ type: 'text', text: `[Attached file: ${att.name} (${att.type})]` });
      }
    });
    if (msg) content.push({ type: 'text', text: msg });

    const userMsg = {
      role: 'user',
      content: content.length === 1 && content[0].type === 'text' ? msg : content,
      displayText: msg || `Sent ${attachments.length} file(s)`,
      attachmentPreviews: attachments.filter(a => a.preview).map(a => a.preview),
      attachmentNames: attachments.map(a => a.name),
    };

    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setAttachments([]);
    setLoading(true);

    try {
      // Send to API — convert messages to API format
      const apiMsgs = newMsgs.map(m => ({
        role: m.role,
        content: m.content,
      }));
      const data = await api.chat(apiMsgs);
      setMessages([...newMsgs, { role: 'assistant', content: data.response, actions: data.actions }]);
    } catch {
      setMessages([...newMsgs, { role: 'assistant', content: 'Connection error. Please try again.' }]);
    }
    setLoading(false);
  }

  const t1 = '#1a1a1a', t2 = '#6b7280', t3 = '#9ca3af', ac = '#2dba8e', brd = '#e5e5e7';

  const pill = {
    padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
    border: '1px solid #e5e5e7', background: '#f0f0f2', color: t2,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: isPanel ? '100%' : '100vh', background: isPanel ? '#ffffff' : '#f5f5f7' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: isPanel ? '16px 18px' : '16px 20px', gap: 12, borderBottom: `1px solid ${brd}` }}>
        {!isPanel && <button onClick={onBack} style={{ background: 'none', border: 'none', color: t2, fontSize: 22 }}>←</button>}
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#2dba8e,#1a8a6a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: t1 }}>Vitals AI</div>
          <div style={{ fontSize: 11, color: t2 }}>Your health coach</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {!messages.length && (
          <div style={{ textAlign: 'center', padding: '36px 10px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#2dba8e,#1a8a6a)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: t1, marginBottom: 6 }}>Your health coach</div>
            <div style={{ fontSize: 13, color: t2, lineHeight: 1.6, marginBottom: 6 }}>Log symptoms, ask about patterns, get coaching.</div>
            <div style={{ fontSize: 12, color: t3, marginBottom: 16 }}>Upload photos of meals, labels, or blood tests.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {PROMPTS.map(q => (
                <button key={q} onClick={() => { setInput(q); sendMessage(q); }} style={pill}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth: '85%' }}>
              {/* Show image previews for user messages */}
              {m.attachmentPreviews?.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 4, justifyContent: 'flex-end' }}>
                  {m.attachmentPreviews.map((src, j) => (
                    <img key={j} src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12 }} />
                  ))}
                </div>
              )}
              {/* Show file names for non-image attachments */}
              {m.attachmentNames?.filter((_, j) => !m.attachmentPreviews?.[j]).length > 0 && (
                <div style={{ marginBottom: 4, textAlign: 'right' }}>
                  {m.attachmentNames.map((name, j) => (
                    <div key={j} style={{ fontSize: 11, color: '#ffffff', background: ac, padding: '4px 10px', borderRadius: 8, display: 'inline-block', marginBottom: 2 }}>📎 {name}</div>
                  ))}
                </div>
              )}
              <div style={{
                padding: '12px 16px', borderRadius: 18, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                ...(m.role === 'user'
                  ? { background: ac, color: '#fff', borderBottomRightRadius: 4 }
                  : { background: '#f0f0f2', color: t1, borderBottomLeftRadius: 4 }),
              }}>{m.role === 'user' ? (m.displayText || m.content) : m.content}</div>
              {/* Show actions taken */}
              {m.actions?.length > 0 && (
                <div style={{ marginTop: 6, padding: '8px 12px', borderRadius: 10, background: 'rgba(45,186,142,0.08)', border: '1px solid rgba(45,186,142,0.15)' }}>
                  {m.actions.map((a, j) => (
                    <div key={j} style={{ fontSize: 12, color: ac, fontWeight: 500, padding: '2px 0' }}>✓ {a.result?.message || a.tool}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'inline-block', padding: '12px 16px', borderRadius: 18, background: '#f0f0f2', color: t3, fontSize: 14, borderBottomLeftRadius: 4 }}>Thinking...</div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      {/* Attachment preview bar */}
      {attachments.length > 0 && (
        <div style={{ padding: '8px 20px', display: 'flex', gap: 6, borderTop: `1px solid ${brd}`, flexWrap: 'wrap' }}>
          {attachments.map((att, i) => (
            <div key={i} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, background: '#f0f0f2', border: '1px solid #e5e5e7' }}>
              {att.preview ? (
                <img src={att.preview} alt="" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
              ) : (
                <span style={{ fontSize: 14 }}>📄</span>
              )}
              <span style={{ fontSize: 11, color: t2, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
              <button onClick={() => removeAttachment(i)} style={{ background: 'none', border: 'none', color: t3, fontSize: 14, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{ padding: isPanel ? '12px 18px 16px' : '12px 20px 28px', display: 'flex', gap: 8, borderTop: attachments.length ? 'none' : `1px solid ${brd}`, alignItems: 'flex-end' }}>
        {/* File upload button */}
        <button onClick={() => fileRef.current?.click()} style={{
          width: 44, height: 44, borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: t2,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <input type="file" ref={fileRef} onChange={handleFileSelect} accept="image/*,.pdf,.txt,.csv,.json" multiple style={{ display: 'none' }} />

        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          placeholder="Ask about your health..." style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1px solid #e5e5e7', background: '#ffffff', fontSize: 15, color: t1 }} />
        <button onClick={() => sendMessage()} disabled={loading || (!input.trim() && attachments.length === 0)}
          style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: (input.trim() || attachments.length) ? ac : '#e5e5e7', color: (input.trim() || attachments.length) ? '#fff' : t3, fontSize: 18, fontWeight: 700, flexShrink: 0 }}>↑</button>
      </div>
    </div>
  );
}
