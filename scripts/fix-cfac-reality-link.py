#!/usr/bin/env python3
"""Fix empty 3x-ui Reality pbk / QR without apt/sqlite3 CLI.
Writes /root/cfac-node-info.txt. Does not print secrets by default.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sqlite3
import subprocess
import time
from datetime import datetime
from pathlib import Path
from urllib.request import urlopen

DB = Path("/etc/x-ui/x-ui.db")
INFO = Path("/root/cfac-node-info.txt")
BACKUP_DIR = Path("/root/cfac-backups")
XRAY_CANDIDATES = [
    Path("/usr/local/x-ui/bin/xray-linux-amd64"),
    Path("/usr/local/x-ui/bin/xray"),
]


def log(msg: str) -> None:
    print(f"[{datetime.now():%F %T}] {msg}", flush=True)


def detect_ip() -> str:
    for url in ("https://api.ipify.org", "https://ifconfig.me"):
        try:
            with urlopen(url, timeout=8) as r:
                ip = r.read().decode().strip()
                if re.fullmatch(r"\d+\.\d+\.\d+\.\d+", ip):
                    return ip
        except Exception:
            pass
    return "199.255.96.31"


def find_xray() -> Path:
    for p in XRAY_CANDIDATES:
        if p.is_file() and os.access(p, os.X_OK):
            return p
    raise SystemExit("xray binary not found")


def derive_public_key(xray: Path, private_key: str) -> str:
    out = subprocess.check_output([str(xray), "x25519", "-i", private_key], text=True, stderr=subprocess.STDOUT)
    pub = None
    for line in out.splitlines():
        if re.search(r"(?i)password|public key|publickey", line):
            parts = line.split(":", 1)
            if len(parts) == 2 and parts[1].strip():
                pub = parts[1].strip()
                break
    if not pub:
        raise SystemExit(f"failed to derive public key: {out!r}")
    return pub


def main() -> None:
    if os.geteuid() != 0:
        raise SystemExit("run as root")
    if not DB.is_file():
        raise SystemExit(f"missing db: {DB}")

    xray = find_xray()
    vps_ip = detect_ip()
    log(f"db={DB} xray={xray} ip={vps_ip}")

    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    bak = BACKUP_DIR / f"x-ui.db.{datetime.now():%Y%m%d%H%M%S}"
    shutil.copy2(DB, bak)
    log(f"backup -> {bak}")

    conn = sqlite3.connect(str(DB))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, port, remark, stream_settings, settings FROM inbounds WHERE lower(protocol)='vless' ORDER BY id"
    ).fetchall()
    if not rows:
        raise SystemExit("no vless inbounds")

    fixed = 0
    last = None

    for row in rows:
        stream = json.loads(row["stream_settings"] or "{}")
        settings = json.loads(row["settings"] or "{}")
        if stream.get("security") != "reality":
            log(f"skip id={row['id']} port={row['port']} security={stream.get('security')}")
            continue

        rs = stream.setdefault("realitySettings", {})
        private_key = rs.get("privateKey") or ""
        if not private_key:
            raise SystemExit(f"inbound id={row['id']} missing privateKey")

        nested = (rs.get("settings") or {}) if isinstance(rs.get("settings"), dict) else {}
        public_key = nested.get("publicKey") or rs.get("publicKey") or ""
        if not public_key:
            log(f"id={row['id']}: deriving publicKey")
            public_key = derive_public_key(xray, private_key)

        fingerprint = nested.get("fingerprint") or "chrome"
        spider = nested.get("spiderX") or "/"
        sid_list = rs.get("shortIds") or []
        sid = sid_list[0] if sid_list else ""
        sni_list = rs.get("serverNames") or ["www.microsoft.com"]
        sni = sni_list[0] if sni_list else "www.microsoft.com"
        dest = rs.get("dest") or rs.get("target") or "www.microsoft.com:443"

        rs["publicKey"] = public_key
        rs["settings"] = {
            **nested,
            "publicKey": public_key,
            "fingerprint": fingerprint,
            "serverName": nested.get("serverName") or "",
            "spiderX": spider,
        }
        stream["realitySettings"] = rs

        new_stream = json.dumps(stream, separators=(",", ":"))
        if new_stream != (row["stream_settings"] or ""):
            conn.execute("UPDATE inbounds SET stream_settings=? WHERE id=?", (new_stream, row["id"]))
            fixed += 1
            log(f"fixed inbound id={row['id']} port={row['port']} remark={row['remark']}")
        else:
            log(f"inbound id={row['id']} already OK")

        clients = settings.get("clients") or []
        if not clients or not clients[0].get("id"):
            raise SystemExit(f"inbound id={row['id']} missing client uuid")
        last = {
            "uuid": clients[0]["id"],
            "pbk": public_key,
            "sid": sid,
            "sni": sni,
            "dest": dest,
            "port": row["port"],
            "remark": row["remark"] or "cfac-reality",
        }

    conn.commit()
    conn.close()
    if not last:
        raise SystemExit("no Reality inbound found")

    # restart x-ui
    subprocess.run(["x-ui", "restart"], check=False, capture_output=True)
    time.sleep(2)
    st = subprocess.run(["systemctl", "is-active", "x-ui"], capture_output=True, text=True)
    log(f"x-ui active={st.stdout.strip() or st.stderr.strip()}")

    link = (
        f"vless://{last['uuid']}@{vps_ip}:{last['port']}"
        f"?encryption=none&flow=xtls-rprx-vision&security=reality"
        f"&sni={last['sni']}&fp=chrome&pbk={last['pbk']}&sid={last['sid']}"
        f"&type=tcp&spx=%2F#{last['remark']}"
    )
    if "pbk=&" in link or re.search(r"pbk=(#|&|$)", link):
        raise SystemExit("repaired link still has empty pbk")

    panel_block = ""
    env_path = Path("/etc/x-ui/install-result.env")
    if env_path.is_file():
        env = {}
        for line in env_path.read_text(errors="replace").splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"')
        panel_block = (
            "【3x-ui 管理面板】\n"
            f"{env.get('XUI_ACCESS_URL', '')}\n"
            f"用户名: {env.get('XUI_USERNAME', '见 install-result.env')}\n"
            f"密码: {env.get('XUI_PASSWORD', '见 install-result.env')}\n"
            f"API Token: {env.get('XUI_API_TOKEN', '见面板')}"
        )

    text = f"""========================================
CFAC Reality 链接修复 {datetime.now()}
========================================
节点域名(备注): cfac.8518060.xyz
服务器 IP: {vps_ip}
协议: VLESS + Reality + XTLS-Vision
端口: {last['port']}
SNI: {last['sni']}
Dest: {last['dest']}
pbk 长度: {len(last['pbk'])}
sid 长度: {len(last['sid'])}
修复入站数: {fixed}
DB 备份: {bak}

【客户端链接 — 导入 Shadowrocket / v2rayNG】
{link}

{panel_block}

配置文件: /etc/x-ui/install-result.env
本修复脚本: /root/fix-cfac-reality-link.py
========================================
"""
    INFO.write_text(text)
    os.chmod(INFO, 0o600)
    log(f"wrote {INFO}")
    log(f"OK pbk_len={len(last['pbk'])} sid_len={len(last['sid'])} port={last['port']} fixed={fixed}")
    # listen check
    ss = subprocess.run(["ss", "-lnt"], capture_output=True, text=True)
    if f":{last['port']} " in (ss.stdout or ""):
        log(f"port {last['port']} is listening")
    else:
        log(f"WARN: port {last['port']} not seen in ss")


if __name__ == "__main__":
    main()
