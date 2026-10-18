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

## iOS Safari companion

- The standalone Office HQ site cannot read or operate unrelated Safari websites. iOS guided task assignments are local records only; any claim of completing external work must reflect actual observed action or be marked as owner-confirmed manual work.
- The optional Safari Web Extension exists as **source only** and needs Apple's packaging, installation and per-site user permissions before it can act. It does not read website passwords, cookies, hidden input values, banking credentials or verification codes. Do not install unsigned or unverified extension copies.
- The extension can inspect a bounded excerpt of visible webpage text when explicitly requested; such text may include confidential emails, order details or other private data visible on the page. Only use it with permission from the account owner.
- The extension can insert text into an ordinary selected field; some sites auto-save on typing even when no submit button is clicked. Read-only sensitive services disable insertion. No financial transfers, spending, sending or posting features have been enabled.
- Extension authorization is scoped to a website and an Office HQ employee identity, **not cryptographically to your signed-in account identity**. Confirm the actual account on screen before each action. Browser site policies and iOS background suspension still apply.

Report a security vulnerability privately to the repository owner rather than posting credentials or exploit instructions in a public issue.
