// Verdict computation — pure logic, separated from rule registration.
// Reads schema-shaped ProgramRecord; emits the verdict words plus the
// not-measured-reason precedence chain that R12 surfaces.

import type {
  ProgramRecord,
  VerdictWord,
  NotMeasuredReason,
} from './types.js';

/**
 * Tool re-derivation: median earnings vs benchmark, OBBBA "less than median earnings" trigger.
 * Returns NOT_MEASURED whenever the inputs are insufficient.
 */
export function deriveToolVerdict(p: ProgramRecord): VerdictWord {
  if (
    p.median_earn_p4 === null ||
    p.benchmark === null ||
    p.ep_gap_pct === null
  ) {
    return 'NOT MEASURED';
  }
  // OBBBA § 84001(c)(2): fail when median earnings are LESS than the benchmark.
  return p.ep_gap_pct < 0 ? 'FAIL' : 'PASS';
}

/** Read PPD's pre-computed verdict (`fail_obbb_cip2_wageb`). */
export function derivePpdVerdict(p: ProgramRecord): VerdictWord | null {
  if (p.ppd_fail_obbb === null) return null;
  return p.ppd_fail_obbb === 1 ? 'FAIL' : 'PASS';
}

/**
 * Surfaced verdict — what the dean sees on the verdict card.
 * PPD-published is authoritative. Falls back to tool re-derivation only when
 * PPD has no published value (rare; mostly NOT_MEASURED rows).
 */
export function deriveSurfacedVerdict(p: ProgramRecord): VerdictWord {
  const ppd = derivePpdVerdict(p);
  if (ppd !== null) return ppd;
  return deriveToolVerdict(p);
}

/**
 * NOT_MEASURED reason precedence (R12 enumeration, four reasons per
 * SPEC-DELTA §2.3 chair greenlight):
 *
 *   1. out_of_scope          (program outside OBBBA § 84001 scope)
 *   2. privacy_suppressed    (data perturbation > 9% — `missing_test = 1`)
 *   3. cohort_below_floor    (cohort < 30 after expansion — `cohort_suppressed`)
 *   4. earnings_below_floor  (IRS records < 16 — `earn_suppressed` ALONE)
 *
 * Why cohort precedes earnings: per SPEC-DELTA §2.3, in PPD:2026 the cohort
 * and earnings floors always co-occur — every row with `count_wne_p4 IS NULL`
 * also has `md_earn_wne_p4 IS NULL`. When both fire together the cohort floor
 * is the binding cause (cascade exhausted produces both nulls). The earnings
 * floor only surfaces independently when cohort is non-null but the IRS
 * reporter count is below 16 — a structurally distinct condition.
 */
export function deriveNotMeasuredReason(
  p: ProgramRecord,
): NotMeasuredReason | null {
  if (deriveSurfacedVerdict(p) !== 'NOT MEASURED') return null;
  if (p.suppression.out_of_scope) return 'out_of_scope';
  if (p.suppression.missing_test === 1) return 'privacy_suppressed';
  if (p.suppression.cohort_suppressed) return 'cohort_below_floor';
  if (p.suppression.earn_suppressed) return 'earnings_below_floor';
  // Defensive default — input was insufficient but no flag explained why.
  return 'cohort_below_floor';
}

/**
 * Cross-validation status between tool re-derivation and PPD-published.
 * Drives R20 fires + the institution-level disagreement banner (spec §3.2).
 */
export function deriveCrossValidationStatus(
  tool: VerdictWord,
  ppd: VerdictWord | null,
): 'agree' | 'disagree' | 'ppd-not-published' | 'tool-not-measured-ppd-published' | 'both-not-measured' {
  if (tool === 'NOT MEASURED' && ppd === null) return 'both-not-measured';
  if (tool === 'NOT MEASURED' && ppd !== null) return 'tool-not-measured-ppd-published';
  if (tool !== 'NOT MEASURED' && ppd === null) return 'ppd-not-published';
  return tool === ppd ? 'agree' : 'disagree';
}

/** Helper — is this credlev a graduate-level program (R08 trigger)? */
export function isGraduateLevel(credlev: ProgramRecord['credlev']): boolean {
  return (
    credlev === "Master's" ||
    credlev === 'Doctoral' ||
    credlev === 'First Professional Degree' ||
    credlev === 'Graduate Certificate' ||
    credlev === 'Post-Bacc Certificate'
  );
}

/** Helper — is this credlev an undergraduate baccalaureate-or-lower (R09 trigger)? */
export function isUndergraduateLevel(credlev: ProgramRecord['credlev']): boolean {
  return (
    credlev === 'Bachelor' ||
    credlev === 'Associate' ||
    credlev === 'Undergrad Certificate'
  );
}
