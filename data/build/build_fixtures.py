"""
build_fixtures.py — join PPD:2026 (debt-earnings) with IPEDS HD; emit per-institution
JSON slices to data/build/output/by_unitid/<UNITID>.json plus a global institution
directory data/build/output/institutions.json.

Phase 0 produces a JSON shape close to spec §2/§3 expectations, deliberately wider
than strictly needed so the rules engine in Phase 1 has every column it might want
in scope without re-parsing the xlsx.

JSON shape per institution (see data/build/SCHEMA.md for full doc):

{
  "unitid": "110635",
  "opeid6": "1139",
  "instnm": "California State University-Long Beach",
  "stabbr": "CA",
  "control": 1,
  "iclevel": 1,
  "sector": 1,
  "ppd_release": "2026",
  "build_date": "2026-04-29",
  "programs": [
    {
      "cip4": "5009",
      "cip4_title": "Music.",
      "credlev": "Master's",
      "cohort_count": 28,
      "median_earn_p4": 32534,
      "benchmark": 48304,
      "benchmark_route": "Same-State BA Median",   // raw which_test_cip2_wageb
      "ep_gap_pct": -0.3265,                       // tool-derived; NOT a published field
      "ppd_fail_obbb": 1,                          // published verdict (R20 cross-check)
      "ppd_fail_master": 1,                        // mstr_obbb_fail_cip2_wageb (Master's only)
      "suppression": {
        "missing_test": 0,                         // missing_test_cip2_wageb
        "earn_suppressed": false,                  // md_earn_wne_p4 is NaN
        "cohort_suppressed": false,                // count_wne_p4 is NaN
        "out_of_scope": false                      // which_test=='Not Listed in Section 84001'
      }
    },
    ...
  ]
}

Usage:
    python3 build_fixtures.py
    python3 build_fixtures.py --unitid 110635   # single institution
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import math
import sys
from pathlib import Path

import pandas as pd

BUILD_DIR = Path(__file__).resolve().parent
RAW_PPD = BUILD_DIR / "raw" / "ppd" / "ppd2026-debt-earnings-and-earnings-test-metrics.xlsx"
RAW_IPEDS = BUILD_DIR / "raw" / "ipeds" / "hd2024.csv"
OUTPUT_DIR = BUILD_DIR / "output"
INSTITUTIONS_JSON = OUTPUT_DIR / "institutions.json"
BY_UNITID_DIR = OUTPUT_DIR / "by_unitid"

# Optional fallback: if PPD raw is not in data/build/raw/ppd/, accept a known
# pre-existing CIPcodes archive copy. fetch_ppd.py is the canonical source path.
PPD_FALLBACKS = [
    Path.home() / "gt/CIPcodes/polecats/amber/CIPcodes/research/extracts"
    / "ahead-session-2-program-performance-data-debt-earnings-and-earnings-test-metrics-112908.xlsx",
]

PPD_RELEASE = "2026"


def _resolve_ppd() -> Path:
    if RAW_PPD.exists():
        return RAW_PPD
    for fb in PPD_FALLBACKS:
        if fb.exists():
            print(f"[note] using PPD fallback path: {fb}")
            return fb
    raise FileNotFoundError(
        f"PPD:2026 debt-earnings file not found.\n"
        f"  Run: python3 {BUILD_DIR / 'fetch_ppd.py'} --only debt"
    )


def _resolve_ipeds() -> Path:
    if RAW_IPEDS.exists():
        return RAW_IPEDS
    raise FileNotFoundError(
        f"IPEDS HD file not found.\n"
        f"  Run: python3 {BUILD_DIR / 'fetch_ipeds.py'}"
    )


def _safe_int(x):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    try:
        return int(x)
    except (TypeError, ValueError):
        return None


def _safe_float(x, ndigits: int | None = None):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    try:
        v = float(x)
        if ndigits is not None:
            v = round(v, ndigits)
        return v
    except (TypeError, ValueError):
        return None


def _safe_str(x):
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return None
    s = str(x).strip()
    return s or None


def _gap_pct(med, bench):
    if med is None or bench is None:
        return None
    if bench == 0:
        return None
    return round((med - bench) / bench, 4)


def _cip4_to_str(x):
    """Normalize cip4 to a 4-character zero-padded string ('5009', not 5009 or '5009.0')."""
    v = _safe_int(x)
    if v is None:
        return None
    return f"{v:04d}"


def _opeid6_to_str(x):
    """Normalize opeid6 to a 6-character zero-padded string."""
    v = _safe_int(x)
    if v is None:
        return None
    return f"{v:06d}"


def load_ppd() -> pd.DataFrame:
    path = _resolve_ppd()
    print(f"[ppd]  reading {path.name} ...")
    df = pd.read_excel(path)
    print(f"[ppd]  rows={len(df):,}")
    return df


def load_ipeds_hd() -> pd.DataFrame:
    path = _resolve_ipeds()
    print(f"[ipeds] reading {path.name} ...")
    # IPEDS CSVs are sometimes Latin-1 encoded
    try:
        df = pd.read_csv(path, dtype=str, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, dtype=str, encoding="latin-1")
    df.columns = [c.upper() for c in df.columns]
    print(f"[ipeds] rows={len(df):,} cols={len(df.columns)}")
    return df


def build_crosswalk(hd: pd.DataFrame) -> pd.DataFrame:
    """One row per OPEID6 → keep the institution with the longest INSTNM as a tie-breaker.

    OPEID can be shared across branches; we collapse to one row keyed on opeid6 for
    institution-level metadata join. Persona A's UI may want UNITID-level metadata
    (e.g., for branch-specific institutions); for Phase 0 we collapse.
    """
    df = hd.copy()
    if "OPEID" not in df.columns or "UNITID" not in df.columns:
        raise RuntimeError(f"HD missing OPEID or UNITID; have: {list(df.columns)[:20]}")
    # OPEID is 8 char in HD; first 6 = OPEID6.
    df["opeid6"] = df["OPEID"].astype(str).str.replace(r"\D", "", regex=True).str.zfill(8).str[:6]
    # Drop synthetic / non-matching opeids ('000000' or all-zeros)
    df = df[df["opeid6"] != "000000"]
    df = df.sort_values(["opeid6", "INSTNM"], na_position="last")
    cw = df.drop_duplicates(subset=["opeid6"], keep="first").copy()
    return cw[["opeid6", "UNITID", "INSTNM", "STABBR", "CONTROL", "ICLEVEL", "SECTOR"]]


def build_institution_records(ppd: pd.DataFrame, cw: pd.DataFrame) -> dict[str, dict]:
    ppd = ppd.copy()
    ppd["opeid6_n"] = ppd["opeid6"].apply(_opeid6_to_str)
    cw = cw.copy()

    # Inner join — institutions in both PPD and IPEDS HD
    merged = ppd.merge(cw, left_on="opeid6_n", right_on="opeid6", how="inner")
    print(f"[join] PPD rows joined to IPEDS: {len(merged):,} / {len(ppd):,}")

    institutions: dict[str, dict] = {}
    for unitid, group in merged.groupby("UNITID"):
        head = group.iloc[0]
        rec = {
            "unitid": str(unitid),
            "opeid6": _safe_str(head["opeid6_n"]),
            "instnm": _safe_str(head["INSTNM"]),
            "stabbr": _safe_str(head["STABBR"]),
            "control": _safe_int(head["CONTROL"]),
            "iclevel": _safe_int(head["ICLEVEL"]),
            "sector": _safe_int(head["SECTOR"]),
            "ppd_release": PPD_RELEASE,
            "build_date": dt.date.today().isoformat(),
            "programs": [],
        }
        for _, r in group.iterrows():
            med = _safe_float(r["md_earn_wne_p4"], ndigits=2)
            bench = _safe_float(r["earn_bnchmrk_cip2_wageb"], ndigits=2)
            cohort = _safe_int(r["count_wne_p4"])
            which = _safe_str(r["which_test_cip2_wageb"])
            program = {
                "cip4": _cip4_to_str(r["cip4"]),
                "cip4_title": _safe_str(r["cip4_title"]),
                "credlev": _safe_str(r["credlev"]),
                "cohort_count": cohort,
                "median_earn_p4": med,
                "benchmark": bench,
                "benchmark_route": which,
                "ep_gap_pct": _gap_pct(med, bench),
                "ppd_fail_obbb": _safe_int(r["fail_obbb_cip2_wageb"]),
                "ppd_fail_master": _safe_int(r["mstr_obbb_fail_cip2_wageb"]),
                "suppression": {
                    "missing_test": _safe_int(r["missing_test_cip2_wageb"]),
                    "earn_suppressed": med is None,
                    "cohort_suppressed": cohort is None,
                    "out_of_scope": which == "Not Listed in Section 84001",
                },
            }
            rec["programs"].append(program)
        # Sort programs deterministically: cip4, then credlev
        rec["programs"].sort(key=lambda p: (p["cip4"] or "", p["credlev"] or ""))
        institutions[str(unitid)] = rec
    return institutions


def write_outputs(institutions: dict[str, dict], only_unitid: str | None = None) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    BY_UNITID_DIR.mkdir(parents=True, exist_ok=True)

    if only_unitid:
        if only_unitid not in institutions:
            raise SystemExit(f"unitid {only_unitid} not in joined set")
        out = BY_UNITID_DIR / f"{only_unitid}.json"
        out.write_text(json.dumps(institutions[only_unitid], indent=2))
        print(f"[write] {out}")
        return

    # Per-institution slices
    for unitid, rec in institutions.items():
        out = BY_UNITID_DIR / f"{unitid}.json"
        out.write_text(json.dumps(rec, indent=2))
    # Global directory (slim — for institution-picker UI)
    directory = [
        {
            "unitid": rec["unitid"],
            "opeid6": rec["opeid6"],
            "instnm": rec["instnm"],
            "stabbr": rec["stabbr"],
            "control": rec["control"],
            "iclevel": rec["iclevel"],
            "sector": rec["sector"],
            "n_programs": len(rec["programs"]),
        }
        for rec in institutions.values()
    ]
    directory.sort(key=lambda r: (r["stabbr"] or "", r["instnm"] or ""))
    INSTITUTIONS_JSON.write_text(json.dumps(directory, indent=2))
    print(f"[write] {INSTITUTIONS_JSON} ({len(directory):,} institutions)")
    print(f"[write] {BY_UNITID_DIR}/<UNITID>.json ({len(institutions):,} files)")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--unitid", help="emit only one institution slice (e.g., 110635 = CSULB)")
    args = p.parse_args()

    ppd = load_ppd()
    hd = load_ipeds_hd()
    cw = build_crosswalk(hd)
    institutions = build_institution_records(ppd, cw)
    print(f"[built] {len(institutions):,} institutions")
    write_outputs(institutions, only_unitid=args.unitid)
    return 0


if __name__ == "__main__":
    sys.exit(main())
