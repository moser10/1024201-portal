#!/usr/bin/env bash
# Mac one-shot: read password from a plain text file, SSH to VPS, fix Reality pbk.
#
# Password file (plain text, one line):
#   /tmp/cfac_root_pass.txt
# Put only the password in that file. No quotes. No python needed.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/cursor/fix-cfac-reality-link-7e94/scripts/run-cfac-fix-from-mac.sh | bash
#
# Does NOT delete the password file.
# Does NOT print the password or full vless:// link.

set -euo pipefail

PASS_FILE="${PASS_FILE:-/tmp/cfac_root_pass.txt}"
HOST="${HOST:-199.255.96.31}"
FIX_URL="${FIX_URL:-https://raw.githubusercontent.com/moser10/1024201-portal/cursor/fix-cfac-reality-link-7e94/scripts/fix-cfac-reality-link.sh}"
AGENT_PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMKqcF6tUdX+HH0tPuKCiZ0XDFsDCUBlKbP3XfvQ0aSz cursor-cfac-agent'

if [[ ! -f "$PASS_FILE" ]]; then
  echo "ERROR: missing $PASS_FILE" >&2
  echo "Create it with TextEdit/nano and put ONLY the CloudCone root password on one line." >&2
  exit 1
fi
if ! command -v expect >/dev/null 2>&1; then
  echo "ERROR: expect not found" >&2
  exit 1
fi

# Length check only — never print password
PASS_LEN="$(tr -d '\r\n' <"$PASS_FILE" | wc -c | tr -d ' ')"
echo "[check] password_file=$PASS_FILE length=$PASS_LEN"
if [[ "$PASS_LEN" -lt 1 ]]; then
  echo "ERROR: password file is empty" >&2
  exit 1
fi

export HOST PASS_FILE FIX_URL AGENT_PUBKEY

# expect reads the password file itself (shell does not expand password chars)
expect <<'EOF'
set timeout 240
set host $env(HOST)
set pass_file $env(PASS_FILE)
set fix_url $env(FIX_URL)
set pubkey $env(AGENT_PUBKEY)

set fh [open $pass_file r]
set pass [string trim [read $fh]]
close $fh
if {$pass eq ""} {
  puts stderr "ERROR: password file empty after trim"
  exit 1
}

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
    puts stderr "ERROR: server rejected the password in $pass_file"
    puts stderr "This is NOT a script format issue. CloudCone root password does not match."
    puts stderr "Fix on CloudCone Access page, then overwrite the txt and rerun."
    exit 2
  }
  timeout {
    puts stderr "ERROR: timed out after password (no root shell)"
    exit 1
  }
}

puts "OK: logged in. Running Reality fix..."

send -- "mkdir -p /root/.ssh && chmod 700 /root/.ssh && touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys\r"
expect -re {# }
send -- "grep -qF cursor-cfac-agent /root/.ssh/authorized_keys || echo '$pubkey' >> /root/.ssh/authorized_keys\r"
expect -re {# }
send -- "curl -fsSL '$fix_url' -o /root/fix-cfac-reality-link.sh && chmod +x /root/fix-cfac-reality-link.sh && bash /root/fix-cfac-reality-link.sh; echo FIX_EXIT:\$?\r"
expect {
  -re "FIX_EXIT:0" {
    puts "OK: Reality fix finished"
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
send -- "grep -q '^vless://' /root/cfac-node-info.txt && grep pbk= /root/cfac-node-info.txt | grep -vq 'pbk=&' && echo LINK_OK || echo LINK_BAD\r"
expect {
  -re "LINK_OK" { puts "OK: node info has vless link with pbk" }
  -re "LINK_BAD" { puts stderr "ERROR: info file link still bad"; exit 4 }
  timeout { puts stderr "ERROR: timed out checking info file"; exit 1 }
}
expect -re {# }
send -- "exit\r"
expect eof
puts "DONE. Next: ssh in and run:  grep '^vless://' /root/cfac-node-info.txt"
exit 0
EOF
