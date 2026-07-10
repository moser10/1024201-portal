#!/usr/bin/env python3
"""Shadowrocket subscription server (HTTPS).

Subscribe field must be an https:// URL, NOT a vless:// link.
Response body is base64-encoded vless lines (airport-style).
"""
from __future__ import annotations

import base64
import json
import os
import re
import ssl
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

DB = Path(os.environ.get("CFAC_DB", "/etc/x-ui/x-ui.db"))
HOST = os.environ.get("CFAC_SUB_HOST", "0.0.0.0")
PORT = int(os.environ.get("CFAC_SUB_PORT", "8880"))
VPS_IP = os.environ.get("CFAC_VPS_IP", "199.255.96.31")
CERT = Path(os.environ.get("CFAC_SUB_CERT", "/etc/cfac-sub/certs/sub.crt"))
KEY = Path(os.environ.get("CFAC_SUB_KEY", "/etc/cfac-sub/certs/sub.key"))
INFO = Path("/root/cfac-node-info.txt")


def load_token() -> str:
    env = os.environ.get("CFAC_SUB_TOKEN", "").strip()
    if env:
        return env
    p = Path("/etc/cfac-sub/token")
    if p.is_file():
        return p.read_text().strip()
    raise SystemExit("missing token")


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
        links.append(
            f"vless://{uuid}@{VPS_IP}:{port}"
            f"?encryption=none&flow={flow}&security=reality"
            f"&sni={sni}&fp=chrome&pbk={pbk}&sid={sid}"
            f"&type=tcp&spx=%2F#{name}"
        )
    if not links and INFO.is_file():
        links = re.findall(r"vless://[^\s]+", INFO.read_text())
    return links


class Handler(BaseHTTPRequestHandler):
    token = ""

    def log_message(self, fmt: str, *args) -> None:
        print(f"[sub] {self.address_string()} {self.command} {urlparse(self.path).path}")

    def _deny(self, code: int = 404) -> None:
        body = b"not found\n"
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET(head_only=True)

    def do_GET(self, head_only: bool = False) -> None:  # noqa: N802
        p = urlparse(self.path).path.rstrip("/")
        allowed = {f"/{self.token}", f"/sub/{self.token}"}
        if p not in allowed:
            self._deny(404)
            return
        try:
            links = build_links()
        except Exception as e:
            print("[sub] build error", type(e).__name__, e)
            self._deny(500)
            return
        if not links:
            self._deny(404)
            return
        body = base64.b64encode(("\n".join(links) + "\n").encode())
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Profile-Update-Interval", "6")
        self.send_header("Subscription-Userinfo", "upload=0; download=0; total=0; expire=0")
        self.end_headers()
        if not head_only:
            self.wfile.write(body)


def main() -> None:
    Handler.token = load_token()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    if not CERT.is_file() or not KEY.is_file():
        raise SystemExit(f"missing TLS cert/key: {CERT} {KEY}")
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(certfile=str(CERT), keyfile=str(KEY))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"[sub] https://0.0.0.0:{PORT}/<token>/")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
