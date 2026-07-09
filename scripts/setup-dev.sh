#!/usr/bin/env bash
# Dev environment: Node.js (via nvm if needed), wrangler, 1024 CLI on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ensure_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local major
    major="$(node -p "process.versions.node.split('.')[0]")"
    if [ "$major" -lt 18 ]; then
      echo "Node.js >= 18 required (found $(node -v))."
      exit 1
    fi
    echo "Node $(node -v) · npm $(npm -v)"
    return 0
  fi

  echo "Node.js not found. Installing via nvm ..."
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm install
  nvm use
  echo "Node $(node -v) · npm $(npm -v)"
}

ensure_zsh_path_hint() {
  local npm_global
  npm_global="$(npm prefix -g 2>/dev/null || echo "${HOME}/.npm-global")"
  if [[ ":$PATH:" != *":${npm_global}/bin:"* ]]; then
    echo ""
    echo "Add to zsh (~/.zshrc):"
    echo "  export PATH=\"${npm_global}/bin:\$PATH\""
  fi
}

ensure_node
echo "Installing project dependencies (wrangler) ..."
npm install

mkdir -p "${HOME}/.npm-global/lib"
if ! npm config get prefix 2>/dev/null | grep -q "${HOME}/.npm-global"; then
  npm config set prefix "${HOME}/.npm-global"
fi
export PATH="${HOME}/.npm-global/bin:${PATH}"

echo "Linking 1024 CLI ..."
npm link ./cli

echo ""
echo "Verify:"
echo "  ./node_modules/.bin/wrangler --version"
./node_modules/.bin/wrangler --version
echo "  1024 --version"
1024 --version

ensure_zsh_path_hint

echo ""
echo "Done. Deploy (after CLOUDFLARE_API_TOKEN or wrangler login):"
echo "  npm run deploy"
