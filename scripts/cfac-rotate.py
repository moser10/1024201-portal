#!/usr/bin/env python3
"""Hourly Reality dest rotate from JSON. Tiny; safe to cron."""
import json, sqlite3, ssl, socket, subprocess, time
from pathlib import Path

DB = Path("/etc/x-ui/x-ui.db")
DESTS = Path("/etc/cfac-sub/reality-dests.json")
STATE = Path("/etc/cfac-sub/active-dest")


def verify(dest, sni, timeout=6):
    host, _, port = dest.partition(":")
    port = int(port or 443)
    try:
        raw = socket.create_connection((host, port), timeout=timeout)
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(raw, server_hostname=sni) as ss:
            return (ss.version() or "").startswith("TLSv1.3")
    except Exception:
        return False


def main():
    j = json.loads(DESTS.read_text())
    dests = j.get("dests") or []
    if not dests:
        return
    n = len(dests)
    start = (int(j.get("active_index", 0)) + 1) % n
    chosen = None
    idx = start
    for _ in range(n):
        d = dests[idx]
        if verify(d["dest"], d["sni"]):
            chosen, chosen_i = d, idx
            break
        idx = (idx + 1) % n
    if not chosen:
        print("no verified dest")
        return
    conn = sqlite3.connect(str(DB))
    for iid, stream in conn.execute(
        "select id,stream_settings from inbounds where lower(protocol)='vless' and enable=1"
    ):
        s = json.loads(stream or "{}")
        if s.get("security") != "reality":
            continue
        rs = s.setdefault("realitySettings", {})
        rs["dest"] = chosen["dest"]
        rs["serverNames"] = [chosen["sni"]]
        nested = rs.get("settings") if isinstance(rs.get("settings"), dict) else {}
        nested = dict(nested or {})
        nested["serverName"] = ""
        rs["settings"] = nested
        conn.execute(
            "update inbounds set stream_settings=? where id=?",
            (json.dumps(s, separators=(",", ":")), iid),
        )
    conn.commit()
    conn.close()
    j["active_index"] = chosen_i
    DESTS.write_text(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
    STATE.write_text(f"{chosen['dest']}|{chosen['sni']}|{time.time()}\n")
    subprocess.run(["x-ui", "restart"], check=False)
    print("rotated", chosen["name"], chosen["sni"])


if __name__ == "__main__":
    main()
