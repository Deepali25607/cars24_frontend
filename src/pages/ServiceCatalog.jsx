import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, Icon, Modal, Spinner, useToast } from '../ui';

export default function ServiceCatalog() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user.role === 'ADMIN';
  const [items, setItems] = useState(null);
  const [requesting, setRequesting] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | item

  const load = () => {
    api(`/catalog${isAdmin ? '?all=1' : ''}`).then(setItems).catch(() => setItems([]));
  };
  useEffect(load, [isAdmin]); // eslint-disable-line

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Service catalog</h1>
          <p className="sub">Request equipment, software and access from IT.</p>
        </div>
        <div className="row">
          {isAdmin && (
            <button className="btn btn-primary" onClick={() => setEditing('new')}>New catalog item</button>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/requests')}>My requests</button>
        </div>
      </div>

      {!items ? (
        <div className="loading-page"><Spinner dark /></div>
      ) : items.length === 0 ? (
        <Empty title="The catalog is empty" hint="An administrator can add catalog items." />
      ) : (
        <div className="cat-grid">
          {items.map((i) => (
            <button key={i.id} className="cat-item" type="button"
              style={{ opacity: i.active ? 1 : 0.5, position: 'relative' }}
              onClick={() => (i.active ? setRequesting(i) : isAdmin && setEditing(i))}>
              <Icon name={i.icon || 'cart'} size={22} />
              <span className="ci-name">{i.name}{i.active ? '' : ' (disabled)'}</span>
              {i.description && <span className="ci-desc">{i.description}</span>}
              <span className="muted" style={{ fontSize: 12 }}>
                {i.requires_approval ? 'Needs approval' : 'No approval needed'}
                {isAdmin && i.group_name ? ` · ${i.group_name}` : ''}
              </span>
              {isAdmin && (
                <span className="btn btn-ghost btn-sm" role="button" tabIndex={0}
                  style={{ position: 'absolute', top: 10, right: 10 }}
                  onClick={(e) => { e.stopPropagation(); setEditing(i); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setEditing(i); } }}>
                  Edit
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <CatalogItemModal item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); toast('Catalog item saved'); }} />
      )}

      {requesting && (
        <RequestModal item={requesting} onClose={() => setRequesting(null)}
          onDone={(r) => { setRequesting(null); toast(`Request ${r.request_number} submitted`); navigate(`/requests/${r.id}`); }} />
      )}
    </>
  );
}

// Admin management of catalog items (BRD 7.7: catalog is admin-configurable)
const ITEM_ICONS = [['cart', 'Cart'], ['laptop', 'Laptop'], ['apps', 'Software'],
  ['wifi', 'Network'], ['key', 'Access'], ['plug', 'Peripheral'], ['gear', 'Other']];

function CatalogItemModal({ item, onClose, onSaved }) {
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [f, setF] = useState({
    name: item?.name || '', description: item?.description || '',
    icon: item?.icon || 'cart', support_group_id: item?.support_group_id || '',
    requires_approval: item ? !!item.requires_approval : true,
    active: item ? !!item.active : true,
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/meta').then((m) => setGroups(m.groups)).catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: f.name, description: f.description || null, icon: f.icon,
        support_group_id: f.support_group_id ? Number(f.support_group_id) : null,
        requires_approval: f.requires_approval, active: f.active,
      };
      if (item) await api(`/catalog/${item.id}`, { method: 'PATCH', body });
      else await api('/catalog', { method: 'POST', body });
      onSaved();
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  return (
    <Modal title={item ? `Edit: ${item.name}` : 'New catalog item'} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field"><span className="req">Item name</span>
            <input value={f.name} onChange={set('name')} required maxLength={80}
              placeholder="e.g. Docking Station Request" /></label>
          <label className="field"><span>Icon</span>
            <select value={f.icon} onChange={set('icon')}>
              {ITEM_ICONS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
        </div>
        <label className="field"><span>Description (shown to employees)</span>
          <textarea rows={2} value={f.description} onChange={set('description')}
            placeholder="What this request is for and anything the requester should know." /></label>
        <label className="field"><span>Fulfilling support group</span>
          <select value={f.support_group_id} onChange={set('support_group_id')}>
            <option value="">— (any group)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select></label>
        <label className="field row" style={{ gap: 8 }}>
          <input type="checkbox" checked={f.requires_approval}
            onChange={(e) => setF((x) => ({ ...x, requires_approval: e.target.checked }))} />
          <span>Needs approval (Team Lead → Administrator) before fulfillment</span>
        </label>
        <label className="field row" style={{ gap: 8 }}>
          <input type="checkbox" checked={f.active}
            onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
          <span>Active (visible to employees)</span>
        </label>
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save item'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function RequestModal({ item, onClose, onDone }) {
  const toast = useToast();
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api('/requests', {
        method: 'POST',
        body: { catalog_item_id: item.id, description: description || null },
      });
      onDone(r);
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Request: ${item.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        {item.description && <p className="muted" style={{ marginTop: 0 }}>{item.description}</p>}
        <label className="field">
          <span>Details / justification{item.requires_approval ? ' (helps the approvers)' : ''}</span>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Anything IT should know about this request…" />
        </label>
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
