import { useEffect, useId, useMemo, useRef, useState } from 'react';

// ============================================================
// Lightweight, dependency-free SVG charts for the Cars24 design system.
// Every chart is responsive (measures its container), supports hover
// tooltips and optional click-through, and uses the app's CSS tokens.
// ============================================================

export const CHART_COLORS = {
  brand: '#4b3ae9',
  green: '#187a3c',
  blue: '#2456c4',
  amber: '#d99a12',
  red: '#b3261e',
  grey: '#8a8aa6',
};

// Colours match the existing status chips (`.chip-*`) and priority bars (`.prio-*`)
// so the same meaning always has the same colour across the app.
export const STATUS_COLORS = {
  NEW: '#2456c4', ASSIGNED: '#6d3fbf', IN_PROGRESS: '#a05c0a', PENDING: '#5b6472',
  RESOLVED: '#187a3c', CLOSED: '#49524d', REOPENED: '#b3261e',
};
export const PRIORITY_COLORS = { P1: '#b3261e', P2: '#c2570b', P3: '#c99a08', P4: '#8a927f' };

// Measures the rendered width of a wrapper so SVGs can size to their card.
export function useMeasure() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

function Tooltip({ tip }) {
  if (!tip) return null;
  return (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.title && <div className="chart-tip-title">{tip.title}</div>}
      {tip.rows.map((r) => (
        <div className="chart-tip-row" key={r.label}>
          {r.color && <span className="chart-tip-dot" style={{ background: r.color }} />}
          <span className="chart-tip-label">{r.label}</span>
          <span className="chart-tip-val">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// Monotone cubic (Fritsch–Carlson) path: smooth, but never overshoots the data,
// so a series of counts can't dip below zero between two points.
function smoothPath(pts) {
  const n = pts.length;
  if (n < 2) return n ? `M${pts[0][0]},${pts[0][1]}` : '';
  const dx = []; const dy = []; const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    dy.push(pts[i + 1][1] - pts[i][1]);
    m.push(dx[i] ? dy[i] / dx[i] : 0);
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i]; const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

// ---------- Sparkline ----------
export function Sparkline({ values = [], color = CHART_COLORS.brand, width = 110, height = 36 }) {
  const id = useId();
  const clean = values.map((v) => (v == null ? 0 : v));
  if (clean.length < 2) return <svg width={width} height={height} aria-hidden="true" />;
  const max = Math.max(...clean, 1);
  const min = Math.min(...clean, 0);
  const span = max - min || 1;
  const pad = 3;
  const pts = clean.map((v, i) => [
    pad + (i / (clean.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  const line = smoothPath(pts);
  const area = `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`sg${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sg${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---------- Line chart (multi-series, shared x axis) ----------
// `null` values are rendered as gaps (no line, no area) rather than zero.
// `yMax` pins the axis (e.g. 100 for percentages); `yFormat` formats ticks
// and `valueFormat` formats tooltip values.
export function LineChart({ series, labels, height = 230, formatLabel = (l) => l, maxTicks = 6,
  yMax: yMaxIn, yFormat = (v) => v, valueFormat = (v) => (v == null ? '—' : v) }) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState(null);
  const id = useId();
  const m = { top: 14, right: 14, bottom: 30, left: 40 };
  const w = Math.max(width, 240);
  const iw = w - m.left - m.right;
  const ih = height - m.top - m.bottom;
  const n = labels.length;

  const maxVal = Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null)));
  const yMax = yMaxIn ?? niceMax(maxVal);
  const x = (i) => m.left + (n > 1 ? (i / (n - 1)) * iw : iw / 2);
  const y = (v) => m.top + ih - (v / yMax) * ih;
  const ticks = useMemo(() => {
    const step = yMax / 4;
    return [0, 1, 2, 3, 4].map((k) => Math.round(k * step));
  }, [yMax]);
  // Width-aware tick density (~70px per label), and never draw a regular tick
  // so close to the final one that the two collide.
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.min(maxTicks, Math.floor(iw / 70)))));
  const showLabel = (i) => i === n - 1 || (i % labelEvery === 0 && (n - 1 - i) * (iw / Math.max(n - 1, 1)) > 48);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (n === 0) return;
    const i = Math.round(((px - m.left) / (iw || 1)) * (n - 1));
    const idx = Math.min(n - 1, Math.max(0, i));
    setHover({
      idx,
      x: Math.min(x(idx) + 12, w - 160),
      y: 8,
      title: formatLabel(labels[idx], true),
      rows: series.map((s) => ({ label: s.label, value: valueFormat(s.values[idx]), color: s.color })),
    });
  };

  // Split a series into runs of consecutive non-null points (gap support).
  const runs = (values) => {
    const out = [];
    let cur = [];
    values.forEach((v, i) => {
      if (v == null) { if (cur.length) out.push(cur); cur = []; } else cur.push([x(i), y(v)]);
    });
    if (cur.length) out.push(cur);
    return out;
  };

  return (
    <div className="chart-wrap" ref={ref}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img"
        aria-label={series.map((s) => s.label).join(' vs ')}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`lg${id}${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={w - m.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={m.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">{yFormat(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => showLabel(i) && (
          <text key={`${l}${i}`} x={x(i)} y={height - 8} textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="chart-axis">
            {formatLabel(l)}
          </text>
        ))}
        {series.map((s) => runs(s.values).map((pts, ri) => {
          const line = smoothPath(pts);
          const area = `${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`;
          return (
            <g key={`${s.key}${ri}`}>
              {!s.noArea && <path d={area} fill={`url(#lg${id}${s.key})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
              {pts.length === 1 && <circle cx={pts[0][0]} cy={pts[0][1]} r="3.5" fill={s.color} />}
            </g>
          );
        }))}
        {hover && (
          <g>
            <line x1={x(hover.idx)} x2={x(hover.idx)} y1={m.top} y2={m.top + ih} stroke="var(--line-strong)" />
            {series.map((s) => s.values[hover.idx] != null && (
              <circle key={s.key} cx={x(hover.idx)} cy={y(s.values[hover.idx])} r="4.5" fill="#fff" stroke={s.color} strokeWidth="2.2" />
            ))}
          </g>
        )}
      </svg>
      <Tooltip tip={hover} />
    </div>
  );
}

