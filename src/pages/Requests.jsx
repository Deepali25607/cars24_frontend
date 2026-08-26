import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, timeAgo } from '../api';
import { useAuth } from '../auth';
import { Empty, Spinner } from '../ui';

export const REQ_STATUS_LABEL = {
  SUBMITTED: 'Submitted', PENDING_APPROVAL: 'Awaiting approval', APPROVED: 'Approved',
  REJECTED: 'Rejected', IN_FULFILLMENT: 'In fulfillment', COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export function ReqStatusChip({ status }) {
  return <span className={`chip chip-${status}`}><span className="dot" />{REQ_STATUS_LABEL[status] || status}</span>;
}

export default function Requests() {
  const { user, isIT } = useAuth();
  const navigate = useNavigate();
  const canApprove = ['TEAM_LEAD', 'ADMIN'].includes(user.role);
  const [scope, setScope] = useState(canApprove ? 'approvals' : isIT ? 'fulfillment' : 'my');
  const [rows, setRows] = useState(null);

  useEffect(() => {
    setRows(null);
    api(`/requests?scope=${scope}`).then(setRows).catch(() => setRows([]));
  }, [scope]);

  const tabs = [
    ['my', 'My requests'],
    ...(canApprove ? [['approvals', 'Approvals']] : []),
    ...(isIT ? [['fulfillment', 'Fulfillment']] : []),
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Service requests</h1>
          <p className="sub">Catalog requests, approvals and fulfillment.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/catalog')}>New request</button>
      </div>

      <div className="filters">
        {tabs.map(([key, label]) => (
          <button key={key} className={`btn btn-sm ${scope === key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setScope(key)}>{label}</button>
        ))}
      </div>

      <div className="card">
        {!rows ? (
          <div className="loading-page"><Spinner dark /></div>
        ) : rows.length === 0 ? (
          <Empty title="No requests here"
            hint={scope === 'approvals' ? 'Nothing is waiting for your approval.' : 'Browse the service catalog to raise a request.'} />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Request</th><th>Item</th><th>Requester</th>
                  <th>Status</th><th>Group</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/requests/${r.id}`)}>
                    <td><span className="tnum">{r.request_number}</span></td>
                    <td style={{ fontWeight: 600 }}>{r.item_name}</td>
                    <td className="muted">{r.requester_name}</td>
                    <td><ReqStatusChip status={r.status} /></td>
                    <td className="muted">{r.group_name || '—'}</td>
                    <td className="muted">{timeAgo(r.updated_at)}</td>
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
