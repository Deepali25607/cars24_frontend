import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Empty, Modal, Spinner, useToast } from '../ui';

export const KB_STATUS_LABEL = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Awaiting approval',
  PUBLISHED: 'Published', ARCHIVED: 'Archived',
};

export function KbStatusChip({ status }) {
  return <span className={`chip chip-${status}`}><span className="dot" />{KB_STATUS_LABEL[status] || status}</span>;
}

export function KbEditorModal({ article, meta, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    title: article?.title || '', body: article?.body || '',
    category_id: article?.category_id || '', review_at: article?.review_at || '',
  });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...f,
        category_id: f.category_id ? Number(f.category_id) : null,
        review_at: f.review_at || null,
      };
      const saved = article
        ? await api(`/kb/${article.id}`, { method: 'PATCH', body })
        : await api('/kb', { method: 'POST', body });
      onSaved(saved);
    } catch (e2) {
      toast(e2.message, true);
      setBusy(false);
    }
  };

  return (
    <Modal title={article ? `Edit ${article.article_number}` : 'New knowledge article'} onClose={onClose} wide>
      <form onSubmit={save}>
        <label className="field"><span className="req">Title</span>
          <input value={f.title} onChange={set('title')} required maxLength={200} /></label>
        <label className="field"><span className="req">Article body</span>
          <textarea rows={10} value={f.body} onChange={set('body')} required
            placeholder="Steps, resolution details, screenshots references…" /></label>
        <div className="form-grid">
          <label className="field"><span>Category</span>
            <select value={f.category_id} onChange={set('category_id')}>
              <option value="">—</option>
              {meta.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <label className="field"><span>Review / expiry date</span>
            <input type="date" value={f.review_at || ''} onChange={set('review_at')} /></label>
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save article'}</button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
        {article?.status === 'PUBLISHED' && (
          <p className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>
            Editing a published article creates a new version and returns it to draft for re-approval.
          </p>
        )}
      </form>
    </Modal>
  );
}

export default function Knowledge() {
  const { isIT } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = useState(null);
  const [meta, setMeta] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status && isIT) params.set('status', status);
    api(`/kb${params.toString() ? `?${params}` : ''}`)
      .then(setArticles).catch(() => setArticles([]));
  };

  useEffect(() => { load(); }, [status]); // eslint-disable-line
  useEffect(() => { api('/meta').then(setMeta).catch(() => {}); }, []);

  const pendingCount = isIT && articles
    ? articles.filter((a) => a.status === 'PENDING_APPROVAL').length : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Knowledge base</h1>
          <p className="sub">{isIT ? 'Author, approve and publish support articles.' : 'Self-help articles from the IT team.'}</p>
        </div>
        {isIT && meta && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>New article</button>
        )}
      </div>

      <div className="filters">
        <input placeholder="Search articles…" value={q} style={{ minWidth: 260 }}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn btn-ghost btn-sm" onClick={load}>Search</button>
        {isIT && (
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="DRAFT">Drafts</option>
            <option value="PENDING_APPROVAL">Awaiting approval{pendingCount ? ` (${pendingCount})` : ''}</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        )}
      </div>

      <div className="card">
        {!articles ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : articles.length === 0 ? (
          <Empty title="No articles found"
            hint={isIT ? 'Write the first knowledge article for your team.' : 'The IT team has not published articles matching this search.'} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Article</th><th>Title</th><th>Category</th>
                  {isIT && <th>Status</th>}
                  <th>Helpful</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((a) => (
                  <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/kb/${a.id}`)}>
                    <td><span className="tnum">{a.article_number}</span></td>
                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                    <td className="muted">{a.category_name || '—'}</td>
                    {isIT && <td><KbStatusChip status={a.status} /></td>}
                    <td className="muted">
                      {a.helpful_count + a.not_helpful_count > 0
                        ? `${a.helpful_count} of ${a.helpful_count + a.not_helpful_count}` : '—'}
                    </td>
                    <td className="muted">{timeAgo(a.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {creating && meta && (
        <KbEditorModal meta={meta} onClose={() => setCreating(false)}
          onSaved={(a) => { setCreating(false); navigate(`/kb/${a.id}`); }} />
      )}
    </>
  );
}
