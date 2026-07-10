#!/usr/bin/env bash
# Bootstrap: clone repo + setup (Node/wrangler/1024). macOS needs no sudo.
#
#   cd ~ && curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/install.sh | bash -s -- ~/CodeProjects/1024
set -euo pipefail

cd "${HOME:-/tmp}" 2>/dev/null || cd /tmp

REPO_URL="${PORTAL_REPO_URL:-https://github.com/moser10/1024201-portal.git}"
TARGET="${1:-${PORTAL_INSTALL_DIR:-$HOME/CodeProjects/1024}}"

if ! command -v git >/dev/null 2>&1; then
  echo "✗ git not found." >&2
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "  Run once (needs password): xcode-select --install" >&2
    xcode-select --install 2>/dev/null || true
  else
    echo "  Install git, then re-run this script." >&2
  fi
  exit 2
fi

if [ ! -d "$TARGET/.git" ]; then
  echo "→ Cloning $REPO_URL → $TARGET"
  mkdir -p "$(dirname "$TARGET")"
  if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    echo "✗ $TARGET is not empty. Run: rm -rf $TARGET" >&2
    exit 1
  fi
  mkdir -p "$TARGET"
  git clone --depth 1 "$REPO_URL" "$TARGET"
else
  echo "→ Updating $TARGET"
  git -C "$TARGET" pull --ff-only
fi

exec bash "$TARGET/scripts/setup-dev.sh"
