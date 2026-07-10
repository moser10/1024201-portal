#!/usr/bin/env bash
# Dev environment: Node (official binary on macOS, nvm on Linux), wrangler, 1024 CLI.
# macOS: no Homebrew, no sudo — installs to ~/.local/node
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ZSH_MARKER="# 1024201-portal dev"
SETUP_CMD="bash $ROOT/scripts/setup-dev.sh"
NODE_VERSION="${PORTAL_NODE_VERSION:-22.14.0}"
NODE_DIR="${HOME}/.local/node"

die() {
  echo "" >&2
  echo "✗ FAILED: $*" >&2
  exit 1
}

is_mac() { [ "$(uname -s)" = "Darwin" ]; }

node_arch() {
  case "$(uname -m)" in
    arm64) echo "arm64" ;;
    x86_64) echo "x64" ;;
    *) die "Unsupported CPU: $(uname -m)" ;;
  esac
}

use_local_node() {
  if [ -x "${NODE_DIR}/bin/node" ]; then
    export PATH="${NODE_DIR}/bin:${PATH}"
  fi
}

verify_node() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 || return 1
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$major" -lt 18 ]; then
    die "Node.js >= 18 required (found $(node -v))"
  fi
  echo "✓ Node $(node -v) · npm $(npm -v)"
}

ensure_node_mac_binary() {
  use_local_node
  verify_node && return 0

  local arch tarball tmp
  arch="$(node_arch)"
  tarball="node-v${NODE_VERSION}-darwin-${arch}"
  tmp="$(mktemp -d)"

  echo "→ Installing Node ${NODE_VERSION} → ${NODE_DIR} (no sudo, no Homebrew) ..."
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}.tar.xz" -o "${tmp}/${tarball}.tar.xz"
  rm -rf "${NODE_DIR}"
  mkdir -p "${NODE_DIR}"
  tar -xJf "${tmp}/${tarball}.tar.xz" -C "${NODE_DIR}" --strip-components=1
  rm -rf "${tmp}"

  export PATH="${NODE_DIR}/bin:${PATH}"
  verify_node || die "Node binary install failed"
}

ensure_node_nvm() {
  use_local_node
  verify_node && return 0

  echo "→ Installing Node via nvm → ~/.nvm ..."
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
    nvm install "${NODE_VERSION%%.*}"
    nvm use "${NODE_VERSION%%.*}"
  fi
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  verify_node || die "nvm install failed"
}

ensure_node() {
  if is_mac; then
    ensure_node_mac_binary
  else
    ensure_node_nvm
  fi
}

ensure_zshrc() {
  local zshrc="${HOME}/.zshrc"
  touch "$zshrc"
  grep -qF "$ZSH_MARKER" "$zshrc" 2>/dev/null && return 0

  if is_mac; then
    cat >>"$zshrc" <<'EOF'

# 1024201-portal dev
export PATH="$HOME/.local/node/bin:$HOME/.npm-global/bin:$PATH"
EOF
  else
    cat >>"$zshrc" <<'EOF'

# 1024201-portal dev
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$HOME/.npm-global/bin:$PATH"
EOF
  fi
  echo "✓ Updated ~/.zshrc"
}

ensure_npm_global() {
  mkdir -p "${HOME}/.npm-global/lib"
  if ! npm config get prefix 2>/dev/null | grep -q "${HOME}/.npm-global"; then
    npm config set prefix "${HOME}/.npm-global"
  fi
  export PATH="${HOME}/.npm-global/bin:${PATH}"
}

main() {
  echo "=== 1024201 dev setup ($ROOT) ==="
  use_local_node

  ensure_node
  ensure_zshrc
  use_local_node
  ensure_npm_global

  echo "→ npm install (wrangler) ..."
  npm install

  echo "→ npm link 1024 CLI ..."
  npm link ./cli

  echo ""
  echo "=== Verify ==="
  ./node_modules/.bin/wrangler --version
  1024 --version

  echo ""
  echo "✓ Done — no sudo was required."
  echo "  source ~/.zshrc   # or open a new Terminal tab"
  echo "  cd $ROOT && npm run deploy"
}

main "$@"
