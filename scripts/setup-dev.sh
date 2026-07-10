#!/usr/bin/env bash
# Dev environment: Node (Homebrew on macOS, nvm on Linux), wrangler, 1024 CLI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ZSH_MARKER="# 1024201-portal dev"
SETUP_CMD="bash $ROOT/scripts/setup-dev.sh"

die() {
  echo "" >&2
  echo "✗ FAILED: $*" >&2
  exit 1
}

need_user() {
  echo ""
  echo "⚠ NEEDS YOU (one-time), then re-run:" >&2
  echo "  $SETUP_CMD" >&2
  echo "" >&2
  echo "$*" >&2
  exit 2
}

is_mac() { [ "$(uname -s)" = "Darwin" ]; }

load_brew() {
  if [ -x /opt/homebrew/bin/brew ]; then
    # shellcheck disable=SC1091
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [ -x /usr/local/bin/brew ]; then
    # shellcheck disable=SC1091
    eval "$(/usr/local/bin/brew shellenv)"
  fi
}

verify_node() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 || return 1
  local major
  major="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$major" -lt 18 ]; then
    die "Node.js >= 18 required (found $(node -v)). On Mac: brew upgrade node"
  fi
  echo "✓ Node $(node -v) · npm $(npm -v)"
}

ensure_mac_xcode_clt() {
  xcode-select -p >/dev/null 2>&1 && return 0
  echo "→ Xcode Command Line Tools missing; opening installer ..."
  xcode-select --install 2>/dev/null || true
  need_user "1. Complete the pop-up installer (git, compiler).
2. When it finishes, run again:
   $SETUP_CMD"
}

ensure_brew() {
  load_brew
  command -v brew >/dev/null 2>&1 && return 0

  echo "→ Installing Homebrew ..."
  ensure_mac_xcode_clt
  if ! NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; then
    need_user "Homebrew needs your Mac password (one-time). Run in Terminal:
  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
Then:
  $SETUP_CMD"
  fi
  load_brew
  command -v brew >/dev/null 2>&1 || need_user "Homebrew installed. Open a **new** Terminal tab, then:
  $SETUP_CMD"
}

ensure_node_mac() {
  verify_node && return 0

  ensure_brew
  echo "→ brew install node ..."
  if ! brew install node; then
    die "brew install node failed. Try manually: brew doctor && brew install node"
  fi
  load_brew
  verify_node || die "node not on PATH after brew install. Run: eval \"\$(/opt/homebrew/bin/brew shellenv)\""
}

ensure_node_nvm() {
  verify_node && return 0

  echo "→ Installing Node via nvm (Linux / non-brew) ..."
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
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  verify_node || die "nvm install failed"
}

ensure_node() {
  if is_mac; then
    ensure_node_mac
  else
    ensure_node_nvm
  fi
}

ensure_zshrc() {
  local zshrc="${HOME}/.zshrc"
  touch "$zshrc"
  if grep -qF "$ZSH_MARKER" "$zshrc" 2>/dev/null; then
    return 0
  fi
  if is_mac; then
    cat >>"$zshrc" <<'EOF'

# 1024201-portal dev
if [ -x /opt/homebrew/bin/brew ]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [ -x /usr/local/bin/brew ]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi
export PATH="$HOME/.npm-global/bin:$PATH"
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
  is_mac && load_brew

  ensure_node
  ensure_zshrc
  is_mac && load_brew
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
  echo "✓ Done."
  echo "  cd $ROOT"
  echo "  source ~/.zshrc   # or new Terminal tab"
  echo "  1024 --version"
  echo ""
  echo "Deploy:"
  echo "  npx wrangler login"
  echo "  npm run deploy"
}

main "$@"
