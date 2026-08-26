import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from './api';
import { Icon, useToast } from './ui';

// ADVANCED A5: IT Support Assistant (BRD 8.10). The bot troubleshoots using
// the AI engine and only creates a ticket after the user explicitly confirms.

export default function Chatbot() {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hello! I'm the IT Support Assistant. Describe your laptop issue and I'll suggest what to try." },
  ]);
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef();

  useEffect(() => {
    bodyRef.current?.scrollTo(0, bodyRef.current.scrollHeight);
  }, [messages, open]);

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setBusy(true);
    try {
      const r = await api('/ai/chat', {
        method: 'POST',
        body: { messages: next.filter((m) => m.role === 'user').map((m) => ({ role: 'user', text: m.text })) },
      });
      setMessages((m) => [...m, { role: 'bot', text: r.reply }]);
      if (r.ticket_draft) setDraft(r.ticket_draft);
    } catch (e2) {
      setMessages((m) => [...m, { role: 'bot', text: `Sorry — something went wrong (${e2.message}).` }]);
    }
    setBusy(false);
  };

  const createTicket = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      let body = { ...draft };
      if (!body.category_id) {
        const meta = await api('/meta');
        body.category_id = meta.categories[0]?.id;
      }
      const t = await api('/tickets', { method: 'POST', body });
      toast(`Ticket ${t.ticket_number} created`);
      setMessages((m) => [...m, {
        role: 'bot',
        text: `Done — I created ticket ${t.ticket_number} for you. The IT team has been notified; you can track it under My tickets.`,
      }]);
      setDraft(null);
      setOpen(false);
      navigate(`/tickets/${t.id}`);
    } catch (e2) {
      toast(e2.message, true);
    }
    setBusy(false);
  };

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <Icon name="bot" size={18} />
            <b>IT Support Assistant</b>
            <span className="spacer" />
            <button className="btn-icon" style={{ color: '#fff' }} onClick={() => setOpen(false)} aria-label="Close chat">
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="chat-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {draft && (
              <button className="btn btn-primary btn-sm chat-cta" disabled={busy} onClick={createTicket}>
                Yes, create the ticket
              </button>
            )}
          </div>
          <form className="chat-foot" onSubmit={send}>
            <input placeholder="Describe your issue…" value={input}
              onChange={(e) => setInput(e.target.value)} disabled={busy} />
            <button className="btn btn-primary btn-sm" disabled={busy || !input.trim()} aria-label="Send">
              <Icon name="send" size={15} />
            </button>
          </form>
        </div>
      )}
      <button className="chat-fab" onClick={() => setOpen((o) => !o)} title="IT Support Assistant" aria-label="IT Support Assistant">
        <Icon name={open ? 'x' : 'bot'} size={24} />
      </button>
    </>
  );
}
