import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, Icon } from '../ui';

export default function NewTicket() {
  const navigate = useNavigate();
  const toast = useToast();
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  const [form, setForm] = useState({
    title: '', description: '', category_id: '', subcategory_id: '',
    priority_id: '3', asset_id: '', location_id: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => { api('/meta').then(setMeta).catch((e) => setErr(e.message)); }, []);

  const subs = useMemo(() => {
    if (!meta || !form.category_id) return [];
    return meta.subcategories.filter((s) => s.category_id === Number(form.category_id));
  }, [meta, form.category_id]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const ticket = await api('/tickets', {
        method: 'POST',
        body: {
          title: form.title,
          description: form.description,
          category_id: Number(form.category_id),
          subcategory_id: form.subcategory_id ? Number(form.subcategory_id) : null,
          priority_id: Number(form.priority_id),
          asset_id: form.asset_id ? Number(form.asset_id) : null,
          location_id: form.location_id ? Number(form.location_id) : null,
        },
      });
      const file = fileRef.current?.files?.[0];
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        try {
          await api(`/tickets/${ticket.id}/attachments`, { method: 'POST', formData: fd });
        } catch (upErr) {
          toast(`Ticket created, but the attachment failed: ${upErr.message}`, true);
          navigate(`/tickets/${ticket.id}`);
          return;
        }
      }
      toast(`Ticket ${ticket.ticket_number} created`);
      navigate(`/tickets/${ticket.id}`);
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  if (!meta) return null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Report an issue</h1>
          <p className="sub">Tell us what's wrong — the more detail, the faster the fix.</p>
        </div>
      </div>

      <div className="card card-pad" style={{ maxWidth: 760 }}>
        {err && <div className="error-box">{err}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span className="req">What's the problem?</span>
            <input value={form.title} onChange={set('title')} maxLength={140} required
              placeholder='e.g. "Laptop battery drains within an hour"' />
          </label>

          {/* ADVANCED A5: AI classification suggestion (BRD 8.7) — advisory only */}
          {(form.title.trim().length > 6 || form.description.trim().length > 12) && (
            <div className="row" style={{ marginBottom: 10 }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={async () => {
                try {
                  const s = await api('/ai/classify', {
                    method: 'POST', body: { title: form.title, description: form.description },
                  });
                  if (!s.category) return toast('No confident suggestion — please pick a category manually', true);
                  setForm((f) => ({
                    ...f,
                    category_id: String(s.category.id),
                    subcategory_id: s.subcategory ? String(s.subcategory.id) : '',
                    priority_id: String(s.priority_id),
                  }));
                  toast(`Suggested: ${s.category.name}${s.subcategory ? ` / ${s.subcategory.name}` : ''} · ${s.priority_code}`);
                } catch (e2) { toast(e2.message, true); }
              }}>
                <Icon name="sparkle" size={13} /> Suggest category &amp; priority
              </button>
            </div>
          )}

          <div className="form-grid">
            <label className="field">
              <span className="req">Category</span>
              <select value={form.category_id} required
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value, subcategory_id: '' }))}>
                <option value="">Choose…</option>
                {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Subcategory</span>
              <select value={form.subcategory_id} onChange={set('subcategory_id')} disabled={!subs.length}>
                <option value="">{subs.length ? 'Choose…' : 'Pick a category first'}</option>
                {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>

            <label className="field">
              <span className="req">How urgent is it?</span>
              <select value={form.priority_id} onChange={set('priority_id')}>
                {meta.priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} — {p.label}: {p.description}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Which laptop?</span>
              <select value={form.asset_id} onChange={set('asset_id')}>
                <option value="">Not laptop-specific</option>
                {meta.myAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.asset_tag} — {a.manufacturer} {a.model}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Where are you?</span>
              <select value={form.location_id} onChange={set('location_id')}>
                <option value="">My usual location</option>
                {meta.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Attachment (screenshot, log, photo…)</span>
              <input type="file" ref={fileRef}
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.zip" />
            </label>
          </div>

          <label className="field">
            <span className="req">Describe what happened</span>
            <textarea value={form.description} onChange={set('description')} required rows={6}
              placeholder={'What were you doing when it happened?\nWhat did you expect, and what happened instead?\nAny error messages?'} />
          </label>

          <div className="row">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit ticket'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
            <span className="muted" style={{ marginLeft: 'auto' }}>
              <Icon name="clock" size={13} /> Typical first response: same business day
            </span>
          </div>
        </form>
      </div>
    </>
  );
}
