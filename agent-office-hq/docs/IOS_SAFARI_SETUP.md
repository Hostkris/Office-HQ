# Office HQ on iPhone and iPad — Safari browser workstations

## What runs today with no desktop, cloud browser, or developer account

Open **https://hostkris.github.io/Office-HQ/#/workstations** in Safari on your iPhone or iPad.

The iOS page supports:
- The full Office HQ browser-based workforce dashboard and your existing locally saved companies and employees.
- Selecting a personal website and using **Open in Safari** to open its real sign-in page. **You sign in yourself**, including passwords and two-factor codes, directly on that website. Office HQ neither sees nor receives these credentials.
- Giving eligible AI employees named task assignments, saving queued tasks, tracking progress and pausing/resuming them as guided records.
- Confirming work you personally completed and handing an assignment to another eligible employee in your company.

**Guided mode is not autonomous automation.** Without a Safari extension, your website **cannot read or operate another tab** belonging to Gmail, TikTok, Instagram, Facebook, Shopify, Chime, or another unrelated domain. This is a browser security boundary, even if you signed in to both websites. An ordinary website also cannot keep a Node.js/Playwright worker running directly on iOS.

Guided task records are stored locally in the Office HQ site's browser storage. They do not sync to the separate Secure Cloud HQ or to another device and may be lost if Safari storage is cleared.

## Optional Apple Safari web extension (source code included, NOT distributed yet)

To go beyond guided tasks without cloud browser hosting, the repository includes a source-only **Safari Web Extension** under `agent-office-hq/ios-safari-extension/`:

- `manifest.json` — restricted website permissions; no all-sites or cookies permission.
- `office-bridge.js` — connects the Office HQ page to the extension inside Safari.
- `background.js` — checks website/employee permissions, looks up a matching Safari tab and coordinates approved actions.
- `website-agent.js` — can inspect a bounded excerpt of visible website text or insert an owner's exact draft into a currently selected ordinary field **only when explicitly requested**.
- `popup.html` — brief user instructions.

The iOS workstation page detects an installed and authorized extension. If present, a signed-in owner can grant a specific employee access for a selected website, inspect that site's visible text, insert a user-written draft in an ordinary text field, and revoke the worker grant.

**The extension is not installed merely because the code is in GitHub.** Apple distributes iPhone/iPad Safari web extensions through a containing iOS app or Apple's [Safari Web Extension Packager](https://developer.apple.com/safari/extensions/) / App Store Connect workflow. Shipping it to your iPhone or iPad requires Apple-approved packaging, signing and installation, and may require Apple Developer Program membership and review. An extension also needs the user's explicit Safari website permission. The app package and actual on-device testing are **not yet completed**.

Apple documentation: [Safari web extensions](https://developer.apple.com/documentation/safariservices/safari-web-extensions) and [Managing Safari web extension permissions](https://developer.apple.com/documentation/safariservices/managing-safari-web-extension-permissions).

## Limits of the optional extension

This is an early Safari **owner-triggered assistant**, not a fully autonomous AI employee. It does not yet include a vision/language-model planner on iOS, background browser orchestration, or API credential management. It **never attempts** to bypass CAPTCHA, two-factor authentication, provider policies or website protection. Do not presume every website will allow the extension to operate.

- It does not send, publish, delete, pay, purchase, follow, or automatically post.
- The user must separately open/sign into the actual website; Safari handles login cookies.
- Inspect reads only selected visible text (maximum 1,600 characters) from a permitted tab and returns it to the Office HQ tab. It does not read input values or cookies. It can include personal information visible on your screen. Do not use on sensitive private pages without considering this exposure.
- Insert requires explicit user confirmation and only targets an ordinary, non-sensitive text input/textarea. **Some websites may auto-save** draft fields even if the extension doesn't click Send/Save.
- Chime, Lemonade and iCloud are restricted to read-only assistance.
- Safari may pause or suspend background activity when the browser is switched, locked or closed. Running three autonomous bots in different tabs simultaneously on iOS is not supported in this build.
- If the owner switches accounts in the same website, the extension cannot tell which account is active. Check the actual website account before a task; workforce grants are site-based, not verified identities.
- The Office HQ GitHub Pages frontend is **not a secure multiuser authorization server**. Local employees are simulated roles in local storage. Worker permissions stored by the extension are owner-asserted and are not independently cryptographically bound to a website account.

## Roadmap for full iOS personal-account computer use

1. **Package, install and test the iOS Safari extension** using Apple's official workflow and Safari permissions.
2. Add an owner-facing per-tab/site approval screen with account-identity confirmation, audit history, and task controls.
3. Add a properly secured AI reasoning component for screenshot/DOM interpretation that does not expose account contents without permission. An on-device iOS model might eventually be viable on compatible hardware, but has **not** been integrated.
4. Add robust task interruption/restart management, site-specific safe interaction and policy checks, and explicit human approval for potentially consequential actions. iOS background runtime limits and website anti-automation policies still apply.

No cloud browser has been introduced. The previous **computer-local Playwright runner** is still available for Windows/macOS/Linux; the new iOS **guided** mode works in Safari immediately, while webpage manipulation remains extension-dependent.
