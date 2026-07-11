#!/usr/bin/env python3
"""Rotate Reality dest/SNI for all VLESS-Reality inbounds, then restart x-ui.

Usage:
  python3 /root/cfac-rotate-reality-dest.py --list
  python3 /root/cfac-rotate-reality-dest.py --pick teams.microsoft.com
  python3 /root/cfac-rotate-reality-dest.py --next
"""
from __future__ import annotations

import argparse
import json
import shutil
import socket
import sqlite3
import ssl
import subprocess
import time
from datetime import datetime
from pathlib import Path

DB = Path("/etc/x-ui/x-ui.db")
DESTS = Path("/etc/cfac-sub/reality-dests.txt")
STATE = Path("/etc/cfac-sub/active-dest")
BACKUP = Path("/root/cfac-backups")


def parse_dests() -> list[tuple[str, str, str]]:
    out = []
    for line in DESTS.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) < 2:
            continue
        dest, sni = parts[0].strip(), parts[1].strip()
        note = parts[2].strip() if len(parts) > 2 else ""
        out.append((dest, sni, note))
    return out


def verify_tls(hostport: str, sni: str, timeout: float = 8.0) -> bool:
    host, _, port = hostport.partition(":")
    port = int(port or "443")
    try:
        raw = socket.create_connection((host, port), timeout=timeout)
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(raw, server_hostname=sni) as ss:
            ver = ss.version() or ""
            return ver.startswith("TLSv1.3")
    except Exception as e:
        print(f"verify fail {hostport} sni={sni}: {type(e).__name__}: {e}")
        return False


def apply(dest: str, sni: str) -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    bak = BACKUP / f"x-ui.db.rotate.{datetime.now():%Y%m%d%H%M%S}"
    shutil.copy2(DB, bak)
    conn = sqlite3.connect(str(DB))
    rows = conn.execute(
        "select id, stream_settings from inbounds where lower(protocol)='vless'"
    ).fetchall()
    n = 0
    for iid, stream in rows:
        s = json.loads(stream or "{}")
        if s.get("security") != "reality":
            continue
        rs = s.setdefault("realitySettings", {})
        rs["dest"] = dest
        rs["serverNames"] = [sni]
        # keep nested settings; clear serverName override
        nested = rs.get("settings") if isinstance(rs.get("settings"), dict) else {}
        nested = dict(nested or {})
        nested["serverName"] = ""
        rs["settings"] = nested
        conn.execute(
            "update inbounds set stream_settings=? where id=?",
            (json.dumps(s, separators=(",", ":")), iid),
        )
        n += 1
    conn.commit()
    conn.close()
    STATE.write_text(f"{dest}|{sni}|{datetime.now().isoformat()}\n")
    subprocess.run(["x-ui", "restart"], check=False)
    time.sleep(2)
    print(f"rotated {n} inbounds -> dest={dest} sni={sni}")
    print("clients must refresh subscription to pick up new sni")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--pick", help="dest host or sni keyword")
    ap.add_argument("--next", action="store_true")
    ap.add_argument("--skip-verify", action="store_true")
    args = ap.parse_args()
    dests = parse_dests()
    if args.list or (not args.pick and not args.next):
        cur = STATE.read_text().strip() if STATE.exists() else ""
        print("active:", cur or "(none)")
        for d, s, note in dests:
            print(f"- {d} | sni={s} | {note}")
        return
    chosen = None
    if args.pick:
        key = args.pick.lower()
        for item in dests:
            if key in item[0].lower() or key in item[1].lower():
                chosen = item
                break
        if not chosen:
            raise SystemExit(f"no dest matching {args.pick}")
    elif args.next:
        cur_dest = ""
        if STATE.exists():
            cur_dest = STATE.read_text().split("|", 1)[0].strip()
        idx = 0
        for i, (d, _, _) in enumerate(dests):
            if d == cur_dest:
                idx = (i + 1) % len(dests)
                break
        chosen = dests[idx]
    assert chosen
    dest, sni, note = chosen
    if not args.skip_verify and not verify_tls(dest, sni):
        raise SystemExit("TLS1.3 verify failed; pick another or --skip-verify")
    apply(dest, sni)
    print("note:", note)


if __name__ == "__main__":
    main()
