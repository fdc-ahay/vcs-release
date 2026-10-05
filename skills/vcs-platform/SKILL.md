---
name: vcs-platform
description: Conventions for code that will deploy to the Vibe Code Store platform. Use when writing or reviewing an app that runs on this platform — database access, caching, observability, or a user-facing rating prompt.
---

# Writing for the VCS platform

Extracted from `docs/deployment-spec.md` in the vcs-web repo. Do not edit this
file: regenerate it with `make skill-bundle`.

Each rule below is enforced at deploy time, so an app that ignores one does not
fail at review — it fails at the gate, after the work is done.

**Never write an app_id into a config file in the repo.** It is assigned when
the project is registered, and an app that names its own id can bill its costs
to a different project.

## 3. Postgres is schema-per-project

One database, one schema per project, and the project's role may touch only its
own schema. Not database-per-project (connection and backup cost per tenant),
not shared-schema-with-a-tenant-column (one missing `WHERE` leaks everything).

## 4. The observability library is required

Installed and initialised before the deploy gate passes, not after. Verified by
the pipeline actually observing metrics arrive — an import that compiles proves
nothing about a metric that never ships.

### Supported runtime client catalog

All four adopted runtimes now have released clients. `/deploy` installs the
exact immutable tag, commits the dependency declaration and lockfile (or the
vendored browser asset), initializes one client per process/application, and
then exercises `/metrics` or the RUM transport. It must not report Python,
Node.js, or browser support as unpublished.

Server clients use the registered project identity (`VCS_APP_ID`), the deployed
environment (`APP_ENV`), the injected public identity (`APP_DISPLAY_NAME`,
`APP_DESCRIPTION`, `APP_PUBLIC`, `BUILD_SHA`, `GIT_COMMIT`) that reaches
dashboards through `app_build_info` rather than any hardcoded service list,
tier `T3` under the current fixed deployment policy,
and `push` transport on Cloud Run when an OTLP endpoint is configured. Local
development may keep `scrape` when no OTLP endpoint resolves. Framework
adapters are installed exactly once and before application routes. Keep labels
bounded and free of credentials, request bodies, user ids, email, phone numbers,
NIK, raw URLs, and other PHI.

### Observability configuration bootstrap

The OTLP destination is runtime configuration, never a checked-in localhost or
example URL. Before initializing any server client, the application performs
this resolution once during startup:

1. When `OBSERVABILITY_CONFIG_URL` is non-empty, fetch it with a bounded
   startup timeout. The successful JSON contract is
   `{"otlp_endpoint":"https://...","rum_collector_url":"https://..."}`.
   The platform config service may resolve those values from Secret Manager;
   the application receives endpoint values, not a Secret Manager credential.
2. If the request fails, returns a non-2xx status, is malformed, or omits
   `otlp_endpoint`, fall back to `OTEL_EXPORTER_OTLP_ENDPOINT` from the process
   environment. Record a bounded `obs.config.fallback` event without response
   bodies, tokens, or endpoint query strings.
3. Pass the resolved value explicitly into the client as Go `OTLPEndpoint`,
   Python `otlp_endpoint`, or Node.js `otlpEndpoint`. For `push` or `both`, an
   absent or invalid value is a startup error; never let the clients silently
   use their localhost development default in Cloud Run.

`vcs deploy` injects `OBSERVABILITY_CONFIG_URL`, the direct
`OTEL_EXPORTER_OTLP_ENDPOINT` fallback, and `OBS_TRANSPORT=push` from backoffice
Settings. At least one observability endpoint must be configured before the
release pipeline accepts an app. Each Cloud Run revision also receives Direct
VPC egress (`PRIVATE_RANGES_ONLY` on the configured network/subnetwork) so
RFC1918 Postgres and OTLP collectors on the platform VM are reachable. A
production endpoint for the released Python and Node clients must use HTTPS
unless it is an explicitly approved RFC1918 collector reachable only through the
runtime VPC;
plain HTTP to public addresses is forbidden.

