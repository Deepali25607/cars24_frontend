import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { Empty, Modal, Spinner, useToast } from '../ui';

// ADVANCED A2: Problem Management (BRD 8.4)

export const PRB_STATUS_LABEL = {
  NEW: 'New', ROOT_CAUSE_ANALYSIS: 'Root cause analysis',
  KNOWN_ERROR: 'Known error', RESOLVED: 'Resolved', CLOSED: 'Closed',
};

export function PrbStatusChip({ status }) {
  return <span className={`chip chip-${status}`}><span className="dot" />{PRB_STATUS_LABEL[status] || status}</span>;
}

export default function Problems() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [meta, setMeta] = useState(null);

  const load = () => {
    api(`/problems${status ? `?status=${status}` : ''}`).then(setRows).catch(() => setRows([]));
  };
  useEffect(() => { load(); }, [status]); // eslint-disable-line
  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Problem management</h1>
          <p className="sub">Root causes behind recurring incidents, known errors and permanent fixes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>New problem</button>
      </div>

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(PRB_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card">
        {!rows ? <div className="loading-page"><Spinner dark /></div> : rows.length === 0 ? (
          <Empty title="No problems recorded" hint="Create a problem when several incidents share a suspected root cause." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Problem</th><th>Title</th><th>Status</th><th>Category</th><th>Linked incidents</th><th>Owner</th><th>Updated</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/problems/${p.id}`)}>
                    <td className="tnum">{p.problem_number}</td>
                    <td style={{ fontWeight: 600 }}>{p.title}</td>
                    <td><PrbStatusChip status={p.status} /></td>
                    <td className="muted">{p.category_name || '—'}</td>
                    <td className="muted">{p.linked_count}</td>
                    <td className="muted">{p.agent_name || '—'}</td>
                    <td className="muted">{timeAgo(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && meta && (
        <ProblemCreate meta={meta} onClose={() => setCreating(false)}
          onSaved={(p) => { setCreating(false); toast(`${p.problem_number} created`); navigate(`/problems/${p.id}`); }} />
      )}
    </>
  );
}

function ProblemCreate({ meta, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ title: '', description: '', category_id: '', support_group_id: '' });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api('/problems', {
        method: 'POST',
        body: {
          ...f,
          category_id: f.category_id ? Number(f.category_id) : null,
          support_group_id: f.support_group_id ? Number(f.support_group_id) : null,
        },
      });
      onSaved(p);
    } catch (e2) { toast(e2.message, true); setBusy(false); }
  };

  return (
    <Modal title="New problem" onClose={onClose} wide>
      <form onSubmit={save}>
        <label className="field"><span className="req">Title</span>
          <input value={f.title} onChange={(e) => setF((x) => ({ ...x, title: e.target.value }))} required /></label>
        <label className="field"><span className="req">Description</span>
          <textarea rows={4} value={f.description} required
            placeholder="What pattern of incidents does this problem explain?"
            onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} /></label>
        <div className="form-grid">
          <label className="field"><span>Category</span>
            <select value={f.category_id} onChange={(e) => setF((x) => ({ ...x, category_id: e.target.value }))}>
              <option value="">—</option>
              {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="field"><span>Support group</span>
            <select value={f.support_group_id} onChange={(e) => setF((x) => ({ ...x, support_group_id: e.target.value }))}>
              <option value="">—</option>
              {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select></label>
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create problem'}</button>
      </form>
    </Modal>
  );
}
