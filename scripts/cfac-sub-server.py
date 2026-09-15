#!/usr/bin/env python3
"""Minimal CFAC HTTPS: node sub + SR (Study Rule) config."""
import base64, json, os, sqlite3, ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

DB = Path(os.environ.get("CFAC_DB", "/etc/x-ui/x-ui.db"))
PORT = int(os.environ.get("CFAC_SUB_PORT", "8880"))
VPS_IP = os.environ.get("CFAC_VPS_IP", "199.255.96.31")
CERT = Path("/etc/cfac-sub/certs/sub.crt")
KEY = Path("/etc/cfac-sub/certs/sub.key")
TOKEN = Path("/etc/cfac-sub/token").read_text().strip()
SR = Path("/etc/cfac-sub/sr.conf")
DESTS = Path("/etc/cfac-sub/reality-dests.json")


def links():
    out = []
    conn = sqlite3.connect(str(DB))
    for port, remark, stream, settings in conn.execute(
        "select port,remark,stream_settings,settings from inbounds where lower(protocol)='vless' and enable=1 order by port"
    ):
        s, st = json.loads(stream or "{}"), json.loads(settings or "{}")
        if s.get("security") != "reality":
            continue
        rs = s.get("realitySettings") or {}
        nested = rs.get("settings") if isinstance(rs.get("settings"), dict) else {}
        pbk = (nested or {}).get("publicKey") or rs.get("publicKey") or ""
        sid = (rs.get("shortIds") or [""])[0] or ""
        sni = (rs.get("serverNames") or ["www.microsoft.com"])[0]
        cls = st.get("clients") or []
        if not cls or not pbk:
            continue
        uuid, flow = cls[0].get("id") or "", cls[0].get("flow") or "xtls-rprx-vision"
        name = remark or f"cfac-{port}"
        try:
            j = json.loads(DESTS.read_text())
            cur = j["dests"][int(j.get("active_index", 0)) % len(j["dests"])]["name"]
            name = f"cfac-{port}-{cur}"
        except Exception:
            pass
        out.append(
            f"vless://{uuid}@{VPS_IP}:{port}?encryption=none&flow={flow}&security=reality"
            f"&sni={sni}&fp=chrome&pbk={pbk}&sid={sid}&type=tcp&spx=%2F#{name}"
        )
    conn.close()
    return out


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        print("[sub]", self.command, urlparse(self.path).path)

    def _send(self, code, body: bytes, ctype="text/plain; charset=utf-8", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = urlparse(self.path).path.rstrip("/")
        base = f"/{TOKEN}"
        sr = f"/{TOKEN}/sr"
        # keep old /rules alias
        rules = f"/{TOKEN}/rules"
        status = f"/{TOKEN}/status"
        if p in (base, f"/sub/{TOKEN}"):
            ls = links()
            if not ls:
                return self._send(404, b"empty\n")
            body = base64.b64encode(("\n".join(ls) + "\n").encode())
            return self._send(200, body, extra={"Profile-Update-Interval": "1"})
        if p in (sr, rules, f"/sub/{TOKEN}/sr", f"/sub/{TOKEN}/rules"):
            if not SR.is_file():
                return self._send(404, b"no sr\n")
            return self._send(200, SR.read_bytes())
        if p == status:
            try:
                j = json.loads(DESTS.read_text())
                i = int(j.get("active_index", 0)) % len(j["dests"])
                body = json.dumps(
                    {
                        "ok": True,
                        "active": j["dests"][i],
                        "next_rotate_at": j.get("next_rotate_at"),
                        "rotate_min_minutes": j.get("rotate_min_minutes", 50),
                        "rotate_max_minutes": j.get("rotate_max_minutes", 190),
                        "nodes": len(links()),
                    },
                    ensure_ascii=False,
                ).encode()
            except Exception as e:
                body = json.dumps({"ok": False, "err": type(e).__name__}).encode()
            return self._send(200, body, "application/json")
        self._send(404, b"not found\n")


def main():
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), H)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.load_cert_chain(str(CERT), str(KEY))
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
    print(f"[sub] https 0.0.0.0:{PORT}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
