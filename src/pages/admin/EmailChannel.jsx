import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, timeAgo } from '../../api';
import { Empty, Modal, Spinner, useToast } from '../../ui';

// Admin console for the two-way email channel (S10 extension):
// settings, classification keywords, templates, message log, quarantine.

const TABS = [
  ['overview', 'Overview & settings'],
  ['rules', 'Classification rules'],
  ['templates', 'Email templates'],
  ['log', 'Email log'],
  ['quarantine', 'Quarantine & dead letters'],
];

export default function EmailChannel() {
  const [tab, setTab] = useState('overview');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Email channel</h1>
          <p className="sub">
            Emails to the support mailbox become incidents; every customer-visible update is mailed back on the same thread.
          </p>
        </div>
      </div>
      <div className="etabs">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={`etab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'rules' && <Rules />}
      {tab === 'templates' && <Templates />}
      {tab === 'log' && <LogView />}
      {tab === 'quarantine' && <Quarantine />}
    </>
  );
}

// ---------------- Overview & settings ----------------
function Overview() {
  const toast = useToast();
  const [status, setStatus] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [meta, setMeta] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api('/email/status').then(setStatus).catch(() => setStatus({}));
    api('/email/config').then(setCfg).catch((e) => toast(e.message, true));
    api('/meta').then(setMeta).catch(() => {});
  }, [toast]);
  useEffect(load, [load]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      for (const k of ['enabled', 'mailbox_address', 'system_addresses', 'allowed_domains', 'unknown_sender_action', 'auth_check_mode',
        'polling_interval_seconds', 'reopen_window_days', 'max_attachment_mb', 'max_total_attachment_mb', 'attachment_violation_action',
        'inline_image_min_kb', 'rate_limit_per_hour', 'triage_group_id', 'general_category_id', 'subject_weight', 'body_weight',
        'notify_on_assignment', 'notify_on_update', 'notify_on_progress', 'thread_internal_notifications',
        'cc_assigned_agent', 'portal_url', 'processed_folder']) body[k] = cfg[k];
      const r = await api('/email/config', { method: 'PUT', body });
      setCfg(r);
      toast('Email channel settings saved');
      load();
    } catch (e2) { toast(e2.message, true); } finally { setSaving(false); }
  };

  if (!cfg || !status) return <div className="loading-page"><Spinner dark /></div>;
  const m = status.metrics || {};
  const l = status.listener || {};
  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Channel status</h3>
        <div className="estats">
          <Stat label="Channel" value={cfg.enabled ? 'Enabled' : 'Disabled'} ok={!!cfg.enabled} />
          <Stat label="Mailbox listener" value={status.mailbox_configured ? (l.connected ? 'Connected (IMAP IDLE)' : (l.lastError ? 'Error' : 'Connecting…')) : 'Not configured'} ok={!!l.connected} />
          <Stat label="Outbound SMTP" value={status.smtp_configured ? 'Configured' : 'Console (dev)'} ok={!!status.smtp_configured} />
          <Stat label="Created / threaded" value={`${m.created ?? 0} / ${m.threaded ?? 0}`} />
          <Stat label="Ignored / quarantined / failed" value={`${m.ignored ?? 0} / ${m.quarantined ?? 0} / ${m.failed ?? 0}`} />
          <Stat label="Outbound sent" value={m.outbound_sent ?? 0} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          {status.mailbox_configured
            ? <>Listening on <b>{l.user}</b> @ {l.host} · last fetch {l.lastPollAt ? timeAgo(l.lastPollAt) : 'never'} · fetched {l.fetched ?? 0}{l.lastError ? <> · <span style={{ color: 'var(--danger, #c0392b)' }}>last error: {l.lastError}</span></> : null}</>
            : <>Set <code>MAIL_IN_HOST / MAIL_IN_USER / MAIL_IN_PASS</code> on the server to connect the support mailbox. The token-secured relay endpoint works regardless (see Integrations).</>}
          {' '}Counters reset on server restart.
        </p>
      </div>

      <form className="card card-pad" onSubmit={save}>
        <h3 style={{ marginTop: 0 }}>Settings</h3>
        <div className="egrid">
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!cfg.enabled} onChange={(e) => set('enabled', e.target.checked ? 1 : 0)} />
            Email channel enabled
          </label>
          <Field label="Support mailbox address" hint="Mail from this address (and system addresses) is ignored to prevent loops.">
            <input value={cfg.mailbox_address || ''} onChange={(e) => set('mailbox_address', e.target.value)} placeholder="itsupport@cars24.com" />
          </Field>
          <Field label="Other system addresses" hint="Comma-separated: noreply@, monitoring@ …">
            <input value={cfg.system_addresses || ''} onChange={(e) => set('system_addresses', e.target.value)} />
          </Field>
          <Field label="Allowed sender domains" hint="Registered users are always accepted. Unknown senders from these domains become guest callers.">
            <input value={cfg.allowed_domains || ''} onChange={(e) => set('allowed_domains', e.target.value)} placeholder="cars24.com" />
          </Field>
          <Field label="Unknown sender from other domains">
            <select value={cfg.unknown_sender_action} onChange={(e) => set('unknown_sender_action', e.target.value)}>
              <option value="QUARANTINE">Quarantine for review</option>
              <option value="REJECT">Reject (log only)</option>
            </select>
          </Field>
          <Field label="SPF / DKIM / DMARC">
            <select value={cfg.auth_check_mode} onChange={(e) => set('auth_check_mode', e.target.value)}>
              <option value="QUARANTINE_FAIL">Quarantine on failure</option>
              <option value="OFF">Do not check</option>
            </select>
          </Field>
          <Field label="Reopen window (days)" hint="Replies to a resolved incident within this window reopen it; later replies create a linked incident.">
            <input type="number" min="0" value={cfg.reopen_window_days} onChange={(e) => set('reopen_window_days', e.target.value)} />
          </Field>
          <Field label="Rate limit (incidents per sender per hour)">
            <input type="number" min="1" value={cfg.rate_limit_per_hour} onChange={(e) => set('rate_limit_per_hour', e.target.value)} />
          </Field>
          <Field label="Max attachment size (MB)">
            <input type="number" min="0" value={cfg.max_attachment_mb} onChange={(e) => set('max_attachment_mb', e.target.value)} />
          </Field>
          <Field label="Max total attachments (MB)">
            <input type="number" min="0" value={cfg.max_total_attachment_mb} onChange={(e) => set('max_total_attachment_mb', e.target.value)} />
          </Field>
          <Field label="Blocked / oversized attachment">
            <select value={cfg.attachment_violation_action} onChange={(e) => set('attachment_violation_action', e.target.value)}>
              <option value="QUARANTINE">Quarantine the whole email</option>
              <option value="STRIP">Drop the file, keep the email</option>
            </select>
          </Field>
          <Field label="Ignore inline images below (KB)" hint="Signature logos are not attached to tickets.">
            <input type="number" min="0" value={cfg.inline_image_min_kb} onChange={(e) => set('inline_image_min_kb', e.target.value)} />
          </Field>
          <Field label="Fallback category (no keyword match / tie)">
            <select value={cfg.general_category_id || ''} onChange={(e) => set('general_category_id', e.target.value || null)}>
              <option value="">— auto (General) —</option>
              {meta?.categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Triage group (fallback routing)">
            <select value={cfg.triage_group_id || ''} onChange={(e) => set('triage_group_id', e.target.value || null)}>
              <option value="">— auto (Service Desk Triage) —</option>
              {meta?.groups?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Subject weight">
            <input type="number" min="1" value={cfg.subject_weight} onChange={(e) => set('subject_weight', e.target.value)} />
          </Field>
          <Field label="Body weight">
            <input type="number" min="0" value={cfg.body_weight} onChange={(e) => set('body_weight', e.target.value)} />
          </Field>
          <Field label="Portal URL (links in emails)">
            <input value={cfg.portal_url || ''} onChange={(e) => set('portal_url', e.target.value)} placeholder="https://itsm.cars24.com" />
          </Field>
          <Field label="Polling fallback interval (seconds)">
            <input type="number" min="15" value={cfg.polling_interval_seconds} onChange={(e) => set('polling_interval_seconds', e.target.value)} />
          </Field>
          <Field label="Processed mail folder">
            <input value={cfg.processed_folder || ''} onChange={(e) => set('processed_folder', e.target.value)} />
          </Field>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!cfg.notify_on_assignment} onChange={(e) => set('notify_on_assignment', e.target.checked ? 1 : 0)} />
            Email the caller on the thread when the ticket is assigned / reassigned
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!cfg.notify_on_progress} onChange={(e) => set('notify_on_progress', e.target.checked ? 1 : 0)} />
            Email the caller on the thread when work starts
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!cfg.notify_on_update} onChange={(e) => set('notify_on_update', e.target.checked ? 1 : 0)} />
            Email the caller on the thread when category / priority / location change
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!cfg.cc_assigned_agent} onChange={(e) => set('cc_assigned_agent', e.target.checked ? 1 : 0)} />
            CC the assigned agent on every thread mail to the caller (agent follows the chain in their own mailbox)
          </label>
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!cfg.thread_internal_notifications} onChange={(e) => set('thread_internal_notifications', e.target.checked ? 1 : 0)} />
            Also email agents / leads a copy on the incident's thread (off = in-app notification only, one mail chain per incident)
          </label>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn btn-primary" disabled={saving}>Save settings</button>
        </div>
      </form>
    </>
  );
}

function Stat({ label, value, ok }) {
  return (
    <div className="estat">
      <div className="estat-label">{label}</div>
      <div className="estat-value">{ok !== undefined && <span className={`badge-dot ${ok ? 'ok' : 'off'}`} />}{value}</div>
    </div>
  );
}
function Field({ label, hint, children }) {
  return (
    <label className="efield">
      <span className="efield-label">{label}</span>
      {children}
      {hint && <span className="muted" style={{ fontSize: 11.5 }}>{hint}</span>}
    </label>
  );
}

// ---------------- Classification rules ----------------
function Rules() {
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [meta, setMeta] = useState(null);
  const [edit, setEdit] = useState(null); // null | {} (new) | rule
  const [probe, setProbe] = useState({ subject: '', body: '', result: null });

  const load = useCallback(() => {
    api('/email/rules').then(setRules).catch(() => setRules([]));
    api('/meta').then(setMeta).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = {
        keyword: edit.keyword, category_id: Number(edit.category_id), subcategory_id: edit.subcategory_id ? Number(edit.subcategory_id) : null,
        weight: Number(edit.weight || 1), assignment_group_id: edit.assignment_group_id ? Number(edit.assignment_group_id) : null,
        default_priority_id: edit.default_priority_id ? Number(edit.default_priority_id) : null, is_active: edit.is_active === 0 ? 0 : 1,
      };
      if (edit.id) await api(`/email/rules/${edit.id}`, { method: 'PUT', body });
      else await api('/email/rules', { method: 'POST', body });
      toast('Rule saved');
      setEdit(null);
      load();
    } catch (e2) { toast(e2.message, true); }
  };
  const remove = async (r) => {
    if (!confirm(`Delete keyword "${r.keyword}"?`)) return;
    await api(`/email/rules/${r.id}`, { method: 'DELETE' }).catch((e) => toast(e.message, true));
    load();
  };
  const toggle = async (r) => {
    await api(`/email/rules/${r.id}`, { method: 'PUT', body: { is_active: r.is_active ? 0 : 1 } }).catch((e) => toast(e.message, true));
    load();
  };
  const runProbe = async (e) => {
    e.preventDefault();
    try {
      const result = await api('/email/rules/test', { method: 'POST', body: { subject: probe.subject, body: probe.body } });
      setProbe((p) => ({ ...p, result }));
    } catch (e2) { toast(e2.message, true); }
  };

  const subcats = (catId) => meta?.subcategories?.filter((s) => s.category_id === Number(catId)) || [];
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <h3>Keywords</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setEdit({ keyword: '', category_id: meta?.categories?.[0]?.id || '', weight: 1 })}>Add keyword</button>
        </div>
        <p className="muted card-pad" style={{ fontSize: 13, paddingTop: 0 }}>
          The subject is scored with the subject weight and the body with the body weight; the category with the highest total wins.
          No match or a tie routes to the fallback category and triage group.
        </p>
        {!rules ? <div className="loading-page"><Spinner dark /></div> : rules.length === 0 ? <Empty title="No keywords yet" /> : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Keyword</th><th>Category</th><th>Subcategory</th><th>Weight</th><th>Group</th><th>Priority</th><th>Active</th><th /></tr></thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{r.keyword}</td>
                    <td>{r.category_name}</td>
                    <td className="muted">{r.subcategory_name || '—'}</td>
                    <td>{r.weight}</td>
                    <td className="muted">{r.group_name || '—'}</td>
                    <td className="muted">{r.priority_code || '—'}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(r)}>{r.is_active ? 'On' : 'Off'}</button></td>
                    <td className="row" style={{ gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdit({ ...r })}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => remove(r)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form className="card card-pad" onSubmit={runProbe}>
        <h3 style={{ marginTop: 0 }}>Test the classifier</h3>
        <div className="row" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <input placeholder="Subject" value={probe.subject} onChange={(e) => setProbe((p) => ({ ...p, subject: e.target.value }))} style={{ flex: 1, minWidth: 200 }} />
          <input placeholder="Body (optional)" value={probe.body} onChange={(e) => setProbe((p) => ({ ...p, body: e.target.value }))} style={{ flex: 2, minWidth: 240 }} />
          <button className="btn btn-primary btn-sm">Classify</button>
        </div>
        {probe.result && (
          <p style={{ marginTop: 10, fontSize: 13.5 }}>
            → <b>{probe.result.category_name || '—'}</b> · group {probe.result.group_name || '—'} · score {probe.result.score}
            <span className="muted"> · {probe.result.reason}</span>
          </p>
        )}
      </form>

      {edit && meta && (
        <Modal title={edit.id ? `Edit keyword "${edit.keyword}"` : 'Add keyword'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="stack">
            <Field label="Keyword or phrase"><input required value={edit.keyword} onChange={(e) => setEdit({ ...edit, keyword: e.target.value })} /></Field>
            <Field label="Category">
              <select value={edit.category_id} onChange={(e) => setEdit({ ...edit, category_id: e.target.value, subcategory_id: '' })}>
                {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Subcategory (optional)">
              <select value={edit.subcategory_id || ''} onChange={(e) => setEdit({ ...edit, subcategory_id: e.target.value })}>
                <option value="">—</option>
                {subcats(edit.category_id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Weight (1–10)"><input type="number" min="1" max="10" value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: e.target.value })} /></Field>
            <Field label="Assignment group (optional)">
              <select value={edit.assignment_group_id || ''} onChange={(e) => setEdit({ ...edit, assignment_group_id: e.target.value })}>
                <option value="">— use assignment rules —</option>
                {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
            <Field label="Default priority (optional)">
              <select value={edit.default_priority_id || ''} onChange={(e) => setEdit({ ...edit, default_priority_id: e.target.value })}>
                <option value="">— P3 —</option>
                {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.label}</option>)}
              </select>
            </Field>
            <div className="row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}

// ---------------- Templates ----------------
function Templates() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [sel, setSel] = useState('ACK');
  const [draft, setDraft] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = useCallback(() => api('/email/templates').then((d) => {
    setData(d);
    setDraft((cur) => cur || d.templates.find((t) => t.event_type === 'ACK'));
  }).catch((e) => toast(e.message, true)), [toast]);
  useEffect(load, [load]);
  useEffect(() => { if (data) { setDraft(data.templates.find((t) => t.event_type === sel)); setPreview(null); } }, [sel, data]);

  const save = async (e) => {
    e.preventDefault();
    try {
      await api(`/email/templates/${sel}`, { method: 'PUT', body: {
        subject_template: draft.subject_template, body_html_template: draft.body_html_template,
        body_text_template: draft.body_text_template, is_active: draft.is_active,
      } });
      toast('Template saved');
      load();
    } catch (e2) { toast(e2.message, true); }
  };
  const reset = async () => {
    if (!confirm('Restore the default template?')) return;
    await api(`/email/templates/${sel}/reset`, { method: 'POST' }).catch((e) => toast(e.message, true));
    load();
  };
  const doPreview = async () => {
    try { setPreview(await api(`/email/templates/${sel}/preview`, { method: 'POST', body: draft })); }
    catch (e2) { toast(e2.message, true); }
  };

  if (!data || !draft) return <div className="loading-page"><Spinner dark /></div>;
  const LABEL = { ACK: 'Acknowledgement (new incident)', COMMENT: 'Agent comment', ASSIGNED: 'Assigned / reassigned', IN_PROGRESS: 'Work started', UPDATED: 'Details updated (category / priority / location)', ON_HOLD: 'On hold / awaiting user', RESOLVED: 'Resolved', CLOSED: 'Closed', REOPENED: 'Reopened', NOTIFY: 'Agent / lead notification (same thread)' };
  return (
    <div className="grid-2">
      <form className="card card-pad stack" onSubmit={save}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ maxWidth: 320 }}>
            {data.templates.map((t) => <option key={t.event_type} value={t.event_type}>{LABEL[t.event_type] || t.event_type}</option>)}
          </select>
          <label className="row" style={{ gap: 6, fontSize: 13 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={!!draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked ? 1 : 0 })} /> Active
          </label>
        </div>
        <Field label="Subject"><input value={draft.subject_template} onChange={(e) => setDraft({ ...draft, subject_template: e.target.value })} /></Field>
        <Field label="Plain-text body"><textarea rows={10} value={draft.body_text_template} onChange={(e) => setDraft({ ...draft, body_text_template: e.target.value })} /></Field>
        <Field label="HTML body"><textarea rows={12} value={draft.body_html_template} onChange={(e) => setDraft({ ...draft, body_html_template: e.target.value })} style={{ fontFamily: 'monospace', fontSize: 12 }} /></Field>
        <p className="muted" style={{ fontSize: 12 }}>Placeholders: {data.placeholders.map((p) => <code key={p} style={{ marginRight: 6 }}>{`{{${p}}}`}</code>)}</p>
        <div className="row">
          <button className="btn btn-primary">Save template</button>
          <button type="button" className="btn btn-ghost" onClick={doPreview}>Preview</button>
          <button type="button" className="btn btn-ghost" onClick={reset} style={{ marginLeft: 'auto' }}>Reset to default</button>
        </div>
      </form>
      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>Preview</h3>
        {!preview ? <p className="muted">Click “Preview” to render the template with sample data.</p> : (
          <>
            <p style={{ fontWeight: 600 }}>{preview.subject}</p>
            <div className="email-html" dangerouslySetInnerHTML={{ __html: preview.html }} />
            <details style={{ marginTop: 12 }}><summary className="muted">Plain-text version</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5 }}>{preview.text}</pre></details>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- Log ----------------
function LogView() {
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState({ direction: '', status: '', from: '', to: '', q: '' });
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(filter).filter(([, v]) => v))).toString();
    api(`/email/log${qs ? `?${qs}` : ''}`).then(setRows).catch((e) => toast(e.message, true));
  }, [filter, toast]);
  useEffect(load, [load]);

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <select value={filter.direction} onChange={(e) => setFilter({ ...filter, direction: e.target.value })}>
            <option value="">All directions</option><option value="INBOUND">Inbound</option><option value="OUTBOUND">Outbound</option>
          </select>
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All statuses</option>
            {['PROCESSED', 'PENDING', 'IGNORED', 'QUARANTINED', 'FAILED', 'DISCARDED'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          <input placeholder="Search subject / address / INC" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} style={{ minWidth: 220 }} />
        </div>
      </div>
      <LogTable rows={rows} onOpen={setOpen} />
      {open && <LogDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}

function LogTable({ rows, onOpen, actions }) {
  if (!rows) return <div className="loading-page"><Spinner dark /></div>;
  if (rows.length === 0) return <div className="card"><Empty title="No messages" /></div>;
  return (
    <div className="card table-wrap">
      <table className="data">
        <thead><tr><th /><th>From → To</th><th>Subject</th><th>Ticket</th><th>Status</th><th>Event</th><th>When</th>{actions && <th />}</tr></thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(m.id)}>
              <td title={m.direction}>{m.direction === 'INBOUND' ? '📥' : '📤'}</td>
              <td style={{ fontSize: 12.5 }}>{m.direction === 'INBOUND' ? m.from_address : m.to_addresses}</td>
              <td className="muted">{m.subject || '—'}</td>
              <td className="tnum">{m.ticket_number ? <Link to={`/tickets/${m.ticket_id}`} onClick={(e) => e.stopPropagation()}>{m.ticket_number}</Link> : '—'}</td>
              <td><span className={`chip chip-EMAIL-${m.processing_status}`}>{m.processing_status}</span>{m.ignore_reason && <div className="muted" style={{ fontSize: 11.5, maxWidth: 260 }}>{m.ignore_reason}</div>}</td>
              <td className="muted">{m.event_type || '—'}</td>
              <td className="muted">{timeAgo(m.created_at)}</td>
              {actions && <td onClick={(e) => e.stopPropagation()}>{actions(m)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogDetail({ id, onClose, onChanged }) {
  const toast = useToast();
  const [m, setM] = useState(null);
  const [meta, setMeta] = useState(null);
  const [manual, setManual] = useState(null);
  useEffect(() => {
    api(`/email/log/${id}`).then(setM).catch((e) => toast(e.message, true));
    Promise.all([api('/meta'), api('/admin/users').catch(() => [])])
      .then(([m2, users]) => setMeta({ ...m2, users: users.filter((u) => u.active) }))
      .catch(() => {});
  }, [id, toast]);

  const act = async (fn, msg) => {
    try { await fn(); toast(msg); onChanged?.(); onClose(); } catch (e) { toast(e.message, true); }
  };
  if (!m) return <Modal title="Email" onClose={onClose}><Spinner dark /></Modal>;
  const canAct = m.direction === 'INBOUND' && !(m.processing_status === 'PROCESSED' && m.ticket_id);
  const atts = (() => { try { return JSON.parse(m.attachments_json || '[]'); } catch { return []; } })();
  return (
    <Modal title={m.subject || '(no subject)'} onClose={onClose} wide>
      <dl className="kv" style={{ marginBottom: 12 }}>
        <dt>Direction</dt><dd>{m.direction} · <span className={`chip chip-EMAIL-${m.processing_status}`}>{m.processing_status}</span> {m.event_type && <span className="muted">· {m.event_type}</span>}</dd>
        <dt>From</dt><dd>{m.from_name ? `${m.from_name} <${m.from_address}>` : m.from_address || '—'}</dd>
        <dt>To</dt><dd>{m.to_addresses || '—'}</dd>
        {m.cc_addresses && <><dt>Cc</dt><dd>{m.cc_addresses}</dd></>}
        <dt>Ticket</dt><dd>{m.ticket_number ? <Link to={`/tickets/${m.ticket_id}`}>{m.ticket_number}</Link> : '—'}</dd>
        <dt>Message-ID</dt><dd className="tnum" style={{ fontSize: 12 }}>{m.message_id}</dd>
        {m.in_reply_to && <><dt>In-Reply-To</dt><dd className="tnum" style={{ fontSize: 12 }}>{m.in_reply_to}</dd></>}
        <dt>When</dt><dd>{fmtDate(m.received_or_sent_at || m.created_at)}</dd>
        {m.ignore_reason && <><dt>Reason</dt><dd>{m.ignore_reason}</dd></>}
        {atts.length > 0 && <><dt>Attachments</dt><dd>{atts.map((a) => `${a.filename} (${Math.round((a.size || 0) / 1024)} KB)`).join(', ')}</dd></>}
      </dl>
      {m.body_html_safe
        ? <div className="email-html" dangerouslySetInnerHTML={{ __html: m.body_html_safe }} />
        : <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{m.body_text}</pre>}
      <details style={{ marginTop: 12 }}>
        <summary className="muted">Headers</summary>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11.5 }}>{Object.entries(m.raw_headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
      </details>
      {canAct && (
        <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => act(() => api(`/email/log/${m.id}/reprocess`, { method: 'POST' }), 'Reprocessed')}>Reprocess (bypass policy)</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setManual({ category_id: meta?.categories?.[0]?.id || '', priority_id: 3 })}>Create incident manually…</button>
          <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => confirm('Discard this email?') && act(() => api(`/email/log/${m.id}/discard`, { method: 'POST' }), 'Discarded')}>Discard</button>
        </div>
      )}
      {manual && meta && (
        <form className="card card-pad stack" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); act(() => api(`/email/log/${m.id}/create-ticket`, { method: 'POST', body: manual }), 'Incident created'); }}>
          <Field label="Category"><select value={manual.category_id} onChange={(e) => setManual({ ...manual, category_id: Number(e.target.value) })}>{meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Priority"><select value={manual.priority_id} onChange={(e) => setManual({ ...manual, priority_id: Number(e.target.value) })}>{meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.label}</option>)}</select></Field>
          <Field label="Support group (optional)"><select value={manual.support_group_id || ''} onChange={(e) => setManual({ ...manual, support_group_id: e.target.value ? Number(e.target.value) : null })}><option value="">— auto —</option>{meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          <Field label="Requester (optional; defaults to the sender or a guest caller)">
            <select value={manual.requester_id || ''} onChange={(e) => setManual({ ...manual, requester_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">— sender / guest —</option>
              {meta.users?.map((u) => <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>)}
            </select>
          </Field>
          <div className="row"><button className="btn btn-primary btn-sm">Create incident</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => setManual(null)}>Cancel</button></div>
        </form>
      )}
    </Modal>
  );
}

// ---------------- Quarantine / dead letters ----------------
function Quarantine() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => api('/email/quarantine').then(setData).catch((e) => toast(e.message, true)), [toast]);
  useEffect(load, [load]);

  const job = async (id, action) => {
    await api(`/email/jobs/${id}/${action}`, { method: 'POST' }).catch((e) => toast(e.message, true));
    load();
  };
  if (!data) return <div className="loading-page"><Spinner dark /></div>;
  return (
    <>
      <h3 style={{ margin: '4px 0 10px' }}>Quarantined, ignored and failed inbound mail</h3>
      <LogTable rows={data.messages} onOpen={setOpen} />
      <h3 style={{ margin: '18px 0 10px' }}>Job queue (dead letters, queued, running)</h3>
      {data.jobs.length === 0 ? <div className="card"><Empty title="Queue is empty" /></div> : (
        <div className="card table-wrap">
          <table className="data">
            <thead><tr><th>#</th><th>Kind</th><th>Message-ID</th><th>Status</th><th>Attempts</th><th>Next run</th><th>Last error</th><th /></tr></thead>
            <tbody>
              {data.jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.id}</td><td>{j.kind}</td>
                  <td className="tnum" style={{ fontSize: 12 }}>{j.message_id || '—'}</td>
                  <td><span className={`chip chip-EMAIL-${j.status}`}>{j.status}</span></td>
                  <td>{j.attempts}/{j.max_attempts}</td>
                  <td className="muted">{j.status === 'QUEUED' ? fmtDate(j.next_run_at) : '—'}</td>
                  <td className="muted" style={{ maxWidth: 320, fontSize: 12 }}>{j.last_error || '—'}</td>
                  <td className="row" style={{ gap: 4 }}>
                    {j.status !== 'RUNNING' && <button className="btn btn-ghost btn-sm" onClick={() => job(j.id, 'retry')}>Retry</button>}
                    {j.status !== 'RUNNING' && <button className="btn btn-ghost btn-sm" onClick={() => job(j.id, 'discard')}>Discard</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <LogDetail id={open} onClose={() => setOpen(null)} onChanged={load} />}
    </>
  );
}
