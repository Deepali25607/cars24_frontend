import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { BarList, Empty, Priority, Spinner, StatTile, StatusChip, STATUS_LABEL } from '../ui';

export default function Dashboard() {
  const { user, isIT } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/reports/dashboard').then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="error-box">{err}</div>;
  if (!data) return <div className="loading-page"><Spinner dark /></div>;

  return isIT ? <ITDashboard data={data} user={user} /> : <EmployeeDashboard data={data} />;
}

function EmployeeDashboard({ data }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="sub">Everything you've reported, at a glance.</p>
        </div>
        <Link to="/new" className="btn btn-amber">Report an issue</Link>
      </div>

      <div className="stat-row">
        <StatTile num={data.open} label="Open tickets" accent onClick={() => navigate('/tickets')} />
        <StatTile num={data.pending} label="Waiting on you / vendor" onClick={() => navigate('/tickets?status=PENDING')} />
        <StatTile num={data.resolved} label="Resolved — please confirm" onClick={() => navigate('/tickets?status=RESOLVED')} />
        <StatTile num={data.closed} label="Closed" onClick={() => navigate('/tickets?status=CLOSED')} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent activity</h2>
          <Link to="/tickets" className="muted">View all →</Link>
        </div>
        {data.recent.length === 0 ? (
          <Empty title="No tickets yet"
            hint="When your laptop misbehaves, report it here and we'll take it from there." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <tbody>
                {data.recent.map((t) => (
                  <tr key={t.id} className="rowlink" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td><span className="tnum">{t.ticket_number}</span></td>
                    <td style={{ fontWeight: 600 }}>{t.title}</td>
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

function ITDashboard({ data, user }) {
  const navigate = useNavigate();
  const statusItems = (data.byStatus || [])
    .map((s) => ({ label: STATUS_LABEL[s.status] || s.status, n: s.n }))
    .sort((a, b) => b.n - a.n);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Service desk overview</h1>
          <p className="sub">
            {user.role === 'ADMIN' ? 'All teams, all queues.' : 'Your work and your team’s queue.'}
          </p>
        </div>
        <Link to="/queue" className="btn btn-primary">Open the queue</Link>
      </div>

      <div className="stat-row">
        <StatTile num={data.mine} label="Assigned to me" accent onClick={() => navigate('/queue?scope=assigned')} />
        <StatTile num={data.unassigned} label="Unassigned" onClick={() => navigate('/queue?scope=unassigned')} />
        <StatTile num={data.open} label="Open (team)" onClick={() => navigate('/queue')} />
        <StatTile num={data.pending} label="Pending" onClick={() => navigate('/queue?status=PENDING')} />
        <StatTile num={data.resolvedToday} label="Resolved today" onClick={() => navigate('/queue?status=RESOLVED')} />
      </div>

      <div className="grid-2">
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Active workload by priority</h2>
          <BarList items={(data.byPriority || []).map((p) => ({ label: p.code, n: p.n }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Tickets by status</h2>
          <BarList items={statusItems} />
        </div>
      </div>
    </>
  );
}
