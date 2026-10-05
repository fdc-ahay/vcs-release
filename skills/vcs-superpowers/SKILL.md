---
name: vcs-superpowers
description: Use when starting any VCS coding session — establishes disciplined skill use, verification, and deploy alignment before writing code. Always applies inside vcs wrap claude.
---

# VCS Superpowers

Built-in for `vcs wrap claude`. Personal plugins like obra/superpowers are intentionally
excluded from that launcher; this skill replaces the process discipline those
plugins would have provided, without overriding platform rules.

## The Rule

If there is even a small chance a skill applies, invoke it before acting —
including clarifying questions, exploration, or edits.

Announce "Using [skill] to [purpose]" and follow it. Checklist skills become
todos.

## Skill priority inside VCS

1. **`vcs-platform`** (or plugin `vcs-platform:vcs-platform`) — source of truth
   for Postgres schema-per-project, Valkey, observability clients, rating,
   IAP audience checks, `features.yaml`, container/`PORT`, and Forgejo workflow
   rules. Never invent a conflicting platform rule.
2. **`vcs-iap-auth`** — when the user asks for login, auth, RBAC, or route
   protection: validate IAP JWT, forward email for roles; never custom password login.
3. **`/deploy`** (`.claude/commands/deploy.md`) — the only path that ships.
   Natural-language deploy / publish / go-online intent equals `/deploy`.
4. **This skill** — process: verify, debug systematically, do not claim done
   without evidence.

User instructions in the project beat skills; skills beat default improvisation.

## Deploy alignment

- Completion owner is `/deploy`: repair → test → commit → `git push -u origin HEAD`
  → `vcs deploy`. Never `gcloud run deploy`, never raw Cloud Run credentials.
- Prefer project-scoped files written by `vcs wrap claude`:
  `.claude/commands/deploy.md`, `.claude/settings.local.json`, and the
  `.vcs/claude-platform` plugin. Do not rely on `~/.claude` during `vcs wrap claude`
  (`--setting-sources project,local` excludes user settings/skills/plugins).
- Poll deploy status only via `vcs deploy`. Do not `curl` `/deploys` with a
  hand-copied API key.

## Verification before completion

Do not declare success until a command you ran proves it. Preferred evidence:

- formatter / tests / production build for the runtime
- `features.yaml` matches what the code actually registers
- after `/deploy`, the URL or the exact gate failure from `vcs deploy`

Absence of an error message is not evidence.

## Systematic debugging

1. Reproduce with a concrete command.
2. Read the failure; do not guess a fix from vibes.
3. Change one cause; re-run the same command.
4. If the gate failed (AI QC / deploygate / metrics), treat the server message
   as authoritative and repair locally, then push and redeploy.

## Boilerplate and existing apps

- New Go scaffolds already wire platform requirements; extend them, do not
  replace the observability/rating/IAP skeleton casually.
- Adopted Go / browser / Node / Python apps: install the exact pinned clients
  from `vcs-platform`. Do not substitute example collector URLs or localhost
  OTLP defaults.
- Never commit `app_id`, API keys, Forgejo tokens, or GCP credentials.

## Red flags

| Thought | Reality |
| --- | --- |
| "Skip the skill, this is tiny" | Tiny changes still fail the gate. |
| "I'll gcloud deploy to save time" | That bypasses every enforceable gate. |
| "User skills will teach me" | `vcs wrap claude` excludes them on purpose. |
| "Curl the deploys API" | Use `vcs deploy` only. |
| "User wants a login page" | IAP already authenticates at ingress; read `vcs-iap-auth` and use JWT email for RBAC. |
| "Looks done" | Run the proof command. |
