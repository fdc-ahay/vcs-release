# Agent-driven access requests

Use this workflow for Data Access and VCS Plugins. Run commands yourself; never ask the user to open a terminal. Use the bundled VCS CLI launcher and JSON output. Authenticate through `auth login` when needed. Resolve owner/project from the existing VCS remote; ask only when ambiguous. Never change project selection silently.

1. Inspect current access with `data-access list` or `plugins list`, using `--owner OWNER --project PROJECT --json`. Reuse an existing pending or granted request. Current resources: **datalake BI** (`datalake-bi`) and **Google Ads** (`google-ads`, reports only). If intent is unclear, ask which resource; both require separate requests and grants.
2. Collect the purpose through native question UI. Claude: `AskUserQuestion`; OpenCode: `question`; Antigravity: `ask_question`, when exposed by the host. Claude supports 1–4 questions, each with 2–4 options and automatic free-text Other. Offer a concrete purpose derived from the user's stated app goal plus Cancel; let Other supply a custom purpose. Reuse an explicit purpose already given by the user. Never invent consent, use a generic button label as purpose, or send a request after Cancel. Without a native tool, ask a concise text question and wait for the answer; do not claim a native form appeared. Purpose: 10–2000 characters, no credentials or patient data.
3. Submit the chosen resource with the user's approved purpose:

```sh
vcs data-access request --owner OWNER --project PROJECT --database datalake-bi --purpose "USER-APPROVED PURPOSE" --json
vcs plugins request --owner OWNER --project PROJECT --plugin google-ads --purpose "USER-APPROVED PURPOSE" --json
```

Use argument arrays or correct shell quoting for user text. Missing purpose returns `needs_input` with `form.fields`; render those fields through native question UI, then rerun with the answer. The CLI does not read interactive stdin or submit a blank purpose. A duplicate open request is reused.

4. Track the returned request ID:

```sh
vcs data-access status --owner OWNER --project PROJECT --id ID --wait --timeout 1m --json
vcs plugins status --owner OWNER --project PROJECT --id ID --wait --timeout 1m --json
```

`running` with `access_status=pending` needs human review. Data Access emails designated reviewers; Google Ads needs a VCS administrator in Backoffice → VCS Plugins. Give the returned `web_url`. Agents and API keys cannot approve their own request. `granting` means infrastructure is applying. Poll only within the active session, in bounded waits with progress updates. After a wait times out, preserve the ID and explain that approval is still pending; resume the same ID when the user returns. Never promise background continuation after the agent session ends. Rejected, revoked or failed requests: show the reason and stop; do not automatically resubmit or bypass review.

5. Only `succeeded` / `access_status=granted` permits integration. Inspect the actual app code, configure its backend, and complete the authorized integration:
   - Data Access: use returned connection metadata, project secrets and verified TLS with the trusted BI certificate. For a missing password, run `env request` using names derived from the app code; let the user fill the secure VCS secrets page. Never request passwords in chat or question tools. Use read-only queries, bounded pools and timeouts. Verify a query from the deployed app; a grant alone does not prove database login works. Keep VCS per-project networking; do not add static instance IPs, NAT or public database ingress.
   - Google Ads: read [plugins.md](plugins.md), implement authenticated app-backend calls, then redeploy to receive `VCS_PLUGIN_URL` and secret `VCS_PLUGIN_TOKEN`. Verify a real authorized report. Never put the token in frontend code or substitute personal MCP credentials.

Report request approval and integration verification separately. If deployment is not yet authorized, finish reviewable code and ask only for the missing deployment authorization. Existing authorization remains valid.
