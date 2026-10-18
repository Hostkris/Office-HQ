# Live RPG Office — 12 departmental levels and CEO review routing

Office HQ uses the **12 department names already defined in the company's employee-role directory**, not twelve additional or duplicated workforces. Every company now has a departmental office for: Executive Leadership, Operations, Finance & Treasury, Marketing, Technology & IT, People & HR, Sales & Revenue, Legal & Compliance, Audit & Analytics, Project Management, Customer Experience, and Product & Catalog.

## Department levels and managers

| Department level | Existing designated head |
| --- | --- |
| Executive Leadership | Chief of Staff; CEO occupies the separately marked final approval office |
| Operations | Chief Operating Officer |
| Finance & Treasury | Chief Financial Officer |
| Marketing | Chief Marketing Officer |
| Technology & IT | Chief Technology Officer |
| People & HR | Chief People Officer |
| Sales & Revenue | Chief Revenue Officer |
| Legal & Compliance | General Counsel |
| Audit & Analytics | Chief Audit Officer |
| Project Management | Director of Project Management |
| Customer Experience | Customer Experience Director |
| Product & Catalog | Product Director |

A company initially has 12 distinct office levels (one for each department); **each level holds at most 10 manually placed workers**, plus a separate optional janitor. Existing placed staff and custom floors are retained when the structure is introduced. There is **no automatic crowding of office floors**: an employee appears only when manually placed or when a newly assigned task places them in their own department. Staff are not duplicated when assigned multiple tasks. An occupied department floor prompts the owner to free a desk or add an extra level instead of drawing an 11th employee.

## Department-head paperwork

The Live RPG Office now includes a 12-department navigation list showing the office, head, and occupancy. Select any office to view its desks, computer stations, RPG workers, department head room, janitor, staff names, job titles, and changing thought bubbles. The enlarged characters have staggered, simulated idle movements: coffee, lunch, restroom, stretching, standing, short coworker conversations, and visiting the department head's office. The office preserves a **minimum of no visible workers until placed**. Activity bubbles distinguish social/idle simulation from genuine in-progress task records.

Use **Create department-to-CEO routing** to name a work packet, optionally associate it with an existing task, and choose the departments that must review it. Selected heads review in the displayed order, and the last stage is **always Executive Leadership / CEO**. At each department, the owner explicitly clicks **Head reviewed · forward**, which updates the internal packet's stage, timestamps a review log, and briefly animates paperwork arriving at the next office. A linked task cannot leave its first department until that task has truly completed through existing role-specific and approval constraints. A missing/inactive head blocks forwarding. The **final CEO approval** is a pending approval in the existing company text thread and Approvals view, where the CEO can approve or reject. Neither a simulated walk nor clicking an internal route approves a payment, sends email, publishes media, or completes external work.

Each internal task remains owned by a single existing role, with existing budget, human approval, authorization and audit requirements preserved. The routing action represents explicit owner confirmation of internal department review, **not AI independently operating a department or connected website**. The Google/Instagram/TikTok/iOS Safari extension boundaries are unchanged.

## Phone and cleaning up the display

The previous company phone message screen, full company thread, and task board keep their X buttons. Removing a text message affects only the local display. Dismissing a pending approval **rejects** it; it cannot silently grant authorization. Deleting a task first asks for confirmation, records the deletion in the activity history, rejects outstanding task-linked approvals, blocks dependent tasks for review, and now also returns any unfinished department-routing packets linked to that task.

## Technical boundaries

This change adds `department-offices.js` as a separate frontend module, loaded between `office-life.js` and `project-floor.js`. It stores department stages in `state.enterprise.projectFloor.departmentRoutes`, reuses existing employee role data, and does not modify the underlying task execution permission model. A restart of Safari may interrupt an in-progress **visual** animation; internal routing state is saved in the existing Office HQ browser-local workspace. iOS Safari can run the visual simulation but still cannot autonomously operate a signed-in website without a compatible, installed extension and applicable Safari permissions.

## Tests

CI checks: 12 office creation, no duplicated levels after reopening, preserved existing desks, designated department head mapping, ordered internal reviews, one final CEO approval, reject and missing-head safeguards, a task prerequisite that cannot be forwarded prematurely, and a mobile Safari WebKit end-to-end route through the CEO text approval flow.
