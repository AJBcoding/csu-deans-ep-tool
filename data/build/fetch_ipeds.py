"""
fetch_ipeds.py — download IPEDS HD (institution directory) into data/build/raw/ipeds/.

Source: NCES IPEDS DataCenter. HD survey is the institutional directory keyed on UNITID.

Phase 0 fetches HD2024 (most recent fully-released vintage as of 2026-04). The HD file
provides the OPEID6 ↔ UNITID crosswalk needed to map PPD:2026 (which is OPEID6-keyed)
to UNITID (which Persona A's UI input uses).

Note: NCES IPEDS distributes HD as a zip containing a CSV. We fetch the zip, extract
the CSV in memory, and write the CSV to disk.

Usage:
    python3 fetch_ipeds.py
"""
from __future__ import annotations
import io
import sys
import urllib.request
import zipfile
from pathlib import Path

BUILD_DIR = Path(__file__).resolve().parent
RAW_DIR = BUILD_DIR / "raw" / "ipeds"

IPEDS_HD_URL = "https://nces.ed.gov/ipeds/datacenter/data/HD2024.zip"
IPEDS_HD_CSV = "hd2024.csv"


def fetch_hd() -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    target = RAW_DIR / IPEDS_HD_CSV
    if target.exists():
        print(f"[skip] {target.name} (exists)")
        return target
    print(f"[fetch] {IPEDS_HD_URL}")
    with urllib.request.urlopen(IPEDS_HD_URL) as resp:
        zip_bytes = resp.read()
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if not names:
            raise RuntimeError("HD zip contained no CSV")
        with zf.open(names[0]) as src, target.open("wb") as dst:
            dst.write(src.read())
    print(f"[ok]    {target.name} ({target.stat().st_size:,} bytes)")
    return target


if __name__ == "__main__":
    fetch_hd()
    sys.exit(0)
