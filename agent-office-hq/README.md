# Agent Office HQ 🏢

## Coding tasks with a real work loop

Open **Coding tasks** in Connections & settings. The first worker supports a bounded
JavaScript/Node repository task: inspect and search approved source, record a plan,
edit a separate checkout, run approved checks, repair failures, and return a diff
and acceptance evidence for independent CEO review.

1. Update Office HQ on your Mac with launcher **1.0.4**. In Department activation,
   authorize a Backend Engineer, Frontend Engineer or Systems Integration Engineer
   and enable approved AI drafts. Coding work uses the same serialized native queue.
2. On the Mac, expand **Set up model & repository permissions**. Enter the name of
   an installed Ollama model (`ollama list`). Office HQ checks `/api/show` for tool
   support, supported context and thinking controls. Choose a context that fits your
   Mac; no larger model is downloaded automatically. This is a separate coding-model
   setting; the existing chat/draft model keeps its configuration.
3. Enter the absolute root folder of a repository already cloned on the Mac. List
   exact readable and editable paths, and one to three check commands. Review the
   repository, pinned commit, files and commands in the Office HQ permission card.
   Only committed source is copied; uncommitted work stays in the original folder.
4. Assign one focused change and up to six acceptance criteria. Review and allow
   that exact task. The worker has 18 model turns, 65 tool calls, a 20-minute limit,
   and at most two repair attempts after its first post-edit check. Checks time out
   after two minutes. A model's written “done” reply cannot complete the task.
5. Inspect the full diff on the Mac and the actual check results and evidence on
   either device. A passing check is evidence, not a guarantee that every behavior
   is correct. CEO approval does not commit, push, merge or publish the changes.
   The result identifies the separate checkout for manual review and continuation.

Supported checks are `npm test`, `npm run test/check/build/typecheck`, and
`node --test` / `node --check` with explicit JavaScript file paths. Tests, scripts,
package configuration and root repository instructions remain read-only in this
first version. Dependencies are not installed in the new checkout. Begin with a
small task whose approved checks work without additional setup. Check commands
execute trusted repository code as your Mac user; the separate checkout and
reduced environment are **not an OS sandbox**. Approve only repositories and
commands you trust. No generic shell, account, credential or publishing tool is
provided to the model.

For phone control, sign into the existing device-sync account on both devices and
use **Refresh Mac status** in Coding tasks to retrieve the Mac's repository grants.
Company names must match; the coding role must already have a Mac sync mapping.
Only the Mac can create a repository grant. The phone can approve a task, request
status, stop work or revoke access. An offline Mac has not applied a queued action.
Coding checks are never automatically replayed after a restart or uncertain result;
review the partial checkout and create a fresh task. Revoking worker/dispatch or
repository permission stops eligible running work and blocks further tool calls.

### Local Ollama coding engine

Coding tasks use a separately approved local Ollama model on the Mac. The model
must be installed and support tool calling. No OpenRouter, Inkling or third-party
cloud coding endpoint is used. Existing saved cloud-provider settings are reset
to local Ollama on the first run of the updated Mac worker, and the worker deletes
the legacy locally saved OpenRouter credential file.

Each task is limited to an approved repository commit, explicit read/edit files,
and the exact owner-approved check commands. Check commands run as your Mac user,
not in an OS sandbox. Every change remains in a separate checkout until the
owner reviews the actual diff and passing check evidence. No automatic commit,
push or publication takes place.

