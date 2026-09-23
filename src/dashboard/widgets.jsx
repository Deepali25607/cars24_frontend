import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fmtDate } from '../api';
import { Avatar, Icon, Priority, StatusChip, STATUS_LABEL } from '../ui';
import { CHART_COLORS, ColumnChart, DonutChart, LineChart, PRIORITY_COLORS, RankedBars, Sparkline, STATUS_COLORS } from '../charts';

// ============================================================
// Reusable analytics widgets. Each one takes already-aggregated data from
// /analytics/dashboard and renders loading / empty / error states itself.
// ============================================================

export function fmtMinutes(min) {
  if (min == null) return '—';
  if (min >= 1440) return `${(min / 1440).toFixed(1)} d`;
  if (min >= 60) return `${(min / 60).toFixed(1)} hrs`;
  return `${Math.round(min)} min`;
}

const shortDay = (iso, long) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' });
};

// ---------- Generic card shell ----------
export function DashCard({ title, subtitle, action, children, className = '', bodyClass = '' }) {
  return (
    <section className={`card dash-card ${className}`}>
      {(title || action) && (
        <div className="dash-card-head">
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="muted">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className={`dash-card-body ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Skeleton({ h = 14, w = '100%', style }) {
  return <span className="skel" style={{ height: h, width: w, ...style }} aria-hidden="true" />;
}

export function CardSkeleton({ lines = 4, chart = false }) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {chart && <Skeleton h={150} />}
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} w={`${92 - i * 12}%`} />)}
    </div>
  );
}

export function EmptyState({ title = 'No ticket data is available for the selected period.', hint, compact }) {
  return (
    <div className={`dash-empty${compact ? ' compact' : ''}`}>
      <div className="dash-empty-icon"><Icon name="inbox" size={20} /></div>
      <div className="dash-empty-title">{title}</div>
      {hint && <div className="muted">{hint}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="dash-error">
      <div><b>Couldn't load analytics.</b> {message}</div>
      {onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry} type="button">Retry</button>}
    </div>
  );
}

// ---------- KPI card ----------
// `invert` = a decrease is the good direction (e.g. resolution time).
export function KpiCard({ icon, tone = 'brand', label, value, unit, delta, compareLabel, invert, spark, sparkColor, unavailable, loading, note }) {
  if (loading) {
    return (
      <div className="card kpi">
        <div className="kpi-top"><div className="kpi-icon skel" style={{ borderRadius: 10 }} /><Skeleton w="55%" /></div>
        <Skeleton h={28} w="40%" style={{ marginTop: 10 }} />
        <Skeleton w="70%" style={{ marginTop: 12 }} />
      </div>
    );
  }
  const good = delta == null || delta === 0 ? null : invert ? delta < 0 : delta > 0;
  const dir = delta == null || delta === 0 ? 'flat' : good ? 'up' : 'down';
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className={`kpi-icon ${tone}`}><Icon name={icon} size={18} /></div>
        <div className="kpi-label">{label}</div>
      </div>
      {unavailable ? (
        <>
          <div className="kpi-value muted-value">—</div>
          <div className="kpi-note">{unavailable}</div>
        </>
      ) : (
        <>
          <div className="kpi-value">{value}{unit && <span className="kpi-unit">{unit}</span>}</div>
          <div className="kpi-foot">
            <div className={`kpi-delta ${dir}`}>
              {note ? <span className="kpi-flat">{note}</span> : delta == null ? <span className="kpi-flat">No comparison data</span> : (
                <span>
                  <span className="kpi-arrow" aria-hidden="true">{delta > 0 ? '↑' : delta < 0 ? '↓' : '→'}</span>
                  {Math.abs(delta)}%
                </span>
              )}
              {!note && delta != null && <span className="vs">{compareLabel}</span>}
            </div>
            {spark && spark.length > 1 && (
              <div className="kpi-spark"><Sparkline values={spark} color={sparkColor} width={92} height={32} /></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Ticket trend ----------
export function TrendCard({ trend, loading, error, onRetry, periodLabel }) {
  const points = trend?.points || [];
  const hasData = points.some((p) => p.created || p.resolved);
  const hourly = trend?.bucket === 'hour';
  const labels = points.map((p) => p.label);
  return (
    <DashCard title="Ticket trend" subtitle={periodLabel} className="dash-trend"
      action={!loading && hasData && (
        <div className="legend">
          <span className="legend-item"><i style={{ background: CHART_COLORS.brand }} />Created</span>
          <span className="legend-item"><i style={{ background: CHART_COLORS.green }} />Resolved</span>
        </div>
      )}>
      {error ? <ErrorState message={error} onRetry={onRetry} />
        : loading && !trend ? <CardSkeleton chart lines={2} />
          : !hasData ? <EmptyState hint="Tickets created or resolved in this period will chart here." />
            : (
              <LineChart labels={labels} height={hourly ? 260 : 380}
                formatLabel={(l, long) => (hourly ? l : shortDay(l, long))}
                series={[
                  { key: 'created', label: 'Created', color: CHART_COLORS.brand, values: points.map((p) => p.created) },
                  { key: 'resolved', label: 'Resolved', color: CHART_COLORS.green, values: points.map((p) => p.resolved) },
                ]} />
            )}
    </DashCard>
  );
}

// ---------- Donut + legend (priority / status) ----------
export function DistributionCard({ title, subtitle, segments, total, loading, error, onRetry, onSelect, centerLabel = 'Tickets', emptyHint }) {
  const [active, setActive] = useState(null);
  const shown = (segments || []).filter((s) => s.value > 0 || s.alwaysShow);
  const hasData = shown.some((s) => s.value > 0);
  return (
    <DashCard title={title} subtitle={subtitle}>
      {error ? <ErrorState message={error} onRetry={onRetry} />
        : loading && !segments ? <CardSkeleton chart lines={3} />
          : !hasData ? <EmptyState compact hint={emptyHint} />
            : (
              <div className="dist">
                <DonutChart segments={shown} total={total} size={136} thickness={22} centerLabel={centerLabel} onSelect={onSelect && ((a) => onSelect(a))}
                  activeKey={active} onHover={setActive} />
                <ul className="dist-legend">
                  {shown.map((s) => (
                    <li key={s.key} className={`${active && active !== s.key ? 'dim' : ''}${onSelect ? ' clickable' : ''}`}
                      onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)}
                      onClick={onSelect ? () => onSelect(s) : undefined} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
                      onKeyDown={onSelect ? (e) => (e.key === 'Enter' || e.key === ' ') && onSelect(s) : undefined}>
                      <span className="dist-dot" style={{ background: s.color }} />
                      <span className="dist-name">{s.label}</span>
                      <span className="dist-val">{s.value} <span className="muted">({s.pct}%)</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
    </DashCard>
  );
}

export const prioritySegments = (rows) => (rows || []).map((p) => ({
  key: p.code, id: p.id, label: `${p.code} - ${p.label}`, value: p.n, pct: p.pct, color: PRIORITY_COLORS[p.code] || CHART_COLORS.grey,
}));

export const statusSegments = (rows) => (rows || []).map((s) => ({
  key: s.status, status: s.status, label: STATUS_LABEL[s.status] || s.status, value: s.n, pct: s.pct, color: STATUS_COLORS[s.status] || CHART_COLORS.grey,
}));

// ---------- Ranked bars (categories / subcategories) ----------
export function RankedCard({ title, subtitle, items, othersLabel = 'Others', others = 0, loading, error, onRetry, footnote, emptyHint }) {
  const hasData = (items || []).length > 0;
  return (
    <DashCard title={title} subtitle={subtitle}>
      {error ? <ErrorState message={error} onRetry={onRetry} />
        : loading && !items ? <CardSkeleton lines={5} />
          : !hasData ? <EmptyState compact hint={emptyHint} />
            : (
              <>
                <RankedBars items={[
                  ...items,
                  ...(others > 0 ? [{ key: '__others', label: othersLabel, value: others, muted: true, color: '#c9c4ff' }] : []),
                ]} />
                {footnote && <div className="muted" style={{ marginTop: 10 }}>{footnote}</div>}
              </>
            )}
    </DashCard>
  );
}

// ---------- SLA compliance ----------
export function SlaCard({ sla, loading, error, onRetry }) {
  const navigate = useNavigate();
  const available = sla?.available;
  const segs = available ? [
    { key: 'within', label: 'Within SLA', value: sla.within, color: CHART_COLORS.green },
    { key: 'breach', label: 'SLA breach', value: sla.breached, color: CHART_COLORS.red },
    { key: 'risk', label: 'At risk', value: sla.at_risk, color: CHART_COLORS.amber },
  ] : [];
  return (
    <DashCard title="SLA compliance" subtitle={available ? `${sla.tracked} tracked tickets` : undefined}
      action={available && <Link to="/reports" className="muted">Details →</Link>}>
      {error ? <ErrorState message={error} onRetry={onRetry} />
        : loading && !sla ? <CardSkeleton chart lines={3} />
          : !available ? (
            <EmptyState compact title={sla?.policies_active === 0 ? 'SLA analytics not yet enabled' : 'No SLA data is currently available.'}
              hint={sla?.message} />
          ) : (
            <div className="dist">
              <DonutChart segments={segs.filter((s) => s.value > 0)} size={140} thickness={20}
                total={`${sla.compliance_pct}%`} centerLabel="On time" onSelect={(a) => a.key === 'risk' && navigate('/analytics')} />
              <ul className="dist-legend boxed">
                {segs.map((s) => (
                  <li key={s.key}>
                    <span className="dist-dot" style={{ background: s.color }} />
                    <span className="dist-name">{s.label}</span>
                    <span className="dist-val">{s.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
    </DashCard>
  );
}

// ---------- Recent tickets ----------
export function RecentTicketsCard({ rows, loading, error, onRetry, viewAllTo = '/queue' }) {
  const navigate = useNavigate();
  const hasData = (rows || []).length > 0;
  return (
    <DashCard title="Recent tickets" action={<Link to={viewAllTo} className="muted">View all →</Link>} bodyClass="flush">
      {error ? <div style={{ padding: 18 }}><ErrorState message={error} onRetry={onRetry} /></div>
        : loading && !rows ? <div style={{ padding: 18 }}><CardSkeleton lines={5} /></div>
          : !hasData ? <EmptyState compact hint="New tickets in this period will be listed here." />
            : (
              <div className="table-wrap">
                <table className="data compact fixed">
                  <colgroup>
                    <col style={{ width: '17%' }} /><col style={{ width: '32%' }} /><col style={{ width: '9%' }} />
                    <col style={{ width: '17%' }} /><col style={{ width: '14%' }} /><col style={{ width: '11%' }} />
                  </colgroup>
                  <thead>
                    <tr><th>Ticket</th><th>Short description</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((t) => (
                      <tr key={t.id} className="rowlink" onClick={() => navigate(`/tickets/${t.id}`)}>
                        <td className="nowrap"><Link to={`/tickets/${t.id}`} className="tnum" onClick={(e) => e.stopPropagation()}>{t.ticket_number}</Link></td>
                        <td className="ellipsis" style={{ fontWeight: 600 }} title={t.title}>{t.title}</td>
                        <td className="nowrap"><Priority code={t.priority_code} /></td>
                        <td className="nowrap ellipsis"><StatusChip status={t.status} /></td>
                        <td className="nowrap ellipsis">
                          {t.agent_name
                            ? <span className="row" style={{ gap: 6 }}><Avatar name={t.agent_name} size={20} />{t.agent_name.split(' ')[0]}</span>
                            : <span className="muted" title={t.group_name || 'Unassigned'}>{t.group_name || 'Unassigned'}</span>}
                        </td>
                        <td className="muted nowrap" title={fmtDate(t.created_at)}>{shortDay(t.created_at.slice(0, 10))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
    </DashCard>
  );
}

// ---------- Open tickets by assignment group ----------
export function GroupsCard({ byGroup, loading, error, onRetry, onSelect }) {
  const items = (byGroup?.items || []).map((g) => ({
    key: g.id, label: g.name, value: g.n, onClick: onSelect ? () => onSelect(g) : undefined,
  }));
  const hasData = items.some((i) => i.value > 0) || byGroup?.untriaged > 0;
  return (
    <DashCard title="Open tickets by assignment group"
      subtitle={byGroup?.untriaged ? `${byGroup.untriaged} open ticket${byGroup.untriaged === 1 ? '' : 's'} not yet routed to a group` : undefined}
      action={<Link to="/queue?scope=unassigned" className="muted">View all →</Link>}>
      {error ? <ErrorState message={error} onRetry={onRetry} />
        : loading && !byGroup ? <CardSkeleton chart lines={1} />
          : !hasData ? <EmptyState compact title="No open tickets for the selected filters." />
            : <ColumnChart items={items} />}
    </DashCard>
  );
}

// ---------- Operational snapshot strip ----------
export function SnapshotStrip({ snapshot, loading, onSelect }) {
  const cells = [
    { key: 'created_today', label: 'Created today', to: null },
    { key: 'resolved_today', label: 'Resolved today', to: '/queue?status=RESOLVED' },
    { key: 'open_backlog', label: 'Open backlog', to: '/queue' },
    { key: 'pending', label: 'Pending', to: '/queue?status=PENDING' },
    { key: 'unassigned', label: 'Unassigned', to: '/queue?scope=unassigned' },
    { key: 'reopened', label: 'Reopened', to: '/queue?status=REOPENED' },
  ];
  return (
    <div className="snap-row">
      {cells.map((c) => (
        <button key={c.key} type="button" className={`card snap${c.to ? ' clickable' : ''}`}
          onClick={c.to ? () => onSelect(c.to) : undefined} disabled={!c.to}>
          {loading && !snapshot ? <Skeleton h={24} w="40%" /> : <div className="snap-num">{snapshot?.[c.key] ?? '—'}</div>}
          <div className="snap-lbl">{c.label}</div>
        </button>
      ))}
    </div>
  );
}

// ---------- Aging ----------
export function AgingCard({ aging, loading, error, onRetry }) {
  const total = (aging || []).reduce((s, a) => s + a.n, 0);
  const colors = ['#4b3ae9', '#7c6cf0', '#d99a12', '#b3261e'];
  return (
    <DashCard title="Aging of open tickets" subtitle="Time since creation, open tickets only">
      {error ? <ErrorState message={error} onRetry={onRetry} />
        : loading && !aging ? <CardSkeleton lines={4} />
          : total === 0 ? <EmptyState compact title="No open tickets to age." />
            : <RankedBars items={aging.map((a, i) => ({ key: a.bucket, label: a.label, value: a.n, color: colors[i] }))} />}
    </DashCard>
  );
}

// ---------- AI insights (future-ready) ----------
// Renders only what the backend returns in `ai.insights`; never synthesises.
export function AiInsightsCard({ ai, loading }) {
  const insights = ai?.insights || [];
  return (
    <DashCard title="AI insights" subtitle={ai?.enabled ? 'Generated from live ticket data' : 'Not yet connected'}
      action={<span className={`ai-badge${ai?.enabled ? ' on' : ''}`}><Icon name="sparkle" size={13} />{ai?.enabled ? 'Live' : 'Coming soon'}</span>}>
      {loading && !ai ? <CardSkeleton lines={3} />
        : insights.length === 0 ? (
          <EmptyState compact title={ai?.enabled ? 'No insights for the selected period.' : 'AI insights are not enabled yet.'}
            hint={ai?.message} />
        ) : (
          <ul className="ai-list">
            {insights.map((i, idx) => (
              <li key={idx} className={`ai-item ${i.severity || 'info'}`}>
                <div className="ai-title">{i.title}</div>
                {i.detail && <div className="muted">{i.detail}</div>}
              </li>
            ))}
          </ul>
        )}
    </DashCard>
  );
}
