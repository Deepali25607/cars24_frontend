import { useEffect, useState } from 'react';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Empty, Modal, Spinner, useToast } from '../ui';

export default function Assets() {
  const { user } = useAuth();
  const toast = useToast();
  const [assets, setAssets] = useState(null);
  const [meta, setMeta] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | asset object
  const [managing, setManaging] = useState(null); // asset object for lifecycle actions

  const canManage = ['ADMIN', 'TEAM_LEAD'].includes(user.role);

  const load = (query = '') =>
    api(`/assets${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setAssets).catch(() => setAssets([]));

  useEffect(() => { load(); }, []);
  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);
  useEffect(() => {
    if (user.role === 'ADMIN') api('/admin/users').then(setUsers).catch(() => {});
  }, [user.role]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Laptop repository</h1>
          <p className="sub">Company laptops and who has them.</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>Add laptop</button>
        )}
      </div>

      <div className="filters">
        <input placeholder="Search tag, serial, hostname or user…" value={q} style={{ minWidth: 280 }}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(q)} />
        <button className="btn btn-ghost btn-sm" onClick={() => load(q)}>Search</button>
      </div>

      <div className="card">
        {!assets ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : assets.length === 0 ? (
          <Empty title="No laptops found" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tag</th><th>Device</th><th>Serial</th><th>Status</th><th>Hostname</th>
                  <th>OS</th><th>Assigned to</th><th>Location</th><th>Warranty</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const expired = a.warranty_until && new Date(a.warranty_until) < new Date();
                  return (
                    <tr key={a.id} style={{ opacity: a.status === 'RETIRED' ? 0.55 : 1 }}>
                      <td><span className="tnum">{a.asset_tag}</span></td>
                      <td style={{ fontWeight: 600 }}>{a.manufacturer} {a.model}</td>
                      <td className="muted">{a.serial_number}</td>
                      <td><span className={`chip chip-${a.status || 'IN_STOCK'}`}><span className="dot" />{STATUS_LABELS[a.status] || a.status}</span></td>
                      <td className="muted">{a.hostname || '—'}</td>
                      <td className="muted">{a.operating_system || '—'}</td>
                      <td>{a.assigned_user_name || <span className="muted">In stock</span>}</td>
                      <td className="muted">{a.location_name || '—'}</td>
                      <td className={expired ? '' : 'muted'} style={expired ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                        {a.warranty_until || '—'}{expired ? ' (expired)' : ''}
                      </td>
                      {canManage && (
                        <td className="row" style={{ gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(a)}>Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setManaging(a)}>Lifecycle</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && meta && (
        <AssetModal
          asset={editing === 'new' ? null : editing}
          meta={meta} users={users}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(q); toast('Laptop saved'); }}
        />
      )}
      {managing && (
        <LifecycleModal asset={managing} users={users}
          onClose={() => setManaging(null)}
          onDone={() => { setManaging(null); load(q); }} />
      )}
    </>
  );
}

const STATUS_LABELS = {
  IN_STOCK: 'In stock', ASSIGNED: 'Assigned', IN_REPAIR: 'In repair', RETIRED: 'Retired',
};

// STANDARD S7: asset lifecycle actions + history (BRD 7.10)
function LifecycleModal({ asset, users, onClose, onDone }) {
  const toast = useToast();
  const [detail, setDetail] = useState(null);
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/assets/${asset.id}`).then(setDetail).catch(() => {});
  }, [asset.id]);

  const options = [];
  if (asset.status !== 'RETIRED') {
    options.push(['ASSIGN', asset.assigned_user_id ? 'Transfer to another user' : 'Assign to a user']);
    if (asset.assigned_user_id) options.push(['UNASSIGN', 'Return to stock']);
    if (asset.status !== 'IN_REPAIR') options.push(['REPAIR', 'Send for repair']);
    if (asset.status === 'IN_REPAIR') options.push(['REPAIR_DONE', 'Repair completed']);
    options.push(['RETIRE', 'Retire from service']);
  } else {
    options.push(['REACTIVATE', 'Reactivate (back to stock)']);
  }

  const run = async (e) => {
    e.preventDefault();
    if (!action) return;
    setBusy(true);
    try {
      await api(`/assets/${asset.id}/action`, {
        method: 'POST',
        body: {
          action: action === 'ASSIGN' && asset.assigned_user_id ? 'TRANSFER' : action,
          user_id: userId ? Number(userId) : undefined,
          note: note || undefined,
        },
      });
      toast('Asset updated');
      onDone();
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Lifecycle — ${asset.asset_tag}`} onClose={onClose} wide>
      <form onSubmit={run}>
        <div className="form-grid">
          <label className="field"><span className="req">Action</span>
            <select value={action} onChange={(e) => setAction(e.target.value)} required>
              <option value="">Choose action…</option>
              {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          {action === 'ASSIGN' && (
            <label className="field"><span className="req">User</span>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} required>
                <option value="">Choose user…</option>
                {users.filter((u) => u.active).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select></label>
          )}
          <label className="field full"><span>Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / details…" /></label>
        </div>
        <button className="btn btn-primary" disabled={busy || !action}>{busy ? 'Working…' : 'Apply'}</button>
      </form>

      {detail?.history?.length > 0 && (
        <>
          <h4 style={{ margin: '16px 0 8px' }}>Asset history</h4>
          <div className="timeline">
            {detail.history.map((h) => (
              <div className="tl-item" key={h.id}>
                <div className="tl-act">{h.action}</div>
                {h.detail && <div style={{ fontSize: 12.5 }}>{h.detail}</div>}
                <div className="tl-meta">{h.actor_name || 'System'} · {timeAgo(h.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function AssetModal({ asset, meta, users, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    asset_tag: asset?.asset_tag || '', serial_number: asset?.serial_number || '',
    manufacturer: asset?.manufacturer || '', model: asset?.model || '',
    hostname: asset?.hostname || '', operating_system: asset?.operating_system || '',
    assigned_user_id: asset?.assigned_user_id || '', location_id: asset?.location_id || '',
    warranty_until: asset?.warranty_until || '',
    vendor: asset?.vendor || '', purchase_date: asset?.purchase_date || '',
    purchase_cost: asset?.purchase_cost ?? '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...f,
        assigned_user_id: f.assigned_user_id ? Number(f.assigned_user_id) : null,
        location_id: f.location_id ? Number(f.location_id) : null,
        warranty_until: f.warranty_until || null,
        hostname: f.hostname || null,
        operating_system: f.operating_system || null,
        vendor: f.vendor || null,
        purchase_date: f.purchase_date || null,
        purchase_cost: f.purchase_cost !== '' ? Number(f.purchase_cost) : null,
      };
      if (asset) await api(`/assets/${asset.id}`, { method: 'PATCH', body });
      else await api('/assets', { method: 'POST', body });
      onSaved();
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  return (
    <Modal title={asset ? `Edit ${asset.asset_tag}` : 'Add laptop'} onClose={onClose} wide>
      <form onSubmit={save} className="form-grid">
        <label className="field"><span className="req">Asset tag</span>
          <input value={f.asset_tag} onChange={set('asset_tag')} required /></label>
        <label className="field"><span className="req">Serial number</span>
          <input value={f.serial_number} onChange={set('serial_number')} required /></label>
        <label className="field"><span className="req">Manufacturer</span>
          <input value={f.manufacturer} onChange={set('manufacturer')} required /></label>
        <label className="field"><span className="req">Model</span>
          <input value={f.model} onChange={set('model')} required /></label>
        <label className="field"><span>Hostname</span>
          <input value={f.hostname} onChange={set('hostname')} /></label>
        <label className="field"><span>Operating system</span>
          <input value={f.operating_system} onChange={set('operating_system')} /></label>
        <label className="field"><span>Assigned to</span>
          <select value={f.assigned_user_id} onChange={set('assigned_user_id')}>
            <option value="">In stock (unassigned)</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select></label>
        <label className="field"><span>Location</span>
          <select value={f.location_id} onChange={set('location_id')}>
            <option value="">—</option>
            {meta.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></label>
        <label className="field"><span>Warranty until</span>
          <input type="date" value={f.warranty_until || ''} onChange={set('warranty_until')} /></label>
        <label className="field"><span>Vendor</span>
          <input value={f.vendor} onChange={set('vendor')} placeholder="Supplier / reseller" /></label>
        <label className="field"><span>Purchase date</span>
          <input type="date" value={f.purchase_date || ''} onChange={set('purchase_date')} /></label>
        <label className="field"><span>Purchase cost</span>
          <input type="number" min="0" step="0.01" value={f.purchase_cost} onChange={set('purchase_cost')} /></label>
        <div className="full row" style={{ marginTop: 4 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save laptop'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
