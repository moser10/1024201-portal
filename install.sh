#!/usr/bin/env bash
# New Mac bootstrap: clone repo (if needed), install Node via nvm, wrangler, 1024 CLI.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/install.sh | bash
#   curl -fsSL .../install.sh | bash -s -- ~/CodeProjects/1024
set -euo pipefail

# Avoid getcwd errors when the current directory was removed (e.g. empty 1024 folder deleted).
cd "${HOME:-/tmp}" 2>/dev/null || cd /tmp

REPO_URL="${PORTAL_REPO_URL:-https://github.com/moser10/1024201-portal.git}"
TARGET="${1:-${PORTAL_INSTALL_DIR:-$HOME/CodeProjects/1024}}"

if [ ! -d "$TARGET/.git" ]; then
  echo "Cloning $REPO_URL → $TARGET"
  mkdir -p "$(dirname "$TARGET")"
  if [ -d "$TARGET" ] && [ -n "$(ls -A "$TARGET" 2>/dev/null)" ]; then
    echo "Error: $TARGET exists and is not empty. Remove it or pick another path:"
    echo "  bash install.sh ~/CodeProjects/1024-other"
    exit 1
  fi
  mkdir -p "$TARGET"
  git clone --depth 1 "$REPO_URL" "$TARGET"
else
  echo "Repo already at $TARGET — pulling latest ..."
  git -C "$TARGET" pull --ff-only
fi

exec bash "$TARGET/scripts/setup-dev.sh"
