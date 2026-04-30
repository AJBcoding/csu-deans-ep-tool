"""
fetch_ipeds.py — download IPEDS source files into data/build/raw/ipeds/.

Source: NCES IPEDS DataCenter.

Phase 0 fetched HD (institution directory) for the OPEID6 ↔ UNITID crosswalk.
Phase 1 adds C2024_A (Completions A subfile) for R14's hidden-program surfacer:
the per-program × CIPCODE × AWLEVEL awards-conferred table. C-A's coverage is
broader than PPD (which is limited to Title-IV programs), so it can surface
programs that confer awards but never appear in PPD's per-cell tables.

Usage:
    python3 fetch_ipeds.py            # fetch all
    python3 fetch_ipeds.py --only hd  # fetch one survey by key
"""
from __future__ import annotations
import argparse
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

BUILD_DIR = Path(__file__).resolve().parent
RAW_DIR = BUILD_DIR / "raw" / "ipeds"

IPEDS_FILES = {
    "hd": {
        "url": "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip",
        "filename": "hd2024.csv",
        "purpose": "Institution directory (UNITID/OPEID/INSTNM/STABBR/CONTROL/...).",
    },
    "c_a": {
        "url": "https://nces.ed.gov/ipeds/datacenter/data/C2024_A.zip",
        "filename": "C2024_a.csv",
        "purpose": "Completions A — awards by CIP × AWLEVEL × MAJORNUM (R14 surfacer).",
    },
}


def fetch_one(key: str, spec: dict, force: bool = False) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    target = RAW_DIR / spec["filename"]
    if target.exists() and not force:
        print(f"[skip] {target.name} (exists)")
        return target
    print(f"[fetch] {spec['url']}")
    req = urllib.request.Request(spec["url"], headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if not names:
            raise RuntimeError(f"{key} zip contained no CSV; got {zf.namelist()}")
        with zf.open(names[0]) as src, target.open("wb") as dst:
            dst.write(src.read())
    print(f"[ok]    {target.name} ({target.stat().st_size:,} bytes)")
    return target


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--only", choices=list(IPEDS_FILES.keys()), help="fetch a single survey by key")
    p.add_argument("--force", action="store_true", help="re-fetch even if cached")
    args = p.parse_args()

    keys = [args.only] if args.only else list(IPEDS_FILES.keys())
    for k in keys:
        fetch_one(k, IPEDS_FILES[k], force=args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
