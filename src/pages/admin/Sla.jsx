import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Modal, Spinner, useToast } from '../../ui';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtMinutes(m) {
  if (m % 1440 === 0) return `${m / 1440} d`;
  if (m % 60 === 0) return `${m / 60} h`;
  return `${m} min`;
}

export default function Sla() {
  const toast = useToast();
  const [policies, setPolicies] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [editing, setEditing] = useState(null);
  const [holForm, setHolForm] = useState({ date: '', name: '' });

  const load = () => {
    api('/sla/policies').then(setPolicies).catch(() => setPolicies([]));
    api('/sla/calendar').then(setCalendar).catch(() => {});
  };
  useEffect(load, []);

  const toggleDay = async (d) => {
    const days = calendar.business_hours.days.includes(d)
      ? calendar.business_hours.days.filter((x) => x !== d)
      : [...calendar.business_hours.days, d].sort();
    if (!days.length) return toast('Keep at least one business day', true);
    await saveHours({ ...calendar.business_hours, days });
  };

  const saveHours = async (hours) => {
    try {
      const r = await api('/sla/calendar/hours', { method: 'PUT', body: hours });
      setCalendar((c) => ({ ...c, business_hours: r.business_hours }));
      toast('Business hours saved');
    } catch (e) { toast(e.message, true); }
  };

  const addHoliday = async (e) => {
    e.preventDefault();
    try {
      await api('/sla/calendar/holidays', { method: 'POST', body: holForm });
      setHolForm({ date: '', name: '' });
      load();
      toast('Holiday added');
    } catch (e2) { toast(e2.message, true); }
  };

  const removeHoliday = async (id) => {
    try {
      await api(`/sla/calendar/holidays/${id}`, { method: 'DELETE' });
      load();
    } catch (e) { toast(e.message, true); }
  };

  const pendingApproval = policies?.some((p) => !p.approved);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>SLA configuration</h1>
          <p className="sub">Response and resolution targets per priority, business hours and holidays.</p>
        </div>
      </div>

      {pendingApproval && (
        <div className="ok-box" style={{ marginBottom: 14 }}>
          Some SLA values are seeded defaults from the BRD example matrix and are still
          <strong> pending formal customer approval</strong>. Update and mark them approved once confirmed.
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head"><h3>SLA policies</h3></div>
        {!policies ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Priority</th><th>Response</th><th>Resolution</th>
                  <th>Clock</th><th>Customer approved</th><th>Active</th><th />
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.priority_code} · {p.priority_label}</td>
                    <td>{fmtMinutes(p.response_minutes)}</td>
                    <td>{fmtMinutes(p.resolution_minutes)}</td>
                    <td className="muted">{p.use_business_hours ? 'Business hours' : '24×7'}</td>
                    <td>{p.approved ? 'Yes' : <span style={{ color: 'var(--danger, #c0392b)', fontWeight: 600 }}>Pending</span>}</td>
                    <td className="muted">{p.active ? 'Yes' : 'No'}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {calendar && (
        <div className="grid-2">
          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>Business hours</h3>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {DAY_NAMES.map((name, d) => (
                <button key={d} type="button"
                  className={`btn btn-sm ${calendar.business_hours.days.includes(d) ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => toggleDay(d)}>{name}</button>
              ))}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <label className="field" style={{ flex: 1 }}><span>Start</span>
                <input type="time" value={calendar.business_hours.start}
                  onChange={(e) => saveHours({ ...calendar.business_hours, start: e.target.value })} /></label>
              <label className="field" style={{ flex: 1 }}><span>End</span>
                <input type="time" value={calendar.business_hours.end}
                  onChange={(e) => saveHours({ ...calendar.business_hours, end: e.target.value })} /></label>
            </div>
            <p className="muted" style={{ fontSize: 12.5 }}>
              P3/P4 SLA clocks run only during business hours. P1/P2 run 24×7.
            </p>
          </div>

          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>Holiday calendar</h3>
            <form className="row" style={{ gap: 8, marginBottom: 10 }} onSubmit={addHoliday}>
              <input type="date" required value={holForm.date}
                onChange={(e) => setHolForm((f) => ({ ...f, date: e.target.value }))} />
              <input placeholder="Holiday name" required value={holForm.name} style={{ flex: 1 }}
                onChange={(e) => setHolForm((f) => ({ ...f, name: e.target.value }))} />
              <button className="btn btn-primary btn-sm">Add</button>
            </form>
            {calendar.holidays.length === 0 && <div className="muted">No holidays configured.</div>}
            {calendar.holidays.map((h) => (
              <div key={h.id} className="spread" style={{ padding: '5px 0' }}>
                <span><span className="tnum">{h.date}</span> {h.name}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeHoliday(h.id)}>Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <PolicyModal policy={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); toast('SLA policy saved'); }} />
      )}
    </>
  );
}

function PolicyModal({ policy, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    response_minutes: policy.response_minutes,
    resolution_minutes: policy.resolution_minutes,
    use_business_hours: !!policy.use_business_hours,
    active: !!policy.active,
    approved: !!policy.approved,
  });
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/sla/policies/${policy.id}`, {
        method: 'PATCH',
        body: {
          response_minutes: Number(f.response_minutes),
          resolution_minutes: Number(f.resolution_minutes),
          use_business_hours: f.use_business_hours,
          active: f.active,
          approved: f.approved,
        },
      });
      onSaved();
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  return (
    <Modal title={`SLA for ${policy.priority_code} · ${policy.priority_label}`} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          <label className="field"><span className="req">Response (minutes)</span>
            <input type="number" min={1} value={f.response_minutes}
              onChange={(e) => setF((x) => ({ ...x, response_minutes: e.target.value }))} required /></label>
          <label className="field"><span className="req">Resolution (minutes)</span>
            <input type="number" min={1} value={f.resolution_minutes}
              onChange={(e) => setF((x) => ({ ...x, resolution_minutes: e.target.value }))} required /></label>
        </div>
        <label className="field row" style={{ gap: 8 }}>
          <input type="checkbox" checked={f.use_business_hours}
            onChange={(e) => setF((x) => ({ ...x, use_business_hours: e.target.checked }))} />
          <span>Count business hours only</span>
        </label>
        <label className="field row" style={{ gap: 8 }}>
          <input type="checkbox" checked={f.approved}
            onChange={(e) => setF((x) => ({ ...x, approved: e.target.checked }))} />
          <span>Values are customer-approved</span>
        </label>
        <label className="field row" style={{ gap: 8 }}>
          <input type="checkbox" checked={f.active}
            onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
          <span>Policy active</span>
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save policy'}</button>
      </form>
    </Modal>
  );
}
