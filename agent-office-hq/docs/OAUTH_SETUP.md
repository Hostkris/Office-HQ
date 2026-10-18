# Office HQ — live OAuth connection setup (October 2026)

## What is deployed

The Office HQ Supabase project `wvadoqncgrmfsftefuoy` now has private OAuth state and token tables protected by RLS, and a deployed HTTPS Edge Function `office-oauth`. The authenticated **Secure Cloud HQ → Connect accounts** page calls the real backend, which starts a provider authorization-code flow **only when configured**. On success it verifies a one-use CSRF state, exchanges a code on the server, resolves the connected account identity and stores encrypted access/refresh tokens in a server-only table. The only information returned to the browser is account metadata. Disconnect removes local credentials.

**Today:** No provider developer credentials or vault encryption key have been configured through this repository. The buttons will correctly return **Developer setup needed**, not an invented login. Provider approvals may impose additional restrictions.

**Authorization only:** This is not yet a live agent job runner. No external API posting, sending email, Shopify fulfillment, money movement or automated bank action is implemented. Access scopes begin read-only wherever possible. Token refresh/background execution, server role policy enforcement, webhook intake, and CEO action approval gates are separate subsequent development stages.

## Setup once (Supabase)

1. In your existing Supabase project dashboard, open **Edge Functions → Secrets** or your deployment's equivalent secrets configuration. Never paste secrets into Office HQ frontend, task descriptions, chat, GitHub files or issues.
2. Generate **32 cryptographically secure random bytes**, encode them with standard or URL-safe base64, and save them as `OAUTH_TOKEN_ENCRYPTION_KEY`. This key is used by AES-256-GCM for third-party tokens; back it up in a secure secrets manager because losing it makes previously stored tokens unreadable. Do not casually rotate it before implementing re-encryption.
3. For each provider below, register your app in its official developer portal. Copy its client ID/key and client secret into **Supabase Edge Function secrets** under the exact names shown below.
4. In each provider developer console, add the exact callback URL:
   `https://wvadoqncgrmfsftefuoy.supabase.co/functions/v1/office-oauth`
   The redirect URI must be HTTPS, without query or fragment. If your provider disallows this callback, that provider cannot be activated until registration is fixed.
5. In Cloud HQ, sign in, **create a Cloud company**, choose **Connect accounts**, select your company, then click **Connect** for the configured provider. The authorization screen is supplied by the *provider*, not by Office HQ.
6. Confirm the connected account appears under your selected company. On disconnect the Office HQ credential is deleted. To revoke provider-side consent as well, use the provider's authorized-apps setting.

## OAuth provider environment variables

| Provider(s) | Secret names | First requested scope |
|---|---|---|
| Gmail, Google Calendar, Drive, YouTube | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OpenID + email and service-specific read-only scope |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | `user.info.basic` |
| X | `X_CLIENT_ID`, `X_CLIENT_SECRET` | `tweet.read users.read offline.access` |
| Etsy | `ETSY_CLIENT_ID`, `ETSY_CLIENT_SECRET` | `shops_r listings_r` |
| Shopify | `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET` | `read_products` |
| Facebook | `META_APP_ID`, `META_APP_SECRET` | `public_profile` |
| Instagram professional | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` | `instagram_business_basic` |

Shopify also requires the store's `*.myshopify.com` domain to begin authorization. X requires a confidential OAuth 2.0 application. Etsy requires PKCE. Meta and TikTok may need app review and account eligibility. Some platforms cannot be connected just by having app credentials; these requirements are enforced by the providers.

## Platforms without a confirmed general-purpose authorization route

- **iCloud:** Sign in with Apple does not grant full iCloud Mail, Drive or Calendar access. No generic iCloud OAuth promise.
- **Chime:** An approved financial-data aggregator and explicit consent would be required for supported read-only information. Do not collect bank passwords or automate transfers.
- **Lemonade insurance:** No verified public consumer OAuth or claims-management API available to this app.
- **Lemon8:** A general approved automation interface is not confirmed.
- **ChatGPT:** Consumer ChatGPT login does not provide access to the private conversation history via OpenAI APIs. API integration requires separately provisioned server-side credentials.

## Backend operations and security

- `POST /functions/v1/office-oauth` with `Authorization: Bearer <Cloud HQ JWT>`, `apikey: <publishable key>`, JSON:
  - `{"action":"status"}`: readiness and unsupported provider reasons, no credentials.
  - `{"action":"start","companyId":"<company-UUID>","provider":"gmail"}`: verify owner, validate configuration and persist time-limited state; return HTTPS provider authorization URL.
  - `{"action":"start","companyId":"<company-UUID>","provider":"shopify","shop":"example.myshopify.com"}`.
  - `{"action":"disconnect","connectionId":"<connection-UUID>"}`: delete owned connection and cascade-delete its encrypted secrets.
- `GET /functions/v1/office-oauth?code=...&state=...` receives provider callback, does not require Cloud HQ session because it validates the single-use stored state. Shopify's callback HMAC is checked.
- State has a 10-minute expiration; callback always consumes it; provider secrets never travel to the frontend; PostgREST only allows authenticated owners to read connection *metadata*.
- Use exact allowlisted provider names. The app only redirects browsers to fixed official provider endpoints. OAuth errors return a status message, not raw tokens.
- OAuth session does **not** grant a virtual employee permission to act. Implement server-enforced worker/role/account policy checks before exposing any agent-facing write endpoints.

## Known follow-up work before launching automated bots

- Scheduled refresh/expiry handling and provider-specific long-lived credentials (manual refresh is supported for Google, Etsy, X and TikTok). Provider-side consent revocation where supported.
- Provider-specific account capability checks and permission/scope upgrades after app review.
- Signed webhooks, durable job queues, retries and idempotency.
- Verified owner/employee authorization and audit logging for every real API action.
- CEO approval gates for sending, posting, refunds, inventory writes and spending.
- Admin monitoring, data retention, rate limits and secure re-encryption key rotation.

Official documentation: [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server), [TikTok Login Kit](https://developers.tiktok.com/docs/en/login-kit-web), [Shopify OAuth](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps), [Etsy PKCE](https://developers.etsy.com/documentation/essentials/oauth2/), [X developers](https://developer.x.com/), [Meta](https://developers.facebook.com/).
