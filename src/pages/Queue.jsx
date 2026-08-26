import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Avatar, Empty, Priority, Spinner, StatusChip, STATUS_LABEL } from '../ui';

const SCOPES = [
  { key: '', label: 'Team queue' },
  { key: 'assigned', label: 'Assigned to me' },
  { key: 'unassigned', label: 'Unassigned' },
];

export default function Queue() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState(null);
  const [meta, setMeta] = useState(null);

  const scope = params.get('scope') || '';
  const status = params.get('status') || '';
  const prio = params.get('priority') || '';
  const cat = params.get('category') || '';
  const q = params.get('q') || '';

  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (scope) qs.set('scope', scope);
    else if (user.role === 'ADMIN') qs.set('scope', 'team');
    if (status) qs.set('status', status);
    if (prio) qs.set('priority_id', prio);
    if (cat) qs.set('category_id', cat);
    if (q) qs.set('q', q);
    setTickets(null);
    api(`/tickets?${qs}`).then(setTickets).catch(() => setTickets([]));
  }, [scope, status, prio, cat, q, user.role]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ticket queue</h1>
          <p className="sub">Triage, assign and work incidents.</p>
        </div>
      </div>

      <div className="filters">
        {SCOPES.map((s) => (
          <button key={s.key}
            className={`btn btn-sm ${scope === s.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setParam('scope', s.key)}>
            {s.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <input placeholder="Search…" defaultValue={q}
          onKeyDown={(e) => e.key === 'Enter' && setParam('q', e.target.value)} />
        <select value={status} onChange={(e) => setParam('status', e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={prio} onChange={(e) => setParam('priority', e.target.value)}>
          <option value="">All priorities</option>
          {meta?.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
        </select>
        <select value={cat} onChange={(e) => setParam('category', e.target.value)}>
          <option value="">All categories</option>
          {meta?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        {!tickets ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : tickets.length === 0 ? (
          <Empty title="Queue is clear" hint="No tickets match these filters." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ticket</th><th>Summary</th><th>Requester</th><th>Category</th>
                  <th>Priority</th><th>Status</th><th>Assignee</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="rowlink" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td><span className="tnum">{t.ticket_number}</span></td>
                    <td style={{ fontWeight: 600, maxWidth: 280 }}>{t.title}</td>
                    <td className="muted">{t.requester_name}</td>
                    <td className="muted">{t.category_name}</td>
                    <td><Priority code={t.priority_code} /></td>
                    <td><StatusChip status={t.status} /></td>
                    <td>
                      {t.agent_name
                        ? <span className="row" style={{ gap: 6 }}><Avatar name={t.agent_name} size={22} />{t.agent_name.split(' ')[0]}</span>
                        : <span className="muted">—</span>}
                    </td>
                    <td className="muted">{timeAgo(t.updated_at)}</td>
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
