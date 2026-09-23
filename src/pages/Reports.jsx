import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, downloadFile, fmtDate } from '../api';
import { useAuth } from '../auth';
import { Icon, STATUS_LABEL, useToast } from '../ui';
import { RANGES, fmtRange, rangeToDates } from '../dateRange';
import { Skeleton } from '../dashboard/widgets';

// ============================================================
// Reports — a report generator, not a dashboard.
// Pick a report type, a period and optional filters, preview the result,
// then export it as Excel, PDF or CSV. Every report is produced by the
// backend registry in src/reportBuilder.js from real ticket data.
// ============================================================

const PREVIEW_ROWS = 100;
const RECENT_KEY = 'itsm_recent_reports';
const GROUP_ORDER = ['Summary', 'Breakdowns', 'Service levels', 'Trends', 'Detail'];

const QUICK = [
  { label: 'Tickets this month', type: 'summary', range: 'month' },
  { label: 'Resolved last week', type: 'resolved', range: 'lastweek' },
  { label: 'Open backlog', type: 'open', range: 'quarter' },
  { label: 'SLA compliance this month', type: 'sla', range: 'month' },
  { label: 'Agent performance last month', type: 'agent', range: 'lastmonth' },
  { label: 'Daily volume this week', type: 'daily', range: 'week' },
];

const DEFAULTS = { type: 'summary', range: 'month', from: '', to: '', group: '', priority: '', category: '', status: '' };
const readParams = (p) => Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, p.get(k) || DEFAULTS[k]]));

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function saveRecent(entry) {
  try {
    const list = loadRecent().filter((r) => JSON.stringify(r.cfg) !== JSON.stringify(entry.cfg));
    localStorage.setItem(RECENT_KEY, JSON.stringify([entry, ...list].slice(0, 6)));
  } catch { /* storage unavailable */ }
}

