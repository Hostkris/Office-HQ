# Office HQ OpenMausBot local starter

This first release connects the existing Office HQ local Node server to a running OpenMausBot using the upstream openmausbot CLI. It does not copy the OpenMausBot application, nor turn static GitHub Pages into a runtime.

## Before starting

1. On your own Mac, Windows, or Linux computer, install Node 24+, OpenMausBot, a supported AI engine, and the OpenMausBot CLI (npm install -g openmausbot). Start the OpenMausBot desktop app.
2. Run openmausbot doctor --json locally. OpenMausBot listens on local port 8799 by default. Set OFFICE_HQ_OPENMAUS_PORT for its actual local port if different.
If the installed OpenMausBot desktop requires pairing for write/send commands, go to Settings → Phone → Set up a phone, get a one-time pairing code, and on your computer run: openmausbot connect http://127.0.0.1:8799 --code YOUR_ONE_TIME_CODE --out /PRIVATE/ABSOLUTE/PATH/openmausbot-token. Set OFFICE_HQ_OPENMAUS_TOKEN_FILE to the actual absolute path (not the contents). Never upload or paste the token into GitHub. The corresponding openmausbot CLI also supports private token-file authentication per upstream documentation.
3. From the agent-office-hq directory, preview the starter template with: openmausbot team apply openmaus/office-hq-starter-team.json --dry-run
4. Apply with: openmausbot team apply openmaus/office-hq-starter-team.json
5. Inspect this bot inside OpenMausBot. Require Ask for approval, computer Off, browser disabled, no connected-app tools. Do NOT connect Gmail, social media or banking accounts to this starter bot.
6. Start Office HQ locally with npm install followed by npm run dev; open http://127.0.0.1:3000/#/openmaus.
7. Choose one Marketing employee, confirm its scope, and explicitly bind that employee to the Marketing Research bot.
8. Job sending is disabled by default. After checking the actual OpenMausBot restrictions, restart Office HQ with OFFICE_HQ_OPENMAUS_SEND=1 set in your own environment. Review and confirm each draft-only assignment before sending.
9. Use **Check real progress** to read the specific task thread from OpenMausBot. Office HQ will show working, approval-needed, failed, or completed states from the actual backend. Finished draft output is copied into that employee's existing assignment as **CEO review required**, never approved automatically. You can also Stop that specific conversation after explicit confirmation. The actual OpenMausBot conversation remains the authoritative place to answer approval cards.

## Boundaries

- This is local-only. Never deploy server.mjs publicly or expose the unauthenticated localhost HTTP port through a tunnel or port forwarding.
- Safari on iPhone/iPad can view the public static integration setup screen but cannot remotely control the local connector until a separate authenticated HTTPS pairing backend is built.
- Only one Marketing Research bot is provisioned in this starter and may be mapped to exactly one employee at a time. Each assignment gets its own OpenMausBot thread, and tracking survives local server restarts. The existing 12 departments, other employees and assignments are preserved.
- OpenMausBot's default bot permission is Full Access. The team template explicitly requests Ask; inspect the real setting and the capabilities in the OpenMausBot application before enabling send.
- OpenMausBot app connections may be shared between bots. Prompt instructions are not an authorization boundary. Tool selection with allow native:* limits external MCP tools on supported engines, but native tools remain available under their engine's permission framework.
- Revoking the mapping does not interrupt running jobs or revoke an OAuth token. Use the Stop control for tracked threads (or OpenMausBot directly) and revoke OAuth apps separately inside OpenMausBot.
- Local binding metadata only is stored in the git-ignored .office-hq-private directory. No API keys, cookies or session tokens are written by this bridge.
- Source reference: https://github.com/milind-soni/OpenMausBot/blob/main/docs/headless-cli.md. The bridge itself is independently authored and does not copy OpenMausBot code. Respect its core Apache 2.0 and separate enterprise licensing.
