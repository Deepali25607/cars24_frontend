import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Icon, STATUS_LABEL } from '../ui';
import { CHART_COLORS } from '../charts';
import { RANGES, fmtRange, rangeToDates } from '../dateRange';
import { useDashboardData } from './useDashboardData';
import {
  AgingCard, AiInsightsCard, DistributionCard, ErrorState, GroupsCard, KpiCard, RankedCard,
  RecentTicketsCard, SlaCard, SnapshotStrip, TrendCard, fmtMinutes, prioritySegments, statusSegments,
} from './widgets';

// ============================================================
// KPI & Analytics dashboard — rendered on the Overview page for IT roles,
// directly below the (unchanged) Service desk overview tiles.
// Filters live in the URL (?range=…&category=…) so drill-downs and the
// browser back button return to the same view.
// ============================================================

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState(null);
  const isAdmin = user.role === 'ADMIN';

  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);

  const filters = {
    range: params.get('range') || '30d',
    from: params.get('from') || '',
    to: params.get('to') || '',
    group: params.get('group') || '',
    category: params.get('category') || '',
    priority: params.get('priority') || '',
    status: params.get('status') || '',
  };
  const setFilter = (patch) => {
    // Functional form so back-to-back changes never read a stale snapshot.
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      return next;
    }, { replace: true });
  };
  const reset = () => setParams(new URLSearchParams(), { replace: true });
  const activeCount = ['group', 'category', 'priority', 'status'].filter((k) => filters[k]).length + (filters.range !== '30d' ? 1 : 0);

  const dates = rangeToDates(filters.range, filters.from, filters.to);
  const queryString = useMemo(() => {
    const qs = new URLSearchParams({ from: dates.from, to: dates.to });
    if (filters.group && isAdmin) qs.set('group_id', filters.group);
    if (filters.category) qs.set('category_id', filters.category);
    if (filters.priority) qs.set('priority_id', filters.priority);
    if (filters.status) qs.set('status', filters.status);
    return qs.toString();
  }, [dates.from, dates.to, filters.group, filters.category, filters.priority, filters.status, isAdmin]);

  const { data, loading, error, refresh } = useDashboardData(queryString);

  const days = data?.period?.days;
  const compareLabel = days ? `vs previous ${days === 1 ? 'day' : `${days} days`}` : 'vs previous period';
  const periodLabel = data ? `${fmtRange(data.period.from, data.period.to)} · ${data.filters.scope === 'all' ? 'all teams' : 'your team'}` : '';
  const points = data?.trend?.points || [];

  // Drill-downs reuse the existing queue filters.
  const goQueue = (q) => navigate(`/queue?${new URLSearchParams(q).toString()}`);

  return (
    <div className="dash" aria-busy={loading}>
      <div className="dash-head">
        <div>
          <h2>KPI &amp; analytics</h2>
          <p className="sub">{periodLabel || 'Performance, workload and trends.'}</p>
        </div>
        <div className="dash-filters">
          <select value={filters.range} onChange={(e) => setFilter({ range: e.target.value })} aria-label="Date range">
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          {filters.range === 'custom' && (
            <>
              <input type="date" value={filters.from || dates.from} max={dates.to} onChange={(e) => setFilter({ from: e.target.value })} aria-label="From" />
              <input type="date" value={filters.to || dates.to} min={dates.from} onChange={(e) => setFilter({ to: e.target.value })} aria-label="To" />
            </>
          )}
          {isAdmin && (
            <select value={filters.group} onChange={(e) => setFilter({ group: e.target.value })} aria-label="Assignment group">
              <option value="">All groups</option>
              {meta?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <select value={filters.category} onChange={(e) => setFilter({ category: e.target.value })} aria-label="Category">
            <option value="">All categories</option>
            {meta?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => setFilter({ priority: e.target.value })} aria-label="Priority">
            <option value="">All priorities</option>
            {meta?.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {activeCount > 0 && <button className="btn btn-ghost btn-sm" type="button" onClick={reset}>Reset</button>}
          <button className="btn-icon" type="button" onClick={refresh} title="Refresh" aria-label="Refresh analytics">
            <Icon name="change" size={16} />
          </button>
        </div>
      </div>

      {error && !data && <ErrorState message={error} onRetry={refresh} />}

      <div className={`dash-body${loading && data ? ' updating' : ''}`}>
        {/* KPI summary */}
        <div className="kpi-row">
          <KpiCard loading={loading && !data} icon="ticket" tone="brand" label="Total tickets"
            value={data?.kpis.total.value} delta={data?.kpis.total.change_pct} compareLabel={compareLabel}
            spark={points.map((p) => p.created)} sparkColor={CHART_COLORS.brand} />
          <KpiCard loading={loading && !data} icon="check" tone="green" label="Resolved tickets"
            value={data?.kpis.resolved.value} delta={data?.kpis.resolved.change_pct} compareLabel={compareLabel}
            spark={points.map((p) => p.resolved)} sparkColor={CHART_COLORS.green} />
          <KpiCard loading={loading && !data} icon="clock" tone="blue" label="Average resolution time" invert
            value={fmtMinutes(data?.kpis.avg_resolution_minutes.value)} delta={data?.kpis.avg_resolution_minutes.change_pct}
            compareLabel={compareLabel}
            unavailable={data && data.kpis.avg_resolution_minutes.value == null ? 'No tickets resolved in this period' : null}
            spark={points.map((p) => (p.mttr == null ? null : Math.round(p.mttr)))} sparkColor={CHART_COLORS.blue} />
          <KpiCard loading={loading && !data} icon="sparkle" tone="amber" label="Customer satisfaction"
            value={data?.kpis.csat.value != null ? `${data.kpis.csat.value} / 5` : '—'} delta={data?.kpis.csat.change_pct}
            compareLabel={data?.kpis.csat.responses ? `${data.kpis.csat.responses} rating${data.kpis.csat.responses === 1 ? '' : 's'} · ${compareLabel}` : compareLabel}
            unavailable={data && !data.kpis.csat.available ? 'No ratings yet — appears once employees rate resolved tickets'
              : data && data.kpis.csat.value == null ? 'No ratings in this period' : null}
            spark={points.map((p) => p.csat)} sparkColor={CHART_COLORS.amber} />
        </div>

        {/* Trend + priority / status */}
        <div className="dash-grid-trend">
          <TrendCard trend={data?.trend} loading={loading} error={error} onRetry={refresh} periodLabel={periodLabel} />
          <DistributionCard title="Tickets by priority" segments={data && prioritySegments(data.byPriority)} total={data?.kpis.total.value}
            loading={loading} error={error} onRetry={refresh} emptyHint="No tickets in this period."
            onSelect={(s) => goQueue({ priority: s.id })} />
          <DistributionCard title="Tickets by status" segments={data && statusSegments(data.byStatus)} total={data?.kpis.total.value}
            loading={loading} error={error} onRetry={refresh} emptyHint="No tickets in this period."
            onSelect={(s) => goQueue({ status: s.status })} />
        </div>

        {/* Categories / subcategories / SLA */}
        <div className="dash-grid-3">
          <RankedCard title="Top 5 categories" items={data && data.topCategories.items.map((c) => ({
            key: c.id, label: c.name, value: c.n, onClick: () => goQueue({ category: c.id }),
          }))} others={data?.topCategories.others} loading={loading} error={error} onRetry={refresh}
            emptyHint="Categories will rank here once tickets are logged." />
          <RankedCard title="Top 5 subcategories" items={data && data.topSubcategories.items.map((s) => ({
            key: s.id, label: s.name, value: s.n, hint: `${s.category_name} › ${s.name}`,
            onClick: () => goQueue({ category: s.category_id, subcategory: s.id }),
          }))} others={data?.topSubcategories.others} loading={loading} error={error} onRetry={refresh}
            footnote={data?.topSubcategories.untagged ? `${data.topSubcategories.untagged} ticket${data.topSubcategories.untagged === 1 ? '' : 's'} without a subcategory` : null}
            emptyHint="Subcategories will rank here once tickets are logged." />
          <SlaCard sla={data?.sla} loading={loading} error={error} onRetry={refresh} />
        </div>

        {/* Recent tickets + groups */}
        <div className="dash-grid-2">
          <RecentTicketsCard rows={data?.recent} loading={loading} error={error} onRetry={refresh} />
          <GroupsCard byGroup={data?.byGroup} loading={loading} error={error} onRetry={refresh}
            onSelect={(g) => goQueue({ group: g.id })} />
        </div>

        {/* Operational snapshot (now) */}
        <div className="dash-section-title">
          <h3>Operational snapshot</h3>
          <span className="muted">Right now · respects team, category, priority and status filters</span>
        </div>
        <SnapshotStrip snapshot={data?.snapshot} loading={loading} onSelect={(to) => navigate(to)} />

        <div className="dash-grid-2 even">
          <AgingCard aging={data?.aging} loading={loading} error={error} onRetry={refresh} />
          <AiInsightsCard ai={data?.ai} loading={loading} />
        </div>
      </div>
    </div>
  );
}
