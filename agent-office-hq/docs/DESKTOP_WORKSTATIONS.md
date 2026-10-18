# Office HQ — Private desktop browser employees

**Mode:** local computer browser only (Windows, macOS, Linux). This feature does not create or rent a cloud browser. No OAuth developer account is required to **manually sign in to a supported website inside a browser**, though the website itself can restrict automation, demand verification, or deny automated browsers.

## Get started on your actual computer

1. Install Node.js **22 or later** and Git. Download or clone the [Office HQ GitHub repository](https://github.com/Hostkris/Office-HQ). Open a terminal in its `agent-office-hq` directory. The computer must have a visible desktop.
2. Run `npm install` and `npx playwright install chromium` (this installs a browser binary). Browser installation and AI-model installation may consume significant disk space.
3. Run `npm run dev`. Open **http://127.0.0.1:3000/#/workstations** in a browser **on the same computer**.
4. Select a website and click **Open website in desktop browser**. A separate Chrome/Chromium window opens. **You** type your email/password and handle all security/2FA prompts there. Do not enter your passwords or security codes in an Office HQ task form.
5. Select a permitted AI employee, check the owner authorization box and click **Authorize employee**. Each site is limited to departments listed by Office HQ; only one job can control a browser profile at a time. Authorization is stored on this computer, not in Supabase.
6. For manual browsing and owner login, no AI model key is needed. To perform AI-operated screen reading and clicks, choose **one** of the AI engines below. Then assign a job through the workstations page, monitor the thought bubble, and approve or reject proposed high-risk clicks.
7. Click **Pause** to stop at the next safe stopping point. **Resume** after reviewing the browser, or **Revoke worker** to remove one employee's access. **Forget session** explicitly erases that website browser profile and revokes all its employee grants.

## AI option A — an on-computer model, no external AI API key

Install the [Ollama desktop software](https://ollama.com/). Use a vision-capable model, for example:

```sh
ollama pull qwen2.5vl:7b
```

Ollama must be running locally on `http://127.0.0.1:11434`. In **a private `.env` file under `agent-office-hq`** put:

```dotenv
OFFICE_HQ_AI_BACKEND=ollama
OLLAMA_MODEL=qwen2.5vl:7b
```

Then launch `npm run dev:env`. The desktop browser **and** the image reasoning model run on your computer. This requires suitable RAM/CPU/GPU and may be slow; more modest vision models may be necessary on older PCs. Ollama model download does not create a Google/Meta/TikTok developer integration.

## AI option B — hosted model decisions, local browser

Create a private `.env` containing `OPENAI_API_KEY=...` and optionally `OPENAI_MODEL=gpt-4.1-mini`, then run `npm run dev:env`. The browser runs only on your computer; however **screenshots of your logged-in account are sent to the AI service** during assigned tasks. The API service is separate from a ChatGPT subscription and may incur charges. To keep browser screenshots off external AI services, use the on-computer Ollama option.

**Important:** Neither option grants a bot your website password. The browser stores authenticated cookies and session data in a local profile directory `.office-hq-private/profiles/`, readable to programs running under your OS user. Protect your computer account, disk, physical access and malware hygiene. This directory and private `.env` are excluded from Git.

## Features that are implemented

- Preconfigured websites: Google Search, Gmail, Google Calendar, Google Drive, YouTube, Instagram, Facebook, TikTok, X, Shopify, Etsy, iCloud, Chime and Lemonade. A supported website in this list is **not a guarantee of automated login or permitted automation**; site policies and anti-bot checks vary.
- The owner manually signs in in a **visible, locally launched, persistent browser session**. Sessions are separate by Office HQ company and website, with multiple websites capable of opening browser windows.
- The owner can grant a specific active employee permission only for eligible job departments and approved websites, then revoke it. No password/token string is copied into employee data.
- When a model is configured: screenshots, capped AI-selected mouse/keyboard interactions, progress status updates, pause/resume, step limits, and error-handling. The Office HQ animated employee thought bubble reflects real local job progress when the local desktop server is open.
- Buttons, form submissions, posting/sending/saving and ambiguous interactions generally halt for **one-action CEO approval**. Payments, transfers and password/security controls are blocked. iCloud, banking and insurance are observe-only (typing blocked).
- Job summaries can be **handed off** to another eligible authorized employee as a new job. The local workforce task board mirrors the task's status.
- Job records and browser sessions are local. If the computer closes or Node stops, in-progress jobs are **paused** on restart. You must start the runner and manually resume; it will not silently repost the last action.

## Limitations and boundaries

- **No cloud browser.** GitHub Pages shows a setup screen. Actual browser automation runs only from `http://127.0.0.1:3000` on the owner’s computer. A tablet or phone alone cannot run this Playwright/Node process. Do not bind the local process to the public Internet or port-forward it.
- No browser automation is guaranteed for every website. Login flows, provider rules, Captchas, layout changes, account locks, and anti-automation protections may stop or limit a workflow. The software must not defeat security challenges or bypass access restrictions.
- This is a **single-owner desktop prototype**, not a remote multi-user production permission service. Any sufficiently privileged local process could interact with the loopback service. Use OS permissions and keep the machine trusted.
- **No transfer of website passwords to AI workers.** The user logs in manually. Browser cookies exist on local disk. Forget session deletes them for that site.
- **No automatic unattended posting or purchases.** Approval of a single click is possible, but the owner must inspect the live browser, and the site may require additional confirmation. Clicking/type actions are inherently risky on auto-saving websites; use **review only** mode for sensitive content.
- The model sees screenshots of website content it must read; a malicious page may try prompt injection. Agent action allowlists and approval gates reduce (but do not eliminate) risks. Never enter sensitive tasks unless you accept that exposure.
- Employee rights are role/scope limited in the local runner, but the web front end is not an identity provider and this prototype has no strong isolation from a malicious program already running on your computer.
- This workstation does not use the earlier Supabase OAuth gateway. That system remains **optional** and separate for future API-based connections.
- No local job continues while the computer or local service is off. The desktop runner does not automatically restart at login; you start `npm run dev` or `npm run dev:env` again.

## Workflow example

Gmail → choose Customer Service employee → open/login manually → approve employee → assign "Review my latest inbox messages and give a short list of follow-ups" in **Review** mode → see employee's real progress. The employee can hand off its verified summary to another permitted worker as a new task. If a proposed UI button might send something, Office HQ pauses and requires your explicit approval.

**This is not a promise that every site allows the intended action**. A web provider may restrict use of automated software even when you personally own the account.
