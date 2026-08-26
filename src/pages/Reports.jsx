import { useEffect, useState } from 'react';
import { api } from '../api';
import { BarList, Spinner, StatTile, STATUS_LABEL } from '../ui';

export default function Reports() {
  const [tab, setTab] = useState('basic');
  const [data, setData] = useState(null);
  const [std, setStd] = useState(null);
  const [slaDash, setSlaDash] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    setData(null);
    setStd(null);
    api(`/reports/tickets?${qs}`).then(setData).catch((e) => setErr(e.message));
    api(`/reports/standard?${qs}`).then(setStd).catch(() => {});
    api('/sla/dashboard').then(setSlaDash).catch(() => {});
  };
  useEffect(load, []); // initial

  if (err) return <div className="error-box">{err}</div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <p className="sub">Ticket volumes, SLA performance and service metrics.</p>
        </div>
      </div>

      <div className="filters">
        <button className={`btn btn-sm ${tab === 'basic' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('basic')}>Ticket volumes</button>
        <button className={`btn btn-sm ${tab === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setTab('standard')}>Service metrics &amp; SLA</button>
      </div>

      <div className="filters">
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
        {(from || to) && (
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setFrom(''); setTo(''); setTimeout(load, 0); }}>
            Clear
          </button>
        )}
      </div>

      {tab === 'standard' ? (
        !std ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : (
          <StandardReport std={std} slaDash={slaDash} />
        )
      ) : !data ? (
        <div className="loading-page"><Spinner dark /></div>
      ) : (
        <>
          <div className="stat-row">
            <StatTile num={data.total} label="Total tickets" accent />
            <StatTile num={data.open} label="Open" />
            <StatTile num={data.closed} label="Closed" />
          </div>

          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card card-pad">
              <h2 style={{ marginBottom: 16 }}>By status</h2>
              <BarList items={data.byStatus.map((s) => ({ label: STATUS_LABEL[s.label] || s.label, n: s.n }))} />
            </div>
            <div className="card card-pad">
              <h2 style={{ marginBottom: 16 }}>By priority</h2>
              <BarList items={data.byPriority} />
            </div>
            <div className="card card-pad">
              <h2 style={{ marginBottom: 16 }}>By category</h2>
              <BarList items={data.byCategory} />
            </div>
            <div className="card card-pad">
              <h2 style={{ marginBottom: 16 }}>By agent</h2>
              <BarList items={data.byAgent} />
            </div>
            <div className="card card-pad">
              <h2 style={{ marginBottom: 16 }}>By support group</h2>
              <BarList items={data.byGroup} />
            </div>
            <div className="card card-pad">
              <h2 style={{ marginBottom: 16 }}>New tickets by day (last 30)</h2>
              <BarList items={data.daily.map((d) => ({ label: d.day, n: d.n }))} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function fmtDuration(min) {
  if (min == null) return '—';
  if (min >= 1440) return `${(min / 1440).toFixed(1)} d`;
  if (min >= 60) return `${(min / 60).toFixed(1)} h`;
  return `${min} min`;
}

// STANDARD S9: SLA compliance, MTTR, first response, FCR, aging, productivity, trends.
function StandardReport({ std, slaDash }) {
  return (
    <>
      <div className="stat-row">
        <StatTile num={std.sla.compliance_pct != null ? `${std.sla.compliance_pct}%` : '—'} label="SLA compliance" accent />
        <StatTile num={std.sla.breached} label="SLA breaches" />
        <StatTile num={fmtDuration(std.mttr_minutes)} label="Avg resolution (MTTR)" />
        <StatTile num={fmtDuration(std.first_response_minutes)} label="Avg first response" />
        <StatTile num={std.fcr.pct != null ? `${std.fcr.pct}%` : '—'} label="First-contact resolution" />
      </div>

      {slaDash && slaDash.atRisk.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>At risk / breached now</h3></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Ticket</th><th>Title</th><th>Priority</th><th>Status</th><th>Resolution due</th><th>State</th></tr></thead>
              <tbody>
                {slaDash.atRisk.map((t) => (
                  <tr key={t.id}>
                    <td className="tnum">{t.ticket_number}</td>
                    <td>{t.title}</td>
                    <td>{t.priority_code}</td>
                    <td>{t.status}</td>
                    <td className="muted">{t.resolution_due_at || '—'}</td>
                    <td>
                      <span className={`chip ${t.resolution_breached ? 'chip-SLA_BREACH' : 'chip-SLA_RISK'}`}>
                        <span className="dot" />{t.resolution_breached ? 'Breached' : 'At risk'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Open ticket aging</h2>
          <BarList items={std.aging.map((a) => ({ label: a.bucket, n: a.n }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Recurring issues</h2>
          <BarList items={std.recurring.map((r) => ({ label: `${r.category} / ${r.subcategory}`, n: r.n }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Agent productivity (resolved)</h2>
          <BarList items={std.agents.map((a) => ({ label: `${a.agent} (${fmtDuration(a.avg_mttr_minutes)} avg)`, n: a.resolved }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Group performance</h2>
          <BarList items={std.groups.map((g) => ({ label: `${g.grp} — ${g.resolved}/${g.total} resolved${g.breached ? `, ${g.breached} breached` : ''}`, n: g.total }))} />
        </div>
      </div>
    </>
  );
}
