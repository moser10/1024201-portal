#!/usr/bin/env python3
"""Random Reality dest rotate (50-190 min). Cron every 10 min; self-schedules via JSON."""
import json, random, sqlite3, ssl, socket, subprocess, time
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
    now = time.time()
    lo = int(j.get("rotate_min_minutes", 50))
    hi = int(j.get("rotate_max_minutes", 190))
    if hi < lo:
        lo, hi = hi, lo
    next_at = float(j.get("next_rotate_at") or 0)
    if next_at <= 0:
        # first schedule without rotating immediately
        delay = random.randint(lo, hi) * 60
        j["next_rotate_at"] = now + delay
        DESTS.write_text(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
        print(f"scheduled first rotate in {delay//60} min")
        return
    if now < next_at:
        print(f"wait {int(next_at-now)}s")
        return

    dests = j.get("dests") or []
    if not dests:
        return
    n = len(dests)
    start = (int(j.get("active_index", 0)) + 1) % n
    chosen = chosen_i = None
    idx = start
    for _ in range(n):
        d = dests[idx]
        if verify(d["dest"], d["sni"]):
            chosen, chosen_i = d, idx
            break
        idx = (idx + 1) % n
    if not chosen:
        # retry later soon
        j["next_rotate_at"] = now + 15 * 60
        DESTS.write_text(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
        print("no verified dest; retry 15m")
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

    delay = random.randint(lo, hi) * 60
    j["active_index"] = chosen_i
    j["next_rotate_at"] = now + delay
    j["last_rotate_at"] = now
    DESTS.write_text(json.dumps(j, ensure_ascii=False, indent=2) + "\n")
    STATE.write_text(f"{chosen['dest']}|{chosen['sni']}|{now}\n")
    subprocess.run(["x-ui", "restart"], check=False)
    print(f"rotated {chosen['name']} sni={chosen['sni']}; next in {delay//60} min")


if __name__ == "__main__":
    main()
