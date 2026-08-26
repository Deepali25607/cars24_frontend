import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Icon, Spinner, useToast } from '../../ui';

// Category & subcategory management (BRD: category structure must be
// configurable by administrators).
export default function Catalog() {
  const toast = useToast();
  const [cats, setCats] = useState(null);
  const [subs, setSubs] = useState([]);
  const [sel, setSel] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [newSub, setNewSub] = useState('');

  const load = async () => {
    const [c, m] = await Promise.all([api('/admin/categories'), api('/meta')]);
    setCats(c);
    setSubs(m.subcategories);
    setSel((s) => s ?? c[0]?.id ?? null);
  };
  useEffect(() => { load().catch(() => setCats([])); }, []);

  const addCat = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      await api('/admin/categories', { method: 'POST', body: { name: newCat.trim() } });
      setNewCat('');
      await load();
      toast('Category added');
    } catch (e2) { toast(e2.message, true); }
  };

  const addSub = async (e) => {
    e.preventDefault();
    if (!newSub.trim() || !sel) return;
    try {
      await api(`/admin/categories/${sel}/subcategories`, { method: 'POST', body: { name: newSub.trim() } });
      setNewSub('');
      await load();
      toast('Subcategory added');
    } catch (e2) { toast(e2.message, true); }
  };

  const toggleCat = async (c) => {
    await api(`/admin/categories/${c.id}`, { method: 'PATCH', body: { active: c.active ? 0 : 1 } });
    load();
  };
  const toggleSub = async (s) => {
    await api(`/admin/subcategories/${s.id}`, { method: 'PATCH', body: { active: s.active ? 0 : 1 } });
    load();
  };

  if (!cats) return <div className="loading-page"><Spinner dark /></div>;
  const selCat = cats.find((c) => c.id === sel);
  const selSubs = subs.filter((s) => s.category_id === sel);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Categories</h1>
          <p className="sub">The taxonomy employees pick from when reporting an issue.</p>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: '320px 1fr' }}>
        <div className="card">
          <div className="card-head"><h3>Categories</h3></div>
          <div style={{ padding: 8 }}>
            {cats.map((c) => (
              <div key={c.id} className="spread"
                style={{
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  background: sel === c.id ? 'var(--pine-soft)' : undefined,
                  opacity: c.active ? 1 : 0.5,
                }}
                onClick={() => setSel(c.id)}>
                <span style={{ fontWeight: sel === c.id ? 700 : 500 }}>
                  {c.name}{!c.active && ' (disabled)'}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); toggleCat(c); }}>
                  {c.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
            <form onSubmit={addCat} className="row" style={{ padding: '10px 10px 6px' }}>
              <input placeholder="New category…" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
              <button className="btn btn-primary btn-sm" title="Add"><Icon name="plus" size={14} /></button>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>{selCat ? `Subcategories of ${selCat.name}` : 'Subcategories'}</h3>
          </div>
          <div style={{ padding: 8 }}>
            {selSubs.map((s) => (
              <div key={s.id} className="spread" style={{ padding: '8px 10px', opacity: s.active ? 1 : 0.5 }}>
                <span>{s.name}{!s.active && ' (disabled)'}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleSub(s)}>
                  {s.active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
            {selSubs.length === 0 && <p className="muted" style={{ padding: 10 }}>No subcategories yet.</p>}
            {selCat && (
              <form onSubmit={addSub} className="row" style={{ padding: '10px 10px 6px', maxWidth: 380 }}>
                <input placeholder={`Add subcategory to ${selCat.name}…`} value={newSub}
                  onChange={(e) => setNewSub(e.target.value)} />
                <button className="btn btn-primary btn-sm" title="Add"><Icon name="plus" size={14} /></button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
