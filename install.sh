#!/usr/bin/env bash
# New Mac bootstrap: clone repo, install Node (brew on macOS), wrangler, 1024 CLI.
#
# One command:
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/install.sh | bash -s -- ~/CodeProjects/1024
set -euo pipefail

cd "${HOME:-/tmp}" 2>/dev/null || cd /tmp

REPO_URL="${PORTAL_REPO_URL:-https://github.com/moser10/1024201-portal.git}"
TARGET="${1:-${PORTAL_INSTALL_DIR:-$HOME/CodeProjects/1024}}"

if ! command -v git >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "git not found — installing Xcode Command Line Tools ..."
    xcode-select --install 2>/dev/null || true
    echo "Complete the CLT installer, then re-run this install command."
    exit 2
  fi
  echo "git is required. Install git and re-run." >&2
  exit 1
fi

if [ ! -d "$TARGET/.git" ]; then
  echo "→ Cloning $REPO_URL → $TARGET"
  mkdir -p "$(dirname "$TARGET")"
  if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    echo "Error: $TARGET is not empty. Run: rm -rf $TARGET" >&2
    exit 1
  fi
  mkdir -p "$TARGET"
  git clone --depth 1 "$REPO_URL" "$TARGET"
else
  echo "→ Updating $TARGET"
  git -C "$TARGET" pull --ff-only
fi

exec bash "$TARGET/scripts/setup-dev.sh"
