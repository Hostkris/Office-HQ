# Live RPG Office — owner-selected project floors

**Updated requirements (October 2026).** This clarifies and supersedes the earlier project-floor planning document where it said that task creation should *never* auto-place an employee. The owner now expressly wants new assignments to make their selected worker appear in the **Live RPG Office**, but does **not** want default random staff visible.

## Required experience

- A fresh Live RPG Office starts with **10 vacant desk-and-computer stations**, zero visible AI employees, and no wandering. Existing workforce roster and sample tasks remain stored without being auto-rendered.
- The owner can choose a floor, select an existing active employee, choose a particular numbered desk (1–10), and place that person. Only placed employees are animated. The Command Center's existing office preview reflects the same assignments.
- When the owner assigns a **new normal Office HQ task** or a workflow stage to a specialist, the responsible employee automatically pops into an empty desk on the appropriate company floor if not already present. This automatic placement applies only to newly assigned work. Previously seeded or historical tasks do **not** silently populate the empty office. Employees do not get duplicated if assigned several tasks.
- Each floor has a hard cap of **10 business workers**. If the selected floor is full, the system may use another already-created floor with room. If all floors are full, the job remains properly assigned but the system tells the owner the office floor is full; no eleventh worker is drawn. Additional floors are created explicitly with **Add level**.
- Each floor has an **optional janitor**, switched on/off by the owner and drawn independently as a support role. The janitor does not count against the 10 business-worker maximum, appear in the ordinary employee roster or execute a business task. Each floor maintains its own janitor setting.
- The owner can build named **project groups**, manually choose employees and place them into their designated desk stations; filtering to a project hides other placed agents without removing their placements.
- An employee may only occupy one desk across levels of a company at any time. Manual removal never deletes the employee profile, tasks, approvals or browser-account permissions.
- Sprite sizes are small relative to the room. Desks, monitors, chairs and aisles stay visible. Employees can type subtly when stationary, but there is **no random wandering or continuously moving crowd**.
- When an **actual** stage/task A finishes through existing task completion and approval checks, and a linked task B belongs to another worker **on the same floor**, show a real visual animation: agent A leaves their desk, walks to B, gives over a paper folder, then returns. This event is animation of an **internal task completion**—not evidence that an email was sent, social post published or browser controlled.
- Keep current employee-role restrictions (one accountable task owner), browser integrations, approval gates, company accounts, inventory, budgets, reports, and all other UI unchanged.
- The same staff placement, janitor toggle, team selection and 10-worker limit must work in **iPhone/iPad Safari** as well as desktop browsers. Touch controls must supplement tapping the canvas.

## Code paths

The narrow implementation is in `agent-office-hq/project-floor.js`. The existing `app.js` delegates only its Live RPG `renderOffice` and `startOffice` to the module, invokes the task hooks on new task assignments/completions, and adds its existing `workerModal` to the bridge. Existing `office-features.js` workflow creation invokes the new-assignment hook. CSS uses `.pf-` scoped selectors. The static build and service-worker cache include the module.

Persist floor/project records under `state.enterprise.projectFloor`, preserving the existing `agent_office_hq_v1` key and `version:1`. Company-level arrays consist of `floors` (companyId, ID, name, 0–10 placements, janitor boolean), `projects` (companyId, ID, name, members, taskIds), and `selected` view IDs. Old workspaces are non-destructively initialized with empty placements; no auto-migration of existing 21-worker sprites.

## Acceptance checks

- Fresh office and old workspace: **0** visible workers; 10 empty desks.
- Assign a new task to specialist A: **A appears** at an available seat; a second assignment to A does not duplicate them.
- Manually place staff B through J: no more than 10 on a level. Eleventh attempted placement is refused without losing tasks.
- Toggle janitor on/off: exactly one optional support character appears/disappears; business seat count unchanged.
- Add another level: new level begins empty; earlier floor remains unchanged. Janitor toggles independently.
- Create Project 1 and Project 2: Project 1 view draws only its assigned people; project filtering does not erase placements.
- Finish task A and link A→B: paperwork handoff animates only on a genuine completion/approval and only where both assigned workers are placed; external account operations remain untouched.
- Inspect a worker sprite: existing employee profile/tasks open. Tap empty desk: matching desk is selected.
- iOS Safari: placement form, worker selection, floor selection and janitor toggle work on touch.
- CI: `npm test`, static `npm run build`, and WebKit tests pass. Refresh caching includes `project-floor.js`.

**Scope boundary:** No cloud browser, App Store packaging, unauthorized account automation, task execution changes or broader app redesign is part of the Live RPG correction.