export default function Reports() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const isAdmin = user.role === 'ADMIN';

  const [catalog, setCatalog] = useState(null);
  const [meta, setMeta] = useState(null);
  const [draft, setDraft] = useState(() => readParams(params));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const [recent, setRecent] = useState(loadRecent);

  useEffect(() => {
    api('/reports/catalog').then(setCatalog).catch((e) => setError(e.message));
    api('/meta').then(setMeta).catch(() => {});
  }, []);

  // The applied configuration lives in the URL so a report link can be shared.
  const applied = useMemo(() => readParams(params), [params]);
  const appliedKey = JSON.stringify(applied);
  useEffect(() => { setDraft(readParams(params)); }, [appliedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(draft) !== appliedKey;

  const dates = rangeToDates(applied.range, applied.from, applied.to);
  const qs = useMemo(() => {
    const q = new URLSearchParams({ type: applied.type, from: dates.from, to: dates.to });
    if (applied.group && isAdmin) q.set('group_id', applied.group);
    if (applied.priority) q.set('priority_id', applied.priority);
    if (applied.category) q.set('category_id', applied.category);
    if (applied.status) q.set('status', applied.status);
    return q.toString();
  }, [applied, dates.from, dates.to, isAdmin]);

  const generate = useCallback(() => {
    setLoading(true);
    setError('');
    api(`/reports/generate?${qs}`)
      .then((rep) => {
        setReport(rep);
        const entry = { cfg: applied, title: rep.title, period: rep.period.label, at: Date.now() };
        saveRecent(entry);
        setRecent(loadRecent());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [qs, applied]);
  useEffect(() => { generate(); }, [generate]);

  const commit = (cfg) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(cfg)) if (v && v !== DEFAULTS[k]) next.set(k, v);
    if (cfg.range !== 'custom') { next.delete('from'); next.delete('to'); }
    if (new URLSearchParams(next).toString() === params.toString()) generate(); // same config → refresh
    else setParams(next);
  };
  const reset = () => setParams(new URLSearchParams());

  const exportAs = async (format) => {
    setExporting(format);
    try {
      const name = await downloadFile(`/reports/generate?${qs}&format=${format}`, `report.${format}`);
      toast(`Downloaded ${name}`);
    } catch (e) {
      toast(e.message, true);
    } finally {
      setExporting('');
    }
  };

  const def = catalog?.find((c) => c.key === draft.type);
  const draftDates = rangeToDates(draft.range, draft.from, draft.to);

  return (
    <div className="rc">
      <div className="rc-head">
        <div>
          <h1>Reports</h1>
          <p className="sub">Generate, preview and export service desk reports as Excel, PDF or CSV.</p>
        </div>
        <Link to="/" className="muted rc-link">Looking for live charts? Open the Overview dashboard →</Link>
      </div>

      <div className="rc-quick" aria-label="Quick reports">
        <span className="rc-quick-label"><Icon name="zap" size={14} />Quick reports</span>
        {QUICK.map((q) => (
          <button key={q.label} type="button" className={`rc-chip${applied.type === q.type && applied.range === q.range && !applied.group && !applied.priority && !applied.category && !applied.status ? ' on' : ''}`}
            onClick={() => commit({ ...DEFAULTS, type: q.type, range: q.range })}>{q.label}</button>
        ))}
      </div>

      <div className="rc-grid">
        {/* ---------------- Builder ---------------- */}
        <aside className="card rc-builder">
          <div className="rc-step">
            <div className="rc-step-head"><span className="rc-step-num">1</span><h3>Report</h3></div>
            {!catalog ? <div className="stack" style={{ gap: 8 }}><Skeleton /><Skeleton w="80%" /><Skeleton w="90%" /></div> : (
              <div className="rc-types" role="radiogroup" aria-label="Report type">
                {GROUP_ORDER.filter((g) => catalog.some((c) => c.group === g)).map((g) => (
                  <div key={g} className="rc-type-group">
                    <div className="rc-type-group-label">{g}</div>
                    {catalog.filter((c) => c.group === g).map((c) => (
                      <button key={c.key} type="button" role="radio" aria-checked={draft.type === c.key}
                        className={`rc-type${draft.type === c.key ? ' on' : ''}`} onClick={() => setDraft({ ...draft, type: c.key })}>
                        <span className="rc-radio" aria-hidden="true" />
                        <span className="rc-type-body">
                          <span className="rc-type-title">{c.title}</span>
                          {draft.type === c.key && <span className="rc-type-desc">{c.description}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rc-step">
            <div className="rc-step-head"><span className="rc-step-num">2</span><h3>Period</h3></div>
            <div className="rc-ranges">
              {RANGES.map((r) => (
                <button key={r.key} type="button" className={`rc-chip${draft.range === r.key ? ' on' : ''}`} onClick={() => setDraft({ ...draft, range: r.key })}>{r.label}</button>
              ))}
            </div>
            {draft.range === 'custom' && (
              <div className="rc-custom">
                <label>From<input type="date" value={draft.from || draftDates.from} max={draft.to || draftDates.to} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
                <label>To<input type="date" value={draft.to || draftDates.to} min={draft.from || draftDates.from} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></label>
              </div>
            )}
            <div className="muted rc-period-hint"><Icon name="calendar" size={13} />{fmtRange(draftDates.from, draftDates.to)}</div>
          </div>

          <div className="rc-step">
            <div className="rc-step-head"><span className="rc-step-num">3</span><h3>Filters</h3><span className="muted">optional</span></div>
            <div className="rc-filters">
              {isAdmin && (
                <label>Team
                  <select value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })}>
                    <option value="">All teams</option>
                    {meta?.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </label>
              )}
              <label>Priority
                <select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                  <option value="">All priorities</option>
                  {meta?.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.label}</option>)}
                </select>
              </label>
              <label>Category
                <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                  <option value="">All categories</option>
                  {meta?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>Status
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  <option value="">All statuses</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
          </div>

          <div className="rc-actions">
            <button type="button" className={`btn btn-primary rc-generate${dirty ? ' pulse' : ''}`} onClick={() => commit(draft)} disabled={loading && !report}>
              <Icon name="chart" size={16} />{dirty ? 'Generate report' : 'Refresh report'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
          </div>

          {recent.length > 0 && (
            <div className="rc-recent">
              <div className="rc-type-group-label">Recently generated</div>
              {recent.map((r) => (
                <button key={`${r.title}-${r.period}-${r.at}`} type="button" className="rc-recent-item" onClick={() => commit({ ...DEFAULTS, ...r.cfg })} title="Generate again">
                  <span className="rc-recent-title">{r.title}</span>
                  <span className="muted">{r.period}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ---------------- Preview ---------------- */}
        <section className="card rc-preview" aria-live="polite" aria-busy={loading}>
          <ReportPreview report={report} loading={loading} error={error} onRetry={generate} exporting={exporting} onExport={exportAs}
            selectedTitle={def?.title} />
        </section>
      </div>
    </div>
  );
}

function ReportPreview({ report, loading, error, onRetry, exporting, onExport, selectedTitle }) {
  if (error && !report) {
    return (
      <div className="rc-state">
        <div className="dash-error"><div><b>Couldn't generate the report.</b> {error}</div><button className="btn btn-ghost btn-sm" onClick={onRetry} type="button">Retry</button></div>
      </div>
    );
  }
  if (loading && !report) {
    return (
      <div className="rc-preview-body">
        <div className="rc-preview-head"><div><Skeleton h={22} w={220} /><Skeleton w={320} style={{ marginTop: 8 }} /></div></div>
        <div className="rc-tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="rc-tile"><Skeleton w="50%" /><Skeleton h={24} w="35%" style={{ marginTop: 8 }} /></div>)}</div>
        <div className="stack" style={{ gap: 10, padding: '0 22px 22px' }}>{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} w={`${95 - i * 8}%`} />)}</div>
      </div>
    );
  }
  const rep = report;
  const rows = rep.rows.slice(0, PREVIEW_ROWS);
  const busy = loading;
  return (
    <div className={`rc-preview-body${busy ? ' updating' : ''}`}>
      <div className="rc-preview-head">
        <div>
          <div className="rc-kicker">Report preview{selectedTitle && selectedTitle !== rep.title ? ` · showing ${rep.title}` : ''}</div>
          <h2>{rep.title}</h2>
          <div className="rc-meta">
            <span><Icon name="calendar" size={13} />{rep.period.label}</span>
            <span><Icon name="filter" size={13} />{[rep.filters.team, rep.filters.priority, rep.filters.category, rep.filters.status].join(' · ')}</span>
            <span><Icon name="clock" size={13} />Generated {fmtDate(rep.generated_at)} by {rep.generated_by}</span>
          </div>
        </div>
        <div className="rc-export" role="group" aria-label="Export">
          <button type="button" className="btn btn-primary" onClick={() => onExport('xlsx')} disabled={!!exporting}>
            <Icon name="download" size={15} />{exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onExport('pdf')} disabled={!!exporting}>
            <Icon name="file" size={15} />{exporting === 'pdf' ? 'Preparing…' : 'PDF'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onExport('csv')} disabled={!!exporting}>
            <Icon name="layers" size={15} />{exporting === 'csv' ? 'Preparing…' : 'CSV'}
          </button>
        </div>
      </div>

      {rep.summary.length > 0 && (
        <div className="rc-tiles">
          {rep.summary.map((s) => (
            <div key={s.label} className="rc-tile"><span className="rc-tile-label">{s.label}</span><span className="rc-tile-value">{s.value}</span></div>
          ))}
        </div>
      )}
      {rep.note && <div className="rc-note"><Icon name="alert" size={14} />{rep.note}</div>}

      {rep.rows.length === 0 ? (
        <div className="rc-state">
          <div className="dash-empty compact">
            <div className="dash-empty-icon"><Icon name="inbox" size={20} /></div>
            <div className="dash-empty-title">No data for the selected period and filters.</div>
            <div className="muted">Try a wider period or fewer filters. Exports still produce a file with the report header.</div>
          </div>
        </div>
      ) : (
        <ReportTable columns={rep.columns} rows={rows} totals={rep.totals} />
      )}
      {rep.rows.length > PREVIEW_ROWS && (
        <div className="rc-foot muted">Previewing the first {PREVIEW_ROWS} of {rep.row_count} rows. Export to get the full report.</div>
      )}
      {rep.truncated && <div className="rc-foot muted">This report is capped at {rep.row_count} rows. Narrow the period or filters to include everything.</div>}

      {rep.extra && rep.extra.rows.length > 0 && (
        <>
          <div className="rc-subhead"><h3>{rep.extra.title}</h3></div>
          <ReportTable columns={rep.extra.columns} rows={rep.extra.rows.slice(0, PREVIEW_ROWS)} />
        </>
      )}
    </div>
  );
}

function ReportTable({ columns, rows, totals }) {
  return (
    <div className="table-wrap rc-table-wrap">
      <table className="data compact rc-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} className={c.align === 'right' ? 'num' : ''}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => (
                <td key={c.key} className={`${c.align === 'right' ? 'num' : ''}${c.wide ? ' wide' : ''}`} title={c.wide ? String(r[c.key] ?? '') : undefined}>
                  {c.key === 'ticket_number' && r.id ? <Link to={`/tickets/${r.id}`} className="tnum">{r[c.key]}</Link> : (r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
          {totals && (
            <tr className="rc-totals">
              {columns.map((c) => <td key={c.key} className={c.align === 'right' ? 'num' : ''}>{totals[c.key] ?? ''}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
