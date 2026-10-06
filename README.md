# VCS marketplace plugin

Canonical source for `vcs@vcs-release`. The release workflow builds standalone hook and CLI executables, then publishes the complete marketplace tree to the release repository. Source checkout alone is not an installable package: run `scripts/build-plugin.sh VERSION .build/plugin` first.

Claude Code installation uses `/plugin marketplace add fdc-ahay/vcs-release`, then `/plugin install vcs@vcs-release`. Enable the plugin and reload the session through the client's UI when required. `/vcs:deploy` is visible in the command picker. The UserPromptSubmit hook routes standalone `vcs` prompts, including questions, without automatically authorizing deployment. CLI installation is not required.

Hook executable uses only the Go standard library and never calls a network, reads client config, or logs prompt contents. Malformed payloads produce no context. OS-specific launchers use the Git shell supplied for Claude Code on Windows; native Windows marketplace activation must be tested before release.

Codex uses `.codex-plugin/plugin.json` and the bundled native `UserPromptSubmit` hook. Install with native marketplace UI/CLI, then review and trust hooks through Codex UI; hook trust is a client requirement and must not be bypassed. Native marketplace add/install is tested with Codex 0.160.0. Automatic hook activation still requires native trust acceptance.

OpenCode 1.18 uses `adapters/opencode/vcs.mjs`, registered as a local plugin file via the native `plugin` config list. The adapter routes native `chat.message` into the same standalone parser, then adds context using native `experimental.chat.system.transform`. Enablement never rewrites provider settings. Adapter fixtures test precision, session scoping, and no duplicate context. Native OpenCode 1.18.33 config loading and exact-token prompt activation are verified in an isolated profile; native question UI and complete deployment remain acceptance requirements. This is a native OpenCode adapter, not a Claude hooks file.

Domain operations: `domains list/connect/status/retry` provide approved root choices, subdomain validation, and automatic provisioning/TLS polling. The VCS skill asks selection/text through native UI only when missing, then resumes the same domain binding without duplicate provisioning.

Official contracts: [Codex plugin hooks](https://developers.openai.com/codex/hooks), [OpenCode plugins](https://opencode.ai/docs/plugins/), and [OpenCode migration mapping](https://opencode.ai/v2/docs/build/plugins/migrate-v1/).

Release acceptance: clean marketplace profile, enabled plugin, absent CLI/PATH setup, namespace/command visibility, keyword matrix, path containing spaces, disabled/uninstalled hook absent, update/reload, and preserved native provider. Standalone fixture tests cannot replace native marketplace activation evidence.

Publishing requires repository variable `VCS_MARKETPLACE_ACCEPTANCE_SHA` to match the exact tagged commit after native marketplace acceptance. This is an operator attestation backed by recorded test evidence, not a substitute for the native test. Missing or stale attestation fails the release workflow.
