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
