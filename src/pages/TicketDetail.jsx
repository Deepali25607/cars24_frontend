import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, API_BASE, fmtDate, timeAgo, getToken } from '../api';
import { useAuth } from '../auth';
import { Avatar, Icon, Modal, Priority, Spinner, StatusChip, STATUS_LABEL, useToast } from '../ui';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isIT } = useAuth();
  const toast = useToast();
  const [t, setT] = useState(null);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const fileRef = useRef();

  const load = useCallback(() => {
    api(`/tickets/${id}`).then(setT).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast(okMsg);
      load();
    } catch (e2) {
      toast(e2.message, true);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status, note) =>
    act(() => api(`/tickets/${id}/status`, { method: 'POST', body: { status, note } }),
      `Ticket ${STATUS_LABEL[status].toLowerCase()}`);

  const addComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    act(async () => {
      await api(`/tickets/${id}/comments`, {
        method: 'POST', body: { body: comment, is_internal: internal },
      });
      setComment('');
      setInternal(false);
    });
  };

  const uploadFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    act(() => api(`/tickets/${id}/attachments`, { method: 'POST', formData: fd }), 'Attachment uploaded');
    e.target.value = '';
  };

  const viewAttachment = async (attId) => {
    const res = await fetch(`${API_BASE}/tickets/${id}/attachments/${attId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { toast('Could not open attachment', true); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  if (err) return <div className="error-box">{err}</div>;
  if (!t) return <div className="loading-page"><Spinner dark /></div>;

  const isRequester = t.requester_id === user.id;
  const canWork = isIT;
  const actions = [];
  if (canWork) {
    if (['NEW', 'REOPENED'].includes(t.status) && !t.assigned_agent_id) {
      actions.push({ label: 'Take this ticket', kind: 'btn-primary', run: () => act(() => api(`/tickets/${id}/assign`, { method: 'POST', body: { agent_id: user.id } }), 'Assigned to you') });
    }
    if (['ASSIGNED', 'PENDING', 'REOPENED'].includes(t.status)) {
      actions.push({ label: 'Start working', kind: 'btn-primary', run: () => setStatus('IN_PROGRESS') });
    }
    if (['ASSIGNED', 'IN_PROGRESS', 'REOPENED'].includes(t.status)) {
      actions.push({ label: 'Mark pending', kind: 'btn-ghost', run: () => setStatus('PENDING') });
    }
    if (['IN_PROGRESS', 'PENDING', 'REOPENED'].includes(t.status)) {
      actions.push({ label: 'Resolve…', kind: 'btn-amber', run: () => setResolveOpen(true) });
    }
    if (t.status === 'RESOLVED') {
      actions.push({ label: 'Close ticket', kind: 'btn-primary', run: () => setStatus('CLOSED') });
    }
  }
  if ((isRequester || canWork) && ['RESOLVED', 'CLOSED'].includes(t.status)) {
    actions.push({ label: 'Reopen', kind: 'btn-danger', run: () => setStatus('REOPENED') });
  }
  if (isRequester && !canWork && t.status === 'RESOLVED') {
    actions.push({ label: 'Confirm & close', kind: 'btn-primary', run: () => setStatus('CLOSED') });
  }

  const visibleComments = t.comments;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <span className="tnum">{t.ticket_number}</span>
            <StatusChip status={t.status} />
            <Priority code={t.priority_code} label={t.priority_label} />
          </div>
          <h1>{t.title}</h1>
          <p className="sub">
            Raised by <b>{t.requester_name}</b> · {fmtDate(t.created_at)}
            {t.reopen_count > 0 && <> · reopened ×{t.reopen_count}</>}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {t.is_major === 1 && (
        <div className="mi-banner">
          <span className="chip chip-MAJOR" style={{ marginRight: 8 }}>MAJOR INCIDENT</span>
          Declared {t.major_declared_at ? fmtDate(t.major_declared_at) : ''}
          {t.major_bridge && <> · <a href={t.major_bridge} target="_blank" rel="noreferrer">Join the bridge</a></>}
        </div>
      )}

      <div className="grid-2">
        <div className="stack">
          {/* Description */}
          <div className="card card-pad">
            <h3 style={{ marginBottom: 10 }}>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{t.description}</p>
            {t.attachments.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.attachments.map((a) => (
                  <button key={a.id} className="btn btn-ghost btn-sm" type="button"
                    onClick={() => viewAttachment(a.id)}>
                    <Icon name="paperclip" size={13} /> {a.original_name}
                    <span className="muted">({Math.max(1, Math.round(a.size_bytes / 1024))} KB)</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {actions.length > 0 && (
            <div className="card card-pad">
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {actions.map((a) => (
                  <button key={a.label} className={`btn ${a.kind}`} disabled={busy} onClick={a.run}>
                    {a.label}
                  </button>
                ))}
                {canWork && (
                  <button className="btn btn-ghost" onClick={() => setAssignOpen(true)} disabled={busy}>
                    {t.assigned_agent_id ? 'Reassign…' : 'Assign…'}
                  </button>
                )}
              </div>
              {t.status === 'RESOLVED' && t.resolution_note && (
                <div className="ok-box" style={{ marginTop: 14, marginBottom: 0 }}>
                  <b>Resolution:</b> {t.resolution_note}
                </div>
              )}
            </div>
          )}

          {/* Conversation */}
          <div className="card card-pad">
            <h3 style={{ marginBottom: 6 }}>Conversation</h3>
            {visibleComments.length === 0 && <p className="muted" style={{ padding: '10px 0' }}>No comments yet.</p>}
            {visibleComments.map((c) =>
              c.is_internal ? (
                <div key={c.id} className="comment internal">
                  <div className="c-head">
                    <span className="c-tag">Internal work note</span>
                    <span className="c-name">{c.author_name}</span>
                    <span className="c-time">{timeAgo(c.created_at)}</span>
                  </div>
                  <div className="c-text">{c.body}</div>
                </div>
              ) : (
                <div key={c.id} className="comment">
                  <Avatar name={c.author_name} />
                  <div className="c-body">
                    <div className="c-head">
                      <span className="c-name">{c.author_name}</span>
                      {['AGENT', 'TEAM_LEAD', 'ADMIN'].includes(c.author_role) && (
                        <span className="chip chip-PENDING">IT</span>
                      )}
                      <span className="c-time">{timeAgo(c.created_at)}</span>
                    </div>
                    <div className="c-text">{c.body}</div>
                  </div>
                </div>
              )
            )}

            {!['CLOSED'].includes(t.status) && (
              <form onSubmit={addComment} style={{ marginTop: 14 }}>
                <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder={internal ? 'Write an internal note (employee will NOT see this)…' : 'Write a reply…'} />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={busy || !comment.trim()}>
                    {internal ? 'Add work note' : 'Send reply'}
                  </button>
                  {canWork && (
                    <label className="row" style={{ fontSize: 13, gap: 6, cursor: 'pointer' }}>
                      <input type="checkbox" style={{ width: 'auto' }} checked={internal}
                        onChange={(e) => setInternal(e.target.checked)} />
                      Internal work note
                    </label>
                  )}
                  <label className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', cursor: 'pointer' }}>
                    <Icon name="paperclip" size={13} /> Attach file
                    <input type="file" hidden ref={fileRef} onChange={uploadFile}
                      accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.zip" />
                  </label>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="stack">
          {isRequester && ['RESOLVED', 'CLOSED'].includes(t.status) && (
            <RatingCard t={t} onRated={load} />
          )}
          {t.sla && <SlaPanel sla={t.sla} status={t.status} isIT={isIT} />}
          {isIT && <MajorPanel t={t} user={user} onChanged={load} />}
          {isIT && <AiPanel t={t} />}
          <div className="card card-pad">
            <h3 style={{ marginBottom: 12 }}>Details</h3>
            <dl className="kv">
              <dt>Assigned to</dt>
              <dd>{t.agent_name || <span className="muted">Unassigned</span>}</dd>
              <dt>Support group</dt>
              <dd>{t.group_name || <span className="muted">—</span>}</dd>
              <dt>Category</dt>
              <dd>{t.category_name}{t.subcategory_name ? ` / ${t.subcategory_name}` : ''}</dd>
              <dt>Location</dt>
              <dd>{t.location_name || '—'}</dd>
              <dt>Laptop</dt>
              <dd>{t.asset_tag ? `${t.asset_tag} · ${t.asset_manufacturer} ${t.asset_model}` : '—'}</dd>
              <dt>Created</dt><dd>{fmtDate(t.created_at)}</dd>
              {t.resolved_at && <><dt>Resolved</dt><dd>{fmtDate(t.resolved_at)}</dd></>}
              {t.closed_at && <><dt>Closed</dt><dd>{fmtDate(t.closed_at)}</dd></>}
            </dl>

            {canWork && meta && (
              <Classify t={t} meta={meta} busy={busy}
                onSave={(body) => act(() => api(`/tickets/${id}`, { method: 'PATCH', body }), 'Ticket updated')} />
            )}
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 14 }}>History</h3>
            <div className="timeline">
              {t.history.map((h) => (
                <div className="tl-item" key={h.id}>
                  <div className="tl-act">{historyLabel(h.action)}</div>
                  {h.detail && <div style={{ fontSize: 12.5 }}>{h.detail}</div>}
                  <div className="tl-meta">{h.actor_name || 'System'} · {timeAgo(h.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {resolveOpen && (
        <ResolveModal onClose={() => setResolveOpen(false)}
          onResolve={(note) => { setResolveOpen(false); setStatus('RESOLVED', note); }} />
      )}
      {assignOpen && meta && (
        <AssignModal meta={meta} me={user} t={t} onClose={() => setAssignOpen(false)}
          onAssign={(body) => {
            setAssignOpen(false);
            act(() => api(`/tickets/${id}/assign`, { method: 'POST', body }), 'Assignment updated');
          }} />
      )}
    </>
  );
}

function historyLabel(action) {
  const map = {
    CREATED: 'Ticket created', ASSIGNED: 'Assigned', REASSIGNED: 'Reassigned',
    COMMENT: 'Comment added', WORK_NOTE: 'Work note added', ATTACHMENT: 'Attachment uploaded',
    UPDATED: 'Details updated',
    STATUS_IN_PROGRESS: 'Work started', STATUS_PENDING: 'Marked pending',
    STATUS_RESOLVED: 'Resolved', STATUS_CLOSED: 'Closed', STATUS_REOPENED: 'Reopened',
    STATUS_ASSIGNED: 'Assigned',
    AUTO_ASSIGNED: 'Auto-routed', WORKFLOW: 'Workflow ran', WORKFLOW_TASK: 'Workflow task',
    SLA_WARNING: 'SLA warning', SLA_BREACH: 'SLA breached', SLA_ESCALATION: 'SLA escalated',
  };
  return map[action] || action;
}

// ADVANCED A8: satisfaction rating (requester, after resolution)
function RatingCard({ t, onRated }) {
  const toast = useToast();
  const [score, setScore] = useState(t.rating?.score || 0);
  const [comment, setComment] = useState(t.rating?.comment || '');
  const [saved, setSaved] = useState(!!t.rating);

  const submit = async () => {
    try {
      await api(`/tickets/${t.id}/rating`, { method: 'POST', body: { score, comment: comment || null } });
      toast('Thanks for the feedback!');
      setSaved(true);
      onRated();
    } catch (e) { toast(e.message, true); }
  };

  return (
    <div className="card card-pad">
      <h3 style={{ marginBottom: 8 }}>{saved ? 'Your rating' : 'How did we do?'}</h3>
      <div className="stars">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" className={s <= score ? 'on' : ''}
            onClick={() => { setScore(s); setSaved(false); }} aria-label={`${s} stars`}>★</button>
        ))}
      </div>
      {!saved && score > 0 && (
        <>
          <textarea rows={2} placeholder="Anything to add? (optional)" value={comment}
            onChange={(e) => setComment(e.target.value)} style={{ marginTop: 8 }} />
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={submit}>
            Submit rating
          </button>
        </>
      )}
    </div>
  );
}

// ADVANCED A4: major incident panel (BRD 8.6)
function MajorPanel({ t, user, onChanged }) {
  const toast = useToast();
  const [mi, setMi] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const canDeclare = ['TEAM_LEAD', 'ADMIN'].includes(user.role);

  const load = () => {
    if (t.is_major === 1) api(`/major/${t.id}`).then(setMi).catch(() => {});
  };
  useEffect(load, [t.id, t.is_major]); // eslint-disable-line

  const declare = async () => {
    if (!confirm('Declare this a MAJOR incident? Priority is escalated to P1 and IT leadership is notified.')) return;
    const bridge = prompt('Bridge link (optional, e.g. a Teams/Meet call URL):') || null;
    setBusy(true);
    try {
      await api(`/major/${t.id}/declare`, { method: 'POST', body: { bridge } });
      toast('Major incident declared');
      onChanged();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const post = (path) => async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await api(`/major/${t.id}/${path}`, { method: 'POST', body: { message: message.trim() } });
      setMessage('');
      load();
      toast(path === 'review' ? 'Review recorded' : 'Update posted');
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  if (t.is_major !== 1) {
    if (!canDeclare || ['RESOLVED', 'CLOSED'].includes(t.status)) return null;
    return (
      <div className="card card-pad">
        <button className="btn btn-danger btn-sm" disabled={busy} onClick={declare}>
          Declare major incident
        </button>
      </div>
    );
  }

  return (
    <div className="card card-pad">
      <h3 style={{ marginBottom: 8 }}>Major incident</h3>
      <dl className="kv">
        <dt>Commander</dt><dd>{mi?.commander_name || '—'}</dd>
        {mi?.major_bridge && <><dt>Bridge</dt><dd><a href={mi.major_bridge} target="_blank" rel="noreferrer">Join</a></dd></>}
        <dt>Linked incidents</dt><dd>{mi?.linked?.length ?? 0}</dd>
      </dl>
      <textarea rows={2} placeholder="Stakeholder update / post-incident review…" value={message}
        onChange={(e) => setMessage(e.target.value)} style={{ marginTop: 8 }} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy || !message.trim()} onClick={post('update')}>
          Post update
        </button>
        {canDeclare && (
          <button className="btn btn-ghost btn-sm" disabled={busy || !message.trim()} onClick={post('review')}>
            Record review
          </button>
        )}
      </div>
      {mi?.updates?.length > 0 && (
        <div className="timeline" style={{ marginTop: 12 }}>
          {mi.updates.slice(0, 6).map((u) => (
            <div className="tl-item" key={u.id}>
              <div className="tl-act">{u.update_type === 'REVIEW' ? 'Post-incident review' : 'Status update'}</div>
              <div style={{ fontSize: 12.5 }}>{u.message}</div>
              <div className="tl-meta">{u.author_name} · {timeAgo(u.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ADVANCED A5–A7: AI assist panel for IT users
function AiPanel({ t }) {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const analyse = async () => {
    setBusy(true);
    try {
      const [summary, rec, assign, pred] = await Promise.all([
        api(`/ai/summary/${t.id}`),
        api('/ai/recommend', { method: 'POST', body: { ticket_id: t.id } }),
        api(`/ai/assignment/${t.id}`),
        api(`/ai/sla-prediction/${t.id}`),
      ]);
      setData({ summary, rec, assign, pred });
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  return (
    <div className="card card-pad ai-panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}><Icon name="sparkle" size={15} /> AI assist</h3>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={analyse}>
          {busy ? 'Analysing…' : data ? 'Refresh' : 'Analyse'}
        </button>
      </div>
      {data && (
        <>
          {data.pred?.breach_probability != null && !['RESOLVED', 'CLOSED'].includes(t.status) && (
            <>
              <h4>SLA breach prediction</h4>
              <div className="ai-prob" style={{ color: data.pred.breach_probability >= 60 ? 'var(--danger, #c0392b)' : 'inherit' }}>
                {data.pred.breach_probability}%
              </div>
              {data.pred.recommendations.map((r) => (
                <div key={r} style={{ fontSize: 12.5 }}>• {r}</div>
              ))}
            </>
          )}
          <h4>Summary</h4>
          <div style={{ fontSize: 13 }}>{data.summary.issue}</div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{data.summary.current_status}</div>
          {data.rec.articles.length > 0 && (
            <>
              <h4>Knowledge that may help</h4>
              {data.rec.articles.map((a) => (
                <div key={a.id} style={{ fontSize: 13 }}>
                  <Link to={`/kb/${a.id}`}><span className="tnum">{a.article_number}</span> {a.title}</Link>
                </div>
              ))}
            </>
          )}
          {data.rec.similar_resolved.length > 0 && (
            <>
              <h4>Similar resolved tickets</h4>
              {data.rec.similar_resolved.map((s) => (
                <div key={s.id} style={{ fontSize: 12.5 }}>
                  <span className="tnum">{s.ticket_number}</span> — {s.resolution_note}
                </div>
              ))}
            </>
          )}
          {data.assign.recommendations.length > 0 && (
            <>
              <h4>Suggested assignee</h4>
              {data.assign.recommendations.slice(0, 2).map((a) => (
                <div key={a.agent_id} style={{ fontSize: 12.5 }}>
                  <b>{a.agent_name}</b> — {a.reasons.join('; ')}
                </div>
              ))}
            </>
          )}
          <p className="muted" style={{ fontSize: 11.5, marginTop: 10 }}>
            Suggestions from the built-in engine ({data.summary.engine}); decisions stay with you.
          </p>
        </>
      )}
    </div>
  );
}

// STANDARD S2: SLA state panel (BRD 7.4)
function SlaPanel({ sla, status, isIT }) {
  const done = ['RESOLVED', 'CLOSED'].includes(status) || sla.completed_at;
  let chip = 'SLA_OK';
  let label = 'On track';
  if (sla.resolution_breached || sla.response_breached) { chip = 'SLA_BREACH'; label = 'Breached'; }
  else if (sla.paused_at) { chip = 'SLA_PAUSED'; label = 'Paused (pending)'; }
  else if (sla.warning_sent) { chip = 'SLA_RISK'; label = 'At risk'; }
  if (done && !sla.resolution_breached) { chip = 'SLA_OK'; label = 'Met'; }

  return (
    <div className="card card-pad">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>SLA</h3>
        <span className={`chip chip-${chip}`}><span className="dot" />{label}</span>
      </div>
      <div className="sla-grid">
        <div>
          <div className="k">First response due</div>
          <div>{sla.response_due_at ? fmtDate(sla.response_due_at) : '—'}</div>
        </div>
        <div>
          <div className="k">Responded</div>
          <div>{sla.first_response_at
            ? fmtDate(sla.first_response_at)
            : sla.response_breached ? <b style={{ color: 'var(--danger, #c0392b)' }}>Overdue</b> : 'Not yet'}</div>
        </div>
        <div>
          <div className="k">Resolution due</div>
          <div>{sla.resolution_due_at ? fmtDate(sla.resolution_due_at) : '—'}</div>
        </div>
        <div>
          <div className="k">Resolved</div>
          <div>{sla.completed_at ? fmtDate(sla.completed_at) : 'Open'}</div>
        </div>
        {isIT && sla.paused_minutes > 0 && (
          <div>
            <div className="k">Time on hold</div>
            <div>{sla.paused_minutes} min</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Classify({ t, meta, busy, onSave }) {
  const [edit, setEdit] = useState(false);
  const [cat, setCat] = useState(String(t.category_id));
  const [sub, setSub] = useState(t.subcategory_id ? String(t.subcategory_id) : '');
  const [prio, setPrio] = useState(String(t.priority_id));
  const subs = useMemo(
    () => meta.subcategories.filter((s) => s.category_id === Number(cat)),
    [meta, cat]
  );

  if (!edit) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setEdit(true)}>
        Edit classification
      </button>
    );
  }
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <label className="field">
        <span>Category</span>
        <select value={cat} onChange={(e) => { setCat(e.target.value); setSub(''); }}>
          {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Subcategory</span>
        <select value={sub} onChange={(e) => setSub(e.target.value)}>
          <option value="">None</option>
          {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Priority</span>
        <select value={prio} onChange={(e) => setPrio(e.target.value)}>
          {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={busy}
          onClick={() => { setEdit(false); onSave({ category_id: Number(cat), subcategory_id: sub ? Number(sub) : null, priority_id: Number(prio) }); }}>
          Save
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setEdit(false)}>Cancel</button>
      </div>
    </div>
  );
}

function ResolveModal({ onClose, onResolve }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Resolve ticket" onClose={onClose}>
      <p className="muted" style={{ marginBottom: 12 }}>
        Describe the fix — the employee sees this note and can confirm or reopen.
      </p>
      <textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} autoFocus
        placeholder="What was the cause, and what did you do to fix it?" />
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn btn-amber" disabled={!note.trim()} onClick={() => onResolve(note.trim())}>
          Resolve ticket
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function AssignModal({ meta, me, t, onClose, onAssign }) {
  const canAssignOthers = me.role !== 'AGENT';
  const [agent, setAgent] = useState(t.assigned_agent_id ? String(t.assigned_agent_id) : '');
  const [group, setGroup] = useState(t.support_group_id ? String(t.support_group_id) : '');
  const agents = canAssignOthers ? meta.agents : meta.agents.filter((a) => a.id === me.id);

  return (
    <Modal title="Assign ticket" onClose={onClose}>
      <label className="field">
        <span>Support group</span>
        <select value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">—</option>
          {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Agent</span>
        <select value={agent} onChange={(e) => setAgent(e.target.value)}>
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name}{a.group_name ? ` — ${a.group_name}` : ''}
            </option>
          ))}
        </select>
      </label>
      {!canAssignOthers && (
        <p className="muted" style={{ marginBottom: 12 }}>As an agent you can assign tickets to yourself; your team lead can assign to others.</p>
      )}
      <div className="row">
        <button className="btn btn-primary"
          onClick={() => onAssign({ agent_id: agent ? Number(agent) : null, group_id: group ? Number(group) : null })}>
          Save assignment
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}
