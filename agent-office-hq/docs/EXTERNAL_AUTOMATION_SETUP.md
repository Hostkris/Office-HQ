# Office HQ external accounts and autonomous employee operations

## Status (October 2026)

**Account Connection Center and automation workflow planner have been added to the local animated Office HQ.** The center lists Gmail, iCloud, X, Instagram, Shopify, Etsy, TikTok, Lemon8, Chime, Facebook, ChatGPT, YouTube, Google Calendar and Google Drive. Each platform has a **Connection setup** control leading to official guidance, and worker plans can be saved.

**No provider account is connected.** Saved labels are not OAuth grants. Worker approvals and automation plans are currently browser records; planned jobs are explicitly disabled. Neither GitHub Pages nor the local demo's UI can receive events or run durable background agents.

## Design goal

An authorized external event triggers only the specifically delegated worker, who performs allowed actions and reports through their reporting line. The human CEO sets company/account boundaries, grants role/action scopes, and reviews sensitive writes. One department cannot take over another department's role.

Example, Shopify: order webhook -> validate signature and idempotency key -> add a durable queue job -> resolve company and shop -> assign only the operations/fulfillment specialist -> enforce real OAuth scope and company/employee policy -> check stock and order status -> prepare fulfillment and manager update -> CEO checkpoint for gated operations -> write via Shopify API only if approved -> record provider receipt and audit outcome.

Example, Gmail: authorized message change -> verify webhook push source -> normalize message -> create queue job -> customer-support specialist reads via a *read* OAuth scope -> drafts reply -> save and request approval -> send only if employee has *send* scope and external-action approval is confirmed -> persist returned message ID, report to manager. Internal approvals alone are never enough.

## Production integration layers (not shipped yet)

1. **Identity and company isolation.** Sign in to Cloud HQ. Every owner, employee, connection, queue job, policy, activity and credential reference is scoped to a real company/tenant and authenticated owner.
2. **Official provider authorization.** Each provider has its own client credentials, redirects and requested scopes. Use authorization-code flows with PKCE/state where appropriate. Verify callback state, code exchange and connected identity. Do not improvise OAuth URLs.
3. **Private credential vault.** Store encrypted, refreshable provider tokens server-side or in a purpose-built vault. Never store tokens or passwords in static files, localStorage, repository, account labels, approval notes, worker prompts or query strings. Implement token rotation, expiration, revocation, disconnect and auditing.
4. **Real worker permission engine.** A backend checks session, tenant, user, provider grant, provider scopes, authorized employee role, action, resource and approval on **every** call. Treat AI outputs and content from providers as untrusted input. AI workers cannot choose new scopes, elevate roles or authorize themselves.
5. **Durable event and task runner.** Verify signed webhooks or use compliant polling; enqueue deduplicated, persistent events; execute with concurrency limits, timeouts, retries, dead-letter queues, observability and cost budgets. Closing the browser must not halt jobs.
6. **Approval gates and execution receipts.** Explicit CEO approval for publishing, refunds, price changes, outgoing messages, financial actions or spending according to configured policy. Enforce approval expiration and compare action payload against what was approved. Default **no bank transfers/payments** and no automatic financial movement. Track what was really performed with provider operation IDs.
7. **Manager reporting.** Each job posts structured result, evidence, exceptions and audit references to its line manager. Preserve separation between executor, reviewer and auditor.
8. **Testing.** Use sandbox/test accounts, provider API rate limiting, permission-denial tests, webhook replay tests, event retries and fault injection before production.

## Provider considerations

| Platform | Intended connection | Notes |
| --- | --- | --- |
| Gmail | Google OAuth | Google sensitive/restricted scopes may require verification/security review. |
| iCloud | Supported third-party Mail/Calendar/Contacts authorization | No general iCloud OAuth API; app-specific passwords are not to be collected in local UI. |
| X | X OAuth and API access | API availability and paid access vary. |
| Instagram/Facebook | Meta developer app and approved accounts/scopes | Different Page and professional-account limitations. |
| Shopify | App installation and merchant scopes | Prefer narrow per-store permissions; verify webhooks. |
| Etsy | Etsy Open API + OAuth | Etsy API key, PKCE and authorized seller scopes. |
| TikTok | TikTok Login Kit/Content Posting permissions | Posting requirements, reviews and eligible app use cases apply. |
| Lemon8 | Needs provider verification | No general automated connector promised. Local plans remain manual-only. |
| Chime | Potential supported read-only data aggregation | Confirm institution support and user consent; no money movement. |
| ChatGPT | OpenAI API for AI operations, separately | ChatGPT consumer login/subscription does not give programmatic access to personal chats or API quota. |
| YouTube/Calendar/Drive | Google OAuth | Google scopes, quotas and product review differ. |

## Deployment

- The existing **GitHub Pages** website is a static frontend, not a secure OAuth backend.
- The existing **Cloud HQ** is a separate Supabase-authenticated workspace; it currently has companies, tasks, approvals and internal messages. It is not connected to the animated office's local data or account labels.
- To activate an integration, deploy authenticated server-side OAuth start/callback/refresh/revoke endpoints (Supabase Edge Functions or secure equivalents), vault provider tokens, build verified webhook endpoints and queue workers, then add a connection-status endpoint that shows **Connected** only after verifying a provider token/account.
- Implement a protected bridge from animated local Office HQ to Cloud HQ if these views are to operate on shared durable company/worker records. Do not pretend local grants are remotely enforceable.
- Provider apps often require an approved public HTTPS origin, developer registration, platform review, callback URL and a privacy policy. Some integrations may not be available.

**Until those prerequisites are completed:** Connection setup opens guidance, account labels stay disconnected, and workflow plans stay disabled by design.
