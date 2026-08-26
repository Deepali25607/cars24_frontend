import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Icon, Spinner, useToast } from '../ui';
import { ReqStatusChip } from './Requests';

const TASK_LABEL = { OPEN: 'Open', IN_PROGRESS: 'In progress', DONE: 'Done' };

export default function RequestDetail() {
  const { id } = useParams();
  const { user, isIT } = useAuth();
  const toast = useToast();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api(`/requests/${id}`).then(setR).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (err) return <div className="error-box">{err}</div>;
  if (!r) return <div className="loading-page"><Spinner dark /></div>;

  const decide = async (decision) => {
    setBusy(true);
    try {
      await api(`/requests/${r.id}/approve`, { method: 'POST', body: { decision, note: note || null } });
      toast(decision === 'approve' ? 'Approved' : 'Rejected');
      setNote('');
      load();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const taskAction = async (taskId, status) => {
    try {
      await api(`/requests/tasks/${taskId}`, { method: 'POST', body: { status, assign_to_me: true } });
      load();
    } catch (e) { toast(e.message, true); }
  };

  const cancel = async () => {
    if (!confirm('Cancel this request?')) return;
    try {
      await api(`/requests/${r.id}/cancel`, { method: 'POST' });
      toast('Request cancelled');
      load();
    } catch (e) { toast(e.message, true); }
  };

  const canCancel = (r.requester_id === user.id || user.role === 'ADMIN')
    && !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(r.status);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="sub" style={{ marginBottom: 4 }}>
            <Link to="/requests">Service requests</Link> / <span className="tnum">{r.request_number}</span>
          </p>
          <h1 style={{ marginTop: 0 }}>{r.item_name}</h1>
          <p className="sub">
            Requested by {r.requester_name} · {fmtDate(r.created_at)}
            {r.group_name ? ` · ${r.group_name}` : ''}
          </p>
        </div>
        <div className="row">
          <ReqStatusChip status={r.status} />
          {canCancel && <button className="btn btn-ghost btn-sm" onClick={cancel}>Cancel request</button>}
        </div>
      </div>

      {r.description && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="kb-body">{r.description}</div>
        </div>
      )}

      {r.approvals.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head"><h3>Approval chain</h3></div>
          <div className="card-pad appr-chain" style={{ paddingTop: 0 }}>
            {r.approvals.map((a) => (
              <div key={a.id} className={`appr-step ${a.status === 'APPROVED' ? 'done' : a.status === 'REJECTED' ? 'rejected' : ''}`}>
                <span className="lvl">{a.status === 'APPROVED' ? <Icon name="check" size={13} /> : a.level}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    Level {a.level} — {a.approver_role === 'ADMIN' ? 'IT approval' : 'Manager approval'}
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {a.status === 'PENDING'
                      ? 'Waiting for decision'
                      : `${a.status === 'APPROVED' ? 'Approved' : 'Rejected'} by ${a.approver_name || '—'} ${a.acted_at ? timeAgo(a.acted_at) : ''}`}
                    {a.note ? ` — “${a.note}”` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {r.status === 'PENDING_APPROVAL' && (
            r.can_approve_level ? (
              <div className="card-pad" style={{ borderTop: '1px solid var(--line, #e3e8ee)' }}>
                <label className="field"><span>Note (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason or comment…" /></label>
                <div className="row">
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide('approve')}>Approve</button>
                  <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => decide('reject')}>Reject</button>
                </div>
              </div>
            ) : ['TEAM_LEAD', 'ADMIN'].includes(user.role) && (
              <div className="card-pad muted" style={{ borderTop: '1px solid var(--line, #e3e8ee)', fontSize: 13 }}>
                {r.awaiting_role === 'TEAM_LEAD'
                  ? 'Awaiting Team Lead approval (level 1) — your IT approval unlocks once it is given.'
                  : 'Awaiting administrator approval (level 2).'}
              </div>
            )
          )}
        </div>
      )}

      <div className="card">
        <div className="card-head"><h3>Fulfillment tasks</h3></div>
        {r.tasks.length === 0 ? (
          <div className="card-pad muted" style={{ paddingTop: 0 }}>
            {r.status === 'PENDING_APPROVAL' ? 'Tasks are created after approval.' : 'No tasks yet.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Task</th><th>Status</th><th>Agent</th>{isIT && <th />}</tr></thead>
              <tbody>
                {r.tasks.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
                    <td><span className={`chip chip-${t.status}`}><span className="dot" />{TASK_LABEL[t.status]}</span></td>
                    <td className="muted">{t.agent_name || '—'}</td>
                    {isIT && (
                      <td className="row" style={{ gap: 6 }}>
                        {t.status === 'OPEN' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => taskAction(t.id, 'IN_PROGRESS')}>Start</button>
                        )}
                        {t.status !== 'DONE' && (
                          <button className="btn btn-primary btn-sm" onClick={() => taskAction(t.id, 'DONE')}>Complete</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
