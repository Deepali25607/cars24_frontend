import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate } from '../api';
import { Spinner, useToast } from '../ui';
import { PrbStatusChip } from './Problems';

const NEXT = {
  NEW: [['ROOT_CAUSE_ANALYSIS', 'Start root cause analysis']],
  ROOT_CAUSE_ANALYSIS: [['KNOWN_ERROR', 'Mark known error'], ['RESOLVED', 'Resolve']],
  KNOWN_ERROR: [['RESOLVED', 'Resolve']],
  RESOLVED: [['CLOSED', 'Close problem']],
  CLOSED: [],
};

export default function ProblemDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [fields, setFields] = useState(null);
  const [linkNum, setLinkNum] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api(`/problems/${id}`).then((x) => {
    setP(x);
    setFields({ root_cause: x.root_cause || '', workaround: x.workaround || '', permanent_fix: x.permanent_fix || '' });
  }).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (err) return <div className="error-box">{err}</div>;
  if (!p || !fields) return <div className="loading-page"><Spinner dark /></div>;

  const saveFields = async () => {
    setBusy(true);
    try {
      await api(`/problems/${p.id}`, { method: 'PATCH', body: fields });
      toast('Analysis saved');
      load();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const move = async (status) => {
    setBusy(true);
    try {
      await api(`/problems/${p.id}/status`, { method: 'POST', body: { status, ...fields } });
      toast(`Problem ${status.replaceAll('_', ' ').toLowerCase()}`);
      load();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const linkTicket = async (e) => {
    e.preventDefault();
    const m = linkNum.trim().match(/\d+$/);
    try {
      // Accept an INC number (or fragment): resolve via global search
      const search = await api(`/search?q=${encodeURIComponent(linkNum.trim())}`);
      const hit = search.tickets.find((t) => t.ticket_number === linkNum.trim().toUpperCase())
        || (m && search.tickets.find((t) => t.id === Number(m[0])))
        || search.tickets[0];
      if (!hit) return toast('No matching ticket found', true);
      await api(`/problems/${p.id}/tickets`, { method: 'POST', body: { ticket_id: hit.id } });
      setLinkNum('');
      load();
    } catch (e2) { toast(e2.message, true); }
  };

  const addTask = async (e) => {
    e.preventDefault();
    try {
      await api(`/problems/${p.id}/tasks`, { method: 'POST', body: { title: taskTitle } });
      setTaskTitle('');
      load();
    } catch (e2) { toast(e2.message, true); }
  };

  const taskDone = async (taskId) => {
    await api(`/problems/tasks/${taskId}`, { method: 'POST', body: { status: 'DONE' } }).catch((e) => toast(e.message, true));
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="sub" style={{ marginBottom: 4 }}>
            <Link to="/problems">Problems</Link> / <span className="tnum">{p.problem_number}</span>
          </p>
          <h1 style={{ marginTop: 0 }}>{p.title}</h1>
          <p className="sub">Raised by {p.created_by_name} · {fmtDate(p.created_at)}{p.group_name ? ` · ${p.group_name}` : ''}</p>
        </div>
        <PrbStatusChip status={p.status} />
      </div>

      {p.status !== 'CLOSED' && (
        <div className="row" style={{ marginBottom: 14, gap: 8 }}>
          {(NEXT[p.status] || []).map(([s, label]) => (
            <button key={s} className="btn btn-primary btn-sm" disabled={busy} onClick={() => move(s)}>{label}</button>
          ))}
        </div>
      )}

      <div className="grid-2">
        <div className="stack">
          <div className="card card-pad">
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{p.description}</p>
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 10 }}>Root cause analysis</h3>
            <label className="field"><span>Root cause {p.status === 'ROOT_CAUSE_ANALYSIS' && '(required for known error)'}</span>
              <textarea rows={2} value={fields.root_cause} disabled={p.status === 'CLOSED'}
                onChange={(e) => setFields((x) => ({ ...x, root_cause: e.target.value }))} /></label>
            <label className="field"><span>Workaround</span>
              <textarea rows={2} value={fields.workaround} disabled={p.status === 'CLOSED'}
                onChange={(e) => setFields((x) => ({ ...x, workaround: e.target.value }))} /></label>
            <label className="field"><span>Permanent resolution (required to resolve)</span>
              <textarea rows={2} value={fields.permanent_fix} disabled={p.status === 'CLOSED'}
                onChange={(e) => setFields((x) => ({ ...x, permanent_fix: e.target.value }))} /></label>
            {p.status !== 'CLOSED' && (
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={saveFields}>Save analysis</button>
            )}
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 8 }}>Problem tasks</h3>
            {p.tasks.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No tasks yet.</div>}
            {p.tasks.map((t) => (
              <div key={t.id} className="spread" style={{ padding: '5px 0' }}>
                <span style={{ textDecoration: t.status === 'DONE' ? 'line-through' : 'none' }}>
                  {t.title} {t.agent_name ? <span className="muted">({t.agent_name})</span> : null}
                </span>
                {t.status !== 'DONE' && p.status !== 'CLOSED' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => taskDone(t.id)}>Done</button>
                )}
              </div>
            ))}
            {p.status !== 'CLOSED' && (
              <form className="row" style={{ gap: 8, marginTop: 8 }} onSubmit={addTask}>
                <input placeholder="New task…" value={taskTitle} required style={{ flex: 1 }}
                  onChange={(e) => setTaskTitle(e.target.value)} />
                <button className="btn btn-primary btn-sm">Add</button>
              </form>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card card-pad">
            <h3 style={{ marginBottom: 8 }}>Related incidents ({p.tickets.length})</h3>
            {p.tickets.map((t) => (
              <div key={t.id} style={{ padding: '4px 0', fontSize: 13.5 }}>
                <Link to={`/tickets/${t.id}`}><span className="tnum">{t.ticket_number}</span></Link> {t.title}
                <span className="muted"> — {t.status}</span>
              </div>
            ))}
            {p.status !== 'CLOSED' && (
              <form className="row" style={{ gap: 8, marginTop: 8 }} onSubmit={linkTicket}>
                <input placeholder="Link ticket (INC-001001)…" value={linkNum} required style={{ flex: 1 }}
                  onChange={(e) => setLinkNum(e.target.value)} />
                <button className="btn btn-ghost btn-sm">Link</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
