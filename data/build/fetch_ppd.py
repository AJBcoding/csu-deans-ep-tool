"""
fetch_ppd.py — download PPD:2026 source xlsx files into data/build/raw/ppd/.

Source: U.S. Department of Education, AHEAD Session 2 (Program Performance Data),
        published 2026-04 at ed.gov/media/document/...

Phase 0 uses only the debt-earnings file (the load-bearing one with OBBBA pass/fail
flags, OPEID6 × CIP4 × CREDLEV grain, and per-cell suppression). The other 5 files
are listed for completeness; Phase 1 will pull financial-aid-part-1 for the in-state
share variable (t4enrl_inst_instate_p1819, R07).

Usage:
    python3 fetch_ppd.py                  # fetch all
    python3 fetch_ppd.py --only debt      # fetch debt-earnings only (Phase 0 minimum)
"""
from __future__ import annotations
import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

BUILD_DIR = Path(__file__).resolve().parent
RAW_DIR = BUILD_DIR / "raw" / "ppd"

# Provenance pinned in research/primary-sources/AHEAD/PPD-2026/_manifest.md (CIPcodes).
# sha256 hashes verified against an authorized fetch on 2026-04-26.
PPD_FILES = {
    "debt": {
        "url": "https://www.ed.gov/media/document/ahead-session-2-program-performance-data-debt-earnings-and-earnings-test-metrics-112908.xlsx",
        "filename": "ppd2026-debt-earnings-and-earnings-test-metrics.xlsx",
        "purpose": "Earnings, benchmarks, OBBBA fail flags. The load-bearing file.",
        "sha256": None,  # hash for this file was pre-existing in archive; manifest companion-file note
    },
    "inst": {
        "url": "https://www.ed.gov/media/document/ahead-session-2-program-performance-data-institution-characteristics-and-completions-112906.xlsx",
        "filename": "ppd2026-institution-characteristics-and-completions.xlsx",
        "purpose": "Institution metadata + completions counts.",
        "sha256": "c3bebefaea2bd71bbcca1d0d9b84eb30b7c631ec10050b832308098c468c2196",
    },
    "enroll": {
        "url": "https://www.ed.gov/media/document/ahead-session-2-program-performance-data-enrollments-112909.xlsx",
        "filename": "ppd2026-enrollments.xlsx",
        "purpose": "Enrollment-side metrics (program-level enrollment counts).",
        "sha256": "04408d961c022c0165cc431ead3785b947c7fd27a258fdfa590acdb19339a851",
    },
    "fa1": {
        "url": "https://www.ed.gov/media/document/ahead-session-2-program-performance-data-financial-aid-part-1-112907.xlsx",
        "filename": "ppd2026-financial-aid-part-1.xlsx",
        "purpose": "Financial aid part 1 — includes in-state share (t4enrl_inst_instate_p1819) for R07.",
        "sha256": "05cc0a759a2437e1de4fca2aba037545f2c15d9a88fd0e5f7d11ebfe3d24e9e8",
    },
    "fa2": {
        "url": "https://www.ed.gov/media/document/ahead-session-2-program-performance-data-financial-aid-part-2-112910.xlsx",
        "filename": "ppd2026-financial-aid-part-2.xlsx",
        "purpose": "Financial aid part 2.",
        "sha256": "4ceae3879e7ca2d94bdac4404825438cacc1cb67891bd20eeedb7a2845e9c486",
    },
    "fa3": {
        "url": "https://www.ed.gov/media/document/ahead-session-2-program-performance-data-financial-aid-part-3-112911.xlsx",
        "filename": "ppd2026-financial-aid-part-3.xlsx",
        "purpose": "Financial aid part 3.",
        "sha256": "bfac804aff0adf9b727a94d03c7043ea26e0c7a85aba374af40c076ca497d61f",
    },
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch_one(key: str, spec: dict, force: bool = False) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    target = RAW_DIR / spec["filename"]
    if target.exists() and not force:
        print(f"[skip] {target.name} (exists)")
        return target
    print(f"[fetch] {spec['url']}")
    urllib.request.urlretrieve(spec["url"], target)
    actual = sha256_file(target)
    if spec.get("sha256") and actual != spec["sha256"]:
        raise RuntimeError(
            f"sha256 mismatch for {target.name}\n"
            f"  expected: {spec['sha256']}\n"
            f"  actual:   {actual}\n"
            f"  Re-fetch from authoritative source; do not trust mirror."
        )
    print(f"[ok]    {target.name} ({target.stat().st_size:,} bytes; sha256={actual[:16]}...)")
    return target


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--only", choices=list(PPD_FILES.keys()), help="fetch a single file by key")
    p.add_argument("--force", action="store_true", help="re-fetch even if cached")
    args = p.parse_args()

    keys = [args.only] if args.only else list(PPD_FILES.keys())
    for k in keys:
        fetch_one(k, PPD_FILES[k], force=args.force)
    return 0


if __name__ == "__main__":
    sys.exit(main())
