# Office HQ — real connected, autonomous AI workforce (implementation contract)

## Goal

The CEO connects outside business accounts once, grants **specific** company workers a limited scope, and then a server-side task runner performs approved repeatable work when an event or schedule arrives. Example: a Shopify order webhook triggers an inventory worker, who updates the authorized catalog count, then creates a report for the sales manager; a Gmail message triggers a customer-service specialist who classifies the message, drafts a reply, and sends **only under the configured CEO approval policy**. The visual moving office is an interface to verified job progress, not proof an agent has run.

**Current state (Oct 2026):** The local dashboard is an interactive simulation; its account directory saves names and internal approvals only. The Cloud HQ is a separate authenticated Supabase workspace. No outside OAuth, account tokens, webhooks, real posting, sending, store changes, payment actions or background agent execution are deployed. The new Connection Center shows providers and setup steps; clicking them is **not** authorization.

## Production pipeline

1. **CEO chooses a company and connects an account.** OAuth or a provider-approved app installation begins on a HTTPS backend, with state + PKCE where applicable, least-privilege scopes, verified redirect URI and signed-in owner/company context.
2. **Backend verifies the OAuth response** using a single-use state, performs the token exchange privately, and records the validated provider account identity. Tokens are encrypted at rest and **never** put in browser localStorage, frontend JavaScript, logs or GitHub. Use protected Supabase Vault or an equivalent secrets store and strict service-to-service access.
3. **CEO assigns a role** (e.g. Marketing Specialist) to one connected account with explicit allowed actions (read, draft, write, publish, send), limits, budgets, expiry and final-approval rules. Distinct workers never inherit permissions from manager avatars.
4. **Server receives an authenticated trigger** (e.g. verified Shopify webhook or scheduled trigger), deduplicates it and creates a durable job. Every external event's signature must be verified.
5. **Executor checks all gates** on **every tool call**: authenticated company, exact worker role, live token/consent, requested provider operation, permissions, approval requirement, rate/budget limits and request idempotency.
6. **Worker performs the tool action** only if that action is supported by the provider API and approved by CEO policy. High-risk actions (outbound email, publication, spending, refund, sensitive account changes, bank transfers) should default to human confirmation at the specific action/payload level.
7. **Worker records results** (including failure/partial success), external operation ID, timestamps and reason; manager receives a briefing. Never display an unconfirmed success status.
8. **Disconnect, revoke or expire** instantly blocks new work, cancels outstanding actions where possible and invalidates the internal worker grants. Tokens must be revoked with the provider where available.

## Per-platform capabilities and restrictions

| Provider | Authorized integration path | Example role activity | Important restriction |
| --- | --- | --- | --- |
| Gmail | Google OAuth, Gmail API | Review, label and draft; send on allowed approval | Sensitive or restricted Google scopes may require verification / security assessment. |
| iCloud | Provider-supported protocols or limited service integrations | Possible mail synchronization through a separately secured adapter | Sign in with Apple does **not** authorize iCloud Mail/Drive access. Do not present a generic iCloud OAuth button as if one exists. |
| X (Twitter) | X API OAuth and eligible API subscription | Read posts, prepare and publish where allowed | API tier and feature restrictions apply. |
| Instagram | Meta Instagram professional-account API | Professional account publishing, supported insights | Personal-account access and features may be limited; Meta review required for some scopes. |
| Shopify | Shopify custom/public app auth and Admin GraphQL API | Orders, fulfillment support, inventory synchronization | Actual order management only within approved scopes. Distinguish preparing changes from modifying store state. |
| Etsy | Etsy OAuth 2.0 + PKCE | Shop/listing data, inventory tasks | Subject to Etsy app approval, scopes, API terms. |
| TikTok | TikTok Login Kit + Content Posting/Display APIs | Content drafts and eligible publication | Posting product approvals/audit may be required; user control and consent must be preserved. |
| Lemonade | Provider partnership / supported insured-account access if available | Manually recorded insurance renewal reminders | No general-purpose autonomous consumer insurance integration has been established. Never store login/password or silently submit claims. |
| Chime | Verified consent-based financial aggregation if supported | Potential *read-only* reconciliation | No unrestricted bank API or transfer authority for agents. No funds movement. |
| Facebook | Meta Pages API | Approved Page posting and analytics | Requires suitable Page permissions and possible app review. |
| YouTube | Google OAuth / YouTube APIs | Channel drafts, uploads and supported analytics | Google scopes and upload/analytics API limits apply. |

## Security / separation of powers

- CEO sets broad policies and authorizes specific operations. Managers can assign work only to subordinate role scopes; they cannot circumvent CEO controls.
- An agent must not create its own role grant, approve its own spending or modify immutable audit trails.
- Read-only operations may be scheduled when supported; write actions require a narrow, explicit permission; customer-facing messages, postings and financial actions need a suitable approval gate.
- Jobs and grants are company-scoped, idempotent, logged server-side, and resilient to retries; unsuccessful API actions must be reported as errors, not completed.
- Webhooks carry untrusted external text; tool calls must not follow instructions contained inside email bodies, comments, order notes or attachments.
- Worker task bubbles display actual server states (queued, running, awaiting approval, succeeded, failed) and the last validated step, never invented progress.
- Protect personal banking and insurance records with additional access restrictions. Human review is the default for account-related decisions.

## Implementation phases

**Phase 1 — Discovery UI (present in this PR):** provider directory; actual provider requirements; manual labels and existing internal CEO grant screens remain clearly marked as not connected.

**Phase 2 — Authenticated backend:** Supabase metadata schema (draft migration: `supabase/office_hq_agent_pipeline.sql`), tested token vault, server-authorized grant APIs and signed callback routes for one chosen provider, initially Gmail or Shopify. Never expose service-role credentials in static GitHub Pages.

**Phase 3 — Real task execution:** provider adapters, event verification, persistent queue + retries, worker tooling and differentiated CEO approval gates; e2e tests that deliberately deny unauthorized work.

**Phase 4 — Reporting:** connect the server job states to the animated avatars and manager dashboards. Add CEO emergency stop, per-provider pause/disconnect and complete audits.

## Required to turn on the first real platform

- Developer account and accepted integration permissions for that platform.
- Stable production HTTPS domain and exact redirect URLs.
- Secure backend runtime and secret management.
- CEO sign-in and provider consent (Office HQ cannot authorize other people's accounts by itself).
- Explicit action policy: what work may occur automatically, what must be approved, and appropriate risk limits.
- Integration security review and tests before any outbound posting, order changes or sending.

A `connected` badge may only be shown after the server verifies provider authorization. A `task complete` badge may only be shown after the provider confirms the action.
