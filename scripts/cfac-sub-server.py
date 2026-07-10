#!/usr/bin/env python3
"""Minimal Shadowrocket subscription server for CFAC Reality nodes.

Serves base64(vless lines) at /<token>/
Does not log full links.
"""
from __future__ import annotations

import base64
import json
import os
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

DB = Path(os.environ.get("CFAC_DB", "/etc/x-ui/x-ui.db"))
HOST = os.environ.get("CFAC_SUB_HOST", "0.0.0.0")
PORT = int(os.environ.get("CFAC_SUB_PORT", "8880"))
TOKEN = os.environ.get("CFAC_SUB_TOKEN", "")
VPS_IP = os.environ.get("CFAC_VPS_IP", "199.255.96.31")
INFO = Path("/root/cfac-node-info.txt")


def load_token() -> str:
    if TOKEN:
        return TOKEN.strip()
    p = Path("/etc/cfac-sub/token")
    if p.is_file():
        return p.read_text().strip()
    raise SystemExit("missing CFAC_SUB_TOKEN /etc/cfac-sub/token")


def build_links() -> list[str]:
    links: list[str] = []
    conn = sqlite3.connect(str(DB))
    rows = conn.execute(
        "select port, remark, stream_settings, settings from inbounds "
        "where lower(protocol)='vless' and enable=1 order by port"
    ).fetchall()
    conn.close()
    for port, remark, stream, settings in rows:
        s = json.loads(stream or "{}")
        st = json.loads(settings or "{}")
        if s.get("security") != "reality":
            continue
        rs = s.get("realitySettings") or {}
        nested = rs.get("settings") if isinstance(rs.get("settings"), dict) else {}
        pbk = (nested or {}).get("publicKey") or rs.get("publicKey") or ""
        sid = (rs.get("shortIds") or [""])[0] or ""
        sni = (rs.get("serverNames") or ["www.microsoft.com"])[0]
        clients = st.get("clients") or []
        if not clients or not pbk:
            continue
        uuid = clients[0].get("id") or ""
        flow = clients[0].get("flow") or "xtls-rprx-vision"
        if not uuid:
            continue
        name = remark or f"cfac-{port}"
        link = (
            f"vless://{uuid}@{VPS_IP}:{port}"
            f"?encryption=none&flow={flow}&security=reality"
            f"&sni={sni}&fp=chrome&pbk={pbk}&sid={sid}"
            f"&type=tcp&spx=%2F#{name}"
        )
        links.append(link)
    if not links and INFO.is_file():
        links = re.findall(r"vless://[^\s]+", INFO.read_text())
    return links


class Handler(BaseHTTPRequestHandler):
    token = ""

    def log_message(self, fmt: str, *args) -> None:
        # avoid logging query/token bodies with secrets
        sys_stderr = getattr(self, "address_string", lambda: "?")()
        print(f"[sub] {sys_stderr} {self.command} {urlparse(self.path).path}")

    def _deny(self, code: int = 404) -> None:
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"not found\n")

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") + "/"
        want = f"/{self.token}/"
        # also accept /sub/<token>/
        alt = f"/sub/{self.token}/"
        if path not in (want, alt, f"/{self.token}", f"/sub/{self.token}"):
            # normalize without trailing for compare
            p = urlparse(self.path).path.rstrip("/")
            if p not in (f"/{self.token}", f"/sub/{self.token}"):
                self._deny(404)
                return
        try:
            links = build_links()
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"error\n")
            print("[sub] build error", type(e).__name__)
            return
        if not links:
            self._deny(404)
            return
        body = base64.b64encode(("\n".join(links) + "\n").encode())
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Profile-Update-Interval", "6")
        self.send_header("Content-Disposition", "attachment; filename=cfac")
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    Handler.token = load_token()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[sub] listening on {HOST}:{PORT} path=/{Handler.token}/ nodes_dynamic=1")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
