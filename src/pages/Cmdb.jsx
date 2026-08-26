import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { Empty, Icon, Modal, Spinner, useToast } from '../ui';

// ADVANCED A1: CMDB (BRD 8.3)

const TYPE_LABEL = {
  BUSINESS_SERVICE: 'Business service', APPLICATION: 'Application',
  SERVER: 'Server', LAPTOP: 'Laptop', NETWORK_DEVICE: 'Network device',
};
const TYPE_ICON = {
  BUSINESS_SERVICE: 'gear', APPLICATION: 'apps', SERVER: 'cpu',
  LAPTOP: 'laptop', NETWORK_DEVICE: 'wifi',
};
const REL_LABEL = {
  DEPENDS_ON: 'depends on', RUNS_ON: 'runs on', USED_BY: 'used by', CONNECTS_TO: 'connects to',
};

export default function Cmdb() {
  const { user } = useAuth();
  const toast = useToast();
  const [cis, setCis] = useState(null);
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  const canManage = ['TEAM_LEAD', 'ADMIN'].includes(user.role);

  const load = () => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (q) params.set('q', q);
    api(`/cmdb${params.toString() ? `?${params}` : ''}`).then(setCis).catch(() => setCis([]));
  };
  useEffect(() => { load(); }, [type]); // eslint-disable-line

  return (
    <>
      <div className="page-head">
        <div>
          <h1>CMDB</h1>
          <p className="sub">Configuration items, relationships and dependencies.</p>
        </div>
        {canManage && <button className="btn btn-primary" onClick={() => setCreating(true)}>New CI</button>}
      </div>

      <div className="filters">
        <input placeholder="Search name, CI number, asset tag…" value={q} style={{ minWidth: 260 }}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn btn-ghost btn-sm" onClick={load}>Search</button>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="card">
        {!cis ? <div className="loading-page"><Spinner dark /></div> : cis.length === 0 ? (
          <Empty title="No configuration items" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>CI</th><th>Name</th><th>Type</th><th>Status</th><th>Owner</th><th>Linked asset</th></tr></thead>
              <tbody>
                {cis.map((c) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c.id)}>
                    <td className="tnum">{c.ci_number}</td>
                    <td style={{ fontWeight: 600 }}>
                      <span className="row" style={{ gap: 8 }}><Icon name={TYPE_ICON[c.ci_type]} size={15} />{c.name}</span>
                    </td>
                    <td className="muted">{TYPE_LABEL[c.ci_type]}</td>
                    <td><span className={`chip chip-${c.status}`}><span className="dot" />{c.status}</span></td>
                    <td className="muted">{c.owner_name || '—'}</td>
                    <td className="muted">{c.asset_tag || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <CiDetail id={selected} canManage={canManage} allCis={cis || []}
          onClose={() => setSelected(null)} onChanged={load} />
      )}
      {creating && (
        <CiCreate onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); toast('CI created'); }} />
      )}
    </>
  );
}

