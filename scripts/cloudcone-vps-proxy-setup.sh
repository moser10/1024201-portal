#!/usr/bin/env bash
# CloudCone VPS: 3x-ui + VLESS-Reality 一键安装
# 用法（root 或 sudo）:
#   curl -fsSL https://.../cloudcone-vps-proxy-setup.sh | bash
#   或 scp 到服务器后:
#   NODE_DOMAIN=cfac.8518060.xyz bash cloudcone-vps-proxy-setup.sh
#
# 可选环境变量:
#   NODE_DOMAIN      节点域名（仅备注/DNS，Reality 伪装 SNI 用 REALITY_SNI）
#   VPS_IP           留空则自动检测公网 IPv4
#   PANEL_PORT       面板端口（默认 28421）
#   PANEL_USER       面板用户名（默认随机）
#   PANEL_PASS       面板密码（默认随机）
#   REALITY_PORT     节点端口（默认 443）
#   REALITY_DEST     Reality 目标（默认 www.microsoft.com:443）
#   REALITY_SNI      客户端 SNI（默认 www.microsoft.com）
#   SKIP_UFW         设为 1 跳过防火墙
#   SKIP_HOSTNAME    设为 1 不改 hostname

set -euo pipefail

NODE_DOMAIN="${NODE_DOMAIN:-cfac.8518060.xyz}"
VPS_IP="${VPS_IP:-}"
PANEL_PORT="${PANEL_PORT:-28421}"
PANEL_USER="${PANEL_USER:-}"
PANEL_PASS="${PANEL_PASS:-}"
REALITY_PORT="${REALITY_PORT:-443}"
REALITY_DEST="${REALITY_DEST:-www.microsoft.com:443}"
REALITY_SNI="${REALITY_SNI:-www.microsoft.com}"
REALITY_REMARK="${REALITY_REMARK:-cfac-reality}"
LOG_FILE="/var/log/cfac-proxy-setup.log"
INFO_FILE="/root/cfac-node-info.txt"
INSTALL_ENV="/etc/x-ui/install-result.env"

rand_alnum() {
  local n="${1:-16}"
  tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$n"
}

log() { echo "[$(date '+%F %T')] $*"; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "请使用 root 运行: sudo bash $0" >&2
    exit 1
  fi
}

detect_ip() {
  if [[ -n "$VPS_IP" ]]; then
    echo "$VPS_IP"
    return
  fi
  curl -4fsS --max-time 10 https://api.ipify.org 2>/dev/null \
    || curl -4fsS --max-time 10 https://ifconfig.me 2>/dev/null \
    || hostname -I | awk '{print $1}'
}

step_system() {
  log "=== [1/6] 系统更新与基础包 ==="
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" || true
  apt-get install -y curl wget ca-certificates jq ufw uuid-runtime openssl

  if [[ "${SKIP_HOSTNAME:-0}" != "1" ]]; then
  hostnamectl set-hostname "$NODE_DOMAIN" || true
  log "hostname 已设为 $NODE_DOMAIN"
  fi
}

step_firewall() {
  if [[ "${SKIP_UFW:-0}" == "1" ]]; then
    log "跳过 UFW"
    return
  fi
  log "=== [2/6] 配置 UFW ==="
  ufw --force reset || true
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow 22/tcp comment 'SSH'
  ufw allow "${PANEL_PORT}"/tcp comment '3x-ui panel'
  ufw allow "${REALITY_PORT}"/tcp comment 'VLESS Reality'
  ufw --force enable
  ufw status verbose || true
}

