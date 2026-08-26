import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Empty, Modal, Spinner, useToast } from '../../ui';

// Admin console for BRD 7.5 assignment rules and BRD 7.11 workflows.

const TRIGGER_LABEL = {
  'ticket.created': 'Ticket created',
  'ticket.assigned': 'Ticket assigned',
  'ticket.status.ASSIGNED': 'Status → Assigned',
  'ticket.status.IN_PROGRESS': 'Status → In progress',
  'ticket.status.PENDING': 'Status → Pending',
  'ticket.status.RESOLVED': 'Status → Resolved',
  'ticket.status.CLOSED': 'Status → Closed',
  'ticket.status.REOPENED': 'Status → Reopened',
};

const COND_FIELDS = [
  ['priority_id', 'Priority'], ['category_id', 'Category'],
  ['subcategory_id', 'Subcategory'], ['location_id', 'Location'],
  ['support_group_id', 'Assignment group'],
];

const ACTION_TYPES = [
  ['assign_group', 'Move to group'], ['assign_agent', 'Assign to agent'],
  ['set_priority', 'Set priority'], ['notify_user', 'Notify a user'],
  ['notify_requester', 'Notify the requester'], ['add_note', 'Add internal note'],
  ['escalate', 'Escalate to group leads'], ['wait', 'Wait (minutes), then continue'],
];