Provider reference: [Ollama tool calling](https://docs.ollama.com/capabilities/tool-calling)
and [Ollama model metadata](https://docs.ollama.com/api-reference/show-model-details).

## Agent website access

[Permission card preview](docs/website-permission-card.jpg)

Open **Agent website access** in the sidebar or Department activation. Enter a
public HTTPS website, name the account profile, describe the task, and select
individual specialists or all 39 agents. The permission card follows the supplied
reference: an Office HQ header and globe, white rounded panel, and **Deny**, **Allow all relevant
sites**, and **Allow for this chat** buttons.

- **Deny** creates no grant. **Allow for this chat** grants the first listed website
  for this conversation, ending when you end the chat, after 24 hours, or when the
  Mac browser service restarts. **Allow all relevant sites** grants only the exact
  website origins explicitly listed, until revoked. Each agent keeps its role scope.
- Use **Open account & sign in** to log into your own account in its visible Mac
  browser. Named profiles isolate Work and Personal accounts for the same website.
  Passwords, cookies and authentication codes stay on the Mac; logins are never
  copied from Safari or sent through device sync. A permission is not a verified login.
- Use **Start approved task** after sign-in. Browser work needs Playwright Chromium
  plus a vision model. The 1.0.4 Mac launcher offers separate optional installation
  of Chromium and local `qwen2.5vl:7b` (several GB). Existing text draft workers keep
  their smaller model. Manual setup remains `npm install`, `npx playwright install
  chromium`, `ollama pull qwen2.5vl:7b`, then launch with
  `OFFICE_HQ_AI_BACKEND=ollama OLLAMA_MODEL=qwen2.5vl:7b npm run dev`.
- Phone decisions and commands travel through the existing authenticated owner-only
  device queue. Select workers already authorized on the Mac. The phone displays
  **Waiting for Mac confirmation** until an actual permission receipt arrives.
  Refresh a request to check its current permissions and recent browser results.
  Revocations sent while the Mac is offline take effect after it receives them.
- Browser workers pause for sign-in, new websites and account changes. Exact
  one-click approvals cannot be reused after the target or approval record changes.
  Revoke a selected agent or the whole request, or end the access conversation.
  Money movement, account-security changes and authentication remain manual.

Custom HTTPS destinations are supported, but individual websites may block browser
control or require verification. Static GitHub Pages cannot run the browser by
itself; the updated, awake Mac and its configured model perform the real work.
Validation uses isolated accounts and controlled model/browser responses, never
live owner credentials or real account changes.


## Department activation, team reports, conversations and recovery

Use the existing Office HQ app; this update preserves its companies, employees,
local records, iPhone layout and public URLs. Update the Mac with the 1.0.4 launcher,
quit an older running Office HQ server if prompted, then reopen Office HQ.app.

1. Open **Department activation**, choose one of the 12 departments, review its
   account connection links, then authorize its active specialists on the Mac.
   That one explicit decision creates separate specialist bindings and paired-device
   mappings for this company. The human CEO is excluded. **Enable approved AI drafts**
   separately. Revoke the department from the same screen to stop its active drafts.
2. Sign into the same secure device-sync account on Mac and iPhone/iPad in
   **Company Messages**. Company names must match and be unique. Phone assignments
   are queued in the existing owner-only cloud table; the running Mac polls every
   12 seconds. Keep the phone web app open for updates and the Mac awake for work.
3. Open **Department teams**, select one department or **All departments**, and
   describe the goal. Each active specialist gets its own scope-limited draft task;
   the 40-position roster has 39 AI specialists plus the human CEO. Ollama processes
   one draft at a time. Both devices reconstruct team progress from task metadata.
4. Only after **every specialist returns an actual draft** does a combined report
   appear in Company Messages with one CEO approval. Read it, approve, or request
   changes. Decisions and results sync through the same private queue. This report
   combines separate contributions; it does not claim that agents independently
   debated, sent messages, published content or changed outside accounts.
5. Use **Ask / chat** in Company Messages to speak with the Executive Assistant or
   a department's available specialist. These are real local Ollama responses,
   relayed through the authorized worker when sent from a phone. Queued questions
   are clearly labeled while the Mac or worker is unavailable.
6. Open **Agent Health** for the actual model check, local dispatch state, sync
   indicator, blocked task errors and native run history. **Fix It** checks model
   availability and resumes eligible interrupted drafts under their original
   approval. The running Mac also checks these automatically. There are at most
   two retries; revoked permissions, stopped jobs, non-transient failures and
   completed work cannot restart. Recovery does not install software, sign in,
   change permissions or run arbitrary repair commands.

The three approved public GET tools remain connected to the same per-worker
permission checks. Gmail, social, payment and other private account actions still
need their own configured connectors and explicit authorization; department
activation does not silently grant them. No new cloud schema or service key is
needed by this update.

Validation includes native execution, team aggregation, revocation, recovery,
Mac/phone queue transitions, browser packaging and WebKit interface tests. Model
and cloud integration tests use controlled responses; physical-device execution
still requires the owner's running, updated and authorized Mac.



## Independent Ollama Mac engine and paired iOS assignments (October 2026)

Office HQ's Mac server now imports the independent draft-only agent engine at
[native-engine/bridge.mjs](native-engine/bridge.mjs), not the legacy OpenMausBot CLI bridge.
The [Mac installer](../mac/install.command) downloads the official Ollama Mac app and
\`llama3.2:3b\` model into private local storage when needed, without requiring
a third-party bot subscription. It asks before installing, requires macOS 14+,
and may download several gigabytes. Source code updates back up existing files.

The [Company Text Thread](https://hostkris.github.io/Office-HQ/#/thread) on Mac
and iPhone/iPad now displays an iPhone-style four-bar indicator. **Green bars mean
both devices have recently completed authenticated queue exchanges**, and gray
bars with a red X mean they have not. A working internet connection alone does
not light the bars. A Mac server running alone does not imply an iPhone is connected.

### One-time pairing
1. Use the iOS **Send to Mac** button to AirDrop
   [Office HQ for Mac](https://raw.githubusercontent.com/Hostkris/Office-HQ/main/downloads/Office_HQ_for_Mac.zip).
2. Download and open the ZIP on the Mac; launch Office HQ.app and approve Ollama/model setup.
3. Open the Mac's local Company Text Thread and expand **Connect devices / manage sync**.
   Sign in with your Secure Cloud HQ account.
4. On Mac, explicitly **Authorize selected employee for synced drafts** for each
   specialist allowed to receive mobile work, then tap **Enable local Ollama drafts**.
5. On iPhone/iPad, open the same Company Text Thread, sign into the **same**
   Secure Cloud HQ account, and send voice/typed assignments. A matching
   company *name* and specialist role must exist on the Mac. Work is queued
   in owner-RLS Supabase until the Mac can safely handle it.

The local Mac service polls the secure cloud queue while running, even if the Mac
browser closes. The iOS Safari app uploads new work and downloads results when
open/foregrounded; a closed iOS web app cannot keep a permanent background connection.
Mac AI generates drafts, not external actions. Work returned for CEO review requires
approval. The sync only transfers assignments/results; it does not automatically
merge whole companies, employee records, account logins, or credentials.
The cloud owner session must be established on each device; the installer
cannot secretly pair the devices.


**GitHub-ready, mobile-friendly, RPG-style multi-business workforce dashboard.** Create separate companies, assign narrowly scoped AI-employee roles, organize projects, review approvals and track manually entered budgets/inventory while animated characters move around a virtual office.

**Lean workforce:** Every new company starts with **40 essential positions across 12 departments**, not 168. The RPG has a separate **HQ Collaboration** room that initially displays 15 distinct specialists from the real roster, plus 12 department-restricted offices; the collaboration room does not give employees wider task permissions. When an older browser workspace opens, additional profiles are archived inside the JSON backup, their unfinished jobs are held for CEO reassignment, and the twelve department heads and reporting lines are updated. Original instructions, original job scopes, and previous completed work remain available. No archived bot receives new permission or a task automatically. Back up from **Settings → Export JSON** before making substantial changes. Browser-local workspaces on other devices require the update on each device; secure Cloud HQ is separate.

**Screenshots:** [Dashboard](docs/images/dashboard.png) · [Animated RPG office](docs/images/rpg-office.png) · [Mobile layout](docs/images/iphone.png)

![Agent Office HQ dashboard preview](docs/images/dashboard.png)

> **Prototype, not an autonomous company.** The dashboard functions as a local, interactive demo. AI drafting only works if you start the optional private Node server with an API key. There are no live sales, account, banking, inventory, social-media or payment integrations. Closing the app stops its browser-only scheduled brief checks. See [Architecture](docs/ARCHITECTURE.md) and [Security](SECURITY.md).

### Living RPG office actions and cleanable CEO threads

The up-to-30 assigned RPG workers per level are drawn slightly larger and always display a **thought bubble, full employee name (shortened on canvas as needed) and job title**. Assigned-but-idle employees animate with different staggered activities: desk movement, standing/stretching, coffee, restroom, lunch and colleague conversations. Up to two workers are away from desks at once; coffee/restroom/lunch stations cannot be crowded by multiple workers simultaneously. **Only manually placed or newly task-assigned workers** take part in this simulation, not the entire 40-person essential directory at once. Every eligible employee can be placed on a floor over time; the 30-seat cap remains.

Each Live RPG floor includes a distinct **CEO office and approval desk**, with an always-visible CEO avatar outside the 10-seat business-worker count. A worker with a matching pending CEO request can walk to that office; tapping the CEO office or its Approvals button takes the owner to real internal approval controls. Thought bubbles that say coffee, chatting or reviewing are **simulation states**, not evidence of external task execution. Handoffs still require existing internal task completion, and connected AI thought updates take precedence while working.

Every **task card and task detail modal** now has a visible × delete action with confirmation. Deleting a task keeps its activity/audit record, rejects any outstanding internal approval tied specifically to that deleted task, and blocks dependent workflow tasks so nothing advances without review. This deletes only locally stored task records, not external activity.

Each in-app **phone message and full company thread message** has a separate × delete action; the full thread also has a **Clear messages** action. Pending CEO request cards retain Approve/Deny buttons directly in both phone and full thread. Removing a pending request through its × requires confirmation and records a **rejection**, not a silent approval or disappearance. This does not send texts or enact real payments.

## Agent Reach + Public APIs integration

The **Agent Reach & Public APIs** screen in the Connections section includes a curated, searchable selection of twelve real providers from the user-supplied Public APIs source repository. It lets a relevant employee ask the CEO for a **documentation review only**—not an OAuth session or external tool access. On a compatible local computer, the separate Agent Reach adapter can diagnose installed channels and execute a strictly read-only **GitHub repo metadata** or **YouTube video metadata** request after explicit one-time owner approval and server opt-in. All account-cookied social networks, bank connections, messaging, publishing, uploads and spending remain unavailable. The public iPhone/iPad GitHub Pages interface cannot run computer-only commands. Read [setup and security](docs/AGENT_REACH_PUBLIC_APIS.md).

## Unified 40-agent OpenMausBot runtime

Office HQ now includes a **shared local OpenMausBot engine that supports a separate AI bot for every one of the 40 essential roles**, with distinct company and role identities. Every one of the 12 departments can preview and provision restricted bot templates, map its unique employees, request internal per-provider approval, dispatch actual draft-only assignments, inspect live task state and stop its own bot conversations. No OAuth, email, social, banking or payment execution is implicitly connected. Provisioning and sending remain individually disabled until the computer owner explicitly enables them locally and approves every action. The public Safari version offers the setup UI but **not live remote backend control**. Read [40 Agent Runtime setup and limitations](docs/WORKFORCE_RUNTIME.md). Existing Marketing Research starter code is retained for compatibility.

## OpenMausBot local agent engine (starter)

Office HQ now includes a **local OpenMausBot CLI bridge** and a touch-friendly Agent Engine setup panel. The first compatible bot is a dedicated Marketing Research agent, explicitly bound to only one Office HQ Marketing employee, with an existing assigned task sent for draft-only execution after owner confirmation. The starter bot configuration requests Ask for approval, computer off, browser off, and limited integration tools. Job sending is **off by default** and requires an explicit local opt-in. This is not an all-department autonomous backend: GitHub Pages shows a setup guide, and OpenMausBot must run on a compatible computer. The bridge now creates a **real, separate OpenMausBot task thread for each owner-approved assignment**, checks its runtime status, displays actual results in Office HQ, routes completed drafts to CEO review and supports an explicit Stop action. Approval-waiting jobs remain pending in OpenMausBot until the owner responds there. RPG and Command Center thought bubbles show engine-reported work rather than fake completion. The submission receipt is not proof of finished work. External account credentials and OAuth sessions are not shared by Office HQ. Follow [OpenMausBot setup and security](docs/OPENMAUSBOT_SETUP.md). Do not publicly expose the localhost server.

## Live RPG Office floors — 30 workers and optional janitor

The **Live RPG Office** provides **30 desk-and-computer stations on every department level**, with a one-time starting group of 15 active employee avatars drawn from the existing company roster. The same selected workers move in the Command Center preview. Removing one from the RPG does not delete their employee record or real assignments, and that worker will not be automatically re-added. Owners can select individual active workers, choose a desk, create named project teams, view one project's staff at a time, and add more levels when needed. **Exactly 30 business workers maximum per level.** Each level has an independent optional janitor, which is visual support and does not use a worker seat.

Creating a standard new Office HQ task (or sequential workflow stage) automatically puts its single assigned specialist at an available desk if that worker was not already placed; historical/sample tasks do not auto-populate the floor. If all levels are full, the task remains assigned but the user is prompted to add another level. A person cannot occupy multiple desks. Completing a genuinely linked and approved internal task animates a brief paper-folder handoff to the next selected worker on that same level, without simulating or implying external website actions. Characters are small and do not wander randomly.

**iPhone/iPad Safari:** All visible floor/project/seat/janitor controls are touch-friendly and the Command Center office preview follows the same placements. See [Live RPG Floor requirements and tests](docs/LIVE_RPG_FLOOR_SPEC.md). No other management, account connection or automation feature was redesigned.


### Shared RPG roster and stable appearance
The **Command Center** now includes a department-level selector and compact **Add to RPG / Remove from RPG** controls. These edit exactly the same placements as the **Live RPG Office** desk list. The 15 starting avatars are placed **only once per company** and never respawn automatically after removal. A new task can still add its assigned specialist when an appropriate department has a free desk. Up to 30 visible staff avatars per department level; the separate janitor and department head station do not consume a desk. Workers have consistent ID-derived skin tones, hair colors and outfit colors, keeping the same look whenever the scene refreshes. Names, complete role titles and changing idle/work thought bubbles remain above the visible workers. Larger 6-by-5 desk maps can be panned in Safari on iPhone or iPad.

## Role-specific editable assignments for the 40 essential employees

The **Assignments** form (from employee profiles, Live RPG office and Command Center, or the task board) offers two separate selectors: **Choose assignment title** and **Choose job description / acceptance criteria**. Each of the 40 essential role specialties includes three prewritten sub-jobs, for **120 active assignment choices** in total. Older specialty templates remain preserved for backup compatibility. The chosen title and success criteria automatically fill fully editable fields. A separate optional **Additional Commands** box saves supplemental instructions without overwriting the default role template. Saved instructions appear when opening a task and are included in local draft context or a configured AI-drafting request.

Each worker profile also starts with the existing official role description, which the owner can edit, extend, save, or restore to the original. Profile edits persist in browser storage; they do not change a worker's official job scope, title, reporting line, approval authority, or permission to access an outside website. Existing employee and task data are preserved. These selectors prepare assignments, not autonomous external website actions.

## Manual Day / Night appearance

Office HQ now has a top-bar **Night Mode / Day Mode** button on both the animated workforce app and Secure Cloud HQ. Tap it to switch any time. It uses the original dark theme by default, and the light theme applies to interface panels, task cards, navigation, and workstations. The choice is saved per browser in localStorage under `office-hq-theme-v1`, separate from company and employee data, and carries between the two Office HQ pages on the same device. The installed iOS app caches `theme.js`; neither the theme switch nor saving the preference grants agents new access or changes account connections. The canvas-style RPG office illustration retains its own artistic palette.

## iPhone and iPad Safari workstations (now included)

**The regular Office HQ website now runs an iOS-specific browser workstation view.** On your iPhone or iPad, open [Office HQ workstations](https://hostkris.github.io/Office-HQ/#/workstations) in Safari. No Mac or cloud browser is needed for **guided work**: first choose a website and sign into your own account in Safari **without selecting or authorizing any employee**. Separately, in the Assign a task panel, choose an eligible employee and explicitly authorize extension access if available, then save guided tasks, pause or mark work complete, and hand off jobs. The mobile page saves job records in the iOS browser and shows assignment status/thought bubbles.

**Critical distinction:** Standard iOS Safari web pages cannot access or control other websites' tabs. To perform any actual per-site page reading or draft field insertion, Apple requires an **installed and authorized Safari web extension**. The repo now contains a least-privilege Safari extension source under `ios-safari-extension/` and the mobile app is prepared to communicate with it. The extension is **source-only and not installed or packaged for App Store/TestFlight yet**. Without that extension, account authorization in Office HQ does *not* give any bot login access; tasks are guided/manual. Even when installed, the current extension is **owner-triggered** only (read visible text or insert your exact draft), not autonomous AI publishing, buying or browsing. Sites and Safari background execution impose further limits. This does **not** require registering an API application with every individual website, but **distribution of the Safari extension** requires Apple's packaging and signing process.

**Instructions and current limits:** [iOS Safari setup](docs/IOS_SAFARI_SETUP.md).

## Local computer browser employees (primary connection method)

**No cloud browser and no developer account for each website required.** The primary **Social & business accounts → Use desktop browser** and **Desktop AI workstations** controls open a *visible local browser* when this app is running on your Windows/Mac/Linux computer through Node and Playwright. You can first log in manually to Gmail, TikTok, Instagram, Shopify, Chime, iCloud, and other supported websites **without choosing an employee**. When you are ready to create a task, open the separate assignment panel, select an eligible employee, confirm owner authorization, and assign the work. The browser login is not verified just because a website window was opened, and owner authorization is not a provider OAuth connection. The task runs only while your own computer is running; if stopped, work resumes manually from a paused state after restarting.

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
| AI workforce | 40 essential company positions, 12 departments and lean reporting lines, role naming, pause/resume positions |
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

