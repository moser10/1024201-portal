#!/usr/bin/env bash
# One-shot bootstrap for CloudCone web Terminal (paste as root).
# 1) Installs Cursor agent SSH public key (so the cloud agent can finish verification)
# 2) Downloads and runs scripts/fix-cfac-reality-link.sh
#
# Does NOT print passwords or full vless:// unless PRINT_LINK=1.

set -euo pipefail

AGENT_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMKqcF6tUdX+HH0tPuKCiZ0XDFsDCUBlKbP3XfvQ0aSz cursor-cfac-agent'
SCRIPT_URL="${SCRIPT_URL:-https://raw.githubusercontent.com/moser10/1024201-portal/cursor/fix-cfac-reality-link-7e94/scripts/fix-cfac-reality-link.sh}"

mkdir -p /root/.ssh
chmod 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
if ! grep -qF 'cursor-cfac-agent' /root/.ssh/authorized_keys; then
  echo "$AGENT_PUBKEY" >> /root/.ssh/authorized_keys
  echo "[ok] installed cursor-cfac-agent SSH key"
else
  echo "[ok] cursor-cfac-agent SSH key already present"
fi

curl -fsSL "$SCRIPT_URL" -o /root/fix-cfac-reality-link.sh
chmod +x /root/fix-cfac-reality-link.sh
bash /root/fix-cfac-reality-link.sh

echo
echo "Next on phone: ssh/cat is not needed — on VPS run:"
echo "  grep '^vless://' /root/cfac-node-info.txt"
echo "Copy that single line into Shadowrocket (do not paste into chat)."