Browser code never calls Secret Manager or the central config URL and never
receives an OTLP endpoint. Its serving backend resolves the contract above,
then exposes a same-origin public bootstrap endpoint containing only
`{"rum_collector_url":"https://..."}`. If the central response omitted that
field, the backend uses its injected `RUM_COLLECTOR_URL` fallback. The browser
fetches this bootstrap before calling `initRum`; build-time `VITE_*` values may
be a local-development fallback only. Do not serialize credentials, internal
OTLP destinations, or raw upstream error bodies to the browser.

**Go — `obs-go` v1.1.0.** Keep using
`github.com/ibbr-engineering/obs-go v1.1.0`; initialize it before routing and
expose its gatherer through `/metrics` alongside the rating registry. Supply
the startup resolver's value as `obs.Config{OTLPEndpoint: otlpEndpoint}` even
while transport remains `scrape`, so switching to `both` cannot uncover a
latent localhost default.

**Python — `ibbr-obs` v0.1.0.** Record the pinned direct reference in
`requirements.txt`, `pyproject.toml`, or the project's lockfile rather than
installing an unrecorded floating dependency:

```sh
python -m pip install \
  "ibbr-obs @ git+https://github.com/ibbr-engineering/obs-python.git@v0.1.0"
```

For Flask, install the framework extra and instrument the application once:

```sh
python -m pip install \
  "ibbr-obs[flask] @ git+https://github.com/ibbr-engineering/obs-python.git@v0.1.0"
```

```python
from ibbr_obs import ObservabilityConfig, init_observability
from ibbr_obs.flask import instrument_flask

obs = init_observability(
    ObservabilityConfig(
        service=os.environ.get("VCS_APP_ID", "local-app"),
        tier="T3",
        env=os.environ.get("APP_ENV", "local"),
        transport="scrape",
        otlp_endpoint=otlp_endpoint,
    )
)
instrument_flask(app, obs)
```

The same tag provides `ibbr-obs[fastapi]` with
`ibbr_obs.fastapi.instrument_fastapi`, plus direct WSGI/ASGI middleware. Select
the adapter matching code already present; do not combine a framework adapter
with direct middleware. When a slim container installs the Git reference, add
`git` only to its build stage, not the runtime image.

**Node.js — `obs-node` v1.1.0.** Pin the Git dependency in `package.json` and
the lockfile:

```sh
npm install \
  "git+https://github.com/ibbr-engineering/obs-node.git#v1.1.0"
```

For Express, instrument before registering application routes and shut the
handle down during graceful termination:

```js
const {
  instrumentExpress,
} = require("@ibbr-engineering/observability/express");

const obs = instrumentExpress(app, {
  service: process.env.VCS_APP_ID || "local-app",
  tier: "T3",
  env: process.env.APP_ENV || "local",
  version: "1.1.0",
  transport: "scrape",
  otlpEndpoint,
});

process.once("SIGTERM", () => obs.shutdown());
```

The same package exposes the core middleware/metrics handler and LoopBack 3/4
adapters. Use the matching adapter; never add a second metrics library around
the same requests. Git-based npm installation may likewise require `git` in
the container build stage.

**Browser — `obs-browser` v1.0.0.** A version-pinned ESM import from the Git
tag is supported:

```html
<script type="module">
  import { initRum } from "https://cdn.jsdelivr.net/gh/ibbr-engineering/obs-browser@v1.0.0/src/index.js";

  const config = await fetch("/api/observability-config").then((response) => {
    if (!response.ok) throw new Error("observability config unavailable");
    return response.json();
  });
  const rum = initRum({ collectorUrl: config.rum_collector_url });
  window.addEventListener("app:dispose", () => rum.dispose(), { once: true });
</script>
```

