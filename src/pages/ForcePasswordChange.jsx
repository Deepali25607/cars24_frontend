import { useState } from 'react';
import { useAuth } from '../auth';

// Shown (blocking the app) when the signed-in user still has a default or
// admin-reset password. The backend also refuses every other endpoint with
// PASSWORD_CHANGE_REQUIRED until this is done.
export default function ForcePasswordChange() {
  const { changePassword, logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (next.length < 8) return setErr('New password must be at least 8 characters.');
    if (next !== confirm) return setErr('New passwords do not match.');
    setBusy(true);
    try {
      await changePassword(current, next);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel" style={{ gridColumn: '1 / -1' }}>
        <div className="login-card">
          <h2>Set a new password</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            For security you must change your temporary password before continuing.
          </p>
          <form onSubmit={submit}>
            <label>Current password</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
            <label>New password</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
            <label>Confirm new password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {err && <div className="error-box" style={{ marginTop: 10 }}>{err}</div>}
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 14, width: '100%' }}>
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
          <button className="btn btn-ghost btn-sm" type="button" style={{ marginTop: 12 }}
            onClick={() => logout()}>Sign out</button>
        </div>
      </div>
    </div>
  );
}
