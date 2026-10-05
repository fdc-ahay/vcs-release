# Deploy through VCS

Natural-language requests to deploy, publish, go online, or become publicly
available are equivalent to invoking this command. The project-scoped
`UserPromptSubmit` hook in `.claude/settings.local.json` injects this
command when `vcs wrap claude` detects that intent (user `~/.claude` hooks are
excluded by `--setting-sources project,local`).

Use `vcs-superpowers` for process discipline and `vcs-platform`
(`vcs-platform:vcs-platform` from the project plugin) as the platform source
of truth. Work in the current Git repository and complete this loop; do not
merely report violations:

1. Confirm `origin` is the project's Forgejo HTTP(S) URL. Inspect the app and
   `features.yaml`. For every locally repairable platform gap, edit the project:
   runtime/Dockerfile and `PORT` handling, health and metrics routes,
   observability initialization, rating UI/endpoints/metrics for user-facing apps,
   exact-audience IAP validation, declared integrations, and the Forgejo build
   workflow. Never write `app_id` or GCP credentials into the repo.
2. Install and initialize the exact pinned platform observability client from
   the skill's catalog. Go, Python, Node.js, and browser are supported. Browser
   projects require both browser RUM and server-side metrics; never substitute
one for the other or use an example collector URL. Server binaries resolve
   `OBSERVABILITY_CONFIG_URL` once before client initialization and fall back
   to `OTEL_EXPORTER_OTLP_ENDPOINT`; browser code fetches the backend's
   same-origin public bootstrap and falls back there to `RUM_COLLECTOR_URL`.
   Never expose Secret Manager credentials or the server OTLP endpoint to the browser.
   For projects with sites.yaml, keep the existing monorepo and single deployment.
   Update runtime requirements during this deployment, preserving existing site content.
   Custom domains use Google-managed TLS at the GCP load balancer and retain IAP.
   Visitor identity must come from validated IAP sub. Do not emit identities as
   metric labels. All-time unique counts need durable deduplication and collection
   coverage; never sum daily uniques or invent visits before collection began.
3. Run the runtime's formatter, tests, and production build. Re-inspect the diff
   and keep fixing safe local failures until those checks pass. Never discard,
   overwrite, or stash unrelated user changes.
4. If changes remain, stage only the files needed for this app's deployment and
   commit them with `git commit -m "fix(platform): complete deploy requirements"`.
   Do not amend an existing commit.
5. Push the exact current branch to Forgejo with `git push -u origin HEAD`.
   The VCS credential helper supplies the repository-scoped token; never put a
   token in the remote URL or command arguments.
6. Only after the push succeeds, run `vcs deploy`. Report every phase
   transition and the final URL or the exact remaining blocker. Never `curl`
   the deploys API with a hand-copied key — `vcs deploy` already authenticates
   from local config.

The server's AI QC and deterministic gate remain the final verification. A
failure returns to this completion loop when it can be repaired locally.
