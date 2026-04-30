"""
build_fixtures.py — join PPD:2026 (debt-earnings) with IPEDS HD; emit per-institution
JSON slices to data/build/output/by_unitid/<UNITID>.json plus a global institution
directory data/build/output/institutions.json.

Phase 1 adds two joins on top of the Phase 0 base (see data/build/SCHEMA.md):
  - R07 in_state_share — per-program field broadcast from the institution-level
    pct_t4enrl_instate_p1819 published in PPD's institution-characteristics-and-
    completions file. (SPEC-DELTA §2.4 originally pointed at financial-aid-part-1
    for this variable; the published location is in the inst-completions file.)
  - R14 hidden_program_candidates — institution-level array surfacing programs
    that conferred awards in IPEDS C2024_A but are absent from PPD at the
    corresponding (cip4, credlev) cell. Cinematic Arts BA at CSULB
    (UNITID 110583, cip6 50.0601, AWLEVEL=5) is the SPEC-DELTA §4 acceptance case.

Usage:
    python3 build_fixtures.py
    python3 build_fixtures.py --unitid 110583   # single institution (CSULB)
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
RAW_PPD_INST = BUILD_DIR / "raw" / "ppd" / "ppd2026-institution-characteristics-and-completions.xlsx"
RAW_IPEDS_HD = BUILD_DIR / "raw" / "ipeds" / "hd2024.csv"
RAW_IPEDS_C = BUILD_DIR / "raw" / "ipeds" / "C2024_a.csv"
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
IPEDS_C_VINTAGE = "2024"  # IPEDS C2024 reports awards conferred in AY 2023-24

# IPEDS Completions AWLEVEL → PPD-style credlev label
# (PPD credlev set: Associate, Bachelor, Doctoral, First Professional Degree,
#  Graduate Certificate, Master's, Post-Bacc Certificate, Undergrad Certificate)
AWLEVEL_TO_CREDLEV = {
    "1": "Undergrad Certificate",      # award < 1 academic year
    "2": "Undergrad Certificate",      # award 1–2 yr
    "3": "Associate",
    "4": "Undergrad Certificate",      # award 2–4 yr
    "5": "Bachelor",
    "6": "Post-Bacc Certificate",
    "7": "Master's",
    "8": "Graduate Certificate",       # post-master's certificate
    "17": "Doctoral",                  # research/scholarship
    "18": "First Professional Degree", # professional practice
    "19": "Doctoral",                  # doctor's degree-other
}


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


def _resolve_ipeds_hd() -> Path:
    if RAW_IPEDS_HD.exists():
        return RAW_IPEDS_HD
    raise FileNotFoundError(
        f"IPEDS HD file not found.\n"
        f"  Run: python3 {BUILD_DIR / 'fetch_ipeds.py'} --only hd"
    )


def _resolve_ipeds_c() -> Path:
    if RAW_IPEDS_C.exists():
        return RAW_IPEDS_C
    raise FileNotFoundError(
        f"IPEDS Completions C2024_A file not found.\n"
        f"  Run: python3 {BUILD_DIR / 'fetch_ipeds.py'} --only c_a"
    )


def _resolve_ppd_inst() -> Path:
    if RAW_PPD_INST.exists():
        return RAW_PPD_INST
    raise FileNotFoundError(
        f"PPD:2026 institution-characteristics-and-completions file not found.\n"
        f"  Run: python3 {BUILD_DIR / 'fetch_ppd.py'} --only inst"
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
    path = _resolve_ipeds_hd()
    print(f"[ipeds-hd] reading {path.name} ...")
    # IPEDS CSVs are sometimes Latin-1 encoded
    try:
        df = pd.read_csv(path, dtype=str, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, dtype=str, encoding="latin-1")
    df.columns = [c.upper() for c in df.columns]
    print(f"[ipeds-hd] rows={len(df):,} cols={len(df.columns)}")
    return df


def load_ppd_inst_chars() -> pd.DataFrame:
    """Load PPD inst-chars-and-completions; collapse to one row per opeid6.

    The published file is at the same opeid6 × cip4 × credlev grain as the
    debt-earnings file (institution metadata broadcast across program rows).
    For R07 we only need the institution-level pct_t4enrl_instate_p1819.
    """
    path = _resolve_ppd_inst()
    print(f"[ppd-inst] reading {path.name} ...")
    df = pd.read_excel(path, sheet_name=0)
    print(f"[ppd-inst] rows={len(df):,}")
    keep = ["opeid6", "pct_t4enrl_instate_p1819"]
    missing = [c for c in keep if c not in df.columns]
    if missing:
        raise RuntimeError(f"PPD inst-chars missing columns: {missing}")
    df = df[keep].copy()
    df["opeid6_n"] = df["opeid6"].apply(_opeid6_to_str)
    df = df.dropna(subset=["opeid6_n"]).drop_duplicates(subset=["opeid6_n"], keep="first")
    print(f"[ppd-inst] unique opeid6: {len(df):,}")
    return df


def load_ipeds_completions() -> pd.DataFrame:
    """Load IPEDS C2024_A; return primary-major rows with a credlev mapping.

    Columns returned: UNITID, cip6, credlev, completers_total, awlevel_raw, cipcode_raw.
    Filters: MAJORNUM == '1' (primary major; avoids dual-major double-count),
             AWLEVEL in AWLEVEL_TO_CREDLEV (skip totals/unknown codes),
             CIPCODE not '99.*' (totals/unknown placeholders),
             CTOTALT > 0 (program conferred at least one award).
    """
    path = _resolve_ipeds_c()
    print(f"[ipeds-c] reading {path.name} ...")
    try:
        df = pd.read_csv(path, dtype=str, encoding="utf-8", low_memory=False)
    except UnicodeDecodeError:
        df = pd.read_csv(path, dtype=str, encoding="latin-1", low_memory=False)
    df.columns = [c.upper() for c in df.columns]
    print(f"[ipeds-c] rows={len(df):,}")
    needed = ["UNITID", "CIPCODE", "MAJORNUM", "AWLEVEL", "CTOTALT"]
    missing = [c for c in needed if c not in df.columns]
    if missing:
        raise RuntimeError(f"IPEDS C2024_A missing columns: {missing}")
    df = df[df["MAJORNUM"] == "1"].copy()
    df = df[~df["CIPCODE"].str.startswith("99", na=False)]
    df = df[df["AWLEVEL"].isin(AWLEVEL_TO_CREDLEV)]
    df["completers_total"] = pd.to_numeric(df["CTOTALT"], errors="coerce")
    df = df[df["completers_total"].fillna(0) > 0]
    df["credlev"] = df["AWLEVEL"].map(AWLEVEL_TO_CREDLEV)
    df["cip6"] = df["CIPCODE"].astype(str).str.strip()
    df["completers_total"] = df["completers_total"].astype(int)
    out = df[["UNITID", "cip6", "credlev", "completers_total"]].rename(columns={"UNITID": "unitid"})
    out = out.dropna(subset=["unitid", "cip6", "credlev"])
    print(f"[ipeds-c] primary-major program rows with awards: {len(out):,}")
    return out


def _cip6_to_cip4(cip6: str) -> str | None:
    """'50.0601' → '5006'; '50.06' → '5006'; numeric/short → None."""
    if not cip6:
        return None
    s = cip6.replace(".", "").strip()
    if len(s) < 4 or not s[:4].isdigit():
        return None
    return s[:4]


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


def build_institution_records(
    ppd: pd.DataFrame,
    cw: pd.DataFrame,
    inst_chars: pd.DataFrame,
    ipeds_c: pd.DataFrame,
) -> dict[str, dict]:
    ppd = ppd.copy()
    ppd["opeid6_n"] = ppd["opeid6"].apply(_opeid6_to_str)
    cw = cw.copy()

    # Inner join — institutions in both PPD and IPEDS HD
    merged = ppd.merge(cw, left_on="opeid6_n", right_on="opeid6", how="inner")
    print(f"[join] PPD rows joined to IPEDS HD: {len(merged):,} / {len(ppd):,}")

    # R07: institution-level in-state share, broadcast onto each program record.
    instate_pct = inst_chars.set_index("opeid6_n")["pct_t4enrl_instate_p1819"]

    # R14: pre-bin IPEDS Completions per UNITID for fast lookup.
    ipeds_by_unitid: dict[str, list[tuple[str, str, int]]] = {}
    for unitid, group in ipeds_c.groupby("unitid"):
        ipeds_by_unitid[str(unitid)] = list(
            zip(group["cip6"].tolist(), group["credlev"].tolist(), group["completers_total"].tolist())
        )

    institutions: dict[str, dict] = {}
    for unitid, group in merged.groupby("UNITID"):
        head = group.iloc[0]
        opeid6_n = _safe_str(head["opeid6_n"])

        raw_pct = instate_pct.get(opeid6_n) if opeid6_n else None
        in_state_share = None
        if raw_pct is not None and not (isinstance(raw_pct, float) and math.isnan(raw_pct)):
            in_state_share = round(float(raw_pct) / 100.0, 4)

        rec = {
            "unitid": str(unitid),
            "opeid6": opeid6_n,
            "instnm": _safe_str(head["INSTNM"]),
            "stabbr": _safe_str(head["STABBR"]),
            "control": _safe_int(head["CONTROL"]),
            "iclevel": _safe_int(head["ICLEVEL"]),
            "sector": _safe_int(head["SECTOR"]),
            "ppd_release": PPD_RELEASE,
            "build_date": dt.date.today().isoformat(),
            "programs": [],
            "hidden_program_candidates": [],
        }
        ppd_keys: set[tuple[str | None, str | None]] = set()
        for _, r in group.iterrows():
            med = _safe_float(r["md_earn_wne_p4"], ndigits=2)
            bench = _safe_float(r["earn_bnchmrk_cip2_wageb"], ndigits=2)
            cohort = _safe_int(r["count_wne_p4"])
            which = _safe_str(r["which_test_cip2_wageb"])
            cip4 = _cip4_to_str(r["cip4"])
            credlev = _safe_str(r["credlev"])
            program = {
                "cip4": cip4,
                "cip4_title": _safe_str(r["cip4_title"]),
                "credlev": credlev,
                "cohort_count": cohort,
                "median_earn_p4": med,
                "benchmark": bench,
                "benchmark_route": which,
                "ep_gap_pct": _gap_pct(med, bench),
                "ppd_fail_obbb": _safe_int(r["fail_obbb_cip2_wageb"]),
                "ppd_fail_master": _safe_int(r["mstr_obbb_fail_cip2_wageb"]),
                "in_state_share": in_state_share,
                "suppression": {
                    "missing_test": _safe_int(r["missing_test_cip2_wageb"]),
                    "earn_suppressed": med is None,
                    "cohort_suppressed": cohort is None,
                    "out_of_scope": which == "Not Listed in Section 84001",
                },
            }
            rec["programs"].append(program)
            ppd_keys.add((cip4, credlev))
        # Sort programs deterministically: cip4, then credlev
        rec["programs"].sort(key=lambda p: (p["cip4"] or "", p["credlev"] or ""))

        # R14 hidden-program surfacer: IPEDS C2024_A cells whose (cip4, credlev)
        # is absent from the PPD program list for this UNITID.
        hidden: list[dict] = []
        for cip6, credlev_c, completers in ipeds_by_unitid.get(str(unitid), []):
            cip4_from_c = _cip6_to_cip4(cip6)
            if cip4_from_c is None or credlev_c is None:
                continue
            if (cip4_from_c, credlev_c) in ppd_keys:
                continue
            hidden.append({
                "cip6": cip6,
                "credlev": credlev_c,
                "completers_total": int(completers),
                "vintage": IPEDS_C_VINTAGE,
            })
        hidden.sort(key=lambda h: (h["cip6"], h["credlev"]))
        rec["hidden_program_candidates"] = hidden

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
    inst_chars = load_ppd_inst_chars()
    ipeds_c = load_ipeds_completions()
    institutions = build_institution_records(ppd, cw, inst_chars, ipeds_c)
    print(f"[built] {len(institutions):,} institutions")
    write_outputs(institutions, only_unitid=args.unitid)
    return 0


if __name__ == "__main__":
    sys.exit(main())
