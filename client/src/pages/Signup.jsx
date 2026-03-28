import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await signup(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const inp = { width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: '#232a33', fontSize: 15, marginTop: 4, color: '#ffffff' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#191d21' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: '#ffffff' }}>Vitals</div>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', color: '#f85149', fontSize: 14, marginBottom: 16 }}>{error}</div>}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} placeholder="Min 8 characters" />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={inp} />
          </div>
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: '#2dba8e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#8b949e' }}>
          Already have an account? <Link to="/login" style={{ color: '#58a6ff', textDecoration: 'none' }}>Log in</Link>
        </div>
      </div>
    </div>
  );
}
