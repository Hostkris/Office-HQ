# Office HQ: one-tap public API permissions

**What actually connects:** Three uncredentialed, read-only providers can be enabled together in **Agent Reach + Public APIs** on the local Mac Office HQ backend:

| Provider | Query | Eligible departments |
| --- | --- | --- |
| GitHub REST (public repositories only) | Owner/repo metadata | Technology, PMO, Marketing, Product |
| Frankfurter | Latest currency exchange rate | Finance, Audit, Operations |
| Open Food Facts | Food product barcode | Operations, Product |

The CEO confirms a batch of **separate employee/provider permissions**. Each grant records the company, specific agent and service. The **Revoke all free API permissions** control disables the company’s grants. No OAuth, token, browser cookie, login, private GitHub repository or paid API is connected by this button.

## Using it

1. Install/update **Office HQ on Mac** and run the local server at `http://127.0.0.1:3000`. The server must remain running for agent execution.
2. Open **Connections & settings → Agent Reach & Public APIs**.
3. Select the company. Press **Enable free read-only APIs** and read the grant summary. Approve the explicit list of three services and eligible workers.
4. Pair the iPhone and Mac through Office HQ secure device sync. Independently authorize the worker for local Ollama drafting and enable draft dispatch on the Mac.
5. From Company Messages, give the employee a specific task such as **Research GitHub repository public-apis/public-apis**, **Find the USD to EUR exchange rate**, or **Look up food barcode 3017620422003**.
6. The Mac fetches limited public facts using an allowlisted GET endpoint, cites the returned source in the AI draft prompt, and returns the resulting draft to your Company Messages/approval process. Public data is never permitted to change the worker’s instructions.
7. Review the draft, request edits, approve or deny it. Permission to inspect public data **does not** authorize publication, payments or external writes.

**Important limitations:** This is *not* a general web browser or universal MCP connection. It won't research arbitrary websites, find live product images, authenticate to Gmail or TikTok, publish a social post, or edit a GitHub repository. Those capabilities require different dedicated tool integrations, sign-in and restricted permissions. An assignment containing no recognizable authorized public query stays a normal local AI draft; the agent must not claim online research happened. A valid grant does not guarantee the external API is reachable.

The Mac backend uses a fixed HTTPS host and typed query parameter for each provider; it rejects arbitrary URLs, redirects, requests for other departments, and missing grants. Secrets stay server-side when future authenticated connectors are added.

### Diagnostics

The Research section displays the count of grants, the three providers, and a **Check Mac connection** control. The service endpoints are localhost-only, protected by existing server same-origin restrictions. The Mac and iPhone must both be signed in and paired for background sync. Without a running local Mac server, the iPhone shows instructions rather than a false connected state.