function niceMax(v) {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 4 ? 4 : norm <= 5 ? 5 : 10;
  const top = step * mag;
  return top === v ? top : Math.ceil(v / (top / 4)) * (top / 4);
}

// ---------- Donut chart ----------
export function DonutChart({ segments, total, size = 150, thickness = 24, centerLabel, onSelect, activeKey, onHover }) {
  const [hover, setHover] = useState(null);
  const r = size / 2;
  const inner = r - thickness;
  const sum = segments.reduce((s, x) => s + x.value, 0);
  let angle = -Math.PI / 2;
  const arcs = segments.filter((s) => s.value > 0).map((s) => {
    const frac = s.value / (sum || 1);
    const start = angle;
    const end = angle + frac * Math.PI * 2;
    angle = end;
    return { ...s, start, end, frac };
  });
  const arcPath = (start, end, ro, ri) => {
    const gap = arcs.length > 1 ? 0.018 : 0;
    const s = start + gap;
    const e = Math.max(s, end - gap);
    const large = e - s > Math.PI ? 1 : 0;
    const p = (rad, ang) => [r + rad * Math.cos(ang), r + rad * Math.sin(ang)];
    const [sx, sy] = p(ro, s); const [ex, ey] = p(ro, e);
    const [isx, isy] = p(ri, s); const [iex, iey] = p(ri, e);
    return `M${sx},${sy} A${ro},${ro} 0 ${large} 1 ${ex},${ey} L${iex},${iey} A${ri},${ri} 0 ${large} 0 ${isx},${isy} Z`;
  };
  const shown = hover || (activeKey ? arcs.find((a) => a.key === activeKey) : null);
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={centerLabel}>
        {sum === 0 && <circle cx={r} cy={r} r={r - thickness / 2} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />}
        {arcs.map((a) => {
          const active = shown && shown.key === a.key;
          const dim = shown && !active;
          // A single segment covering the whole ring: an SVG arc whose start and
          // end coincide renders nothing, so draw a stroked circle instead.
          if (a.frac >= 0.9999) {
            const ro = active ? r : r - 3;
            const tw = ro - inner;
            return (
              <circle key={a.key} cx={r} cy={r} r={inner + tw / 2} fill="none" stroke={a.color} strokeWidth={tw}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
                onMouseEnter={() => { setHover(a); onHover?.(a.key); }}
                onMouseLeave={() => { setHover(null); onHover?.(null); }}
                onClick={() => onSelect?.(a)}>
                <title>{`${a.label}: ${a.value} (100%)`}</title>
              </circle>
            );
          }
          return (
            <path key={a.key} d={arcPath(a.start, a.end, active ? r : r - 3, inner)} fill={a.color}
              opacity={dim ? 0.35 : 1} style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'opacity .12s' }}
              onMouseEnter={() => { setHover(a); onHover?.(a.key); }}
              onMouseLeave={() => { setHover(null); onHover?.(null); }}
              onClick={() => onSelect?.(a)}>
              <title>{`${a.label}: ${a.value} (${Math.round(a.frac * 100)}%)`}</title>
            </path>
          );
        })}
      </svg>
      <div className="donut-center">
        <div className="donut-num">{shown ? shown.value : (total ?? sum)}</div>
        <div className="donut-lbl">{shown ? shown.label : centerLabel}</div>
      </div>
    </div>
  );
}