step_install_3xui() {
  log "=== [3/6] 安装 3x-ui（非交互）==="
  if command -v x-ui >/dev/null 2>&1 && [[ -f "$INSTALL_ENV" ]]; then
    log "检测到已安装 3x-ui，跳过安装"
    return
  fi

  [[ -z "$PANEL_USER" ]] && PANEL_USER="admin$(rand_alnum 6)"
  [[ -z "$PANEL_PASS" ]] && PANEL_PASS="$(rand_alnum 4)$(rand_alnum 8)"

  export XUI_NONINTERACTIVE=1
  export XUI_USERNAME="$PANEL_USER"
  export XUI_PASSWORD="$PANEL_PASS"
  export XUI_PANEL_PORT="$PANEL_PORT"
  export XUI_WEB_BASE_PATH="$(rand_alnum 18)"
  export XUI_SSL_MODE=none
  export XUI_SERVER_IP="$VPS_IP"
  export XUI_ENABLE_FAIL2BAN=false

  curl -fsSL https://raw.githubusercontent.com/mhsanaei/3x-ui/master/install.sh | bash

  if [[ ! -f "$INSTALL_ENV" ]]; then
    echo "3x-ui 安装失败：未找到 $INSTALL_ENV" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$INSTALL_ENV"
  log "面板: ${XUI_ACCESS_URL:-http://$VPS_IP:$PANEL_PORT}"
}

find_xray_bin() {
  local bin
  for bin in /usr/local/x-ui/bin/xray-linux-amd64 /usr/local/x-ui/bin/xray; do
    if [[ -x "$bin" ]]; then
      echo "$bin"
      return
    fi
  done
  echo "未找到 xray 二进制" >&2
  exit 1
}

