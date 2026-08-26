import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fmtDate } from '../api';
import { useAuth } from '../auth';
import { Spinner, useToast } from '../ui';
import { KbEditorModal, KbStatusChip } from './Knowledge';

export default function KbArticle() {
  const { id } = useParams();
  const { user, isIT } = useAuth();
  const toast = useToast();
  const [article, setArticle] = useState(null);
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => api(`/kb/${id}`).then(setArticle).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]); // eslint-disable-line
  useEffect(() => { if (isIT) api('/meta').then(setMeta).catch(() => {}); }, [isIT]);

  if (err) return <div className="error-box">{err}</div>;
  if (!article) return <div className="loading-page"><Spinner dark /></div>;

  const canApprove = ['TEAM_LEAD', 'ADMIN'].includes(user.role);
  const act = async (path, okMsg) => {
    setBusy(true);
    try {
      await api(`/kb/${article.id}/${path}`, { method: 'POST' });
      toast(okMsg);
      load();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  const rate = async (helpful) => {
    try {
      const updated = await api(`/kb/${article.id}/rate`, { method: 'POST', body: { helpful } });
      setArticle((a) => ({ ...updated, related: a.related, versions: a.versions, my_rating: helpful ? 1 : 0 }));
    } catch (e) { toast(e.message, true); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="sub" style={{ marginBottom: 4 }}>
            <Link to="/kb">Knowledge base</Link> / <span className="tnum">{article.article_number}</span>
            {' '}· v{article.version}
          </p>
          <h1 style={{ marginTop: 0 }}>{article.title}</h1>
          <p className="sub">
            {article.category_name ? `${article.category_name} · ` : ''}
            By {article.author_name} · Updated {fmtDate(article.updated_at)}
            {article.review_at ? ` · Review due ${article.review_at}` : ''}
          </p>
        </div>
        <div className="row">
          {isIT && <KbStatusChip status={article.status} />}
          {isIT && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>}
        </div>
      </div>

      {isIT && (
        <div className="row" style={{ marginBottom: 14, gap: 8 }}>
          {article.status === 'DRAFT' && (
            <button className="btn btn-primary btn-sm" disabled={busy}
              onClick={() => act('submit', 'Submitted for approval')}>Submit for approval</button>
          )}
          {article.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <button className="btn btn-primary btn-sm" disabled={busy}
                onClick={() => act('approve', 'Article published')}>Approve &amp; publish</button>
              <button className="btn btn-ghost btn-sm" disabled={busy}
                onClick={() => act('reject', 'Returned to draft')}>Return to draft</button>
            </>
          )}
          {article.status === 'PUBLISHED' && canApprove && (
            <button className="btn btn-ghost btn-sm" disabled={busy}
              onClick={() => act('archive', 'Article archived')}>Archive</button>
          )}
        </div>
      )}

      <div className="card card-pad">
        <div className="kb-body">{article.body}</div>
      </div>

      {article.status === 'PUBLISHED' && (
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="kb-rate">
            <span style={{ fontWeight: 600 }}>Was this article helpful?</span>
            <button className={`btn btn-sm ${article.my_rating === 1 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => rate(true)}>Yes</button>
            <button className={`btn btn-sm ${article.my_rating === 0 ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => rate(false)}>No</button>
            <span className="muted" style={{ fontSize: 13 }}>
              {article.helpful_count} of {article.helpful_count + article.not_helpful_count || 0} found this helpful
            </span>
          </div>
        </div>
      )}

      {article.related.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head"><h3>Related articles</h3></div>
          <div className="card-pad" style={{ paddingTop: 0 }}>
            {article.related.map((r) => (
              <div key={r.id} style={{ padding: '6px 0' }}>
                <Link to={`/kb/${r.id}`}><span className="tnum">{r.article_number}</span> {r.title}</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {isIT && article.versions.length > 1 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-head"><h3>Version history</h3></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Version</th><th>Title</th><th>Editor</th><th>Date</th></tr></thead>
              <tbody>
                {article.versions.map((v) => (
                  <tr key={v.id}>
                    <td>v{v.version}</td>
                    <td>{v.title}</td>
                    <td className="muted">{v.editor_name || '—'}</td>
                    <td className="muted">{fmtDate(v.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isIT && meta && <RelatedPicker article={article} onLinked={load} />}

      {editing && meta && (
        <KbEditorModal article={article} meta={meta}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }} />
      )}
    </>
  );
}

function RelatedPicker({ article, onLinked }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);

  const search = async () => {
    if (q.trim().length < 2) return;
    const rows = await api(`/kb?q=${encodeURIComponent(q)}`).catch(() => []);
    setOptions(rows.filter((r) => r.id !== article.id));
  };

  const link = async (relatedId) => {
    try {
      await api(`/kb/${article.id}/related`, { method: 'POST', body: { related_id: relatedId } });
      toast('Articles linked');
      setOptions([]);
      setQ('');
      onLinked();
    } catch (e) { toast(e.message, true); }
  };

  return (
    <div className="card card-pad" style={{ marginTop: 14 }}>
      <div className="row" style={{ gap: 8 }}>
        <input placeholder="Link a related article (search)…" value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()} style={{ minWidth: 260 }} />
        <button className="btn btn-ghost btn-sm" onClick={search}>Find</button>
      </div>
      {options.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {options.slice(0, 6).map((o) => (
            <div key={o.id} className="row" style={{ padding: '4px 0', gap: 8 }}>
              <span className="tnum">{o.article_number}</span>
              <span style={{ flex: 1 }}>{o.title}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => link(o.id)}>Link</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
