# Agent Reach + Public APIs in Office HQ

This first release has two separate parts. **Public APIs** provides a curated searchable directory of 12 developer services selected from the user-uploaded public-apis/public-apis source snapshot. **Agent Reach** supplies diagnostics on a compatible computer; actual read-only lookup uses the supported upstream command-line tools it helps choose. Neither source grants universal OAuth or access to user accounts.

## Current scope and roles

The Marketing Research Analyst, CMO, Content Creator, Social Media Manager, selected Product specialists and Technology specialists can request a one-time **public** research action. Each request records the exact employee, company, channel, public target, and business purpose. The CEO approves or denies the exact request and must separately click **Run**. Each approval permits one attempt and is consumed upon execution.

Supported real local actions (only after enabling and approving):

- GitHub public repository metadata using the official gh CLI: gh repo view owner/repository --json name,description,url,stargazerCount,visibility
- YouTube public video metadata using yt-dlp --dump-single-json --skip-download for a strictly validated video ID
- Agent Reach installation status using agent-reach doctor --json (diagnostics, not account access)

Other catalog entries are **discovery only**, apart from the separately supported direct public-source lookups explained below. This release does NOT grant or enable access to Facebook, Instagram, X, Reddit, TikTok, Shopify, Etsy, Gmail, iCloud, financial accounts, publishing APIs or browser cookies. Catalog approval is an internal decision to evaluate the provider documentation; it does not install anything or authorize account connection.

## Local setup on your Mac or PC

1. Install Agent Reach from its source repository with Python 3.10+. Its maintainers warn that the package with the same name on PyPI is a different project. A documented source install command is:

    pipx install https://github.com/Panniantong/agent-reach/archive/main.zip

2. Run the safe diagnostic commands. The default does not install external dependencies or modify system settings:

    agent-reach install --env=auto
    agent-reach doctor --json

3. If missing, independently install GitHub CLI or yt-dlp following their own official instructions. A signed-in gh session may be necessary even for some public requests. Complete sign-in directly in GitHub CLI, never via Office HQ.
4. From the agent-office-hq directory, run npm install and npm run dev. Open http://127.0.0.1:3000/#/research on **that same computer**.
5. Choose an active employee and public target; submit a research request; explicitly approve the exact request as CEO.
6. After you verify the local CLI and permission boundaries, restart the local server with OFFICE_HQ_RESEARCH_EXECUTE=1 in its local environment. Click Run for the approved request. This switch does not create recurring jobs or grant any account permission.

## One-click read-only public sources (new Mac tool layer)

Office HQ now includes **three strictly allowlisted, keyless data lookups** independent of Agent Reach and the gh/yt-dlp tools:

- **GitHub public repository metadata** via `https://api.github.com/repos/owner/repo`; eligible Technology/Research employees only.
- **Frankfurter exchange rates** via the public `api.frankfurter.dev` API; eligible Finance/Pricing employees only.
- **Open Food Facts product/barcode records** via the public `world.openfoodfacts.org` API; eligible Product/Inventory/Research employees only.

On the Mac, launch the updated Office HQ backend and visit `http://127.0.0.1:3000/#/research`. Click **Enable keyless public sources** and confirm. This saves one company-scoped permission set for **named, currently active, eligible employees** with restrictive local file permissions. The exact worker must also be authorized in the native Ollama engine, and agent drafting must separately be enabled. Click **Check Mac readiness** to see the actual state of Ollama, dispatch, pairing, and employee bindings. **Revoke source access** disables subsequent lookups for that company. No API keys or browser cookies are collected.

An employee uses one of these sources only when an assignment includes an explicit, recognizable target such as `GitHub public-apis/public-apis`, `exchange rate USD to EUR`, or `barcode 3017620422003`. Office HQ makes a **read-only HTTPS request** to a fixed provider endpoint, passes the returned metadata to the authorized Mac Ollama drafting model as **untrusted source data**, and instructs the worker to identify the source and retrieval date. If the source is not approved, its server fails, or the query is unsupported, **no external result is claimed or fabricated**. A public API grant does not empower arbitrary browsing, logins, social posts, or external changes.

These endpoints can have rate limits, change service policy, or return incomplete third-party content. Keep the final CEO review and independently verify business-critical facts. This is an initial set of real tools, **not** a universal connector installation and **not** permission for all twelve catalog entries.

On iPhone/iPad Safari, GitHub Pages still runs the interface; it does not run local Mac code. Pair the two devices through the existing secure Office HQ device sync after starting the Mac engine. The Mac must remain powered and connected for unattended jobs. The one-click permission screen is intentionally local to that Mac.

## Security

- Never enter OAuth secrets, cookies, bank credentials, passwords or API tokens into the Office HQ research screen.
- Agent Reach's optional Chrome-session and Cookie-Editor routes are explicitly NOT connected to this adapter. The adapter permits no shell script input, arbitrary URL, website login or writing action.
- The local research server only accepts connections from its own computer. Never expose it using a public tunnel, port-forwarding or unsecured reverse proxy. GitHub Pages on iPhone/iPad is a searchable **static directory** and approval planner, not a connected remote execution engine.
- The local approval screen is a single-owner interface, not authenticated multi-user authorization. Production remote operation needs a trusted server-side employee directory, secure authentication, provider OAuth restrictions, and a tamper-evident audit trail.
- Research requests, sanitized results and timestamps are stored locally in .office-hq-private with restrictive file permissions. Provider tools retain their own sessions and are administered separately.
- Read-only public metadata is not proof of posting, emailing, financial execution or other actual business work.

Sources: https://github.com/public-apis/public-apis/blob/master/README.md | https://github.com/Panniantong/Agent-Reach/blob/main/docs/install.md | https://github.com/Panniantong/Agent-Reach/blob/main/docs/README_en.md
