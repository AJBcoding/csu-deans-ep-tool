// Engine + envelope + panels — orchestration-level tests on synthetic
// fixtures, complementing the CSULB acceptance suite.

import { describe, expect, it } from 'vitest';
import { analyzeInstitution, analyzeQueriedPrograms } from '../src/index.js';
import { makeInstitution, makeProgram } from './helpers.js';

describe('Engine — verdict ordering + envelope counts', () => {
  it('orders by severity: FAIL → NOT MEASURED → PASS', () => {
    const inst = makeInstitution([
      makeProgram({
        cip4: '5005',
        credlev: 'Bachelor',
        ppd_fail_obbb: 0,
        ep_gap_pct: 0.06,
        benchmark_route: 'Same-State HS Median',
      }),
      makeProgram({
        cip4: '5009',
        credlev: "Master's",
        ppd_fail_obbb: 1,
        ep_gap_pct: -0.32,
      }),
      makeProgram({
        cip4: '0501',
        credlev: 'Undergrad Certificate',
        median_earn_p4: null,
        benchmark: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        benchmark_route: 'Not Listed in Section 84001',
        suppression: { out_of_scope: true, earn_suppressed: true, cohort_suppressed: true },
      }),
    ]);
    const r = analyzeInstitution(inst);
    expect(r.programs[0]?.verdict).toBe('FAIL');
    expect(r.programs[1]?.verdict).toBe('NOT MEASURED');
    expect(r.programs[2]?.verdict).toBe('PASS');
  });

  it('integrity envelope — counts each suppression bucket', () => {
    const inst = makeInstitution([
      makeProgram({}), // FAIL Music MM (default fixture)
      makeProgram({
        cip4: '5005',
        credlev: 'Bachelor',
        ppd_fail_obbb: 0,
        ep_gap_pct: 0.06,
        benchmark_route: 'Same-State HS Median',
      }),
      makeProgram({
        cip4: '0501',
        credlev: 'Undergrad Certificate',
        median_earn_p4: null,
        benchmark: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        benchmark_route: 'Not Listed in Section 84001',
        suppression: { out_of_scope: true, earn_suppressed: true, cohort_suppressed: true },
      }),
      makeProgram({
        cip4: '0501',
        credlev: "Master's",
        cohort_count: null,
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { cohort_suppressed: true, earn_suppressed: true },
      }),
    ]);
    const r = analyzeInstitution(inst);
    const sum = r.integrity_envelope.data_status_summary;
    expect(sum.fully_measured).toBe(2);
    expect(sum.out_of_scope).toBe(1);
    expect(sum.irs_below_floor + sum.cohort_below_floor).toBeGreaterThanOrEqual(1);
  });

  it('cross-validation banner fires above 5% disagreement', () => {
    // 100 measured programs, 6 disagreements → 6.0% > 5% threshold
    const programs = [];
    for (let i = 0; i < 94; i += 1) {
      programs.push(
        makeProgram({
          cip4: '5005',
          credlev: 'Bachelor',
          ppd_fail_obbb: 0,
          ep_gap_pct: 0.06,
          benchmark_route: 'Same-State HS Median',
        }),
      );
    }
    for (let i = 0; i < 6; i += 1) {
      // tool FAIL (gap<0) but PPD PASS — synthetic disagree
      programs.push(
        makeProgram({
          cip4: '5005',
          credlev: 'Bachelor',
          ppd_fail_obbb: 0,
          ep_gap_pct: -0.05,
          benchmark_route: 'Same-State HS Median',
        }),
      );
    }
    const r = analyzeInstitution(makeInstitution(programs));
    expect(r.cross_validation_banner).not.toBeNull();
    expect(r.cross_validation_banner).toMatch(/6\.0%/);
  });

  it('cross-validation banner does NOT fire at exactly 5%', () => {
    // 100 measured, 5 disagreements → exactly 5%, must be ABOVE threshold
    const programs = [];
    for (let i = 0; i < 95; i += 1) {
      programs.push(
        makeProgram({
          cip4: '5005',
          credlev: 'Bachelor',
          ppd_fail_obbb: 0,
          ep_gap_pct: 0.06,
          benchmark_route: 'Same-State HS Median',
        }),
      );
    }
    for (let i = 0; i < 5; i += 1) {
      programs.push(
        makeProgram({
          cip4: '5005',
          credlev: 'Bachelor',
          ppd_fail_obbb: 0,
          ep_gap_pct: -0.05,
          benchmark_route: 'Same-State HS Median',
        }),
      );
    }
    const r = analyzeInstitution(makeInstitution(programs));
    expect(r.cross_validation_banner).toBeNull();
  });

  it('determinism — identical input produces identical output', () => {
    const inst1 = makeInstitution([makeProgram({})]);
    const inst2 = makeInstitution([makeProgram({})]);
    const r1 = analyzeInstitution(inst1);
    const r2 = analyzeInstitution(inst2);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe('Engine — auto-triggered panels', () => {
  it('panels respect spec §5 trigger conditions', () => {
    // institution with one FAIL, one NOT MEASURED, one PASS, one R17 elevation
    const inst = makeInstitution([
      makeProgram({}), // 5009 Music MM = R17 + FAIL
      makeProgram({
        cip4: '5005',
        credlev: 'Bachelor',
        ppd_fail_obbb: 0,
        ep_gap_pct: 0.06,
        benchmark_route: 'Same-State HS Median',
      }),
      makeProgram({
        cip4: '0501',
        credlev: "Master's",
        cohort_count: null,
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: null,
        suppression: { cohort_suppressed: true, earn_suppressed: true },
      }),
    ]);
    const r = analyzeInstitution(inst);
    const ids = new Set(r.panels.map((p) => p.id));
    // Always-fire
    expect(ids.has('M01')).toBe(true);
    expect(ids.has('M13')).toBe(true);
    // M03 + M04 fire when any program is measured
    expect(ids.has('M03')).toBe(true);
    expect(ids.has('M04')).toBe(true);
    // M05 + M07 fire when any FAIL
    expect(ids.has('M05')).toBe(true);
    expect(ids.has('M07')).toBe(true);
    // M12 fires when any NOT MEASURED
    expect(ids.has('M12')).toBe(true);
    // M14 fires when any R17 elevation
    expect(ids.has('M14')).toBe(true);
  });

  it('M05/M07 do not fire when zero failures', () => {
    const inst = makeInstitution([
      makeProgram({
        cip4: '5005',
        credlev: 'Bachelor',
        ppd_fail_obbb: 0,
        ep_gap_pct: 0.06,
        benchmark_route: 'Same-State HS Median',
      }),
    ]);
    const r = analyzeInstitution(inst);
    const ids = new Set(r.panels.map((p) => p.id));
    expect(ids.has('M05')).toBe(false);
    expect(ids.has('M07')).toBe(false);
  });

  it('M14 does not fire when no R17 elevation', () => {
    const inst = makeInstitution([
      makeProgram({
        cip4: '0301',
        credlev: 'Bachelor',
        ppd_fail_obbb: 0,
        ep_gap_pct: 0.74,
        benchmark_route: 'Same-State HS Median',
      }),
    ]);
    const r = analyzeInstitution(inst);
    const ids = new Set(r.panels.map((p) => p.id));
    expect(ids.has('M14')).toBe(false);
  });
});

describe('Engine — queried-CIPs path (Persona A)', () => {
  it('synthesizes B16 invisibility for CIPs absent from PPD', () => {
    const inst = makeInstitution([makeProgram({})]); // only Music MM
    const r = analyzeQueriedPrograms(inst, [
      { cip4: '5009', credlev: "Master's" }, // present
      { cip4: '5006', credlev: 'Bachelor' }, // absent
    ]);
    expect(r.programs).toHaveLength(2);
    const invisible = r.programs.find(
      (p) => p.cip4 === '5006' && p.credlev === 'Bachelor',
    );
    expect(invisible?.verdict).toBe('NOT MEASURED');
    expect(invisible?.not_measured_reason).toBe('b16_invisible_to_ppd');
    const r12 = invisible?.rules_fired.find((r2) => r2.id === 'R12');
    expect(r12?.note).toMatch(/absent from PPD/i);
  });
});

describe('Engine — noise-band suppressed-earnings annotation', () => {
  it('fires parallel annotation when PPD verdict surfaces but earnings suppressed', () => {
    const inst = makeInstitution([
      makeProgram({
        median_earn_p4: null,
        ep_gap_pct: null,
        ppd_fail_obbb: 1,
        suppression: { earn_suppressed: true, missing_test: 1 },
      }),
    ]);
    const r = analyzeInstitution(inst);
    const v = r.programs[0]!;
    expect(v.verdict).toBe('FAIL');
    expect(v.noise_band.fired).toBe(true);
    expect(v.noise_band.provenance).toBe('earnings_suppressed_ppd_published');
  });

  // cp-j0gw.14 / R19 fourth annotation case (SPEC-DELTA §2.2).
  // When the published OBBBA verdict surfaces but the underlying earnings
  // are not published at the 4-digit grain for a cohort-level reason
  // (median_earn_p4 IS NULL with earn_suppressed=false — typically cohort
  // below floor or pool-inherited verdict), the noise-band test is still
  // structurally inapplicable but for a different reason than the
  // privacy-rule case above. The annotation must distinguish so the UI
  // can explain WHY the noise band did not run, per SPEC-DELTA §2.3
  // four-layer suppression model.
  describe('fourth annotation case — cohort_suppressed_ppd_published', () => {
    it('fires when verdict published but earnings null without privacy-rule suppression', () => {
      const inst = makeInstitution([
        makeProgram({
          median_earn_p4: null,
          ep_gap_pct: null,
          ppd_fail_obbb: 1,
          suppression: { cohort_suppressed: true, earn_suppressed: false },
        }),
      ]);
      const r = analyzeInstitution(inst);
      const v = r.programs[0]!;
      expect(v.verdict).toBe('FAIL');
      expect(v.noise_band.fired).toBe(true);
      expect(v.noise_band.provenance).toBe('cohort_suppressed_ppd_published');
      expect(v.noise_band.message).toMatch(/cohort below floor|not published at 4-digit/i);
    });

    it('keeps earnings_suppressed_ppd_published when earn_suppressed=true even if median_earn_p4 is null', () => {
      // earn_suppressed wins over the cohort branch — the privacy-rule
      // explanation is the more specific and user-relevant reason.
      const inst = makeInstitution([
        makeProgram({
          median_earn_p4: null,
          ep_gap_pct: null,
          ppd_fail_obbb: 1,
          suppression: { earn_suppressed: true, cohort_suppressed: true },
        }),
      ]);
      const r = analyzeInstitution(inst);
      const v = r.programs[0]!;
      expect(v.noise_band.provenance).toBe('earnings_suppressed_ppd_published');
    });

    it('does not fire when surfaced verdict is NOT MEASURED', () => {
      // When the cell never surfaces a verdict, no annotation fires —
      // regardless of which suppression flag is set.
      const inst = makeInstitution([
        makeProgram({
          median_earn_p4: null,
          ep_gap_pct: null,
          ppd_fail_obbb: null,
          benchmark: null,
          suppression: { cohort_suppressed: true },
        }),
      ]);
      const r = analyzeInstitution(inst);
      const v = r.programs[0]!;
      expect(v.verdict).toBe('NOT MEASURED');
      expect(v.noise_band.fired).toBe(false);
      expect(v.noise_band.provenance).toBeNull();
    });

    it('does not fire when earnings are present (preserves gap_tool_derived path)', () => {
      // Backward-compat sanity: the existing measurable-with-noise-band path
      // still produces gap_tool_derived; the new fourth case only branches
      // on median_earn_p4 IS NULL.
      const inst = makeInstitution([
        makeProgram({
          median_earn_p4: 38270.0,
          ep_gap_pct: 0.0606,
          ppd_fail_obbb: 0,
          suppression: { cohort_suppressed: false, earn_suppressed: false },
        }),
      ]);
      const r = analyzeInstitution(inst);
      const v = r.programs[0]!;
      expect(v.noise_band.fired).toBe(true);
      expect(v.noise_band.provenance).toBe('gap_tool_derived');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R14 — Hidden-program surfacer PAR→DET upgrade (cp-0on.5)
// ─────────────────────────────────────────────────────────────────────────────

describe('R14 — hidden-program surfacer (institution-level)', () => {
  it('falls back to PAR when hidden_program_candidates is absent', () => {
    const inst = makeInstitution([makeProgram({})]);
    const r = analyzeInstitution(inst);
    expect(r.hidden_programs.available).toBe(false);
    expect(r.hidden_programs.data_status).toBe('PAR');
    expect(r.hidden_programs.parametric_note).toMatch(/legacy build pre-cp-0on\.1/);
    expect(r.hidden_programs.programs).toEqual([]);
  });

  it('fires DET when hidden_program_candidates includes Cinematic Arts BA (50.0601)', () => {
    const inst = makeInstitution(
      [makeProgram({})],
      [
        {
          cip6: '50.0601',
          credlev: 'Bachelor',
          completers_total: 230,
          vintage: '2024',
        },
      ],
    );
    const r = analyzeInstitution(inst);
    expect(r.hidden_programs.available).toBe(true);
    expect(r.hidden_programs.data_status).toBe('DET');
    expect(r.hidden_programs.parametric_note).toBeNull();
    expect(r.hidden_programs.provenance).toMatch(/IPEDS Completions C2024_A/);
    expect(r.hidden_programs.programs).toHaveLength(1);
    const cinema = r.hidden_programs.programs[0]!;
    expect(cinema.cip6).toBe('50.0601');
    expect(cinema.credlev).toBe('Bachelor');
    expect(cinema.cohort_range_label).toBe('230 completers');
  });
});
