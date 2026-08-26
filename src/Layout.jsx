import { Cars24Mark } from './Brand';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, timeAgo } from './api';
import { useAuth } from './auth';
import { Avatar, Icon, Modal, useToast } from './ui';
import Chatbot from './Chatbot';

const ROLE_LABEL = {
  EMPLOYEE: 'Employee', AGENT: 'IT Agent', TEAM_LEAD: 'Team Lead', ADMIN: 'Administrator',
};

function NavItem({ to, icon, children, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <Icon name={icon} /><span className="nav-label">{children}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, isIT } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState({ items: [], unread: 0 });
  const [pwOpen, setPwOpen] = useState(false);
  const [emailPref, setEmailPref] = useState(true);

  const loadNotifs = () => api('/notifications').then(setNotifs).catch(() => {});
  useEffect(() => {
    api('/notifications/prefs').then((p) => setEmailPref(p.email_enabled)).catch(() => {});
  }, []);
  const toggleEmailPref = async () => {
    const next = !emailPref;
    setEmailPref(next);
    await api('/notifications/prefs', { method: 'POST', body: { email_enabled: next } }).catch(() => {});
  };
  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 30000);
    return () => clearInterval(t);
  }, []);

  const openNotifs = async () => {
    setNotifOpen(true);
    if (notifs.unread > 0) {
      await api('/notifications/read', { method: 'POST' }).catch(() => {});
      loadNotifs();
    }
  };

  const isAdmin = user.role === 'ADMIN';

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Cars24Mark size={34} />
          <span>
            <span className="word">Cars24</span>
            <div className="tag">IT Service Desk</div>
          </span>
        </div>

        <nav style={{ overflowY: 'auto' }}>
          <NavItem to="/" icon="home" end>Overview</NavItem>
          <NavItem to="/new" icon="plus">Report an issue</NavItem>
          <NavItem to="/tickets" icon="ticket" end>My tickets</NavItem>
          <NavItem to="/catalog" icon="cart">Service catalog</NavItem>
          <NavItem to="/requests" icon="clipboard" end>Requests</NavItem>
          <NavItem to="/kb" icon="book" end>Knowledge base</NavItem>

          {isIT && (
            <>
              <div className="nav-section">Service desk</div>
              <NavItem to="/queue" icon="inbox">Ticket queue</NavItem>
              <NavItem to="/assets" icon="laptop">Laptops</NavItem>
              <NavItem to="/reports" icon="chart">Reports</NavItem>
              <div className="nav-section">ITSM processes</div>
              <NavItem to="/cmdb" icon="database">CMDB</NavItem>
              <NavItem to="/problems" icon="alert" end>Problems</NavItem>
              <NavItem to="/changes" icon="change" end>Changes</NavItem>
              <NavItem to="/analytics" icon="trend">Analytics</NavItem>
            </>
          )}

          {isAdmin && (
            <>
              <div className="nav-section">Administration</div>
              <NavItem to="/admin/users" icon="users">People &amp; roles</NavItem>
              <NavItem to="/admin/catalog" icon="tag">Categories</NavItem>
              <NavItem to="/admin/org" icon="gear">Organization</NavItem>
              <NavItem to="/admin/sla" icon="sliders">SLA</NavItem>
              <NavItem to="/admin/automation" icon="zap">Automation</NavItem>
              <NavItem to="/admin/integrations" icon="link">Integrations</NavItem>
              <NavItem to="/admin/audit" icon="shield">Audit trail</NavItem>
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <Avatar name={user.full_name} />
          <div className="who">
            <div className="name">{user.full_name}</div>
            <div className="role">{ROLE_LABEL[user.role]}</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="crumb">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user.full_name.split(' ')[0]}</span>
          <span className="spacer" />
          <GlobalSearch />
          <button className="btn-icon" onClick={openNotifs} title="Notifications" aria-label="Notifications">
            <Icon name="bell" />
            {notifs.unread > 0 && <span className="badge-dot" />}
          </button>
          <button className="btn-icon" onClick={() => setPwOpen(true)} title="Change password" aria-label="Change password">
            <Icon name="key" />
          </button>
          <button className="btn-icon" title="Sign out" aria-label="Sign out"
            onClick={async () => { await logout(); navigate('/login'); }}>
            <Icon name="logout" />
          </button>
        </header>
        <main className="content"><Outlet /></main>
      </div>

      {notifOpen && (
        <div className="drawer">
          <div className="drawer-head">
            <h3>Notifications</h3>
            <button className="btn-icon" onClick={() => setNotifOpen(false)} aria-label="Close"><Icon name="x" size={16} /></button>
          </div>
          <div className="drawer-body">
            <label className="row" style={{ gap: 8, padding: '4px 0 12px', fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={emailPref} onChange={toggleEmailPref} />
              <span>Also email me these notifications</span>
            </label>
            {notifs.items.length === 0 && <div className="empty">You're all caught up.</div>}
            {notifs.items.map((n) => (
              <div key={n.id} className={`notif${n.read ? '' : ' unread'}`}
                style={{ cursor: n.ticket_id ? 'pointer' : 'default' }}
                onClick={() => { if (n.ticket_id) { setNotifOpen(false); navigate(`/tickets/${n.ticket_id}`); } }}>
                <div>{n.message}</div>
                <div className="n-time">{timeAgo(n.created_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pwOpen && <ChangePassword onClose={() => setPwOpen(false)} toast={toast} />}
      <Chatbot />
    </div>
  );
}

// STANDARD S12: global search across tickets, knowledge, requests and assets.
function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); setOpen(false); return; }
    const t = setTimeout(() => {
      api(`/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => { setResults(r); setOpen(true); })
        .catch(() => setResults(null));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const go = (path) => { setOpen(false); setQ(''); navigate(path); };
  const total = results
    ? results.tickets.length + results.kb.length + results.requests.length + results.assets.length
    : 0;

  return (
    <div className="gsearch">
      <span className="gs-icon"><Icon name="search" size={15} /></span>
      <input placeholder="Search tickets, articles, requests…" value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)} />
      {open && results && (
        <div className="gsearch-panel">
          {total === 0 && <div className="empty" style={{ padding: 14 }}>No matches for “{results.q}”.</div>}
          {results.tickets.length > 0 && <div className="gs-section">Tickets</div>}
          {results.tickets.map((t) => (
            <button key={`t${t.id}`} className="gs-row" onMouseDown={() => go(`/tickets/${t.id}`)}>
              <span className="gs-num tnum">{t.ticket_number}</span>
              <span className="gs-title">{t.title}</span>
              <span className="gs-num">{t.priority_code}</span>
            </button>
          ))}
          {results.kb.length > 0 && <div className="gs-section">Knowledge base</div>}
          {results.kb.map((a) => (
            <button key={`k${a.id}`} className="gs-row" onMouseDown={() => go(`/kb/${a.id}`)}>
              <span className="gs-num tnum">{a.article_number}</span>
              <span className="gs-title">{a.title}</span>
            </button>
          ))}
          {results.requests.length > 0 && <div className="gs-section">Requests</div>}
          {results.requests.map((r) => (
            <button key={`r${r.id}`} className="gs-row" onMouseDown={() => go(`/requests/${r.id}`)}>
              <span className="gs-num tnum">{r.request_number}</span>
              <span className="gs-title">{r.item_name}</span>
            </button>
          ))}
          {results.assets.length > 0 && <div className="gs-section">Laptops</div>}
          {results.assets.map((a) => (
            <button key={`a${a.id}`} className="gs-row" onMouseDown={() => go('/assets')}>
              <span className="gs-num tnum">{a.asset_tag}</span>
              <span className="gs-title">{a.manufacturer} {a.model}{a.hostname ? ` · ${a.hostname}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChangePassword({ onClose, toast }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      toast('Password updated');
      onClose();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Change password" onClose={onClose}>
      <form onSubmit={submit}>
        {err && <div className="error-box">{err}</div>}
        <label className="field">
          <span className="req">Current password</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </label>
        <label className="field">
          <span className="req">New password (min 8 characters)</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </Modal>
  );
}
