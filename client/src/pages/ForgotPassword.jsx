import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await api.forgotPassword(email);
    setSent(true);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#191d21' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: '#e6edf3' }}>Vitals</div>
        </div>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: '#e6edf3' }}>Check your email</div>
            <div style={{ fontSize: 14, color: '#8b949e', marginBottom: 20 }}>If an account exists for {email}, we've sent a reset link.</div>
            <Link to="/login" style={{ fontSize: 14, color: '#58a6ff', textDecoration: 'none' }}>Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#232a33', fontSize: 15, marginTop: 4, color: '#e6edf3' }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: '#2dba8e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#8b949e' }}>
              <Link to="/login" style={{ color: '#58a6ff', textDecoration: 'none' }}>Back to login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
