#!/usr/bin/env python3
"""Build sr.conf from srbase + srsd + srlead. Future in-progress file: srleaing.json"""
import json
from pathlib import Path

BASE = Path("/etc/cfac-sub")
SRBASE = BASE / "srbase.conf"
SRSD = BASE / "srsd.json"
SRLEAD = BASE / "srlead.json"
SRLEAING = BASE / "srleaing.json"  # optional future
OUT = BASE / "sr.conf"


def load_json(p: Path) -> dict:
    if not p.is_file():
        return {"suffix": [], "keyword": [], "policy": "DIRECT"}
    return json.loads(p.read_text())


def rules_from(j: dict, tag: str) -> list[str]:
    pol = j.get("policy") or "DIRECT"
    lines = [f"# --- {tag} ---"]
    for s in j.get("suffix") or []:
        s = str(s).strip().lower()
        if s:
            lines.append(f"DOMAIN-SUFFIX,{s},{pol}")
    for k in j.get("keyword") or []:
        k = str(k).strip().lower()
        if k:
            lines.append(f"DOMAIN-KEYWORD,{k},{pol}")
    return lines


def main() -> None:
    base = SRBASE.read_text()
    marker = "GEOIP,CN,DIRECT"
    if marker not in base:
        raise SystemExit("srbase missing GEOIP,CN,DIRECT")

    block = ["# ===== SR study block (srsd + srlead [+ srleaing]) ====="]
    block += rules_from(load_json(SRSD), "srsd")
    block += rules_from(load_json(SRLEAD), "srlead")
    if SRLEAING.is_file():
        block += rules_from(load_json(SRLEAING), "srleaing")
    block.append("# ===== end SR study block =====")
    block.append("")

    out = (
        "# SR = Study Rule = shadowrocket default + srsd/srlead\n"
        + base.replace(marker, "\n".join(block) + "\n" + marker, 1)
    )
    OUT.write_text(out)
    print(f"wrote {OUT} bytes={len(out)} lines={out.count(chr(10))+1}")


if __name__ == "__main__":
    main()
