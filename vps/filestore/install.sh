#!/usr/bin/env bash
# Install 1024201 VPS file store (Node 18+, systemd).
# Usage on VPS:
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/main/vps/filestore/install.sh | bash -s --
# Or with env:
#   FILE_STORE_SECRET='your-long-random-secret' bash install.sh
set -euo pipefail

REPO_RAW="${REPO_RAW:-https://raw.githubusercontent.com/moser10/1024201-portal/main}"
INSTALL_DIR="${INSTALL_DIR:-/opt/1024-filestore}"
DATA_DIR="${FILE_STORE_DIR:-/var/lib/1024-files}"
PORT="${FILE_STORE_PORT:-3921}"
SECRET="${FILE_STORE_SECRET:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (sudo bash install.sh)" >&2
  exit 1
fi

if [[ -z "$SECRET" ]]; then
  SECRET="$(openssl rand -hex 32)"
  echo "Generated FILE_STORE_SECRET (save for Worker secret):"
  echo "$SECRET"
fi

command -v node >/dev/null || { echo "Install Node 18+ first" >&2; exit 1; }

mkdir -p "$INSTALL_DIR" "$DATA_DIR"
curl -fsSL "$REPO_RAW/vps/filestore/server.mjs" -o "$INSTALL_DIR/server.mjs"
chmod 644 "$INSTALL_DIR/server.mjs"

cat >/etc/systemd/system/1024-filestore.service <<EOF
[Unit]
Description=1024201 VPS file store
After=network.target

[Service]
Type=simple
Environment=FILE_STORE_SECRET=${SECRET}
Environment=FILE_STORE_DIR=${DATA_DIR}
Environment=FILE_STORE_PORT=${PORT}
Environment=FILE_STORE_HOST=127.0.0.1
ExecStart=$(command -v node) ${INSTALL_DIR}/server.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now 1024-filestore
sleep 1
curl -fsS "http://127.0.0.1:${PORT}/health" || { journalctl -u 1024-filestore -n 20 --no-pager; exit 1; }

echo ""
echo "=== VPS file store ready ==="
echo "Local health: http://127.0.0.1:${PORT}/health"
echo ""
echo "Next: expose via Nginx + TLS (see vps/filestore/nginx-snippet.conf), then on your Mac:"
echo "  npx wrangler secret put FILE_STORE_URL --name 1024201-portal"
echo "  # e.g. https://files.yourdomain.com"
echo "  npx wrangler secret put FILE_STORE_SECRET --name 1024201-portal"
echo "  # paste: ${SECRET}"