`collectorUrl` must resolve from the same-origin bootstrap described above,
must be an absolute safe HTTPS URL outside local development, and must be
allowed by CSP `connect-src`; a checked-in `rum.example.com` placeholder does
not pass. The `v1.0.0` GitHub Release is valid, but currently attaches only the
automatic source `.zip` and `.tar.gz` assets. Therefore the pinned ESM URL is
the directly usable distribution. A locally vendored IIFE becomes valid when
an actual versioned bundle asset is attached and its digest is verified; never
invent a release-asset URL or fall back to an unpinned branch.

The browser client emits privacy-safe RUM to `/collect`; it does **not** expose
the Cloud Run service's `/metrics`, rating endpoints, or rating metric families.
Instrument the app's existing serving backend with its matching server client.
For a static-only SPA, `/deploy` adds a minimal serving process in the existing
JavaScript toolchain, instruments it with `obs-node`, and serves the built
assets plus `/healthz`, `/metrics`, and the rating APIs. Browser RUM and server
metrics are both required; neither substitutes for the other.

## 5. Cache is Valkey only

No Redis, no Memcached, no in-process cache that outlives a request.

Key format:

```
project:feature:what-key
```

**The format is not the boundary.** Nothing in a key string stops one project
reading another's, and the code writing these keys is LLM-generated. Isolation
comes from an ACL user per project on the shared instance:

```
ACL SETUSER <owner> on ><secret> ~<project>:* &<project>:* \
    +@all -@admin -@dangerous -select -scan -dbsize -randomkey
```

Each clause earns its place, and three of them were added only after testing
showed the obvious version leaked:

- `~<project>:*` — the enforced prefix. Project slugs are globally unique;
  cross-tenant `GET` and `SET` both return `NOPERM`.
- `-@dangerous` — removes `KEYS`, `FLUSHALL`, `FLUSHDB`, `MONITOR`.
- `-select` — pins the tenant to one logical DB. Without it a client can
  `SELECT 3` and write there; the key pattern still holds, but a key invisible
  from DB 0 is a debugging problem nobody needs.
- `-scan -dbsize -randomkey` — **ACL key patterns filter access, not
  enumeration.** With `~alice:blog:*` alone, alice cannot read
  `other-project:feature:cart` but `SCAN` still lists it and `RANDOMKEY` returns it.
  In this key format the name alone discloses which project has which features.
  Verified against Valkey 8.1: blocked for a hardened user, still fully visible
  to an unhardened one.

An app never needs `SCAN` here: the prefix contract makes its own keys
deterministic, so it can reconstruct them without enumerating.

Logical-DB-per-project was rejected. `SELECT` is not an auth boundary — any
authenticated client can switch — and the DB count is capped, so it caps
tenants.

The client library **constructs** the prefix from injected identity. An app
that types its own prefix is an app that can typo its way into another
tenant's namespace, and the ACL would then reject it at runtime rather than
at review.

## 6. User-facing apps must ask for a rating

A deployed app collects its own rating from its own end users. This is not the
app-store review feature the portal has ruled out of MVP scope — different
audience, different data, different purpose. This one feeds the business-value
side of FinOps, which otherwise has cost with nothing to weigh it against.

- Score is **1..5 with no free-text comment**. A comment box on a clinic app
  will eventually contain PHI, and as a metric label it is unbounded
  cardinality besides. `score` is a label precisely because five series per app
  is cheap and readable without a histogram.
- Asked once in the **first 15 minutes of active use**. The timer runs on time
  spent in the app, not wall clock. A tab left open overnight must not trigger
  a prompt on return.
- Dismissing offers **"Ask again in 20 minutes"**. Choosing it
  records `snoozed` and re-arms the active-use timer for 20 minutes. A final
  dismissal records `dismissed` and does not re-arm it.
- **`app_rating_prompt_total` is mandatory**, with `outcome` = `shown` |
  `submitted` | `dismissed` | `snoozed`, recorded for every prompt event.

Snoozing and dismissing are different signals. Collapsing both into dismissal
hides whether users reject the prompt or only its timing.

