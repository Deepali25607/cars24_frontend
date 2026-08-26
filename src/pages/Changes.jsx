import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, timeAgo, fmtDate } from '../api';
import { Empty, Modal, Spinner, useToast } from '../ui';

// ADVANCED A3: Change Management (BRD 8.5)

export const CHG_STATUS_LABEL = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Awaiting approval', APPROVED: 'Approved',
  SCHEDULED: 'Scheduled', IN_PROGRESS: 'In progress', COMPLETED: 'Completed',
  FAILED: 'Failed', CANCELLED: 'Cancelled',
};
export const CHG_TYPE_LABEL = { STANDARD: 'Standard', NORMAL: 'Normal', EMERGENCY: 'Emergency' };

export function ChgStatusChip({ status }) {
  return <span className={`chip chip-${status}`}><span className="dot" />{CHG_STATUS_LABEL[status] || status}</span>;
}

export default function Changes() {
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState('list');
  const [rows, setRows] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [creating, setCreating] = useState(false);
  const [meta, setMeta] = useState(null);

  const load = () => {
    api('/changes').then(setRows).catch(() => setRows([]));
    api(`/changes/calendar?from=${new Date().toISOString().slice(0, 10)}&days=30`)
      .then(setCalendar).catch(() => setCalendar([]));
  };
  useEffect(() => { load(); api('/meta').then(setMeta).catch(() => {}); }, []);

  const byDay = {};
  for (const c of calendar || []) {
    const day = (c.planned_start || '').slice(0, 10);
    (byDay[day] = byDay[day] || []).push(c);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Change management</h1>
          <p className="sub">Planned changes, CAB approvals and the change calendar.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>New change</button>
      </div>

      <div className="filters">
        <button className={`btn btn-sm ${tab === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('list')}>All changes</button>
        <button className={`btn btn-sm ${tab === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('calendar')}>Calendar (30 days)</button>
      </div>

      {tab === 'calendar' ? (
        <div className="card card-pad">
          {!calendar ? <Spinner dark /> : Object.keys(byDay).length === 0 ? (
            <Empty title="Nothing scheduled in the next 30 days" />
          ) : Object.entries(byDay).map(([day, items]) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: '0 0 6px' }}>{day}</h4>
              {items.map((c) => (
                <div key={c.id} className="row" style={{ gap: 10, padding: '4px 0', cursor: 'pointer' }}
                  onClick={() => navigate(`/changes/${c.id}`)}>
                  <span className="tnum">{c.change_number}</span>
                  <span style={{ fontWeight: 600, flex: 1 }}>{c.title}</span>
                  <span className="muted">{CHG_TYPE_LABEL[c.change_type]} · {c.risk}</span>
                  <ChgStatusChip status={c.status} />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          {!rows ? <div className="loading-page"><Spinner dark /></div> : rows.length === 0 ? (
            <Empty title="No changes recorded" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Change</th><th>Title</th><th>Type</th><th>Risk</th><th>Status</th><th>Planned start</th><th>Updated</th></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/changes/${c.id}`)}>
                      <td className="tnum">{c.change_number}</td>
                      <td style={{ fontWeight: 600 }}>{c.title}</td>
                      <td className="muted">{CHG_TYPE_LABEL[c.change_type]}</td>
                      <td className="muted">{c.risk}</td>
                      <td><ChgStatusChip status={c.status} /></td>
                      <td className="muted">{c.planned_start ? fmtDate(c.planned_start) : '—'}</td>
                      <td className="muted">{timeAgo(c.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {creating && meta && (
        <ChangeCreate meta={meta} onClose={() => setCreating(false)}
          onSaved={(c) => { setCreating(false); toast(`${c.change_number} created`); navigate(`/changes/${c.id}`); }} />
      )}
    </>
  );
}

function ChangeCreate({ meta, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: '', description: '', change_type: 'NORMAL', risk: 'MEDIUM',
    implementation_plan: '', backout_plan: '', planned_start: '', planned_end: '',
    support_group_id: '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api('/changes', {
        method: 'POST',
        body: {
          ...f,
          planned_start: f.planned_start ? f.planned_start.replace('T', ' ') + ':00' : null,
          planned_end: f.planned_end ? f.planned_end.replace('T', ' ') + ':00' : null,
          support_group_id: f.support_group_id ? Number(f.support_group_id) : null,
        },
      });
      onSaved(c);
    } catch (e2) { toast(e2.message, true); setBusy(false); }
  };

  return (
    <Modal title="New change" onClose={onClose} wide>
      <form onSubmit={save}>
        <label className="field"><span className="req">Title</span>
          <input value={f.title} onChange={set('title')} required /></label>
        <label className="field"><span className="req">Description</span>
          <textarea rows={3} value={f.description} onChange={set('description')} required /></label>
        <div className="form-grid">
          <label className="field"><span>Type</span>
            <select value={f.change_type} onChange={set('change_type')}>
              <option value="NORMAL">Normal (CAB approval)</option>
              <option value="STANDARD">Standard (pre-approved)</option>
              <option value="EMERGENCY">Emergency (admin approval)</option>
            </select></label>
          <label className="field"><span>Risk</span>
            <select value={f.risk} onChange={set('risk')}>
              <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option>
            </select></label>
          <label className="field"><span>Planned start</span>
            <input type="datetime-local" value={f.planned_start} onChange={set('planned_start')} /></label>
          <label className="field"><span>Planned end</span>
            <input type="datetime-local" value={f.planned_end} onChange={set('planned_end')} /></label>
          <label className="field"><span>Implementing group</span>
            <select value={f.support_group_id} onChange={set('support_group_id')}>
              <option value="">—</option>
              {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
        </div>
        <label className="field"><span>Implementation plan (required before submission)</span>
          <textarea rows={3} value={f.implementation_plan} onChange={set('implementation_plan')} /></label>
        <label className="field"><span>Backout plan (required before submission)</span>
          <textarea rows={2} value={f.backout_plan} onChange={set('backout_plan')} /></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create draft'}</button>
      </form>
    </Modal>
  );
}
