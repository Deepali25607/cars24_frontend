import { createContext, useCallback, useContext, useState } from 'react';

// ---------- Icons (inline, stroke-based) ----------
const paths = {
  home: 'M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5',
  plus: 'M12 5v14M5 12h14',
  ticket: 'M4 7h16v4a2 2 0 0 0 0 4v2H4v-2a2 2 0 0 0 0-4V7zM13 7v10',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 6h14l2 7v5H3v-5l2-7z',
  users: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75',
  laptop: 'M4 6h16v10H4zM2 19h20',
  tag: 'M12 2H2v10l9.3 9.3a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8L12 2zM7 7h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M21 20H3',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.1-.4.2-.8.2-1.2z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10.3 21a2 2 0 0 0 3.4 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  paperclip: 'M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  x: 'M18 6 6 18M6 6l12 12',
  key: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM14 2v6h6',
  // STANDARD phase icons
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  cart: 'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
  clipboard: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM9 14l2 2 4-4',
  zap: 'M13 2 3 14h8l-1 8 11-13h-8l1-7z',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  check: 'M20 6 9 17l-5-5',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  wifi: 'M5 12.55a11 11 0 0 1 14 0M8.5 15.5a6 6 0 0 1 7 0M12 19h.01M2 8.82a15 15 0 0 1 20 0',
  plug: 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0V8zM12 18v4',
  cpu: 'M9 9h6v6H9zM5 5h14v14H5zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4',
  // ADVANCED phase icons
  database: 'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 5v7c0 1.66-4.03 3-9 3s-9-1.34-9-3V5M21 12v7c0 1.66-4.03 3-9 3s-9-1.34-9-3v-7',
  alert: 'M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
  change: 'M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16',
  bot: 'M12 2v3M8 5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM9 11h.01M15 11h.01M9 15h6M2 10v4M22 10v4',
  trend: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.4L22 18l-2.1.6L19 21l-.9-2.4L16 18l2.1-.6L19 15z',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z',
  // Reports workspace icons
  calendar: 'M3 5h18v16H3zM3 10h18M8 3v4M16 3v4',
  download: 'M12 3v12M6 11l6 6 6-6M4 21h16',
  columns: 'M4 4h16v16H4zM10 4v16M16 4v16',
  chevron: 'M6 9l6 6 6-6',
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  layers: 'M12 3 2 8l10 5 10-5-10-5zM2 13l10 5 10-5M2 18l10 5 10-5',
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name] || paths.file} />
    </svg>
  );
}

// ---------- Status / priority ----------
export const STATUS_LABEL = {
  NEW: 'New', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress',
  PENDING: 'Pending', RESOLVED: 'Resolved', CLOSED: 'Closed', REOPENED: 'Reopened',
};

export function StatusChip({ status }) {
  return (
    <span className={`chip chip-${status}`}>
      <span className="dot" />{STATUS_LABEL[status] || status}
    </span>
  );
}

export function Priority({ code, label }) {
  return (
    <span className={`prio prio-${code}`} title={label}>
      <span className="bar" />{code}{label ? ` · ${label}` : ''}
    </span>
  );
}

const AVATAR_HUES = [158, 22, 205, 262, 340, 96, 30];
export function Avatar({ name = '?', size = 32 }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return (
    <span className="avatar" style={{
      width: size, height: size, fontSize: size * 0.38,
      background: `hsl(${hue} 38% 38%)`,
    }}>{initials}</span>
  );
}

// ---------- Toast ----------
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, isErr = false) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg, isErr }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.isErr ? ' err' : ''}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------- Modal ----------
export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 620 } : undefined}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ---------- Small helpers ----------
export function Spinner({ dark }) {
  return <span className={`spin${dark ? ' dark' : ''}`} />;
}

export function Empty({ title, hint }) {
  return (
    <div className="empty">
      <div className="big">{title}</div>
      {hint && <div>{hint}</div>}
    </div>
  );
}

export function StatTile({ num, label, accent, onClick }) {
  return (
    <button className={`stat${accent ? ' accent' : ''}`} onClick={onClick} type="button">
      <div className="num">{num}</div>
      <div className="lbl">{label}</div>
    </button>
  );
}

export function BarList({ items }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="bar-list">
      {items.map((i) => (
        <div className="bar-item" key={i.label}>
          <div className="bar-top">
            <span>{i.label}</span><span className="v">{i.n}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(i.n / max) * 100}%` }} />
          </div>
        </div>
      ))}
      {items.length === 0 && <div className="muted">No data yet</div>}
    </div>
  );
}
