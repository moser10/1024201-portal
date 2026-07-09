#!/bin/sh
# Install 1024 CLI from a git checkout or published npm package.
set -e

INSTALL_DIR="${1024_INSTALL_DIR:-$HOME/.local/1024-cli}"
REPO_URL="${1024_REPO_URL:-https://github.com/moser10/1024201-portal.git}"

if command -v 1024 >/dev/null 2>&1; then
  echo "1024 already on PATH: $(command -v 1024)"
fi

if [ -f "$(dirname "$0")/package.json" ]; then
  SRC="$(cd "$(dirname "$0")" && pwd)"
else
  echo "Cloning into $INSTALL_DIR ..."
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  SRC="$INSTALL_DIR/cli"
fi

echo "Installing from $SRC"
cd "$SRC"
npm install --omit=dev 2>/dev/null || true
npm link

echo ""
echo "Installed. Try: 1024 --version"
echo "Docs: https://1024201.com/tools/cli/"
