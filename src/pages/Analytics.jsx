import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { BarList, Empty, Spinner, StatTile } from '../ui';

// ADVANCED A7/A8: predictive SLA + advanced dashboards (BRD 8.12/8.13)

function fmtDuration(min) {
  if (min == null) return '—';
  if (min >= 1440) return `${(min / 1440).toFixed(1)} d`;
  if (min >= 60) return `${(min / 60).toFixed(1)} h`;
  return `${min} min`;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [risk, setRisk] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/analytics/advanced').then(setData).catch((e) => setErr(e.message));
    api('/analytics/sla-risk').then(setRisk).catch(() => setRisk([]));
  }, []);

  if (err) return <div className="error-box">{err}</div>;
  if (!data) return <div className="loading-page"><Spinner dark /></div>;

  const expectedWeek = Math.round(data.forecast.reduce((s, f) => s + f.expected, 0));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Advanced analytics</h1>
          <p className="sub">Forecasts, predictions and service intelligence.</p>
        </div>
      </div>

      <div className="stat-row">
        <StatTile num={expectedWeek} label="Forecast tickets (next 7 days)" accent />
        <StatTile num={(risk || []).filter((r) => r.breach_probability >= 60).length} label="Tickets at high breach risk" />
        <StatTile num={data.satisfaction.average != null ? `${data.satisfaction.average}/5` : '—'}
          label={`Customer satisfaction (${data.satisfaction.responses} ratings)`} />
        <StatTile num={data.cost.assets_in_repair} label="Laptops in repair" />
        <StatTile num={data.cost.warranty_expired} label="Laptops out of warranty" />
      </div>

      {risk && risk.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Predictive SLA — highest breach risk now</h3></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Ticket</th><th>Title</th><th>Priority</th><th>Status</th><th>Breach probability</th><th>Recommended action</th></tr></thead>
              <tbody>
                {risk.slice(0, 10).map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td className="tnum">{t.ticket_number}</td>
                    <td>{t.title}</td>
                    <td>{t.priority_code}</td>
                    <td className="muted">{t.status}</td>
                    <td>
                      <b style={{ color: t.breach_probability >= 60 ? 'var(--danger, #c0392b)' : 'inherit' }}>
                        {t.breach_probability}%
                      </b>
                    </td>
                    <td className="muted">{t.recommendations[0] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Ticket volume forecast (next 7 days)</h2>
          <BarList items={data.forecast.map((f) => ({ label: f.day, n: f.expected }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Recurring issue prediction (trending up)</h2>
          {data.recurring.length === 0 ? <Empty title="No rising patterns detected" /> : (
            <BarList items={data.recurring.map((r) => ({ label: `${r.category} / ${r.subcategory} (${r.trend})`, n: r.recent }))} />
          )}
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Asset failure trends (90 days)</h2>
          {data.assetFailures.length === 0 ? <Empty title="No repeat-failure assets" /> : (
            <BarList items={data.assetFailures.map((a) => ({ label: `${a.asset_tag} ${a.manufacturer} ${a.model}${a.repairs ? ` (${a.repairs} repairs)` : ''}`, n: a.incidents }))} />
          )}
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Agent workload (open now)</h2>
          <BarList items={data.workload.map((w) => ({ label: w.agent, n: w.open }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Support team performance</h2>
          <BarList items={data.teams.map((t) => ({
            label: `${t.team} — ${t.resolved}/${t.total} resolved${t.avg_mttr_minutes ? `, ${fmtDuration(t.avg_mttr_minutes)} avg` : ''}`,
            n: t.total,
          }))} />
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Resolution trend (weekly MTTR)</h2>
          {data.resolutionTrend.length === 0 ? <Empty title="No resolutions yet" /> : (
            <BarList items={data.resolutionTrend.map((w) => ({ label: `Week ${w.week} (${w.resolved} resolved)`, n: w.mttr_minutes || 0 }))} />
          )}
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Customer satisfaction</h2>
          {data.satisfaction.responses === 0 ? (
            <Empty title="No ratings yet" hint="Employees can rate resolved tickets." />
          ) : (
            <BarList items={data.satisfaction.distribution.map((d) => ({ label: `${d.score} star${d.score > 1 ? 's' : ''}`, n: d.n }))} />
          )}
        </div>
        <div className="card card-pad">
          <h2 style={{ marginBottom: 16 }}>Cost analysis</h2>
          <dl className="kv">
            <dt>Active fleet value</dt><dd>{data.cost.fleet_value ? data.cost.fleet_value.toLocaleString() : '—'}</dd>
            <dt>Retired asset value</dt><dd>{data.cost.retired_value ? data.cost.retired_value.toLocaleString() : '—'}</dd>
            <dt>In repair</dt><dd>{data.cost.assets_in_repair}</dd>
            <dt>Out of warranty</dt><dd>{data.cost.warranty_expired}</dd>
          </dl>
        </div>
      </div>
    </>
  );
}
