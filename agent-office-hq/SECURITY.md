# Security and privacy

**Agent Office HQ is a demonstration and local-first prototype, not an authenticated enterprise business system.**

- The static GitHub Pages / Netlify build intentionally excludes `server.mjs` and all environment settings.
- Do not commit `.env`, passwords, API tokens, customer personal information, real HR files, privileged contracts or confidential records.
- Browser `localStorage` is device- and origin-specific, lacks multi-user access controls, and is removable by clearing browser data. The browser activity log is not tamper-evident.
- The optional Node drafting service listens on `127.0.0.1` by default. **Never bind it to a public host or deploy it publicly as-is.** It does not authenticate clients or enforce enterprise policy server-side.
- The prototype records owner approvals locally. Approval does not transfer money or trigger external actions.
- AI drafts may be inaccurate; review all financial, legal, compliance, health or business-critical content before use.

The account connector catalog is *informational*. A provider portal URL is not an OAuth redirect, and storing a public account label cannot give the app access. Do not give automated workers iCloud app-specific passwords, banking credentials, insurance login details or service tokens. For real jobs, require independently validated account consent, strict job scopes, webhook signature checks, token vault storage, provider callbacks, immutable server-side audit events and human sign-off on risky actions. No unattended financial transfers.

Before connecting real payment, inventory, marketing or customer systems, add authenticated accounts, per-company server authorizations, audited tool permissions, secure storage and durable human approval gates.

Report a security vulnerability privately to the repository owner rather than posting credentials or exploit instructions in a public issue.
