// Unit tests — every R-rule has at least one fixture-driven test case.
// Tests are structured by rule, not by program, so a regression in any one
// rule fails a focused test rather than the institution-wide acceptance.

import { describe, expect, it } from 'vitest';
import { RULES } from '../src/rules.js';
import {
  deriveCrossValidationStatus,
  deriveNotMeasuredReason,
  derivePpdVerdict,
  deriveSurfacedVerdict,
  deriveToolVerdict,
} from '../src/verdict.js';
import type { ProgramRuleContext } from '../src/rules.js';
import { makeInstitution, makeProgram } from './helpers.js';

function ctxFor(progOverrides: Parameters<typeof makeProgram>[0] = {}): ProgramRuleContext {
  const program = makeProgram(progOverrides);
  const institution = makeInstitution([program]);
  const toolVerdict = deriveToolVerdict(program);
  const ppdVerdict = derivePpdVerdict(program);
  const surfacedVerdict = deriveSurfacedVerdict(program);
  const notMeasuredReason = deriveNotMeasuredReason(program);
  return {
    program,
    institution,
    toolVerdict,
    ppdVerdict,
    surfacedVerdict,
    notMeasuredReason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cohort cascade — R01–R04
// ─────────────────────────────────────────────────────────────────────────────

describe('R01 — cohort cascade Stage 1', () => {
  it('fires for an in-scope program (parametric)', () => {
    const f = RULES.R01!(ctxFor({}));
    expect(f).not.toBeNull();
    expect(f?.id).toBe('R01');
    expect(f?.data_status).toBe('PAR');
    expect(f?.citation).toMatch(/raw\.txt 2272/);
  });
  it('does not fire for out-of-scope programs', () => {
    const f = RULES.R01!(
      ctxFor({
        suppression: { out_of_scope: true },
        benchmark_route: 'Not Listed in Section 84001',
      }),
    );
    expect(f).toBeNull();
  });
});

describe('R02 — cohort cascade Stage 2', () => {
  it('fires for in-scope programs', () => {
    expect(RULES.R02!(ctxFor({}))).not.toBeNull();
  });
  it('does not fire for out-of-scope', () => {
    expect(
      RULES.R02!(ctxFor({ suppression: { out_of_scope: true }, benchmark_route: 'Not Listed in Section 84001' })),
    ).toBeNull();
  });
});

describe('R03 — cohort cascade Stage 3 (4-digit cell)', () => {
  it('fires deterministically for any in-scope row', () => {
    const f = RULES.R03!(ctxFor({}));
    expect(f).not.toBeNull();
    expect(f?.data_status).toBe('DET');
  });
});

describe('R04 — cohort cascade Stage 4 (2-digit expansion)', () => {
  it('fires as parametric advisory', () => {
    const f = RULES.R04!(ctxFor({}));
    expect(f).not.toBeNull();
    expect(f?.data_status).toBe('PAR');
    expect(f?.note).toMatch(/2-digit/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R05 — cascade exhausted
// ─────────────────────────────────────────────────────────────────────────────

describe('R05 — cascade exhausted', () => {
  it('fires when cohort_suppressed and scope-included', () => {
    const f = RULES.R05!(
      ctxFor({
        cohort_count: null,
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { cohort_suppressed: true, earn_suppressed: true },
      }),
    );
    expect(f).not.toBeNull();
    expect(f?.data_status).toBe('DET');
  });
  it('does NOT fire for out-of-scope (cell never measured, not exhausted)', () => {
    const f = RULES.R05!(
      ctxFor({
        suppression: { cohort_suppressed: true, out_of_scope: true },
        benchmark_route: 'Not Listed in Section 84001',
      }),
    );
    expect(f).toBeNull();
  });
  it('does NOT fire for measured programs', () => {
    expect(RULES.R05!(ctxFor({}))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R06 — IRS floor
// ─────────────────────────────────────────────────────────────────────────────

describe('R06 — IRS reporter floor', () => {
  it('fires when earnings cell is suppressed', () => {
    const f = RULES.R06!(
      ctxFor({
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { earn_suppressed: true, cohort_suppressed: true },
      }),
    );
    expect(f).not.toBeNull();
  });
  it('does not fire for measured programs', () => {
    expect(RULES.R06!(ctxFor({}))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R07 — in-state share
// ─────────────────────────────────────────────────────────────────────────────

describe('R07 — 50%-in-state benchmark route', () => {
  it('fires parametric when in_state_share missing', () => {
    const f = RULES.R07!(ctxFor({}));
    expect(f?.data_status).toBe('PAR');
    expect(f?.note).toMatch(/legacy build pre-cp-0on\.1/);
  });
  it('fires deterministic when in_state_share supplied', () => {
    const f = RULES.R07!(ctxFor({ in_state_share: 0.93 }));
    expect(f?.data_status).toBe('DET');
    expect(f?.note).toMatch(/93\.0%/);
  });
  // cp-0on.5 acceptance — CSULB-specific value lands as DET post-merge.
  it('CSULB fixture (in_state_share=0.9918) → DET citing 99.2% in-state share', () => {
    const f = RULES.R07!(ctxFor({ in_state_share: 0.9918 }));
    expect(f?.data_status).toBe('DET');
    expect(f?.note).toMatch(/99\.2%/);
    expect(f?.note).toMatch(/t4enrl_inst_instate_p1819/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R08 / R09 — benchmark route by credlev
// ─────────────────────────────────────────────────────────────────────────────

describe('R08 — graduate lowest-of-three', () => {
  it('fires for Master\'s', () => {
    const f = RULES.R08!(ctxFor({ credlev: "Master's" }));
    expect(f).not.toBeNull();
    expect(f?.data_status).toBe('DET');
  });
  it('fires for Doctoral', () => {
    expect(RULES.R08!(ctxFor({ credlev: 'Doctoral' }))).not.toBeNull();
  });
  it('does not fire for Bachelor', () => {
    expect(RULES.R08!(ctxFor({ credlev: 'Bachelor' }))).toBeNull();
  });
});

describe('R09 — undergraduate state HS-only baseline', () => {
  it('fires for Bachelor', () => {
    const f = RULES.R09!(
      ctxFor({
        credlev: 'Bachelor',
        benchmark_route: 'Same-State HS Median',
        ep_gap_pct: 0.06,
      }),
    );
    expect(f).not.toBeNull();
  });
  it('does not fire for Master\'s', () => {
    expect(RULES.R09!(ctxFor({ credlev: "Master's" }))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R10 — ACS n=30 cell drop
// ─────────────────────────────────────────────────────────────────────────────

describe('R10 — ACS n=30 cell drop', () => {
  it('fires for graduate programs', () => {
    expect(RULES.R10!(ctxFor({ credlev: "Master's" }))).not.toBeNull();
  });
  it('does not fire for undergraduate', () => {
    expect(RULES.R10!(ctxFor({ credlev: 'Bachelor' }))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R11 — gap calculation
// ─────────────────────────────────────────────────────────────────────────────

describe('R11 — EP measure gap calculation', () => {
  it('fires when ep_gap_pct is computable', () => {
    const f = RULES.R11!(ctxFor({ ep_gap_pct: -0.3265 }));
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/-32\.65%/);
    expect(f?.note).toMatch(/tool-derived/);
  });
  it('does not fire when ep_gap_pct is null', () => {
    expect(RULES.R11!(ctxFor({ ep_gap_pct: null }))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R12 — NOT MEASURED branch
// ─────────────────────────────────────────────────────────────────────────────

describe('R12 — NOT MEASURED enumeration (chair greenlight: four reasons)', () => {
  it('fires with out_of_scope reason', () => {
    const f = RULES.R12!(
      ctxFor({
        median_earn_p4: null,
        benchmark: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: {
          out_of_scope: true,
          earn_suppressed: true,
          cohort_suppressed: true,
        },
        benchmark_route: 'Not Listed in Section 84001',
      }),
    );
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/out of OBBBA § 84001 scope/);
  });
  it('fires with privacy_suppressed reason', () => {
    const f = RULES.R12!(
      ctxFor({
        median_earn_p4: null,
        benchmark: 50000.0,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: {
          missing_test: 1,
          earn_suppressed: true,
        },
      }),
    );
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/privacy rule/);
  });
  it('fires with cohort_below_floor reason', () => {
    const f = RULES.R12!(
      ctxFor({
        cohort_count: null,
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { cohort_suppressed: true, earn_suppressed: true },
      }),
    );
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/cohort below 30/);
  });
  it('does not fire for measured programs', () => {
    expect(RULES.R12!(ctxFor({}))).toBeNull();
  });
  it('precedence: out_of_scope dominates other suppression flags', () => {
    const f = RULES.R12!(
      ctxFor({
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: {
          out_of_scope: true,
          missing_test: 1,
          earn_suppressed: true,
          cohort_suppressed: true,
        },
        benchmark_route: 'Not Listed in Section 84001',
      }),
    );
    expect(f?.note).toMatch(/out of OBBBA/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R13 — 2-of-3-year trigger
// ─────────────────────────────────────────────────────────────────────────────

describe('R13 — 2-of-3-year trigger', () => {
  it('fires for measured programs (describes-but-does-not-execute at MVP)', () => {
    const f = RULES.R13!(ctxFor({}));
    expect(f?.data_status).toBe('PAR');
    expect(f?.note).toMatch(/PPD:2027/);
  });
  it('does not fire for NOT MEASURED programs', () => {
    expect(
      RULES.R13!(
        ctxFor({
          median_earn_p4: null,
          ep_gap_pct: null,
          ppd_fail_obbb: null,
          suppression: { cohort_suppressed: true, earn_suppressed: true },
        }),
      ),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R14 — hidden-program surfacer (per-program no-op; institution-level surfacer)
// ─────────────────────────────────────────────────────────────────────────────

describe('R14 — hidden-program surfacer (per-program)', () => {
  it('does not fire per-program (institution-level surfacer)', () => {
    expect(RULES.R14!(ctxFor({}))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R15 / R16
// ─────────────────────────────────────────────────────────────────────────────

describe('R15 — institutional cascade advisory', () => {
  it('fires when surfacedVerdict is FAIL', () => {
    expect(RULES.R15!(ctxFor({}))).not.toBeNull(); // default is Music MM = FAIL
  });
  it('does not fire on PASS', () => {
    expect(
      RULES.R15!(
        ctxFor({
          credlev: 'Bachelor',
          ppd_fail_obbb: 0,
          ep_gap_pct: 0.06,
          benchmark_route: 'Same-State HS Median',
        }),
      ),
    ).toBeNull();
  });
});

describe('R16 — pandemic-cohort advisory', () => {
  it('fires for PPD:2026 measured programs', () => {
    expect(RULES.R16!(ctxFor({}))).not.toBeNull();
  });
  it('does not fire for NOT MEASURED', () => {
    expect(
      RULES.R16!(
        ctxFor({
          median_earn_p4: null,
          ep_gap_pct: null,
          ppd_fail_obbb: null,
          suppression: { cohort_suppressed: true, earn_suppressed: true },
        }),
      ),
    ).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R17 — RIA Table 3.19 elevation
// ─────────────────────────────────────────────────────────────────────────────

describe('R17 — RIA Table 3.19 elevation flag', () => {
  it('fires for 50.05 (Drama/Theatre)', () => {
    expect(RULES.R17!(ctxFor({ cip4: '5005' }))).not.toBeNull();
  });
  it('fires for 50.07 (Visual Arts)', () => {
    expect(RULES.R17!(ctxFor({ cip4: '5007' }))).not.toBeNull();
  });
  it('fires for 50.09 (Music)', () => {
    expect(RULES.R17!(ctxFor({ cip4: '5009' }))).not.toBeNull();
  });
  it('fires for 51.15 (Mental Health Counseling)', () => {
    expect(RULES.R17!(ctxFor({ cip4: '5115' }))).not.toBeNull();
  });
  it('fires for 13.12 (Teacher Education)', () => {
    expect(RULES.R17!(ctxFor({ cip4: '1312' }))).not.toBeNull();
  });
  it('does not fire for non-elevated CIPs', () => {
    expect(RULES.R17!(ctxFor({ cip4: '5006' }))).toBeNull(); // Cinematic Arts
    expect(RULES.R17!(ctxFor({ cip4: '0301' }))).toBeNull(); // Natural Resources
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R18 — graduate loan caps
// ─────────────────────────────────────────────────────────────────────────────

describe('R18 — OBBBA § 81001 graduate loan-cap advisory', () => {
  it('fires for any graduate-level credlev regardless of verdict', () => {
    expect(RULES.R18!(ctxFor({ credlev: "Master's" }))).not.toBeNull();
    expect(RULES.R18!(ctxFor({ credlev: 'Doctoral' }))).not.toBeNull();
    expect(RULES.R18!(ctxFor({ credlev: 'Graduate Certificate' }))).not.toBeNull();
  });
  it('does not fire for undergraduate', () => {
    expect(RULES.R18!(ctxFor({ credlev: 'Bachelor' }))).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R19 — noise band
// ─────────────────────────────────────────────────────────────────────────────

describe('R19 — noise-band advisory', () => {
  it('fires for measured PASS within ±15%', () => {
    const f = RULES.R19!(
      ctxFor({
        credlev: 'Bachelor',
        ppd_fail_obbb: 0,
        ep_gap_pct: 0.0606,
        benchmark_route: 'Same-State HS Median',
      }),
    );
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/tool-derived/);
    expect(f?.note).toMatch(/15%/);
  });
  it('fires for measured FAIL within ±15%', () => {
    const f = RULES.R19!(
      ctxFor({
        ep_gap_pct: -0.08,
        ppd_fail_obbb: 1,
      }),
    );
    expect(f).not.toBeNull();
  });
  it('does not fire outside ±15%', () => {
    const f = RULES.R19!(
      ctxFor({
        ep_gap_pct: -0.3265,
        ppd_fail_obbb: 1,
      }),
    );
    expect(f).toBeNull();
  });
  it('chair greenlight: suppressed-earnings cells get parallel annotation', () => {
    const f = RULES.R19!(
      ctxFor({
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: 1, // PPD published a verdict despite suppressed earnings
        suppression: { earn_suppressed: true, missing_test: 1 },
      }),
    );
    // PPD-published verdict with suppressed earnings — parallel annotation fires
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/suppressed under federal privacy rule/i);
    expect(f?.note).toMatch(/structurally inapplicable/i);
  });
  it('does not fire on NOT MEASURED', () => {
    const f = RULES.R19!(
      ctxFor({
        median_earn_p4: null,
        benchmark: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { cohort_suppressed: true, earn_suppressed: true },
      }),
    );
    expect(f).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R20 — cross-validation
// ─────────────────────────────────────────────────────────────────────────────

describe('R20 — cross-validation', () => {
  it('agrees when tool and PPD match', () => {
    const f = RULES.R20!(ctxFor({}));
    expect(f).not.toBeNull();
    expect(f?.note).toMatch(/agrees/i);
  });
  it('disagrees when tool and PPD differ', () => {
    // synthetic disagree: gap < 0 (tool FAIL) but PPD says pass
    const f = RULES.R20!(
      ctxFor({
        ep_gap_pct: -0.05,
        ppd_fail_obbb: 0,
      }),
    );
    expect(f?.note).toMatch(/differs/i);
  });
  it('reports both-not-measured as no fire', () => {
    const f = RULES.R20!(
      ctxFor({
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { cohort_suppressed: true, earn_suppressed: true },
      }),
    );
    expect(f).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-validation status helper coverage
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveCrossValidationStatus', () => {
  it('returns agree on identical verdicts', () => {
    expect(deriveCrossValidationStatus('PASS', 'PASS')).toBe('agree');
    expect(deriveCrossValidationStatus('FAIL', 'FAIL')).toBe('agree');
  });
  it('returns disagree on differing verdicts', () => {
    expect(deriveCrossValidationStatus('PASS', 'FAIL')).toBe('disagree');
    expect(deriveCrossValidationStatus('FAIL', 'PASS')).toBe('disagree');
  });
  it('returns ppd-not-published when PPD null but tool measured', () => {
    expect(deriveCrossValidationStatus('PASS', null)).toBe('ppd-not-published');
  });
  it('returns tool-not-measured-ppd-published when only PPD has a value', () => {
    expect(deriveCrossValidationStatus('NOT MEASURED', 'PASS')).toBe(
      'tool-not-measured-ppd-published',
    );
  });
  it('returns both-not-measured when neither side resolves', () => {
    expect(deriveCrossValidationStatus('NOT MEASURED', null)).toBe(
      'both-not-measured',
    );
  });
});
