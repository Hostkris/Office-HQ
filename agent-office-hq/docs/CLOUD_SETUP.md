# Office-HQ cloud account setup

## Project

- Supabase project: `wvadoqncgrmfsftefuoy` (US East / Ohio)
- Dashboard: https://supabase.com/dashboard/project/wvadoqncgrmfsftefuoy
- Frontend: https://hostkris.github.io/Office-HQ/cloud.html
- Static site is published by GitHub Actions. This file contains no secrets.

## One required dashboard step: confirm-email redirect

Supabase's default Auth Site URL may be localhost. Before registering an Office-HQ user, open:

https://supabase.com/dashboard/project/wvadoqncgrmfsftefuoy/auth/url-configuration

Set the Site URL to the Cloud HQ URL above. Add that exact same URL to **Redirect URLs**, save, and then register on the Cloud HQ page. The confirm-email link should return to Cloud HQ. Allow a second address only if you intentionally run a development copy.

Go to **Authentication → Providers** to confirm email/password is enabled and to review email confirmation requirements. Do not disable email verification solely to bypass URL configuration.

## Cloud database

An `office_hq_cloud_foundation` migration created:

- `hq_companies`: owner-specific businesses.
- `hq_tasks`: owner-specific task instructions and statuses.
- `hq_approvals`: proposed decisions and approval status, **not** real purchases.
- `hq_messages`: in-app CEO thread records, **not** cellular text messages.

All four tables enforce Row Level Security. Child records include a composite foreign key to the same owner's company. Browser clients use the publishable API key and their own Supabase Auth access token. The public frontend has **no service-role key**.

## Important distinctions

The original Office-HQ `index.html` stays local-first and uses localStorage for the 168-job animated sample workforce and its sample budgets, tasks, and phone drawer. The new `cloud.html` is an independent authenticated cloud workspace. Nothing is automatically imported, nothing is deleted, and there is no migration of the old workforce records yet.

The **service signup links** tab opens Supabase, Google Cloud, Meta, Shopify, TikTok, and other provider sites. Signing in on those sites does **not** grant Office-HQ account access yet. Production authorization requires each provider's OAuth consent flow, restricted scopes, secure server-side credential storage, and audited role checks.

Automatic AI drafting needs separately deployed backend functions and an API key stored only in backend secrets. Automated spends, posting, email sending, and purchases must remain disabled until server-side approval gates and actual provider integrations are tested. Never make real financial decisions based solely on browser-side approval records.

## Verification

- GitHub Actions: `npm test` and `npm run build` from `agent-office-hq/`.
- In Supabase, check Database → Tables to see the four tables and their Row Level Security settings.
- In the website, sign up, confirm email, sign in, create a company, add a task, request/approve a decision, and post a message. Refresh Cloud HQ and verify the records persist.
- Existing local site data must still be present after returning to the animated dashboard.

There is no real Gmail, social, Shopify, Twilio, or payment connection to test yet.
