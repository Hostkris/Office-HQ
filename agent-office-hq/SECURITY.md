# Security and privacy

**Agent Office HQ is a demonstration and local-first prototype, not an authenticated enterprise business system.**

- The static GitHub Pages / Netlify build intentionally excludes `server.mjs` and all environment settings.
- Do not commit `.env`, passwords, API tokens, customer personal information, real HR files, privileged contracts or confidential records.
- Browser `localStorage` is device- and origin-specific, lacks multi-user access controls, and is removable by clearing browser data. The browser activity log is not tamper-evident.
- The optional Node drafting service listens on `127.0.0.1` by default. **Never bind it to a public host or deploy it publicly as-is.** It does not authenticate clients or enforce enterprise policy server-side.
- The prototype records owner approvals locally. Approval does not transfer money or trigger external actions.
- AI drafts may be inaccurate; review all financial, legal, compliance, health or business-critical content before use.

Before connecting real payment, inventory, marketing or customer systems, add authenticated accounts, per-company server authorizations, audited tool permissions, secure storage and durable human approval gates.


## Desktop browser workstations

- Desktop workstations are **local, single-owner browser automation**, not cloud browsers. The Node process binds only to loopback and checks browser request origins. Keep the computer trusted. Never expose port 3000 publicly or bypass the local-only guard.
- The owner signs in directly to websites. No Office HQ worker receives website passwords. The local Playwright profile still stores session cookies and website data in `agent-office-hq/.office-hq-private/`. Protect your OS account, disk and physical computer access. Delete profiles using **Forget session** when no longer required.
- `.office-hq-private/` and `.env` are excluded from Git. Never upload local profiles to GitHub, cloud backup folders or error reports. Do not share screenshots of sensitive financial or authentication screens.
- Browser workers block known password/OTP, account-security and money-movement actions; ambiguous click actions require owner approval. This is **not a mathematically complete guarantee** against unintended writes on dynamic websites (e.g. automatic saves or malicious page scripts).
- When configured with OpenAI, **screenshots of signed-in websites are sent to the AI provider** while jobs run. When configured with Ollama on loopback, AI screenshot processing stays on the computer, although the websites you visit still communicate with their own servers.
- The browser workforce is a desktop prototype with locally stored, owner-asserted employee grants, not an independently authenticated multitenant RBAC system. Any process already trusted to run as the OS user may affect local state. Do not grant access to untrusted computers.
- Websites may restrict automation or challenge automated browsers. Respect verification, CAPTCHA and account safety flows; do not bypass or evade them.

Report a security vulnerability privately to the repository owner rather than posting credentials or exploit instructions in a public issue.
