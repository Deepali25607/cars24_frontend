import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Avatar, Empty, Modal, Spinner, useToast } from '../../ui';

const ROLES = ['EMPLOYEE', 'AGENT', 'TEAM_LEAD', 'ADMIN'];
const ROLE_LABEL = { EMPLOYEE: 'Employee', AGENT: 'Agent', TEAM_LEAD: 'Team Lead', ADMIN: 'Administrator' };

export default function Users() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [meta, setMeta] = useState(null);
  const [editing, setEditing] = useState(null);
  const [q, setQ] = useState('');

  const load = () => api('/admin/users').then(setUsers).catch(() => setUsers([]));
  useEffect(() => { load(); api('/meta').then(setMeta).catch(() => {}); }, []);

  const shown = (users || []).filter((u) =>
    !q || u.full_name.toLowerCase().includes(q.toLowerCase()) || u.email.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>People &amp; roles</h1>
          <p className="sub">Accounts, roles and team membership.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>Add person</button>
      </div>

      <div className="filters">
        <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
      </div>

      <div className="card">
        {!users ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : shown.length === 0 ? (
          <Empty title="No people found" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Person</th><th>Role</th><th>Department</th><th>Location</th><th>Support group</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="row" style={{ gap: 10 }}>
                        <Avatar name={u.full_name} size={30} />
                        <span>
                          <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                          <div className="muted">{u.email}</div>
                        </span>
                      </span>
                    </td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td className="muted">{u.department_name || '—'}</td>
                    <td className="muted">{u.location_name || '—'}</td>
                    <td className="muted">{u.group_name || '—'}</td>
                    <td>
                      {u.active
                        ? <span className="chip chip-RESOLVED"><span className="dot" />Active</span>
                        : <span className="chip chip-REOPENED"><span className="dot" />Inactive</span>}
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && meta && (
        <UserModal user={editing === 'new' ? null : editing} meta={meta}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); load(); toast(msg || 'Saved'); }} />
      )}
    </>
  );
}

function UserModal({ user, meta, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    full_name: user?.full_name || '', email: user?.email || '',
    role: user?.role || 'EMPLOYEE',
    department_id: user?.department_id || '', location_id: user?.location_id || '',
    support_group_id: user?.support_group_id || '', phone: user?.phone || '',
    active: user ? !!user.active : true,
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const isIT = ['AGENT', 'TEAM_LEAD'].includes(f.role);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      full_name: f.full_name, role: f.role,
      department_id: f.department_id ? Number(f.department_id) : null,
      location_id: f.location_id ? Number(f.location_id) : null,
      support_group_id: isIT && f.support_group_id ? Number(f.support_group_id) : null,
      phone: f.phone || null,
    };
    try {
      if (user) {
        await api(`/admin/users/${user.id}`, { method: 'PATCH', body: { ...body, active: f.active ? 1 : 0 } });
        onSaved('User updated');
      } else {
        const r = await api('/admin/users', { method: 'POST', body: { ...body, email: f.email } });
        onSaved(r.temp_password
          ? `User created — temporary password: ${r.temp_password}`
          : 'User created');
      }
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    try {
      const r = await api(`/admin/users/${user.id}`, { method: 'PATCH', body: { reset_password: true } });
      toast(`Temporary password: ${r.temp_password}`);
    } catch (e2) {
      toast(e2.message, true);
    }
  };

  return (
    <Modal title={user ? `Edit ${user.full_name}` : 'Add person'} onClose={onClose} wide>
      <form onSubmit={save} className="form-grid">
        <label className="field"><span className="req">Full name</span>
          <input value={f.full_name} onChange={set('full_name')} required /></label>
        <label className="field"><span className="req">Work email</span>
          <input type="email" value={f.email} onChange={set('email')} required disabled={!!user} /></label>
        <label className="field"><span className="req">Role</span>
          <select value={f.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select></label>
        <label className="field"><span>Phone</span>
          <input value={f.phone} onChange={set('phone')} /></label>
        <label className="field"><span>Department</span>
          <select value={f.department_id} onChange={set('department_id')}>
            <option value="">—</option>
            {meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
        <label className="field"><span>Location</span>
          <select value={f.location_id} onChange={set('location_id')}>
            <option value="">—</option>
            {meta.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></label>
        {isIT && (
          <label className="field"><span>Support group</span>
            <select value={f.support_group_id} onChange={set('support_group_id')}>
              <option value="">—</option>
              {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
        )}
        {user && (
          <label className="field"><span>Account status</span>
            <select value={f.active ? '1' : '0'} onChange={(e) => setF((x) => ({ ...x, active: e.target.value === '1' }))}>
              <option value="1">Active</option>
              <option value="0">Inactive (cannot sign in)</option>
            </select></label>
        )}
        <div className="full row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
          {user && (
            <button type="button" className="btn btn-ghost" onClick={resetPassword}>Reset password</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        {!user && <p className="muted full">New accounts get a temporary password (shown after saving) and must change it on first sign-in.</p>}
      </form>
    </Modal>
  );
}