// ---------- Ranked horizontal bars ----------
export function RankedBars({ items, color = CHART_COLORS.brand, max: maxIn }) {
  const max = Math.max(1, maxIn ?? 0, ...items.map((i) => i.value));
  return (
    <div className="rank-list">
      {items.map((i) => {
        const Tag = i.onClick ? 'button' : 'div';
        return (
          <Tag key={i.key ?? i.label} className={`rank-item${i.onClick ? ' clickable' : ''}${i.muted ? ' muted-row' : ''}`}
            type={i.onClick ? 'button' : undefined} onClick={i.onClick} title={i.hint || (i.onClick ? `View ${i.label} tickets` : undefined)}>
            <span className="rank-label">{i.label}</span>
            <span className="rank-track"><span className="rank-fill" style={{ width: `${(i.value / max) * 100}%`, background: i.color || color }} /></span>
            <span className="rank-val">{i.value}</span>
          </Tag>
        );
      })}
    </div>
  );
}

// ---------- Column chart (single or grouped series) ----------
// Single: items [{label, value, color?, onClick?}].
// Grouped: pass `series` [{key, label, color}] and items [{label, values: [...]}].
export function ColumnChart({ items, series, height = 190, color = CHART_COLORS.brand, ariaLabel = 'Column chart', showValues = true, maxLabels }) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState(null);
  const w = Math.max(width, 200);
  const m = { top: 24, bottom: 34, left: 28, right: 8 };
  const ih = height - m.top - m.bottom;
  const n = items.length;
  const defs = series || [{ key: 'v', label: '', color }];
  const vals = (it) => (series ? it.values : [it.value]);
  const max = niceMax(Math.max(1, ...items.flatMap(vals)));
  const slot = (w - m.left - m.right) / Math.max(n, 1);
  const groupW = Math.min(defs.length * 34, slot * 0.72);
  const bw = groupW / defs.length;
  const labelEvery = maxLabels ? Math.max(1, Math.ceil(n / maxLabels)) : 1;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} role="img" aria-label={ariaLabel}>
        {[0, 0.5, 1].map((k) => (
          <line key={k} x1={m.left} x2={w - m.right} y1={m.top + ih - k * ih} y2={m.top + ih - k * ih}
            stroke="var(--line)" strokeDasharray={k === 0 ? undefined : '3 4'} />
        ))}
        <text x={m.left - 6} y={m.top + ih + 4} textAnchor="end" className="chart-axis">0</text>
        <text x={m.left - 6} y={m.top + ih / 2 + 4} textAnchor="end" className="chart-axis">{max / 2}</text>
        <text x={m.left - 6} y={m.top + 4} textAnchor="end" className="chart-axis">{max}</text>
        {items.map((it, i) => {
          const cx = m.left + slot * i + slot / 2;
          const vs = vals(it);
          const active = hover && hover.key === (it.key ?? it.label);
          return (
            <g key={it.key ?? it.label} style={{ cursor: it.onClick ? 'pointer' : 'default' }}
              onClick={it.onClick}
              onMouseEnter={() => setHover({
                key: it.key ?? it.label, x: Math.min(cx + 10, w - 150), y: 0,
                title: series ? it.label : undefined,
                rows: defs.map((d, si) => ({ label: d.label || it.label, value: vs[si] ?? 0, color: it.color || d.color })),
              })}
              onMouseLeave={() => setHover(null)}>
              {vs.map((v, si) => {
                const h = ((v || 0) / max) * ih;
                const bx = cx - groupW / 2 + si * bw;
                const yTop = m.top + ih - h;
                return (
                  <g key={defs[si].key}>
                    <rect x={bx + 1} y={yTop} width={Math.max(bw - 2, 2)} height={Math.max(h, v ? 2 : 0)} rx="4"
                      fill={it.color || defs[si].color} opacity={hover && !active ? 0.5 : 1} />
                    {showValues && (v || !series) && (
                      <text x={bx + bw / 2} y={yTop - 6} textAnchor="middle" className="chart-val">{v}</text>
                    )}
                  </g>
                );
              })}
              {(i % labelEvery === 0 || i === n - 1) && (
                <text x={cx} y={height - 12} textAnchor="middle" className="chart-axis">
                  {it.label.length > Math.floor(slot / 7) ? `${it.label.slice(0, Math.max(3, Math.floor(slot / 7) - 1))}…` : it.label}
                </text>
              )}
              <title>{`${it.label}: ${vs.join(' / ')}`}</title>
            </g>
          );
        })}
      </svg>
      <Tooltip tip={hover} />
    </div>
  );
}

