# VCS CLI releases

Public binary distribution for the private VCS platform repository.

## macOS and Linux

```sh
curl -fsSL https://github.com/fdc-ahay/vcs-release/releases/latest/download/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"
vcs version
```

Each release includes the installer. It selects the matching macOS or Linux archive and verifies
its SHA-256 checksum.

## Windows

Download the latest `vcs_<version>_windows_amd64.zip` from
[Releases](https://github.com/fdc-ahay/vcs-release/releases/latest), extract `vcs.exe`, and add its
directory to user `PATH`.

macOS DMGs and Windows executables are unsigned. Gatekeeper or SmartScreen may warn.

## Claude Code skills

`skills/` publishes the VCS coding skills that `vcs setup` installs:

| Skill | Purpose |
| --- | --- |
| `vcs-platform` | Platform rules enforced at deploy time (Postgres, Valkey, observability, rating, IAP, `features.yaml`) |
| `vcs-superpowers` | Process discipline: skill use, verification, deploy alignment |
| `vcs-iap-auth` | Login/RBAC through validated IAP JWT, never a parallel password login |
| `vcs-deploy` | Deploy completion loop: repair, test, commit, push to Forgejo, `vcs deploy` |

The plugin also adds the `/vcs:deploy` command (same content as the `/deploy` command `vcs setup` installs).

Install as a Claude Code plugin:

```sh
claude plugin marketplace add fdc-ahay/vcs-release
claude plugin install vcs@vcs-release
```

Or copy them to user scope:

```sh
git clone --depth 1 https://github.com/fdc-ahay/vcs-release.git /tmp/vcs-release
mkdir -p ~/.claude/skills && cp -R /tmp/vcs-release/skills/* ~/.claude/skills/
```

`vcs-platform` is generated from `docs/deployment-spec.md` in the private platform repository; do
not edit it here.
