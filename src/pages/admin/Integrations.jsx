import { useEffect, useState } from 'react';
import { api, fmtDate, timeAgo } from '../../api';
import { Empty, Modal, Spinner, useToast } from '../../ui';

// Admin console for API tokens (S15), the email-to-ticket inbound log (S10)
// and SSO status (S14).

export default function Integrations() {
  const toast = useToast();
  const [tokens, setTokens] = useState(null);
  const [inbound, setInbound] = useState(null);
  const [sso, setSso] = useState(null);
  const [newToken, setNewToken] = useState(null); // {name, token} shown once
  const [nameInput, setNameInput] = useState('');

  const load = () => {
    api('/integrations/tokens').then(setTokens).catch(() => setTokens([]));
    api('/integrations/inbound-email').then(setInbound).catch(() => setInbound([]));
    api('/auth/sso').then(setSso).catch(() => {});
  };
  useEffect(load, []);

  const createToken = async (e) => {
    e.preventDefault();
    try {
      const r = await api('/integrations/tokens', { method: 'POST', body: { name: nameInput } });
      setNewToken(r);
      setNameInput('');
      load();
    } catch (e2) { toast(e2.message, true); }
  };

  const revoke = async (t) => {
    if (!confirm(`Revoke token "${t.name}"? Systems using it will stop working.`)) return;
    await api(`/integrations/tokens/${t.id}/revoke`, { method: 'POST' }).catch((e) => toast(e.message, true));
    load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <p className="sub">API access for external systems, email-to-ticket and single sign-on.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>API tokens</h3></div>
        <div className="card-pad" style={{ paddingTop: 0 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            External systems (e.g. a mail relay posting inbound email) authenticate with the
            <code> X-Api-Token</code> header. Tokens are shown once at creation.
          </p>
          <form className="row" style={{ gap: 8, marginBottom: 12 }} onSubmit={createToken}>
            <input placeholder="Token name (e.g. Mail relay)" required value={nameInput}
              onChange={(e) => setNameInput(e.target.value)} style={{ minWidth: 240 }} />
            <button className="btn btn-primary btn-sm">Create token</button>
          </form>
        </div>
        {!tokens ? <div className="loading-page"><Spinner dark /></div> : tokens.length === 0 ? (
          <Empty title="No API tokens yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Name</th><th>Created</th><th>Last used</th><th>Status</th><th /></tr></thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.id} style={{ opacity: t.active ? 1 : 0.5 }}>
                    <td style={{ fontWeight: 600 }}>{t.name}</td>
                    <td className="muted">{fmtDate(t.created_at)}</td>
                    <td className="muted">{t.last_used_at ? timeAgo(t.last_used_at) : 'Never'}</td>
                    <td>{t.active ? 'Active' : 'Revoked'}</td>
                    <td>{t.active === 1 && (
                      <button className="btn btn-ghost btn-sm" onClick={() => revoke(t)}>Revoke</button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Email-to-ticket</h3></div>
        <div className="card-pad" style={{ paddingTop: 0 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Inbound messages POSTed to <code>/api/integrations/inbound-email</code> become incidents;
            replies containing the INC number thread onto the existing ticket. Connecting a live
            support mailbox requires the customer's mailbox credentials (pending — BRD 16 dependency).
          </p>
        </div>
        {!inbound ? <div className="loading-page"><Spinner dark /></div> : inbound.length === 0 ? (
          <Empty title="No inbound email yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>From</th><th>Subject</th><th>Outcome</th><th>Ticket</th><th>Received</th></tr></thead>
              <tbody>
                {inbound.map((m) => (
                  <tr key={m.id}>
                    <td>{m.from_email}</td>
                    <td className="muted">{m.subject || '—'}</td>
                    <td>{m.status}{m.error ? ` — ${m.error}` : ''}</td>
                    <td className="tnum">{m.ticket_id || '—'}</td>
                    <td className="muted">{timeAgo(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>Single sign-on (SSO)</h3>
        {sso ? (
          sso.enabled ? (
            <p>SSO is <strong>enabled</strong> via {sso.provider}.</p>
          ) : (
            <p className="muted" style={{ fontSize: 13.5 }}>
              SSO is <strong>not yet enabled</strong>. The OIDC integration is built and configuration-driven;
              it activates once the customer confirms the identity provider (Microsoft Entra ID / SAML / OIDC)
              and the <code>OIDC_*</code> settings are supplied (BRD 7.14, BRD 16 Standard dependency).
            </p>
          )
        ) : <Spinner dark />}
      </div>

      {newToken && (
        <Modal title={`Token created: ${newToken.name}`} onClose={() => setNewToken(null)}>
          <p>Copy this token now — it will not be shown again.</p>
          <pre className="tnum" style={{
            padding: 12, background: 'rgba(0,0,0,0.06)', borderRadius: 8,
            userSelect: 'all', overflowX: 'auto',
          }}>{newToken.token}</pre>
          <button className="btn btn-primary" onClick={() => {
            navigator.clipboard?.writeText(newToken.token);
            setNewToken(null);
          }}>Copy &amp; close</button>
        </Modal>
      )}
    </>
  );
}
