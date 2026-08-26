import { useEffect, useState } from 'react';
import { api, fmtDate } from '../../api';
import { Empty, Spinner } from '../../ui';

export default function Audit() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api('/admin/audit').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Audit trail</h1>
          <p className="sub">Security-relevant and administrative actions (latest 300).</p>
        </div>
      </div>

      <div className="card">
        {!rows ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : rows.length === 0 ? (
          <Empty title="No audit entries yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Detail</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="muted" style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td>{r.actor_name || <span className="muted">—</span>}</td>
                    <td><span className="tnum">{r.action}</span></td>
                    <td className="muted">{r.entity} #{r.entity_id}</td>
                    <td className="muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
