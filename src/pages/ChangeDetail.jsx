import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Icon, Spinner, useToast } from '../ui';
import { ChgStatusChip, CHG_TYPE_LABEL } from './Changes';

export default function ChangeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [c, setC] = useState(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [pir, setPir] = useState({ outcome: 'SUCCESSFUL', notes: '' });
  const [busy, setBusy] = useState(false);

  const load = () => api(`/changes/${id}`).then(setC).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (err) return <div className="error-box">{err}</div>;
  if (!c) return <div className="loading-page"><Spinner dark /></div>;

  const act = async (fn, msg) => {
    setBusy(true);
    try { await fn(); if (msg) toast(msg); load(); }
    catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const post = (path, body) => () => act(() => api(`/changes/${c.id}/${path}`, { method: 'POST', body }), null);
  const canLead = ['TEAM_LEAD', 'ADMIN'].includes(user.role);

  const statusActions = {
    APPROVED: [['SCHEDULED', 'Schedule'], ['CANCELLED', 'Cancel']],
    SCHEDULED: [['IN_PROGRESS', 'Start implementation'], ['CANCELLED', 'Cancel']],
    IN_PROGRESS: [['COMPLETED', 'Mark completed'], ['FAILED', 'Mark failed']],
    DRAFT: [['CANCELLED', 'Cancel']],
    PENDING_APPROVAL: [['CANCELLED', 'Cancel']],
  }[c.status] || [];

  return (
    <>
      <div className="page-head">
        <div>
          <p className="sub" style={{ marginBottom: 4 }}>
            <Link to="/changes">Changes</Link> / <span className="tnum">{c.change_number}</span>
          </p>
          <h1 style={{ marginTop: 0 }}>{c.title}</h1>
          <p className="sub">
            {CHG_TYPE_LABEL[c.change_type]} change · Risk {c.risk} · Requested by {c.requested_by_name} · {fmtDate(c.created_at)}
            {c.planned_start ? ` · Window ${fmtDate(c.planned_start)}${c.planned_end ? ` → ${fmtDate(c.planned_end)}` : ''}` : ''}
          </p>
        </div>
        <ChgStatusChip status={c.status} />
      </div>

      <div className="row" style={{ marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        {c.status === 'DRAFT' && (
          <button className="btn btn-primary btn-sm" disabled={busy}
            onClick={post('submit')}>Submit for approval</button>
        )}
        {statusActions.map(([s, label]) => (
          <button key={s} className={`btn btn-sm ${s === 'FAILED' || s === 'CANCELLED' ? 'btn-danger' : 'btn-primary'}`}
            disabled={busy} onClick={post('status', { status: s })}>{label}</button>
        ))}
      </div>

      <div className="grid-2">
        <div className="stack">
          <div className="card card-pad">
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{c.description}</p>
            <h4 style={{ marginBottom: 4 }}>Implementation plan</h4>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{c.implementation_plan || 'Not written yet (required before submission).'}</p>
            <h4 style={{ marginBottom: 4 }}>Backout plan</h4>
            <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>{c.backout_plan || 'Not written yet (required before submission).'}</p>
          </div>

          {['COMPLETED', 'FAILED'].includes(c.status) && (
            <div className="card card-pad">
              <h3 style={{ marginBottom: 8 }}>Post-implementation review</h3>
              {c.pir_outcome ? (
                <>
                  <p><b>{c.pir_outcome.replaceAll('_', ' ')}</b></p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{c.pir_notes}</p>
                </>
              ) : canLead ? (
                <>
                  <label className="field"><span className="req">Outcome</span>
                    <select value={pir.outcome} onChange={(e) => setPir((x) => ({ ...x, outcome: e.target.value }))}>
                      <option value="SUCCESSFUL">Successful</option>
                      <option value="COMPLETED_WITH_ISSUES">Completed with issues</option>
                      <option value="BACKED_OUT">Backed out</option>
                    </select></label>
                  <label className="field"><span className="req">Review notes</span>
                    <textarea rows={3} value={pir.notes} onChange={(e) => setPir((x) => ({ ...x, notes: e.target.value }))} /></label>
                  <button className="btn btn-primary btn-sm" disabled={busy || !pir.notes.trim()}
                    onClick={post('pir', pir)}>Record review</button>
                </>
              ) : <p className="muted">Awaiting review by a team lead or administrator.</p>}
            </div>
          )}

          <div className="card card-pad">
            <h3 style={{ marginBottom: 8 }}>Change tasks</h3>
            {c.tasks.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No tasks yet.</div>}
            {c.tasks.map((t) => (
              <div key={t.id} className="spread" style={{ padding: '5px 0' }}>
                <span style={{ textDecoration: t.status === 'DONE' ? 'line-through' : 'none' }}>
                  {t.title} {t.agent_name ? <span className="muted">({t.agent_name})</span> : null}
                </span>
                {t.status !== 'DONE' && (
                  <button className="btn btn-ghost btn-sm" disabled={busy}
                    onClick={() => act(() => api(`/changes/tasks/${t.id}`, { method: 'POST', body: { status: 'DONE' } }))}>Done</button>
                )}
              </div>
            ))}
            <form className="row" style={{ gap: 8, marginTop: 8 }}
              onSubmit={(e) => { e.preventDefault(); act(() => api(`/changes/${c.id}/tasks`, { method: 'POST', body: { title: taskTitle } }).then(() => setTaskTitle(''))); }}>
              <input placeholder="New task…" value={taskTitle} required style={{ flex: 1 }}
                onChange={(e) => setTaskTitle(e.target.value)} />
              <button className="btn btn-primary btn-sm">Add</button>
            </form>
          </div>
        </div>

        <div className="stack">
          {c.approvals.length > 0 && (
            <div className="card card-pad">
              <h3 style={{ marginBottom: 10 }}>CAB approval</h3>
              <div className="appr-chain">
                {c.approvals.map((a) => (
                  <div key={a.id} className={`appr-step ${a.status === 'APPROVED' ? 'done' : a.status === 'REJECTED' ? 'rejected' : ''}`}>
                    <span className="lvl">{a.status === 'APPROVED' ? <Icon name="check" size={13} /> : a.level}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        Level {a.level} — {a.approver_role === 'ADMIN' ? 'IT management' : 'Team lead'}
                      </div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {a.status === 'PENDING' ? 'Waiting'
                          : `${a.status === 'APPROVED' ? 'Approved' : 'Rejected'} by ${a.approver_name || '—'} ${a.acted_at ? timeAgo(a.acted_at) : ''}`}
                        {a.note ? ` — “${a.note}”` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {c.status === 'PENDING_APPROVAL' && (
                c.can_approve ? (
                  <div style={{ marginTop: 10 }}>
                    <label className="field"><span>Note (optional)</span>
                      <input value={note} onChange={(e) => setNote(e.target.value)} /></label>
                    <div className="row">
                      <button className="btn btn-primary btn-sm" disabled={busy}
                        onClick={post('approve', { decision: 'approve', note: note || null })}>Approve</button>
                      <button className="btn btn-danger btn-sm" disabled={busy}
                        onClick={post('approve', { decision: 'reject', note: note || null })}>Reject</button>
                    </div>
                  </div>
                ) : (
                  <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>
                    {c.awaiting_role === 'TEAM_LEAD'
                      ? 'Awaiting Team Lead approval (level 1) — IT approval unlocks once it is given.'
                      : 'Awaiting administrator approval (level 2).'}
                  </div>
                )
              )}
            </div>
          )}

          {c.cis.length > 0 && (
            <div className="card card-pad">
              <h3 style={{ marginBottom: 8 }}>Affected configuration items</h3>
              {c.cis.map((ci) => (
                <div key={ci.id} style={{ fontSize: 13.5, padding: '3px 0' }}>
                  <span className="tnum">{ci.ci_number}</span> {ci.name}
                  <span className="muted"> — {ci.ci_type.replaceAll('_', ' ').toLowerCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