step_add_reality_inbound() {
  log "=== [4/6] 创建 VLESS-Reality 入站 ==="
  # shellcheck disable=SC1090
  source "$INSTALL_ENV"

  local xray_bin client_uuid private_key public_key short_id
  xray_bin="$(find_xray_bin)"
  client_uuid="$(uuidgen)"
  short_id="$(openssl rand -hex 4)"

  keys="$("$xray_bin" x25519)"
  private_key="$(echo "$keys" | awk -F': ' '/PrivateKey|Private key/{gsub(/^ +/,"",$2); print $2; exit}')"
  public_key="$(echo "$keys" | awk -F': ' '/Password|Public key/{gsub(/^ +/,"",$2); print $2; exit}')"
  if [[ -z "$private_key" || -z "$public_key" ]]; then
    echo "生成 Reality 密钥失败" >&2
    exit 1
  fi

  local base="http://127.0.0.1:${XUI_PANEL_PORT}/${XUI_WEB_BASE_PATH}"
  local api_token="${XUI_API_TOKEN:-}"
  if [[ -z "$api_token" ]]; then
    api_token="$(/usr/local/x-ui/x-ui setting -getApiToken true 2>/dev/null | awk -F': ' '/apiToken/{print $2}')"
  fi
  if [[ -z "$api_token" ]]; then
    echo "无法获取 3x-ui API Token" >&2
    exit 1
  fi

  REALITY_PORT="$REALITY_PORT" REALITY_DEST="$REALITY_DEST" REALITY_SNI="$REALITY_SNI" \
  REALITY_REMARK="$REALITY_REMARK" XUI_API_TOKEN="$api_token" python3 - "$base" "$client_uuid" "$private_key" "$public_key" "$short_id" <<'PY'
import json, os, sys, urllib.request, urllib.parse

base, client_uuid, private_key, public_key, short_id = sys.argv[1:6]
token = os.environ["XUI_API_TOKEN"]
port = int(os.environ["REALITY_PORT"])
dest = os.environ["REALITY_DEST"]
sni = os.environ["REALITY_SNI"]
remark = os.environ["REALITY_REMARK"]
email = f"user-{client_uuid[:8]}@local"

settings = {
    "clients": [{
        "id": client_uuid,
        "flow": "xtls-rprx-vision",
        "email": email,
        "limitIp": 0,
        "totalGB": 0,
        "expiryTime": 0,
        "enable": True,
        "tgId": "",
        "subId": "",
        "comment": remark,
        "reset": 0
    }],
    "decryption": "none",
    "fallbacks": []
}

stream = {
    "network": "tcp",
    "security": "reality",
    "externalProxy": [],
    "realitySettings": {
        "show": False,
        "xver": 0,
        "dest": dest,
        "serverNames": [sni],
        "privateKey": private_key,
        "minClient": "",
        "maxClient": "",
        "maxTimediff": 0,
        "shortIds": [short_id, ""],
        "settings": {
            "publicKey": public_key,
            "fingerprint": "chrome",
            "serverName": "",
            "spiderX": "/"
        }
    },
    "tcpSettings": {
        "acceptProxyProtocol": False,
        "header": {"type": "none"}
    }
}

sniffing = {
    "enabled": True,
    "destOverride": ["http", "tls", "quic"],
    "metadataOnly": False,
    "routeOnly": False
}

payload = urllib.parse.urlencode({
    "up": "0",
    "down": "0",
    "total": "0",
    "remark": remark,
    "enable": "true",
    "expiryTime": "0",
    "listen": "",
    "port": str(port),
    "protocol": "vless",
    "settings": json.dumps(settings, separators=(",", ":")),
    "streamSettings": json.dumps(stream, separators=(",", ":")),
    "sniffing": json.dumps(sniffing, separators=(",", ":")),
    "allocate": ""
}).encode()

req = urllib.request.Request(f"{base}/panel/api/inbounds/add", data=payload, method="POST")
req.add_header("Content-Type", "application/x-www-form-urlencoded")
req.add_header("Authorization", f"Bearer {token}")
with urllib.request.urlopen(req, timeout=30) as resp:
    body = resp.read().decode()
print(body)
if '"success":true' not in body.replace(" ", "").lower():
    raise SystemExit("add inbound failed: " + body)
PY

  systemctl restart x-ui 2>/dev/null || x-ui restart 2>/dev/null || true

  local vless_link
  vless_link="vless://${client_uuid}@${VPS_IP}:${REALITY_PORT}?encryption=none&flow=xtls-rprx-vision&security=reality&sni=${REALITY_SNI}&fp=chrome&pbk=${public_key}&sid=${short_id}&type=tcp#${REALITY_REMARK}"

  cat >"$INFO_FILE" <<EOF
========================================
CFAC 节点安装完成 $(date)
========================================
节点域名(备注): ${NODE_DOMAIN}
服务器 IP: ${VPS_IP}
协议: VLESS + Reality + XTLS-Vision
端口: ${REALITY_PORT}
SNI: ${REALITY_SNI}
Dest: ${REALITY_DEST}

【客户端链接 — 导入 v2rayNG / Shadowrocket】
${vless_link}

【3x-ui 管理面板】
${XUI_ACCESS_URL:-http://${VPS_IP}:${XUI_PANEL_PORT}/${XUI_WEB_BASE_PATH}}
用户名: ${XUI_USERNAME}
密码: ${XUI_PASSWORD}
API Token: ${XUI_API_TOKEN:-见面板}

配置文件: ${INSTALL_ENV}
安装日志: ${LOG_FILE}
========================================
EOF
  chmod 600 "$INFO_FILE"
  log "节点信息已写入 $INFO_FILE"
}

step_cloudcone_stats() {
  log "=== [5/6] （可选）CloudCone 监控 agent ==="
  if [[ -n "${SKIP_CLOUDCONE_STATS:-}" ]]; then
    return
  fi
  log "可在 CloudCone 面板 USAGE & STATISTICS 复制命令手动安装"
}

step_done() {
  log "=== [6/6] 完成 ==="
  cat "$INFO_FILE"
}

main() {
  require_root
  exec > >(tee -a "$LOG_FILE") 2>&1
  VPS_IP="$(detect_ip)"
  log "开始安装，IP=$VPS_IP 域名=$NODE_DOMAIN"

  step_system
  step_firewall
  step_install_3xui
  # 替换 python heredoc 占位符 — 用 sed 注入到临时 py 更稳
  step_add_reality_inbound
  step_cloudcone_stats
  step_done
}

main "$@"
