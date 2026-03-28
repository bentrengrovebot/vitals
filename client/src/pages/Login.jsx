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

  const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#232a33', fontSize: 15, marginTop: 4, color: '#e6edf3' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#1b2129' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: '#e6edf3' }}>Vitals</div>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', color: '#f85149', fontSize: 14, marginBottom: 16 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
              style={inp} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={inp} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: '#2dba8e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#8b949e' }}>
          <Link to="/forgot-password" style={{ color: '#58a6ff', textDecoration: 'none' }}>Forgot password?</Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 14, color: '#8b949e' }}>
          Don't have an account? <Link to="/signup" style={{ color: '#58a6ff', textDecoration: 'none' }}>Sign up</Link>
        </div>
      </div>
    </div>
  );
}
