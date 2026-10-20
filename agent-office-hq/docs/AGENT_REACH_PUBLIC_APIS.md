# Agent Reach + Public APIs in Office HQ

This first release has two separate parts. **Public APIs** provides a curated searchable directory of 12 developer services selected from the user-uploaded public-apis/public-apis source snapshot. **Agent Reach** supplies diagnostics on a compatible computer; actual read-only lookup uses the supported upstream command-line tools it helps choose. Neither source grants universal OAuth or access to user accounts.

## Current scope and roles

The Marketing Research Analyst, CMO, Content Creator, Social Media Manager, selected Product specialists and Technology specialists can request a one-time **public** research action. Each request records the exact employee, company, channel, public target, and business purpose. The CEO approves or denies the exact request and must separately click **Run**. Each approval permits one attempt and is consumed upon execution.

Supported real local actions (only after enabling and approving):

- GitHub public repository metadata using the official gh CLI: gh repo view owner/repository --json name,description,url,stargazerCount,visibility
- YouTube public video metadata using yt-dlp --dump-single-json --skip-download for a strictly validated video ID
- Agent Reach installation status using agent-reach doctor --json (diagnostics, not account access)

Everything else from the directory is **discovery only**. This release does NOT grant or enable access to Facebook, Instagram, X, Reddit, TikTok, Shopify, Etsy, Gmail, iCloud, financial accounts, publishing APIs or browser cookies. Catalog approval is an internal decision to evaluate the provider documentation; it does not install anything or authorize account connection.

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

## Security

- Never enter OAuth secrets, cookies, bank credentials, passwords or API tokens into the Office HQ research screen.
- Agent Reach's optional Chrome-session and Cookie-Editor routes are explicitly NOT connected to this adapter. The adapter permits no shell script input, arbitrary URL, website login or writing action.
- The local research server only accepts connections from its own computer. Never expose it using a public tunnel, port-forwarding or unsecured reverse proxy. GitHub Pages on iPhone/iPad is a searchable **static directory** and approval planner, not a connected remote execution engine.
- The local approval screen is a single-owner interface, not authenticated multi-user authorization. Production remote operation needs a trusted server-side employee directory, secure authentication, provider OAuth restrictions, and a tamper-evident audit trail.
- Research requests, sanitized results and timestamps are stored locally in .office-hq-private with restrictive file permissions. Provider tools retain their own sessions and are administered separately.
- Read-only public metadata is not proof of posting, emailing, financial execution or other actual business work.

Sources: https://github.com/public-apis/public-apis/blob/master/README.md | https://github.com/Panniantong/Agent-Reach/blob/main/docs/install.md | https://github.com/Panniantong/Agent-Reach/blob/main/docs/README_en.md
