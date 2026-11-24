#!/usr/bin/env bash
# Fix 3x-ui VLESS-Reality empty QR / empty share link (empty pbk=).
#
# Root cause (MHSanaei/3x-ui#3956): panel share-link / QR reads
#   streamSettings.realitySettings.settings.publicKey
# but some installs only keep publicKey at realitySettings.publicKey (or lose
# the nested settings object after save). Clients then get pbk= and fail.
#
# Usage (on VPS as root):
#   bash /root/fix-cfac-reality-link.sh
#   # or:
#   curl -fsSL https://raw.githubusercontent.com/moser10/1024201-portal/<branch>/scripts/fix-cfac-reality-link.sh | bash
#
# Safe: does not print full vless:// or passwords to stdout by default.
# Writes usable link to /root/cfac-node-info.txt (mode 600).
# Set PRINT_LINK=1 to also print the repaired link once (for Shadowrocket paste).

set -euo pipefail

INFO_FILE="${INFO_FILE:-/root/cfac-node-info.txt}"
DB_CANDIDATES=(
  /etc/x-ui/x-ui.db
  /usr/local/x-ui/x-ui.db
  /etc/x-ui/bin/x-ui.db
)
REALITY_PORT="${REALITY_PORT:-443}"
REALITY_REMARK="${REALITY_REMARK:-cfac-reality}"
NODE_DOMAIN="${NODE_DOMAIN:-cfac.8518060.xyz}"
PRINT_LINK="${PRINT_LINK:-0}"
BACKUP_DIR="/root/cfac-backups"

log() { echo "[$(date '+%F %T')] $*"; }

die() { echo "ERROR: $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "run as root"
  fi
}

find_db() {
  local p
  for p in "${DB_CANDIDATES[@]}"; do
    if [[ -f "$p" ]]; then
      echo "$p"
      return
    fi
  done
  die "x-ui.db not found (tried: ${DB_CANDIDATES[*]})"
}

find_xray_bin() {
  local bin
  for bin in /usr/local/x-ui/bin/xray-linux-amd64 /usr/local/x-ui/bin/xray /usr/local/bin/xray; do
    if [[ -x "$bin" ]]; then
      echo "$bin"
      return
    fi
  done
  die "xray binary not found"
}

detect_ip() {
  if [[ -n "${VPS_IP:-}" ]]; then
    echo "$VPS_IP"
    return
  fi
  curl -4fsS --max-time 10 https://api.ipify.org 2>/dev/null \
    || curl -4fsS --max-time 10 https://ifconfig.me 2>/dev/null \
    || hostname -I | awk '{print $1}'
}

derive_public_key() {
  local xray_bin="$1" private_key="$2"
  local out pub
  out="$("$xray_bin" x25519 -i "$private_key" 2>/dev/null || true)"
  if [[ -z "$out" ]]; then
    out="$("$xray_bin" x25519 -i "$private_key" 2>&1 || true)"
  fi
  pub="$(echo "$out" | awk -F': ' '/Password|Public key|PublicKey/{gsub(/^ +/,"",$2); print $2; exit}')"
  if [[ -z "$pub" ]]; then
    die "failed to derive public key from privateKey via xray x25519"
  fi
  echo "$pub"
}

