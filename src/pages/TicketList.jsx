import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { Empty, Priority, Spinner, StatusChip, STATUS_LABEL } from '../ui';

// Employee "My tickets" view (also reachable by IT users for their own requests).
export default function TicketList() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tickets, setTickets] = useState(null);
  const status = params.get('status') || '';
  const q = params.get('q') || '';

  useEffect(() => {
    const qs = new URLSearchParams({ scope: 'my' });
    if (status) qs.set('status', status);
    if (q) qs.set('q', q);
    api(`/tickets?${qs}`).then(setTickets).catch(() => setTickets([]));
  }, [status, q]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My tickets</h1>
          <p className="sub">Issues you've reported and where they stand.</p>
        </div>
        <Link to="/new" className="btn btn-amber">Report an issue</Link>
      </div>

      <div className="filters">
        <input placeholder="Search title or number…" defaultValue={q}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const next = new URLSearchParams(params);
              if (e.target.value) next.set('q', e.target.value);
              else next.delete('q');
              setParams(next);
            }
          }} />
        <select value={status} onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set('status', e.target.value);
          else next.delete('status');
          setParams(next);
        }}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card">
        {!tickets ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : tickets.length === 0 ? (
          <Empty title="Nothing here"
            hint={status ? 'No tickets with this status.' : 'You haven’t reported any issues yet.'} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Ticket</th><th>Summary</th><th>Category</th>
                  <th>Priority</th><th>Status</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="rowlink" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td><span className="tnum">{t.ticket_number}</span></td>
                    <td style={{ fontWeight: 600, maxWidth: 340 }}>{t.title}</td>
                    <td className="muted">{t.category_name}{t.subcategory_name ? ` / ${t.subcategory_name}` : ''}</td>
                    <td><Priority code={t.priority_code} /></td>
                    <td><StatusChip status={t.status} /></td>
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
