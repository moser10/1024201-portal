#!/usr/bin/env bash
# Run on your Mac (where /tmp/cfac_root_pass.txt exists).
# Installs the Cursor cloud-agent SSH public key onto the VPS.
# After this succeeds, the cloud agent can SSH in and finish the Reality fix.
#
# Usage (Mac Terminal):
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/cursor/fix-cfac-reality-link-7e94/scripts/grant-cfac-agent-ssh.sh | bash
#
# Does NOT delete /tmp/cfac_root_pass.txt.
# Does NOT print the password.

set -euo pipefail

PASS_FILE="${PASS_FILE:-/tmp/cfac_root_pass.txt}"
HOST="${HOST:-199.255.96.31}"
AGENT_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMKqcF6tUdX+HH0tPuKCiZ0XDFsDCUBlKbP3XfvQ0aSz cursor-cfac-agent'

if [[ ! -f "$PASS_FILE" ]]; then
  echo "ERROR: $PASS_FILE not found." >&2
  echo "This must run on the Mac where you created the password file." >&2
  echo "(The Cursor cloud agent cannot see your Mac /tmp.)" >&2
  exit 1
fi

if ! command -v expect >/dev/null 2>&1; then
  echo "ERROR: macOS 'expect' missing. Install Xcode CLT or: brew install expect" >&2
  exit 1
fi

# Trim CR/LF/spaces from password file without printing it
PASS="$(python3 - <<'PY'
from pathlib import Path
p = Path("/tmp/cfac_root_pass.txt")
print(p.read_text(encoding="utf-8").strip())
PY
)"
if [[ -z "$PASS" ]]; then
  echo "ERROR: password file is empty after trim." >&2
  exit 1
fi

export HOST PASS AGENT_PUBKEY

expect <<'EOF'
set timeout 60
set host $env(HOST)
set pass $env(PASS)
set pubkey $env(AGENT_PUBKEY)

spawn ssh -tt \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o KexAlgorithms=curve25519-sha256,curve25519-sha256@libssh.org,ecdh-sha2-nistp256 \
  -o HostKeyAlgorithms=ssh-ed25519,ecdsa-sha2-nistp256,rsa-sha2-512 \
  -o Ciphers=aes128-ctr,aes256-ctr \
  -o MACs=hmac-sha2-256,hmac-sha2-512 \
  -o IPQoS=none \
  -o ConnectTimeout=20 \
  -o StrictHostKeyChecking=accept-new \
  root@$host

expect {
  -re "(?i)are you sure you want to continue connecting" {
    send "yes\r"
    exp_continue
  }
  -re "(?i)password:" {
    send -- "$pass\r"
  }
  timeout {
    puts stderr "ERROR: timed out waiting for password prompt"
    exit 1
  }
  eof {
    puts stderr "ERROR: ssh closed before password prompt"
    exit 1
  }
}

expect {
  -re {# |\$ } {}
  -re "(?i)Permission denied" {
    puts stderr "ERROR: Permission denied. Reset CloudCone root password again, rewrite /tmp/cfac_root_pass.txt, retry."
    exit 2
  }
  timeout {
    puts stderr "ERROR: timed out after password (shell prompt not seen)"
    exit 1
  }
}

send -- "mkdir -p /root/.ssh && chmod 700 /root/.ssh && touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys\r"
expect -re {# |\$ }
send -- "grep -qF 'cursor-cfac-agent' /root/.ssh/authorized_keys || echo '$pubkey' >> /root/.ssh/authorized_keys\r"
expect -re {# |\$ }
send -- "grep -qF 'cursor-cfac-agent' /root/.ssh/authorized_keys && echo KEY_INSTALLED || echo KEY_MISSING\r"
expect {
  -re "KEY_INSTALLED" {
    puts "OK: agent SSH key installed on $host"
  }
  -re "KEY_MISSING" {
    puts stderr "ERROR: key not found after write"
    exit 3
  }
  timeout {
    puts stderr "ERROR: timed out confirming key install"
    exit 1
  }
}
send -- "exit\r"
expect eof
exit 0
EOF