main() {
  require_root
  if ! command -v sqlite3 >/dev/null 2>&1 || ! command -v jq >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y sqlite3 jq curl ca-certificates
  fi

  local db xray_bin vps_ip
  db="$(find_db)"
  xray_bin="$(find_xray_bin)"
  vps_ip="$(detect_ip)"
  log "db=$db xray=$xray_bin ip=$vps_ip"

  mkdir -p "$BACKUP_DIR"
  local bak="$BACKUP_DIR/x-ui.db.$(date +%Y%m%d%H%M%S)"
  cp -a "$db" "$bak"
  log "backup -> $bak"

  # Dump candidate Reality inbounds (id, port, remark, stream_settings)
  local rows
  rows="$(sqlite3 -separator $'\t' "$db" \
    "SELECT id, port, remark, stream_settings, settings FROM inbounds WHERE lower(protocol)='vless' ORDER BY id;")"
  [[ -n "$rows" ]] || die "no vless inbounds in database"

  local fixed=0
  local last_uuid="" last_pbk="" last_sid="" last_sni="www.microsoft.com" last_port="$REALITY_PORT" last_remark="$REALITY_REMARK"

  while IFS=$'\t' read -r id port remark stream_settings settings; do
    [[ -n "$id" ]] || continue
    local sec
    sec="$(echo "$stream_settings" | jq -r '.security // empty' 2>/dev/null || true)"
    if [[ "$sec" != "reality" ]]; then
      log "skip inbound id=$id port=$port (security=${sec:-none})"
      continue
    fi

    local private_key nested_pbk top_pbk sid sni dest fingerprint spider
    private_key="$(echo "$stream_settings" | jq -r '.realitySettings.privateKey // empty')"
    nested_pbk="$(echo "$stream_settings" | jq -r '.realitySettings.settings.publicKey // empty')"
    top_pbk="$(echo "$stream_settings" | jq -r '.realitySettings.publicKey // empty')"
    sid="$(echo "$stream_settings" | jq -r '.realitySettings.shortIds[0] // empty')"
    sni="$(echo "$stream_settings" | jq -r '.realitySettings.serverNames[0] // "www.microsoft.com"')"
    dest="$(echo "$stream_settings" | jq -r '.realitySettings.dest // .realitySettings.target // "www.microsoft.com:443"')"
    fingerprint="$(echo "$stream_settings" | jq -r '.realitySettings.settings.fingerprint // "chrome"')"
    spider="$(echo "$stream_settings" | jq -r '.realitySettings.settings.spiderX // "/"')"

    [[ -n "$private_key" ]] || die "inbound id=$id missing realitySettings.privateKey"

    local public_key="$nested_pbk"
    if [[ -z "$public_key" ]]; then
      public_key="$top_pbk"
    fi
    if [[ -z "$public_key" ]]; then
      log "inbound id=$id: deriving publicKey from privateKey"
      public_key="$(derive_public_key "$xray_bin" "$private_key")"
    fi

    local needs_fix=0
    if [[ -z "$nested_pbk" || "$nested_pbk" != "$public_key" ]]; then
      needs_fix=1
    fi
    # Also ensure top-level publicKey exists for older tools
    if [[ -z "$top_pbk" ]]; then
      needs_fix=1
    fi

    local new_stream
    new_stream="$(echo "$stream_settings" | jq \
      --arg pbk "$public_key" \
      --arg fp "$fingerprint" \
      --arg spx "$spider" \
      '
      .realitySettings.publicKey = $pbk
      | .realitySettings.settings = ((.realitySettings.settings // {}) + {
          publicKey: $pbk,
          fingerprint: $fp,
          serverName: (.realitySettings.settings.serverName // ""),
          spiderX: $spx
        })
      ')"

    if [[ "$needs_fix" -eq 1 ]] || [[ "$new_stream" != "$stream_settings" ]]; then
      # Escape for SQL: single quotes doubled
      local esc
      esc="$(printf '%s' "$new_stream" | sed "s/'/''/g")"
      sqlite3 "$db" "UPDATE inbounds SET stream_settings='$esc' WHERE id=$id;"
      log "fixed inbound id=$id port=$port remark=${remark:-?} (nested settings.publicKey restored)"
      fixed=$((fixed + 1))
    else
      log "inbound id=$id already has settings.publicKey"
    fi

    local uuid
    uuid="$(echo "$settings" | jq -r '.clients[0].id // empty')"
    [[ -n "$uuid" ]] || die "inbound id=$id has no client uuid in settings"

    last_uuid="$uuid"
    last_pbk="$public_key"
    last_sid="$sid"
    last_sni="$sni"
    last_port="$port"
    last_remark="${remark:-$REALITY_REMARK}"
    # keep dest for info file
    export _CFAC_DEST="$dest"
  done <<<"$rows"

  [[ -n "$last_uuid" && -n "$last_pbk" ]] || die "no Reality inbound repaired / found"
  [[ -n "$last_sid" ]] || log "WARN: shortId empty — client may still fail; check panel Reality shortIds"

  # Restart panel so QR/share link regenerates from DB
  if command -v x-ui >/dev/null 2>&1; then
    x-ui restart >/dev/null 2>&1 || systemctl restart x-ui
  else
    systemctl restart x-ui
  fi
  sleep 2
  systemctl is-active --quiet x-ui && log "x-ui is active" || log "WARN: x-ui may not be active — check: systemctl status x-ui"

  local vless_link
  vless_link="vless://${last_uuid}@${vps_ip}:${last_port}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${last_sni}&fp=chrome&pbk=${last_pbk}&sid=${last_sid}&type=tcp&spx=%2F#${last_remark}"

  # Preserve panel URL / credentials from existing info file if present
  local panel_block=""
  if [[ -f "$INFO_FILE" ]]; then
    panel_block="$(awk '/【3x-ui 管理面板】/,/^=+$/' "$INFO_FILE" | head -n -1 || true)"
  fi
  if [[ -z "$panel_block" && -f /etc/x-ui/install-result.env ]]; then
    # shellcheck disable=SC1091
    source /etc/x-ui/install-result.env
    panel_block="【3x-ui 管理面板】
${XUI_ACCESS_URL:-}
用户名: ${XUI_USERNAME:-见 install-result.env}
密码: ${XUI_PASSWORD:-见 install-result.env}
API Token: ${XUI_API_TOKEN:-见面板}"
  fi

  umask 077
  cat >"$INFO_FILE" <<EOF
========================================
CFAC Reality 链接修复 $(date)
========================================
节点域名(备注): ${NODE_DOMAIN}
服务器 IP: ${vps_ip}
协议: VLESS + Reality + XTLS-Vision
端口: ${last_port}
SNI: ${last_sni}
Dest: ${_CFAC_DEST:-www.microsoft.com:443}
pbk 长度: ${#last_pbk}
sid 长度: ${#last_sid}
修复入站数: ${fixed}
DB 备份: ${bak}

【客户端链接 — 导入 Shadowrocket / v2rayNG】
${vless_link}

${panel_block}

配置文件: /etc/x-ui/install-result.env
本修复脚本: scripts/fix-cfac-reality-link.sh
========================================
EOF
  chmod 600 "$INFO_FILE"
  log "wrote $INFO_FILE (chmod 600)"

  # Sanity: pbk must be non-empty in the stored link
  if grep -q 'pbk=&\|pbk=#' "$INFO_FILE" || ! grep -q 'pbk=[A-Za-z0-9_-]' "$INFO_FILE"; then
    die "repaired link still has empty pbk — inspect DB manually"
  fi

  log "OK: Reality share fields restored. Import from: cat $INFO_FILE"
  log "Shadowrocket: copy the vless:// line only (do not paste into chat)."
  if [[ "$PRINT_LINK" == "1" ]]; then
    echo "$vless_link"
  else
    log "link not printed (set PRINT_LINK=1 to echo once). pbk_len=${#last_pbk} sid_len=${#last_sid} port=${last_port}"
  fi

  # Quick listen check
  if ss -lnt 2>/dev/null | grep -q ":${last_port} "; then
    log "port ${last_port} is listening"
  else
    log "WARN: port ${last_port} not seen in ss — check xray/inbound enable"
  fi
}

main "$@"