export default function Automation() {
  const toast = useToast();
  const [rules, setRules] = useState(null);
  const [workflows, setWorkflows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [ruleModal, setRuleModal] = useState(null);   // null | 'new' | rule
  const [wfModal, setWfModal] = useState(null);       // null | 'new' | workflow

  const load = () => {
    api('/admin/assignment-rules').then(setRules).catch(() => setRules([]));
    api('/admin/workflows').then(setWorkflows).catch(() => setWorkflows([]));
  };
  useEffect(() => { load(); api('/meta').then(setMeta).catch(() => {}); }, []);

  const toggleRule = async (r) => {
    await api(`/admin/assignment-rules/${r.id}`, { method: 'PATCH', body: { active: r.active ? 0 : 1 } })
      .catch((e) => toast(e.message, true));
    load();
  };
  const toggleWf = async (w) => {
    await api(`/admin/workflows/${w.id}`, { method: 'PATCH', body: { active: w.active ? 0 : 1 } })
      .catch((e) => toast(e.message, true));
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Automation</h1>
          <p className="sub">Automatic ticket routing rules and event-driven workflows.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head spread">
          <h3>Assignment rules</h3>
          {meta && <button className="btn btn-primary btn-sm" onClick={() => setRuleModal('new')}>New rule</button>}
        </div>
        {!rules ? <div className="loading-page"><Spinner dark /></div> : rules.length === 0 ? (
          <Empty title="No rules yet" hint="New tickets stay unrouted until an agent triages them." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Order</th><th>Rule</th><th>Conditions</th><th>Routes to</th><th>Active</th><th /></tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} style={{ opacity: r.active ? 1 : 0.5 }}>
                    <td className="tnum">{r.sort}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="muted">
                      {[r.category_name && `Category = ${r.category_name}`,
                        r.subcategory_name && `Subcategory = ${r.subcategory_name}`,
                        r.priority_code && `Priority = ${r.priority_code}`,
                        r.location_name && `Location = ${r.location_name}`,
                        r.department_name && `Department = ${r.department_name}`]
                        .filter(Boolean).join(' · ')}
                    </td>
                    <td>{r.target_group_name}{r.target_agent_name ? ` / ${r.target_agent_name}` : ''}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleRule(r)}>
                        {r.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setRuleModal(r)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head spread">
          <h3>Workflows</h3>
          {meta && <button className="btn btn-primary btn-sm" onClick={() => setWfModal('new')}>New workflow</button>}
        </div>
        {!workflows ? <div className="loading-page"><Spinner dark /></div> : workflows.length === 0 ? (
          <Empty title="No workflows yet" hint="Automate notes, notifications and routing on ticket events." />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Workflow</th><th>Trigger</th><th>Conditions</th><th>Actions</th><th>Active</th><th /></tr>
              </thead>
              <tbody>
                {workflows.map((w) => (
                  <tr key={w.id} style={{ opacity: w.active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                    <td className="muted">{TRIGGER_LABEL[w.trigger_event] || w.trigger_event}</td>
                    <td className="muted">{w.conditions.length ? `${w.conditions.length} condition(s)` : 'Always'}</td>
                    <td className="muted">{w.actions.map((a) => ACTION_TYPES.find(([t]) => t === a.type)?.[1] || a.type).join(', ')}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggleWf(w)}>
                        {w.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setWfModal(w)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ruleModal && meta && (
        <RuleModal rule={ruleModal === 'new' ? null : ruleModal} meta={meta}
          onClose={() => setRuleModal(null)}
          onSaved={() => { setRuleModal(null); load(); toast('Rule saved'); }} />
      )}
      {wfModal && meta && (
        <WorkflowModal wf={wfModal === 'new' ? null : wfModal} meta={meta}
          onClose={() => setWfModal(null)}
          onSaved={() => { setWfModal(null); load(); toast('Workflow saved'); }} />
      )}
    </>
  );
}

function RuleModal({ rule, meta, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: rule?.name || '', sort: rule?.sort ?? 100,
    category_id: rule?.category_id || '', subcategory_id: rule?.subcategory_id || '',
    priority_id: rule?.priority_id || '', location_id: rule?.location_id || '',
    department_id: rule?.department_id || '',
    target_group_id: rule?.target_group_id || '', target_agent_id: rule?.target_agent_id || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);
  const num = (v) => (v ? Number(v) : null);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        name: f.name, sort: Number(f.sort),
        category_id: num(f.category_id), subcategory_id: num(f.subcategory_id),
        priority_id: num(f.priority_id), location_id: num(f.location_id),
        department_id: num(f.department_id),
        target_group_id: num(f.target_group_id), target_agent_id: num(f.target_agent_id),
      };
      if (rule) await api(`/admin/assignment-rules/${rule.id}`, { method: 'PATCH', body });
      else await api('/admin/assignment-rules', { method: 'POST', body });
      onSaved();
    } catch (e2) { toast(e2.message, true); setBusy(false); }
  };

  const subs = meta.subcategories.filter((s) => !f.category_id || s.category_id === Number(f.category_id));

  return (
    <Modal title={rule ? 'Edit assignment rule' : 'New assignment rule'} onClose={onClose} wide>
      <form onSubmit={save} className="form-grid">
        <label className="field"><span className="req">Rule name</span>
          <input value={f.name} onChange={set('name')} required /></label>
        <label className="field"><span>Evaluation order (lower first)</span>
          <input type="number" value={f.sort} onChange={set('sort')} /></label>
        <label className="field"><span>Category is</span>
          <select value={f.category_id} onChange={set('category_id')}>
            <option value="">(any)</option>
            {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="field"><span>Subcategory is</span>
          <select value={f.subcategory_id} onChange={set('subcategory_id')}>
            <option value="">(any)</option>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
        <label className="field"><span>Priority is</span>
          <select value={f.priority_id} onChange={set('priority_id')}>
            <option value="">(any)</option>
            {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.label}</option>)}
          </select></label>
        <label className="field"><span>Location is</span>
          <select value={f.location_id} onChange={set('location_id')}>
            <option value="">(any)</option>
            {meta.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select></label>
        <label className="field"><span>Requester department is</span>
          <select value={f.department_id} onChange={set('department_id')}>
            <option value="">(any)</option>
            {meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></label>
        <label className="field"><span className="req">Route to group</span>
          <select value={f.target_group_id} onChange={set('target_group_id')} required>
            <option value="">Choose group…</option>
            {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select></label>
        <label className="field"><span>Also assign to agent</span>
          <select value={f.target_agent_id} onChange={set('target_agent_id')}>
            <option value="">(no agent)</option>
            {meta.agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
          </select></label>
        <p className="muted full" style={{ fontSize: 12.5, margin: '2px 0 0' }}>
          Leave every condition at “(any)” to create a catch-all rule that matches all tickets.
          Rules run in evaluation order; the first match wins.
        </p>
        <div className="full row" style={{ marginTop: 4 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save rule'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function WorkflowModal({ wf, meta, onClose, onSaved }) {
  const toast = useToast();
  const [name, setName] = useState(wf?.name || '');
  const [trigger, setTrigger] = useState(wf?.trigger_event || 'ticket.created');
  const [conditions, setConditions] = useState(wf?.conditions || []);
  const [actions, setActions] = useState(wf?.actions || []);
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!actions.length) return toast('Add at least one action', true);
    setBusy(true);
    try {
      const body = { name, trigger_event: trigger, conditions, actions };
      if (wf) await api(`/admin/workflows/${wf.id}`, { method: 'PATCH', body });
      else await api('/admin/workflows', { method: 'POST', body });
      onSaved();
    } catch (e2) { toast(e2.message, true); setBusy(false); }
  };

  const setCond = (i, patch) => setConditions((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setAct = (i, patch) => setActions((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const condValueOptions = (field) => {
    switch (field) {
      case 'priority_id': return meta.priorities.map((p) => [p.id, `${p.code} · ${p.label}`]);
      case 'category_id': return meta.categories.map((c) => [c.id, c.name]);
      case 'subcategory_id': return meta.subcategories.map((s) => [s.id, s.name]);
      case 'location_id': return meta.locations.map((l) => [l.id, l.name]);
      case 'support_group_id': return meta.groups.map((g) => [g.id, g.name]);
      default: return [];
    }
  };

  return (
    <Modal title={wf ? 'Edit workflow' : 'New workflow'} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field"><span className="req">Workflow name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label className="field"><span className="req">Trigger</span>
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {Object.entries(TRIGGER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
        </div>

        <div className="spread" style={{ margin: '10px 0 6px' }}>
          <strong>Conditions (all must match)</strong>
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => setConditions((c) => [...c, { field: 'priority_id', op: 'eq', value: 1 }])}>Add condition</button>
        </div>
        {conditions.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Runs on every matching event.</div>}
        {conditions.map((c, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 6 }}>
            <select value={c.field} onChange={(e) => setCond(i, { field: e.target.value, value: '' })}>
              {COND_FIELDS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={c.op} onChange={(e) => setCond(i, { op: e.target.value })}>
              <option value="eq">is</option><option value="ne">is not</option>
            </select>
            <select value={c.value} onChange={(e) => setCond(i, { value: Number(e.target.value) })} style={{ flex: 1 }}>
              <option value="">Choose…</option>
              {condValueOptions(c.field).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setConditions((x) => x.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}

        <div className="spread" style={{ margin: '12px 0 6px' }}>
          <strong>Actions (run in order)</strong>
          <button type="button" className="btn btn-ghost btn-sm"
            onClick={() => setActions((a) => [...a, { type: 'add_note', body: '' }])}>Add action</button>
        </div>
        {actions.map((a, i) => (
          <div key={i} className="row" style={{ gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
            <select value={a.type} onChange={(e) => setAct(i, { type: e.target.value })}>
              {ACTION_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div style={{ flex: 1 }}>
              {a.type === 'assign_group' && (
                <select value={a.group_id || ''} onChange={(e) => setAct(i, { group_id: Number(e.target.value) })}>
                  <option value="">Choose group…</option>
                  {meta.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              )}
              {a.type === 'assign_agent' && (
                <select value={a.agent_id || ''} onChange={(e) => setAct(i, { agent_id: Number(e.target.value) })}>
                  <option value="">Choose agent…</option>
                  {meta.agents.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              )}
              {a.type === 'set_priority' && (
                <select value={a.priority_id || ''} onChange={(e) => setAct(i, { priority_id: Number(e.target.value) })}>
                  <option value="">Choose priority…</option>
                  {meta.priorities.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.label}</option>)}
                </select>
              )}
              {a.type === 'notify_user' && (
                <div className="row" style={{ gap: 6 }}>
                  <select value={a.user_id || ''} onChange={(e) => setAct(i, { user_id: Number(e.target.value) })}>
                    <option value="">Choose user…</option>
                    {meta.agents.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                  <input placeholder="Message" value={a.message || ''} style={{ flex: 1 }}
                    onChange={(e) => setAct(i, { message: e.target.value })} />
                </div>
              )}
              {a.type === 'notify_requester' && (
                <input placeholder="Message to the requester" value={a.message || ''}
                  onChange={(e) => setAct(i, { message: e.target.value })} />
              )}
              {a.type === 'add_note' && (
                <input placeholder="Internal note text" value={a.body || ''}
                  onChange={(e) => setAct(i, { body: e.target.value })} />
              )}
              {a.type === 'escalate' && (
                <input placeholder="Escalation message (optional)" value={a.message || ''}
                  onChange={(e) => setAct(i, { message: e.target.value })} />
              )}
              {a.type === 'wait' && (
                <input type="number" min={1} placeholder="Minutes to wait" value={a.minutes || ''}
                  onChange={(e) => setAct(i, { minutes: Number(e.target.value) })} />
              )}
            </div>
            <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setActions((x) => x.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save workflow'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