function CiDetail({ id, canManage, allCis, onClose, onChanged }) {
  const toast = useToast();
  const [ci, setCi] = useState(null);
  const [relChild, setRelChild] = useState('');
  const [relType, setRelType] = useState('DEPENDS_ON');

  const load = () => api(`/cmdb/${id}`).then(setCi).catch((e) => toast(e.message, true));
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (!ci) return null;

  const addRel = async () => {
    if (!relChild) return;
    try {
      await api(`/cmdb/${ci.id}/relationships`, {
        method: 'POST', body: { child_id: Number(relChild), relation_type: relType },
      });
      setRelChild('');
      load();
      onChanged();
    } catch (e) { toast(e.message, true); }
  };

  const removeRel = async (relId) => {
    await api(`/cmdb/relationships/${relId}`, { method: 'DELETE' }).catch((e) => toast(e.message, true));
    load();
  };

  return (
    <Modal title={`${ci.ci_number} — ${ci.name}`} onClose={onClose} wide>
      <p className="muted" style={{ marginTop: 0 }}>
        {TYPE_LABEL[ci.ci_type]} · {ci.status}
        {ci.owner_name ? ` · Owner: ${ci.owner_name}` : ''}
        {ci.asset_tag ? ` · Asset ${ci.asset_tag} (${ci.manufacturer} ${ci.model})` : ''}
      </p>
      {ci.description && <p style={{ fontSize: 13.5 }}>{ci.description}</p>}

      <h4 style={{ margin: '14px 0 6px' }}>Dependencies</h4>
      {ci.upstream.length === 0 && ci.downstream.length === 0 && (
        <div className="muted" style={{ fontSize: 13 }}>No relationships recorded.</div>
      )}
      {ci.upstream.map((r) => (
        <div key={`u${r.rel_id}`} className="spread" style={{ padding: '3px 0', fontSize: 13.5 }}>
          <span><b>{r.name}</b> ({r.ci_number}) {REL_LABEL[r.relation_type]} this CI</span>
          {canManage && <button className="btn btn-ghost btn-sm" onClick={() => removeRel(r.rel_id)}>Unlink</button>}
        </div>
      ))}
      {ci.downstream.map((r) => (
        <div key={`d${r.rel_id}`} className="spread" style={{ padding: '3px 0', fontSize: 13.5 }}>
          <span>This CI {REL_LABEL[r.relation_type]} <b>{r.name}</b> ({r.ci_number})</span>
          {canManage && <button className="btn btn-ghost btn-sm" onClick={() => removeRel(r.rel_id)}>Unlink</button>}
        </div>
      ))}

      {canManage && (
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <select value={relType} onChange={(e) => setRelType(e.target.value)}>
            {Object.entries(REL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={relChild} onChange={(e) => setRelChild(e.target.value)} style={{ flex: 1 }}>
            <option value="">Relate to CI…</option>
            {allCis.filter((c) => c.id !== ci.id).map((c) => (
              <option key={c.id} value={c.id}>{c.ci_number} — {c.name}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={addRel}>Link</button>
        </div>
      )}

      {ci.tickets.length > 0 && (
        <>
          <h4 style={{ margin: '14px 0 6px' }}>Recent tickets on this CI</h4>
          {ci.tickets.slice(0, 8).map((t) => (
            <div key={t.id} style={{ fontSize: 13.5, padding: '2px 0' }}>
              <span className="tnum">{t.ticket_number}</span> {t.title} — {t.status}
            </div>
          ))}
        </>
      )}
      {ci.changes.length > 0 && (
        <>
          <h4 style={{ margin: '14px 0 6px' }}>Changes touching this CI</h4>
          {ci.changes.map((c) => (
            <div key={c.id} style={{ fontSize: 13.5, padding: '2px 0' }}>
              <span className="tnum">{c.change_number}</span> {c.title} — {c.status}
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

function CiCreate({ onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', ci_type: 'APPLICATION', description: '' });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/cmdb', { method: 'POST', body: f });
      onSaved();
    } catch (e2) { toast(e2.message, true); setBusy(false); }
  };

  return (
    <Modal title="New configuration item" onClose={onClose}>
      <form onSubmit={save}>
        <label className="field"><span className="req">Name</span>
          <input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} required /></label>
        <label className="field"><span className="req">Type</span>
          <select value={f.ci_type} onChange={(e) => setF((x) => ({ ...x, ci_type: e.target.value }))}>
            {Object.entries(TYPE_LABEL).filter(([k]) => k !== 'LAPTOP').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
        <p className="muted" style={{ fontSize: 12.5 }}>Laptop CIs are created automatically from the asset repository.</p>
        <label className="field"><span>Description</span>
          <textarea rows={3} value={f.description} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} /></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create CI'}</button>
      </form>
    </Modal>
  );
}
