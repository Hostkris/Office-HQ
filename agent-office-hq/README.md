# Agent Office HQ 🏢

**GitHub-ready, mobile-friendly, RPG-style multi-business workforce dashboard.** Create separate companies, assign narrowly scoped AI-employee roles, organize projects, review approvals and track manually entered budgets/inventory while animated characters move around a virtual office.

**Screenshots:** [Dashboard](docs/images/dashboard.png) · [Animated RPG office](docs/images/rpg-office.png) · [Mobile layout](docs/images/iphone.png)

![Agent Office HQ dashboard preview](docs/images/dashboard.png)

> **Prototype, not an autonomous company.** The dashboard functions as a local, interactive demo. AI drafting only works if you start the optional private Node server with an API key. There are no live sales, account, banking, inventory, social-media or payment integrations. Closing the app stops its browser-only scheduled brief checks. See [Architecture](docs/ARCHITECTURE.md) and [Security](SECURITY.md).

### Living RPG office actions and cleanable CEO threads

The 10 assigned RPG workers per level are drawn slightly larger and always display a **thought bubble, full employee name (shortened on canvas as needed) and job title**. Assigned-but-idle employees animate with different staggered activities: desk movement, standing/stretching, coffee, restroom, lunch and colleague conversations. Up to two workers are away from desks at once; coffee/restroom/lunch stations cannot be crowded by multiple workers simultaneously. **Only manually placed or newly task-assigned workers** take part in this simulation, not the entire 168-person directory at once. Every eligible employee can be placed on a floor over time; the 10-seat cap remains.

Each Live RPG floor includes a distinct **CEO office and approval desk**, with an always-visible CEO avatar outside the 10-seat business-worker count. A worker with a matching pending CEO request can walk to that office; tapping the CEO office or its Approvals button takes the owner to real internal approval controls. Thought bubbles that say coffee, chatting or reviewing are **simulation states**, not evidence of external task execution. Handoffs still require existing internal task completion, and connected AI thought updates take precedence while working.

Every **task card and task detail modal** now has a visible × delete action with confirmation. Deleting a task keeps its activity/audit record, rejects any outstanding internal approval tied specifically to that deleted task, and blocks dependent workflow tasks so nothing advances without review. This deletes only locally stored task records, not external activity.

Each in-app **phone message and full company thread message** has a separate × delete action; the full thread also has a **Clear messages** action. Pending CEO request cards retain Approve/Deny buttons directly in both phone and full thread. Removing a pending request through its × requires confirmation and records a **rejection**, not a silent approval or disappearance. This does not send texts or enact real payments.

## Live RPG Office floors — 10 workers and optional janitor

The **Live RPG Office** now starts with **10 empty desk-and-computer stations on Level 1**. Employees remain in their existing roles/roster but none appear in the RPG unless the owner places them or assigns new work. Owners can select individual active workers, choose a desk, create named project teams, view one project's staff at a time, and add more levels when needed. **Exactly 10 business workers maximum per level.** Each level has an independent optional janitor, which is visual support and does not use a worker seat.

Creating a standard new Office HQ task (or sequential workflow stage) automatically puts its single assigned specialist at an available desk if that worker was not already placed; historical/sample tasks do not auto-populate the floor. If all levels are full, the task remains assigned but the user is prompted to add another level. A person cannot occupy multiple desks. Completing a genuinely linked and approved internal task animates a brief paper-folder handoff to the next selected worker on that same level, without simulating or implying external website actions. Characters are small and do not wander randomly.

**iPhone/iPad Safari:** All visible floor/project/seat/janitor controls are touch-friendly and the Command Center office preview follows the same placements. See [Live RPG Floor requirements and tests](docs/LIVE_RPG_FLOOR_SPEC.md). No other management, account connection or automation feature was redesigned.

## iPhone and iPad Safari workstations (now included)