## 7. IAP protects every user-facing request

Cloud Run's direct IAP integration is the default. Enable IAP on the service,
grant access through IAP policy, and require authentication. Do not enable IAP
on both Cloud Run and a load balancer.

If a load balancer owns IAP instead, set Cloud Run ingress to
`internal-and-cloud-load-balancing` and disable the default `run.app` URL.
Otherwise users can bypass IAP by calling the service directly.

The app validates `x-goog-iap-jwt-assertion` on every request except a
non-sensitive `/healthz` check. Validation must cover the ES256 signature,
`iss = https://cloud.google.com/iap`, expiry, and the exact audience. Direct
Cloud Run audiences use:

```
/projects/<project-number>/locations/<region>/services/<service-name>
```

Reading `x-goog-authenticated-user-email` without validating the signed JWT is
not authentication. After validation, use JWT `sub` as the stable identity and
`email` for display. The app needs no password database unless its own domain
requires profiles or authorization beyond IAP identity.

### App RBAC on IAP email

Optional app-level roles must **not** introduce a second ingress login. Map roles
from the validated IAP JWT `email` claim:

- Primary RBAC key: `email` (for example `user@ibbr.info`)
- Audit/stable foreign key: JWT `sub` when email rotation matters
- Allowed: `app_user_roles(email, role)` maintained by an in-app admin UI
- Forbidden on Cloud Run: password tables, `/login` forms, Firebase client auth,
  or session cookies as an ingress gate

### Local laptop login vs Cloud Run ingress

Cloud Run ingress must stay IAP-only. Laptop-only password login (`/login`,
session cookies, bcrypt) may remain in source when **all** of these hold:

1. IAP JWT validation against `IAP_AUDIENCE` (or the sandbox audience that
   falls back to it) is implemented and is the Cloud Run path.
2. Every baked Cloud Run config — `config.sandbox.yaml`, or the YAML the
   Dockerfile `COPY`s onto the image config path — sets `auth.mode: iap`.
3. Local password mode cannot start unless `APP_ENV=local`. VCS injects
   `APP_ENV=sandbox`, so that path cannot run on Cloud Run.

Do not fail QC solely because those local-dev files exist. Still fail when
sandbox config is `auth.mode: local` or `dev`, when Firebase is used as
ingress, when the app trusts `x-goog-authenticated-user-email` without JWT
validation, or when the live service serves a password login form.

New apps should still skip a second login and use the empty-audience
`APP_ENV=local` IAP bypass from the scaffold.

Node.js and Python backends validate `x-goog-iap-jwt-assertion` with the Google
auth library and read `email` the same way. Browser UI must never be the security
boundary.

The `vcs-iap-auth` skill and `auth-intent` hook steer coding agents toward this
pattern during `vcs wrap claude`.

## Project declaration (`features.yaml`)

Every repo declares one HTTP service with this fixed shape:

```yaml
version: 1
kind: http-service
runtime:
  language: go # existing projects may use browser, nodejs, or python
  framework: net/http # name the actual framework for an existing project
scope:
  - PostgreSQL
features:
  observability:
    library: github.com/ibbr-engineering/obs-go
    metrics_path: /metrics
  authentication:
    iap: true
    identity:
      source: iap-jwt
      email_for_rbac: true
  rating:
    score: 1..5
    first_prompt_after: 15m
    snooze_for: 20m
registrations:
  routes:
    - GET /healthz
    - POST /api/rating/events
    - POST /api/ratings
  metrics:
    - app_rating_total
    - app_rating_prompt_total
```

For Python and Node.js, `features.observability.library` is respectively
`ibbr-obs` or `@ibbr-engineering/observability`. A browser project declares its
serving process in `library`, and also declares:

```yaml
features:
  observability:
    library: "@ibbr-engineering/observability" # or its existing Go/Python backend client
    rum_library: "@ibbr-engineering/observability-browser"
    rum_collector_config: /api/observability-config # backend uses RUM_COLLECTOR_URL fallback
    metrics_path: /metrics
```

