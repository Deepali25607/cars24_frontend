import { Cars24Mark, Cars24Wordmark } from '../Brand';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, login, booting } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  if (!booting && user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="row" style={{ gap: 12 }}>
          <Cars24Mark size={40} />
          <Cars24Wordmark size={28} />
        </div>
        <div>
          <h1>Your laptop trouble, <span className="accent">handled</span> — from first report to fixed.</h1>
          <p className="lede">
            Report an issue in under a minute, follow every step of the fix,
            and get back to work. The IT service desk for people, not tickets.
          </p>
        </div>
        <p style={{ color: '#c9c4ff', fontSize: 12.5 }}>
          Cars24 IT Service Desk · Phase 1 (Basic) · Internal use
        </p>
      </div>

      <div className="login-panel">
        <div className="login-card">
          <h2>Sign in</h2>
          <p className="muted" style={{ marginBottom: 22 }}>Use your company account to continue.</p>
          {err && <div className="error-box">{err}</div>}
          <form onSubmit={submit}>
            <label className="field">
              <span>Work email</span>
              <input type="email" value={email} autoFocus
                placeholder="you@company.com"
                onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={password}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p className="muted" style={{ marginTop: 18 }}>
            Forgot your password? Contact your administrator for a reset.
          </p>
        </div>
      </div>
    </div>
  );
}
