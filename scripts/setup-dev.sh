#!/usr/bin/env bash
# Dev environment: Node.js (via nvm if needed), wrangler, 1024 CLI on PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ZSH_MARKER="# 1024201-portal dev"

ensure_zshrc() {
  local zshrc="${HOME}/.zshrc"
  touch "$zshrc"
  if grep -qF "$ZSH_MARKER" "$zshrc" 2>/dev/null; then
    return 0
  fi
  cat >>"$zshrc" <<'EOF'

# 1024201-portal dev
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.npm-global/bin:$PATH"
EOF
  echo "Updated ~/.zshrc (nvm + 1024 CLI PATH)"
}

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
  if [ -f "$ROOT/.nvmrc" ]; then
    nvm install
    nvm use
  else
    nvm install 22
    nvm use 22
  fi
  ensure_zshrc
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  echo "Node $(node -v) · npm $(npm -v)"
}

ensure_node
ensure_zshrc

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
./node_modules/.bin/wrangler --version
1024 --version

echo ""
echo "Done."
echo "  cd $ROOT"
echo "  source ~/.zshrc    # or open a new Terminal tab"
echo "  1024 --version"
echo ""
echo "Deploy (after wrangler login or CLOUDFLARE_API_TOKEN):"
echo "  npm run deploy"
