#!/usr/bin/env bash
# Run entirely on your Mac. Uses /tmp/cfac_root_pass.txt, SSHs into the VPS,
# installs the Reality pbk fix. Does not need the cloud agent to hold your password.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/cursor/fix-cfac-reality-link-7e94/scripts/run-cfac-fix-from-mac.sh | bash
#
# Does NOT delete /tmp/cfac_root_pass.txt.
# Does NOT print the password or full vless:// link.

set -euo pipefail

PASS_FILE="${PASS_FILE:-/tmp/cfac_root_pass.txt}"
HOST="${HOST:-199.255.96.31}"
FIX_URL="${FIX_URL:-https://raw.githubusercontent.com/moser10/1024201-portal/cursor/fix-cfac-reality-link-7e94/scripts/fix-cfac-reality-link.sh}"
AGENT_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMKqcF6tUdX+HH0tPuKCiZ0XDFsDCUBlKbP3XfvQ0aSz cursor-cfac-agent'

if [[ ! -f "$PASS_FILE" ]]; then
  echo "ERROR: $PASS_FILE not found on this Mac." >&2
  exit 1
fi
if ! command -v expect >/dev/null 2>&1; then
  echo "ERROR: expect not found (should be built into macOS)." >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
p = Path("/tmp/cfac_root_pass.txt")
raw = p.read_bytes()
stripped = raw.decode("utf-8", errors="replace").strip()
ends_nl = "yes" if raw.endswith(b"\n") or raw.endswith(b"\r\n") else "no"
has_cr = "yes" if b"\r" in raw else "no"
print("[check] pass_file_bytes=%d" % len(raw))
print("[check] pass_len_after_strip=%d" % len(stripped))
print("[check] ends_with_newline=%s" % ends_nl)
print("[check] contains_cr=%s" % has_cr)
if not stripped:
    raise SystemExit("ERROR: password file empty after strip")
if len(stripped) < 8:
    print("[warn] password looks unusually short for CloudCone")
PY

PASS="$(python3 -c 'from pathlib import Path; print(Path("/tmp/cfac_root_pass.txt").read_text(encoding="utf-8").strip())')"
export HOST PASS FIX_URL AGENT_PUBKEY

expect <<'EOF'
set timeout 240
set host $env(HOST)
set pass $env(PASS)
set fix_url $env(FIX_URL)
set pubkey $env(AGENT_PUBKEY)

spawn ssh -tt \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o NumberOfPasswordPrompts=1 \
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
}

expect {
  -re {root@.+:.*# } {}
  -re {(?:^|\r|\n)# } {}
  -re "(?i)Permission denied" {
    puts stderr "ERROR: Permission denied — CloudCone password in the file does not match the server."
    puts stderr "Rewrite the file with the NEW Access-page password using:"
    puts stderr "  python3 - <<'PY'"
    puts stderr "from pathlib import Path"
    puts stderr "Path('/tmp/cfac_root_pass.txt').write_text(input('paste password then Enter: ').strip())"
    puts stderr "print('saved len=', len(Path('/tmp/cfac_root_pass.txt').read_text().strip()))"
    puts stderr "PY"
    exit 2
  }
  timeout {
    puts stderr "ERROR: timed out after password (no root shell)"
    exit 1
  }
}

puts "OK: logged in. Running Reality fix on VPS..."

send -- "mkdir -p /root/.ssh && chmod 700 /root/.ssh && touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys\r"
expect -re {# }
send -- "grep -qF cursor-cfac-agent /root/.ssh/authorized_keys || echo '$pubkey' >> /root/.ssh/authorized_keys\r"
expect -re {# }
send -- "curl -fsSL '$fix_url' -o /root/fix-cfac-reality-link.sh && chmod +x /root/fix-cfac-reality-link.sh && bash /root/fix-cfac-reality-link.sh; echo FIX_EXIT:\$?\r"
expect {
  -re "FIX_EXIT:0" {
    puts "OK: Reality fix finished (exit 0)"
  }
  -re "FIX_EXIT:\[1-9\]" {
    puts stderr "ERROR: fix script failed — see output above"
    exit 3
  }
  timeout {
    puts stderr "ERROR: timed out while running fix script"
    exit 1
  }
}
expect -re {# }
send -- "grep -q '^vless://' /root/cfac-node-info.txt && grep -q 'pbk=.\+' /root/cfac-node-info.txt && echo LINK_OK || echo LINK_BAD\r"
expect {
  -re "LINK_OK" { puts "OK: /root/cfac-node-info.txt has vless link with non-empty pbk" }
  -re "LINK_BAD" { puts stderr "ERROR: info file link still bad"; exit 4 }
  timeout { puts stderr "ERROR: timed out checking info file"; exit 1 }
}
expect -re {# }
send -- "exit\r"
expect eof
puts "DONE. On Mac, login again and run:  grep '^vless://' /root/cfac-node-info.txt"
puts "Then paste that single line into Shadowrocket."
exit 0
EOF
