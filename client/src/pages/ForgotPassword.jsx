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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#f8f8fa' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>Vitals</div>
        </div>
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Check your email</div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 20 }}>If an account exists for {email}, we've sent a reset link.</div>
            <Link to="/login" style={{ fontSize: 14 }}>Back to login</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #eaeaef', background: '#fff', fontSize: 15, marginTop: 4 }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 700 }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#6b7280' }}>
              <Link to="/login">Back to login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
