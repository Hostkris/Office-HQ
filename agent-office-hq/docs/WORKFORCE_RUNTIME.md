# Office HQ: forty independent AI bot runtimes

The former single Marketing Research bot is now accompanied by a scalable forty-role OpenMausBot adapter. Each of the 40 essential roles gets its own company-specific bot name, department, original exclusive scope and management chain. All bots share one OpenMausBot installation and AI engine; **no separate paid API key, browser session or login is required for each employee**.

## What is real, and what is not yet connected?

- Office HQ now has an actual server adapter for all forty roles: separate role bot provision, owner-approved mapping, role-only draft task dispatch, live job status retrieval, stop command, and CEO review.
- Provisioning builds a company-specific twelve-department, forty-bot OpenMausBot team file and applies it ONLY on the user's explicit local confirmation. No bots are silently installed just by publishing GitHub code.
- Every bot requests **Ask for approval**, **computer Off**, **browser disabled** and **tools.allow=[]**. Inspect the actual OpenMausBot engine settings; some engine types retain privileged native tools despite an empty tool allowlist. Use a restricted/sandboxed model engine rather than one with unguarded shell commands or file access.
- Every employee can submit a formal site/assignment/actions request to the CEO. Approving the request is **policy bookkeeping only**, NOT authorization of the provider account. OAuth, cookies and bank credentials are NOT transferred. No real account read/send/post/edit/transfer/purchase action is implemented in this phase.
- Actual work is **draft only**, based on text explicitly assigned by the CEO. Results go to CEO review and are never marked automatically published or finished in an outside platform.
- An existing local old Marketing bot may remain; it is not silently re-paired or authorized. The former single-bot adapter is retained for compatibility, but use the new forty-role control screen to manage the new runtime.

## Enable the forty bots on the Mac or another supported computer

1. Install **OpenMausBot** and its CLI from the [upstream project](https://github.com/milind-soni/OpenMausBot). Node 24+ and a supported model engine are required. OpenMausBot's engine may require a model/API subscription or local model depending on your provider.
2. Start OpenMausBot and verify `openmausbot doctor --json` on that computer. For a paired desktop, configure OFFICE_HQ_OPENMAUS_TOKEN_FILE as documented in [OPENMAUSBOT_SETUP.md](OPENMAUSBOT_SETUP.md).
3. Update your Office HQ project and start the local server from `agent-office-hq` (`npm install`, `npm run dev`). Browse to http://127.0.0.1:3000/#/openmaus on the **same computer**.
4. **Preview all 40 bots**. This generates a private team file and runs OpenMausBot's `team apply --dry-run`. Preview does not install bots.
5. Only after verifying the proposed configuration, explicitly set OFFICE_HQ_OPENMAUS_PROVISION=1 for your local Office HQ server, restart it and click **Install / update 40 role bots**. Confirm that the real bots appear and have tool restrictions. Provisioning does not prune unrelated teams.
6. In **40 Agent Runtimes**, select an employee and verify the role, company, and scope. Click **Authorize runtime binding** with the explicit checkbox for each employee. Bindings are exclusive and separately revocable.
7. When permissions have been inspected, set OFFICE_HQ_OPENMAUS_SEND=1 locally and restart the server. Select an *existing task assigned to that employee with its matching scope*, check the CEO confirmation, and submit. Real OpenMausBot job status is visible under that employee.
8. Use **Check live status** to see pending approval/completion. Completed drafts automatically enter the existing Office HQ CEO review process. **Stop this job** interrupts a specific active conversation. Revoking a binding refuses while that employee has active jobs; stop first.

## On iPhone or iPad Safari

GitHub Pages has the forty-role roster, templates, setup status instructions and existing Office HQ assignments. Static Safari cannot run the Node backend or OpenMausBot CLI on your Mac. For genuine remote mobile control a **separate authenticated HTTPS pairing/backend** is needed, and is NOT included here; do not expose port 3000 publicly. OpenMausBot itself offers a separately paired phone interface, explained in OPENMAUSBOT_SETUP.md.

## Security and architecture

- Multi-company separation: OpenMausBot bot names include the company ID and role key. Company-specific team files are private under `.office-hq-private/teams`. Team files do not contain tokens or OAuth credentials.
- Source of the 40 roles: the same essential-workforce catalogue from Office HQ's active 12-department policy. No invented cross-department skills are granted.
- **Localhost owner assumption:** the owner-controlled local Node server is not a hardened multi-user authorization service. The browser-supplied company/employee mapping can be impersonated by someone with local machine access. Never expose this HTTP server to networks, even via a tunnel. Secure remote use requires a real login, a trusted server-side identity/employee directory, audited OAuth tokens, and server-side enforcement for every action.
- Tool selectors are **not a full sandbox**. Native shell/filesystem access may remain on Claude/Codex and similar engines; choose an engine that enforces available-tool selection or run the engine in an OS sandbox with no private files or credentials. Prompt instructions do not replace true sandboxing.
- External accounts still require separately implemented, official platform OAuth or a trusted service provider. Approved policy records in Office HQ cannot access them by themselves. For banking, favor read-only aggregation and forbid transfers by default.
- Real CLI output is required before a job is marked completed. An employee avatar's thought bubble follows the returned bot status; animation by itself is never proof of work.

Upstream: https://github.com/milind-soni/OpenMausBot/blob/main/docs/headless-cli.md and https://github.com/milind-soni/OpenMausBot/blob/main/docs/tool-selection.md