// ---------- Stacked horizontal bars ----------
// rows: [{ key, label, total?, segments: [{ key, label, value, color }], onClick? }]
export function StackedBars({ rows, legend, showTotals = true }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
  return (
    <div className="stack-bars">
      {legend && (
        <div className="legend" style={{ marginBottom: 10 }}>
          {legend.map((l) => (
            <span key={l.key} className={`legend-item${active && active !== l.key ? ' dim' : ''}`}
              onMouseEnter={() => setActive(l.key)} onMouseLeave={() => setActive(null)}>
              <i style={{ background: l.color }} />{l.label}
            </span>
          ))}
        </div>
      )}
      {rows.map((r) => {
        const total = r.segments.reduce((s, x) => s + x.value, 0);
        const Tag = r.onClick ? 'button' : 'div';
        return (
          <Tag key={r.key} className={`stack-row${r.onClick ? ' clickable' : ''}`} type={r.onClick ? 'button' : undefined} onClick={r.onClick}>
            <span className="stack-label">{r.label}</span>
            <span className="stack-track" style={{ width: `${(total / max) * 100}%` }}>
              {r.segments.filter((s) => s.value > 0).map((s) => (
                <span key={s.key} className="stack-seg" style={{ flex: s.value, background: s.color, opacity: active && active !== s.key ? 0.35 : 1 }}
                  title={`${r.label} · ${s.label}: ${s.value}`}
                  onMouseEnter={() => setActive(s.key)} onMouseLeave={() => setActive(null)} />
              ))}
              {total === 0 && <span className="stack-seg empty" />}
            </span>
            {showTotals && <span className="stack-val">{r.total ?? total}</span>}
          </Tag>
        );
      })}
    </div>
  );
}