**The regular Office HQ website now runs an iOS-specific browser workstation view.** On your iPhone or iPad, open [Office HQ workstations](https://hostkris.github.io/Office-HQ/#/workstations) in Safari. No Mac or cloud browser is needed for **guided work**: select a website, sign into your own account in Safari, assign tasks to existing workers, pause or mark work complete, and explicitly hand off jobs to another employee. The mobile page saves job records in the iOS browser and shows assignment status/thought bubbles.

**Critical distinction:** Standard iOS Safari web pages cannot access or control other websites' tabs. To perform any actual per-site page reading or draft field insertion, Apple requires an **installed and authorized Safari web extension**. The repo now contains a least-privilege Safari extension source under `ios-safari-extension/` and the mobile app is prepared to communicate with it. The extension is **source-only and not installed or packaged for App Store/TestFlight yet**. Without that extension, account authorization in Office HQ does *not* give any bot login access; tasks are guided/manual. Even when installed, the current extension is **owner-triggered** only (read visible text or insert your exact draft), not autonomous AI publishing, buying or browsing. Sites and Safari background execution impose further limits. This does **not** require registering an API application with every individual website, but **distribution of the Safari extension** requires Apple's packaging and signing process.

**Instructions and current limits:** [iOS Safari setup](docs/IOS_SAFARI_SETUP.md).

## Local computer browser employees (primary connection method)

**No cloud browser and no developer account for each website required.** The primary **Social & business accounts → Use desktop browser** and **Desktop AI workstations** controls open a *visible local browser* when this app is running on your Windows/Mac/Linux computer through Node and Playwright. You log in manually to Gmail, TikTok, Instagram, Shopify, Chime, iCloud, and other supported websites, approve a specific employee, and assign a task. The task runs only while your own computer is running; if stopped, work resumes manually from a paused state after restarting.

**Install / launch on your computer:**

```sh
cd agent-office-hq
npm install
npx playwright install chromium
npm run dev
```

Open **http://127.0.0.1:3000/#/workstations** on that same computer, not the public GitHub Pages URL. Website passwords are never collected by the Office HQ forms or passed to employees; logged-in browser session data is retained in a private OS-local directory ignored by Git.

Automatic AI clicking/typing needs an AI model. You can choose a **locally installed Ollama vision model (no developer API key)** or an optional OpenAI API key (account screenshots are then sent to OpenAI during the job). Both modes keep the **browser itself** on your computer. Each job is assigned to an authorized employee, has a time/step cap, shows actual progress in the avatar thought bubble, allows pause/resume, and stops before high-risk clicks for one-action CEO approval. Financial transfers and account-security actions are never automated. Results can be handed off to another authorized employee.

**Read the full guide:** [Desktop workstations setup and restrictions](docs/DESKTOP_WORKSTATIONS.md).

The public GitHub Pages site is a remote-accessible frontend and therefore **cannot** control the browser on your computer. On GitHub Pages the workstation tab displays installation instructions instead of pretending work is running. Browser logins can be blocked by website policies and automated site operation is not guaranteed.

## Account Connection Center and AI employee workflow plans

Open **Social & business accounts** in the animated Office HQ to explore the new interactive connection catalog for Gmail, iCloud, X (Twitter), Instagram, Shopify, Etsy, TikTok, Lemon8, Chime, Facebook, ChatGPT, YouTube, Google Calendar and Google Drive. Select **Connection setup** to see the proper external authorization approach and official provider documentation. You can also save a public account label, request role-specific CEO permission, and assign an inactive, predefined automation plan to one worker in the correct department. Plans include Gmail inbox replies, Shopify orders, Etsy inventory, Instagram/TikTok content and read-only finance reports.

**OAuth server deployed, provider configuration pending.** The Local Office HQ buttons now open the authenticated Cloud HQ Connect accounts screen, which can initiate real provider OAuth after the necessary developer credentials and encryption key are configured. Unsupported providers are explicitly marked unavailable. These controls do not run tasks, publish or move money. Workflow plans remain **Disabled · Not running** and there are **zero live platform connections**. Actual automation requires approved provider developer credentials, OAuth/authorization, a secure backend and vault, verified event intake, server-enforced worker permissions, human approval gates, and a durable job runner. See [External automation setup and limits](docs/EXTERNAL_AUTOMATION_SETUP.md).

## Secure Cloud HQ (Supabase-backed, separate from demo)

The sidebar now includes **Secure Cloud HQ** at `cloud.html`. This page connects to the Office-HQ Supabase project `wvadoqncgrmfsftefuoy` using a **public publishable key** (safe in browser code), while the database enforces owner-only Row Level Security. It supports email/password sign-in, private companies, tasks, owner approval records, and in-app company messages. **No service-role or third-party credentials are in the public frontend.**

**Required owner setup before sign-up:** In [Supabase Auth URL Configuration](https://supabase.com/dashboard/project/wvadoqncgrmfsftefuoy/auth/url-configuration), set your Site URL and allowed Redirect URLs to the GitHub Pages Cloud HQ address:

`https://hostkris.github.io/Office-HQ/cloud.html`

After saving, open that Cloud HQ address and register/sign in with your own email. You may have to confirm your email. The original animated office and seeded sample records remain in the **local browser workspace**. Cloud HQ is a distinct real-data workspace; local example data are **not** silently uploaded or migrated.

**Not yet implemented:** autonomous agents, Gmail inbox actions, Shopify/social posting, ad purchases, real SMS and a shared task backend for the animated dashboard. The new `office-oauth` authorization gateway is deployed, but every provider still requires developer credentials, provider approval, and your consent before a real account can authorize. The Cloud HQ **Connect accounts** page can start official authorization-code flows after provider secrets and an encryption key are configured; its developer links only open legitimate provider portals. A stored approval is not a purchase. Session credentials are held in the current tab's session storage.

More details: [Cloud setup and limitations](docs/CLOUD_SETUP.md).

## Quick start — GitHub Pages (no API key)

1. Download the GitHub-ready ZIP and **extract it**. Create a new **GitHub repository** (for example `agent-office-hq`) and upload the **contents** of the extracted folder into the repository root, including the hidden `.github` folder. Or use `git clone`/`git push` commands shown below.
2. Ensure the default branch is named **`main`**.
3. On GitHub go to **Settings → Pages → Build and deployment → Source → GitHub Actions**. Save the setting.
4. Open the **Actions** tab. Run **Publish GitHub Pages** manually if it did not start on its own. Wait for the successful deployment.
5. Open the public URL, typically `https://YOUR-USERNAME.github.io/agent-office-hq/` (GitHub displays your actual URL in Pages settings).

This publishes the **frontend only** with fully interactive demo screens; no secret key is required or included. Since it saves to browser `localStorage`, your GitHub Pages workspace is separate from any Netlify or local copy.

### Upload with Git commands (alternative)

```bash
cd agent-office-hq-github
# If you created an empty repository on GitHub, substitute its HTTPS URL:
git init
git add .
git commit -m "Initial Agent Office HQ prototype"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/agent-office-hq.git
git push -u origin main
```

**No GitHub account has been connected or repository created by this package.** You control the repository and its visibility. Publishing GitHub Pages from a public repository makes the static code publicly viewable; do not upload private business data.

## Run on your own computer

Requires **Node.js 22+**. No `npm install` is necessary because the project has no third-party runtime dependencies.

```bash
npm test            # Syntax, role permissions, build safety and local server smoke checks
npm run build       # Produce public frontend in dist/
npm run dev         # Run local browser app at http://127.0.0.1:3000
```

### Optional real AI-written drafts (local development only)

```bash
cp .env.example .env
# Edit .env and add your own OPENAI_API_KEY; DO NOT commit it
npm run dev:env
```

Open `http://127.0.0.1:3000`. The drafting model is configured using `OPENAI_MODEL` (default: `gpt-4.1-mini`). Normal API usage charges may apply. If no key is provided, the app uses clearly labeled **local template outputs**, not model-written drafts. The example server is local-only; it has **no login security**, so do not expose it on the public Internet.

## Deploy to Netlify from the same GitHub repository

1. Push the source repo to GitHub.
2. Choose **Add new project → Import an existing project** in Netlify, and connect the GitHub repository.
3. Netlify uses the included `netlify.toml` to run `npm run build` and publish the static `dist/` directory. No environment variables are needed for the demo.
4. Visit the published URL. Updates pushed to GitHub build and redeploy automatically.

Netlify's static build does **not** run the optional Node AI drafting server. Never set `OPENAI_API_KEY` as a public frontend variable or put it in a source file.

## Features currently in the app

| Area | Functions |
|---|---|
| Command center | Company overview, metrics, alerts and animated office preview |
| RPG office | Three floors, moving pixel avatars, click employee for position and open work |
| AI workforce | 52 unique company jobs and reporting lines, role naming, pause/resume positions |
| Projects | Exclusive assignment to a single authorized job owner, tasks and progress tracking |
| Managers | Project manager delegation, daily morning/evening brief templates and status summaries |
| Finance | Manual budget allocations, income/expense records, requests for approval |
| Inventory | Manual SKUs, counts, reorder thresholds, batch and expiry data |
| Controls | Owner approval forms, audit log, local JSON backup and restore |

New companies each get their own simulated workforce. All task permissions and financial records are demo browser-state controls; production applications must enforce access restrictions in a secure server as well.

## What gets published (and what does not)

The script `npm run build` copies only `index.html`, `app.js`, `styles.css`, `sw.js`, `icon.svg`, and `manifest.webmanifest` to `dist/`. It excludes `server.mjs`, `.env`, tests and documentation. The same build is used by GitHub Pages and Netlify. The included GitHub Actions workflows test and publish on changes to `main`.

## Data safety and limits

- The app starts with **fake sample revenue, expenses and inventory**. They are not your real business numbers.
- Data lives in the **current browser and web address only**, with no secure login or sharing across devices.
- Export **Settings → Export all data** for a JSON backup before resetting or clearing your browser data.
- The audit history is viewable/editable within browser storage and is **not a tamper-resistant audit system**.
- Daily briefs run when the app is open; no true background jobs are installed.
- No payments, supplier orders, email sending, ad purchases, transfers or other external actions occur from this version.

For the future authenticated multi-agent service architecture, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). If you make the GitHub repository public, the code is visible; without a separately chosen license, it isn't automatically offered for unrestricted reuse.
