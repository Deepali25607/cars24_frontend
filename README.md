# Cars24 ITSM — web client (React + Vite)

## Email channel (email ↔ incident two-way sync)

Emails sent to the support mailbox become incidents, the sender gets an
acknowledgement on the same thread (`RE: <subject> [INC-nnnnnn]`), replies
land in the incident conversation, and every customer-visible update made in
the app (agent comment, pending/resolved/closed/reopened) is emailed back on
that thread. Internal work notes are never emailed.

- **Users** see a "Source: Email" badge, "via Email" comments with the sender
  address, and the composer tells agents whether a reply will be emailed.
- **Admins** manage it under *Administration → Email channel*: enable/disable,
  allowed domains, reopen window, attachment/rate limits, classification
  keywords (with a live classifier test), email templates with placeholders,
  the full inbound/outbound log with filters, and the quarantine / dead-letter
  queue (reprocess, create incident manually, discard, retry).
- **Backend**: `itsm_backend/src/email/*` (parser, thread matcher, classifier,
  pipeline, outbound, queue, IMAP listener). Setup, environment variables,
  Microsoft 365 / Google Workspace configuration, architecture and
  troubleshooting: [`docs/Release/email-channel-guide.md`](../docs/Release/email-channel-guide.md).
- **Tests**: `itsm_backend/tests/email.test.js` with `.eml` fixtures under
  `itsm_backend/tests/fixtures/email/` (`npm test` in `itsm_backend`).

---

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