`scope` contains only values from the platform scope catalog
(`PostgreSQL`, `Redis`, `MongoDB`, `Fast API`, `WRAP API`, `JOBI API`,
`Helpy Happy API`, `FDC API`). It snapshots what the project is allowed to reach; QC
compares it in both directions with the code. `kind` must be `http-service`.
Workers, jobs, and queue consumers are rejected. `app_id` is injected at
deploy time and is forbidden anywhere in this file.

New VCS projects still use the supported Go `net/http` scaffold. The additional
runtime values exist only for adopting repositories created before VCS; setup
must not replace their application with the Go scaffold.

## Local completion before deploy

Start Claude Code through `vcs wrap claude`. The launcher loads only Claude's project
and local setting sources plus the VCS platform plugin generated outside Git
(`.vcs/claude-platform`, with `vcs-platform` and the built-in `vcs-superpowers`
process skill). Personal skills and user-enabled plugins are intentionally
excluded so they cannot replace platform instructions or rewrite the app
through an unrelated workflow. Managed Claude policy remains effective.

The deploy-intent hook that `vcs wrap claude` relies on is **project-scoped**: it is
written into `.claude/settings.local.json`. `vcs setup` also installs a user
hook under `~/.claude/settings.json` for plain `claude` sessions, but
`--setting-sources project,local` means that user hook is ignored during
`vcs wrap claude`. Prefer `.claude/commands/deploy.md` from the project; do not curl
the deploys API with a hand-copied key — run `vcs deploy` only.

Natural-language deploy intent is equivalent to invoking `/deploy`. Examples
include `deploy`, `mari deploy`, and requests to make the app available on the
public internet. The project `UserPromptSubmit` hook maps those prompts to the
same completion loop; it does not call a second model or bypass any VCS gate.

The installed `/deploy` command is an active completion loop, not a lint command.
It reads `vcs-superpowers` then this skill, repairs every safe local gap, runs
the runtime's tests and production build, reviews and commits the relevant
diff, pushes the exact commit to the project's Forgejo `origin`, then calls
`vcs deploy`. A QC failure that can be fixed in source returns to the same loop.

This includes the Dockerfile and `PORT` contract, `/healthz`, observability
initialisation and `/metrics`, rating UI/endpoints/metric families for a
user-facing app, exact-audience IAP validation, `features.yaml`, and
`.forgejo/workflows/build-deploy.yml`. The workflow builds the repository's
Dockerfile and pushes `<forgejo-host>/<owner>/<repo>:${{ github.sha }}` using
the repository's `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` Actions secrets.
`<forgejo-host>` is a hostname with optional port, never an `http://` or
`https://` origin; Docker image references do not accept URL schemes.
It uses Buildx to produce `linux/amd64` even when the Forgejo runner host is
ARM64. Generated Go projects use a native builder with Go cross-compilation;
other runtimes may use QEMU. The workflow runs for every pushed branch and
labels the image with the source URL and Git revision. Cloud Run supports the
Linux x86_64 ABI; a multi-platform manifest is acceptable only when it includes
`linux/amd64`. The workflow never releases Cloud Run; only the VCS deploy
pipeline may resolve that tag to an immutable digest and release it.

Local completion must not fabricate a dependency, but all currently supported
runtimes are now in the catalog above. `/deploy` installs and wires the pinned
Go, Python, Node.js, and browser client that matches the detected runtime. It
keeps fixing locally repairable integration, lifecycle, `/metrics`, CSP, and
lockfile gaps rather than reporting these released clients as unavailable. A
real missing external value such as the browser collector endpoint is reported
precisely and is never replaced with an example URL; the project is not silently
exempted and the server gate is not weakened.

Resource labels and `app_id` are injected by the release pipeline. They are
verified at deploy time but are never authored into the application's repo.
