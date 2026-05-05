#!/usr/bin/env python3
"""
build_systemwide_context.py — convert CSU systemwide-exposure 3-cut CSVs into
content/systemwide-cip-context.json (cp-j0gw.8).

The output JSON gives the runtime engine a per-CIP context: how many CSU
campuses surface this CIP4 with each of the four failure types (A direct-fail,
C invisible, D knife-edge, E pool-suppressed). The verdict-card UI uses this
to surface "this CIP fails at N of K CSU campuses systemwide" alongside the
per-program verdict.

Source CSVs live in the CIPcodes companion repo:
    analyses/csu-systemwide-exposure/output/3cut-2026-05-04/
      cut1_by_campus.csv
      cut2_by_cip.csv
      cut3_by_failure_type.csv
      unified_exposure.csv

Reproducer for the source CSVs:
    analyses/csu-systemwide-exposure/scripts/03_build_systemwide.py

Usage:
    python3 data/build/build_systemwide_context.py [--source <path>] [--out <path>]

Defaults:
    --source ~/gt/CIPcodes/crew/anthonybyrnes/analyses/csu-systemwide-exposure/output/3cut-2026-05-04
    --out content/systemwide-cip-context.json

Determinism: output is sorted by CIP4. No randomness; no time-dependent fields
beyond the build_date constant.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

DEFAULT_SOURCE = Path.home() / "gt/CIPcodes/crew/anthonybyrnes/analyses/csu-systemwide-exposure/output/3cut-2026-05-04"
DEFAULT_OUT = Path(__file__).resolve().parent.parent.parent / "content/systemwide-cip-context.json"
BUILD_DATE = "2026-05-05"
PPD_RELEASE = "2026"


def load_by_cip(path: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            cip4 = row["cip4"]
            out[cip4] = {
                "cip4": cip4,
                "a_direct_fail": int(row["A_directly_failing_AHEAD"]),
                "c_invisible": int(row["C_invisible_no_AHEAD_row"]),
                "d_knife_edge": int(row["D_knife_edge_passing_within_20pct"]),
                "e_pool_suppressed": int(row["E_suppressed_pool_has_failing_siblings"]),
                "total_cells": int(row["total_cells"]),
                "n_unique_campuses": int(row["n_unique_campuses"]),
            }
    return out


def load_totals(path: Path) -> dict[str, dict]:
    out: dict[str, dict] = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            out[row["failure_type"]] = {
                "n_cells": int(row["n_cells"]),
                "n_campuses": int(row["n_campuses"]),
                "n_unique_cip4": int(row["n_unique_cip4"]),
            }
    return out


def load_campuses(path: Path) -> list[dict]:
    out: list[dict] = []
    with path.open() as f:
        for row in csv.DictReader(f):
            out.append({
                "opeid6": row["opeid6"],
                "instnm": row["instnm"].strip(),
                "total_exposure_cells": int(row["total_exposure_cells"]),
            })
    return out


def load_titles(path: Path) -> dict[str, str]:
    """Read cip4_title from unified_exposure.csv, one per cip4. Source CSVs
    arrive with whitespace-padded titles (``"... General."`` becomes
    ``"... General"`` after rstrip-dot, leaving stray double spaces). Collapse
    runs of whitespace so the rendered UI line reads cleanly."""
    import re
    titles: dict[str, str] = {}
    with path.open() as f:
        for row in csv.DictReader(f):
            cip4 = row["cip4"]
            raw = row["cip4_title"].strip().rstrip(".")
            title = re.sub(r"\s+", " ", raw).strip()
            if cip4 not in titles and title:
                titles[cip4] = title
    return titles


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE,
                        help="Source directory (3cut CSVs).")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT,
                        help="Output JSON path.")
    args = parser.parse_args()

    src: Path = args.source
    if not src.is_dir():
        raise SystemExit(f"Source directory not found: {src}")

    by_cip = load_by_cip(src / "cut2_by_cip.csv")
    totals = load_totals(src / "cut3_by_failure_type.csv")
    campuses = load_campuses(src / "cut1_by_campus.csv")
    titles = load_titles(src / "unified_exposure.csv")

    # Empty string when no title was harvested. The UI omits the parenthetical
    # entirely on empty/missing — see web/js/render.js:renderSystemwideContext.
    for cip4 in by_cip:
        by_cip[cip4]["cip4_title"] = titles.get(cip4, "")

    by_cip_sorted = dict(sorted(by_cip.items()))

    out = {
        "schema_version": "1.0.0",
        "build_date": BUILD_DATE,
        "ppd_release": PPD_RELEASE,
        "scope_label": f"CSU systemwide ({len(campuses)} of 23 campuses, "
                       f"{sum(t['n_cells'] for t in totals.values())} exposure cells, "
                       f"{len(by_cip)} unique CIP-4 codes)",
        "source_csv_path": "CIPcodes:analyses/csu-systemwide-exposure/output/3cut-2026-05-04/",
        "reproducer_script": "CIPcodes:analyses/csu-systemwide-exposure/scripts/03_build_systemwide.py",
        "failure_type_legend": {
            "a_direct_fail":
                "AHEAD published per-cell fail flag = 1 (direct regulatory verdict)",
            "c_invisible":
                "IPEDS-recorded completers but no AHEAD row (B16 invisibility)",
            "d_knife_edge":
                "Within ±20% of lowest-of-three benchmark — sensitivity-flip candidate",
            "e_pool_suppressed":
                "Below 30-completer floor at 4-digit; pool has failing siblings",
        },
        "totals": totals,
        "n_campuses_in_scope": len(campuses),
        "n_unique_cip4": len(by_cip),
        "by_cip": by_cip_sorted,
        "disclaimer": (
            "CSU systemwide context derived from forward-simulated PPD:2026 "
            "negotiator analytic file. Not a prediction of which programs will "
            "fail in 2027 — a current snapshot of how the proposed rule maps "
            "onto the system as of the data freeze. Verify against the source "
            "CSVs (path above)."
        ),
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"wrote {args.out}")
    print(f"  cip count: {len(by_cip)}")
    print(f"  campuses:  {len(campuses)}")


if __name__ == "__main__":
    main()
