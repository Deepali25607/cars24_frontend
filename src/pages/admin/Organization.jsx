import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Icon, Spinner, useToast } from '../../ui';

// Departments, locations, support groups and priority wording.
export default function Organization() {
  const toast = useToast();
  const [data, setData] = useState(null);

  const load = async () => {
    const [departments, locations, groups, meta] = await Promise.all([
      api('/admin/departments'), api('/admin/locations'), api('/admin/groups'), api('/meta'),
    ]);
    setData({ departments, locations, groups, priorities: meta.priorities });
  };
  useEffect(() => { load().catch(() => setData({ departments: [], locations: [], groups: [], priorities: [] })); }, []);

  if (!data) return <div className="loading-page"><Spinner dark /></div>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Organization</h1>
          <p className="sub">Departments, locations, support groups and priority definitions.</p>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <RefList title="Departments" rows={data.departments} endpoint="departments" onChange={load} toast={toast} />
        <RefList title="Locations" rows={data.locations} endpoint="locations" onChange={load} toast={toast} />
        <RefList title="Support groups" rows={data.groups} endpoint="groups" onChange={load} toast={toast}
          hint="Tickets are routed to these teams." />
        <Priorities rows={data.priorities} onChange={load} toast={toast} />
      </div>
    </>
  );
}

function RefList({ title, rows, endpoint, onChange, toast, hint }) {
  const [name, setName] = useState('');
  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api(`/admin/${endpoint}`, { method: 'POST', body: { name: name.trim() } });
      setName('');
      onChange();
      toast(`${title.slice(0, -1)} added`);
    } catch (e2) { toast(e2.message, true); }
  };
  const toggle = async (r) => {
    await api(`/admin/${endpoint}/${r.id}`, { method: 'PATCH', body: { active: r.active ? 0 : 1 } });
    onChange();
  };
  return (
    <div className="card">
      <div className="card-head"><h3>{title}</h3>{hint && <span className="muted">{hint}</span>}</div>
      <div style={{ padding: 8 }}>
        {rows.map((r) => (
          <div key={r.id} className="spread" style={{ padding: '7px 10px', opacity: r.active ? 1 : 0.5 }}>
            <span>{r.name}{!r.active && ' (disabled)'}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle(r)}>
              {r.active ? 'Disable' : 'Enable'}
            </button>
          </div>
        ))}
        <form onSubmit={add} className="row" style={{ padding: '10px 10px 6px' }}>
          <input placeholder={`New ${title.toLowerCase().slice(0, -1)}…`} value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-primary btn-sm" title="Add"><Icon name="plus" size={14} /></button>
        </form>
      </div>
    </div>
  );
}

function Priorities({ rows, onChange, toast }) {
  const [edit, setEdit] = useState(null);
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');

  const save = async (e) => {
    e.preventDefault();
    try {
      await api(`/admin/priorities/${edit}`, { method: 'PATCH', body: { label, description: desc } });
      setEdit(null);
      onChange();
      toast('Priority updated');
    } catch (e2) { toast(e2.message, true); }
  };

  return (
    <div className="card">
      <div className="card-head"><h3>Priorities</h3><span className="muted">P1–P4 per the approved BRD</span></div>
      <div style={{ padding: 8 }}>
        {rows.map((p) =>
          edit === p.id ? (
            <form key={p.id} onSubmit={save} style={{ padding: '7px 10px' }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <b style={{ width: 30 }}>{p.code}</b>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ maxWidth: 140 }} />
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" />
              </div>
              <div className="row" style={{ paddingLeft: 30 }}>
                <button className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(null)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div key={p.id} className="spread" style={{ padding: '7px 10px' }}>
              <span><b style={{ display: 'inline-block', width: 30 }}>{p.code}</b> {p.label}
                <span className="muted"> — {p.description}</span></span>
              <button className="btn btn-ghost btn-sm"
                onClick={() => { setEdit(p.id); setLabel(p.label); setDesc(p.description || ''); }}>
                Edit
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
