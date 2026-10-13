# VCS Plugins for application integrations

VCS Plugins are project-scoped third-party connections. They are separate from this
Claude delivery plugin. First provider: shared FDC Google Ads, read-only reports.

1. Owner requests access in the project's **VCS Plugins** tab with a purpose.
2. VCS administrator grants specific Google Ads Customer IDs in **Backoffice → VCS Plugins**.
3. Redeploy to receive server-side `VCS_PLUGIN_URL` and secret `VCS_PLUGIN_TOKEN`.
4. App backend sends `POST ${VCS_PLUGIN_URL}/google-ads/reports`, with
   `Authorization: Bearer ${VCS_PLUGIN_TOKEN}` and JSON:

```json
{"customer_id":"7704268400","report":"daily","start_date":"2026-10-01","end_date":"2026-10-13"}
```

Use `campaigns` for period totals or `daily` for daily campaign performance.
Dates use the Ads account timezone. Cost is in micros of the account currency.
Response: `{"results": [...], "limited": false}`. Maximum 90 days, 1000 rows,
1000 requests per project per UTC day. If `limited` is true, shorten the date range;
never display partial results as complete totals. Handle 401 invalid token,
403 missing/revoked grant or unauthorized account, 429 quota, 502 Google Ads
failure, and 503 platform unavailability. Do not retry indefinitely.

Keep tokens and requests in the app backend. Check app user authentication and
report permissions before exposing data. VCS project grants do not authorize every
app user. Do not put the token in browser bundles, URLs, logs or source.

Do not add personal OAuth, use the Claude MCP connection as app credentials,
download service-account keys, or request Google Ads write/admin permission.
VCS uses a sandbox service account with separate Read-only access in Google Ads.
OAuth scope `adwords` is not read-only; provider permissions and VCS report-only
endpoints enforce that restriction. Apps cannot change campaigns or budgets.

Revocation stops requests immediately. A replacement grant requires redeployment
and invalidates the previous token. Verify a real authorized report and denied
unauthorized account before claiming the integration works.
