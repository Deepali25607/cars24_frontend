// Shared date-range presets used by the Overview analytics and Reports pages.
// Weeks start on Monday.

export const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'lastweek', label: 'Last week' },
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'lastmonth', label: 'Last month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'lastquarter', label: 'Last quarter' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Custom range' },
];

const pad = (n) => String(n).padStart(2, '0');
export const localIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function rangeToDates(range, from, to, now = new Date()) {
  const y = now.getFullYear(); const m = now.getMonth(); const d = now.getDate();
  const day = (offset) => localIso(new Date(y, m, d + offset));
  const today = day(0);
  const dow = (now.getDay() + 6) % 7; // Monday = 0
  const q = Math.floor(m / 3);
  switch (range) {
    case 'today': return { from: today, to: today };
    case 'yesterday': return { from: day(-1), to: day(-1) };
    case 'week': return { from: day(-dow), to: today };
    case 'lastweek': return { from: day(-dow - 7), to: day(-dow - 1) };
    case '7d': return { from: day(-6), to: today };
    case 'month': return { from: localIso(new Date(y, m, 1)), to: today };
    case 'lastmonth': return { from: localIso(new Date(y, m - 1, 1)), to: localIso(new Date(y, m, 0)) };
    case 'quarter': return { from: localIso(new Date(y, q * 3, 1)), to: today };
    case 'lastquarter': return { from: localIso(new Date(y, q * 3 - 3, 1)), to: localIso(new Date(y, q * 3, 0)) };
    case 'year': return { from: localIso(new Date(y, 0, 1)), to: today };
    case 'custom': return { from: from || day(-29), to: to || today };
    default: return { from: day(-29), to: today };
  }
}

export function rangeLabel(range, from, to) {
  if (range !== 'custom') return RANGES.find((r) => r.key === range)?.label || 'Last 30 days';
  const d = rangeToDates('custom', from, to);
  return fmtRange(d.from, d.to);
}

export function fmtRange(from, to) {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const opts = { day: 'numeric', month: 'short' };
  if (from === to) return f.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  const sameYear = f.getFullYear() === t.getFullYear();
  return `${f.toLocaleDateString(undefined, sameYear ? opts : { ...opts, year: 'numeric' })} – ${t.toLocaleDateString(undefined, { ...opts, year: 'numeric' })}`;
}
