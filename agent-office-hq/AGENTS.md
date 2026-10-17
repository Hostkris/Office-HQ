# Notes for coding agents contributing to this repository

This is a local-first static workforce prototype. Do not treat role avatars as independent, continuously running backend agents.

- Preserve one authorized task executor per company + role scope; the project manager delegates across teams but has its own narrowly defined `briefing` scope.
- Keep review/approval independent from task execution, especially for spending, contracts, outreach and inventory purchasing.
- Keep all frontend resources relative so GitHub Pages works under `/repository-name/`.
- Never put provider API keys, customer data or backend configuration in static files or committed `.env` files.
- Do not claim that a button calls an external service unless there is a real approved and tested integration.
- Keep generated publish output in `dist/` and allow only the public asset allowlist from `scripts/build.mjs`.
- Run `npm test && npm run build` after any change. Update README and ARCHITECTURE when capabilities change.
