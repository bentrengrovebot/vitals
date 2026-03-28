import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#f8f8fa' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px' }}>Vitals</div>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: '#fef2f2', color: '#ef4444', fontSize: 14, marginBottom: 16 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #eaeaef', background: '#fff', fontSize: 15, marginTop: 4 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #eaeaef', background: '#fff', fontSize: 15, marginTop: 4 }} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: '#3b82f6', color: '#fff', fontSize: 15, fontWeight: 700 }}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#6b7280' }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 14, color: '#6b7280' }}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
