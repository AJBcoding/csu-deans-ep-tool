// Acceptance — reproduces dean memo v10 §1 numbers from the CSULB fixture.
//
// Source: briefs/2026-04-23-dean-royce-OBBBA-EP-synthesis.v10.md §1 bottom-line.
// Extension (cp-j0gw.1): English MA per REV-2 narrative correction (cp-fiq8.2.2,
// 2026-05-03) — third CSULB direct-fail surfaced after AHEAD-flag-override fix.
//
// Music MM   (5009/Master's):     FAIL @ -32.65%, n=28
// Art MFA    (5007/Master's):     FAIL @ -20.40%, n=23
// English MA (2301/Master's):     FAIL @ -4.97%,  n=29  (cp-j0gw.1, REV-2)
// Theatre BA (5005/Bachelor):     PASS @ +6.06%, n=81 — within R19 noise band
// Cinematic Arts BA (5006/Bach):  NOT MEASURED (B16 invisibility — absent from PPD)

import { describe, expect, it } from 'vitest';
import { analyzeInstitution, analyzeQueriedPrograms } from '../src/index.js';
import { loadCsulb } from './helpers.js';

describe('Acceptance — dean memo v10 §1', () => {
  const inst = loadCsulb();
  const result = analyzeInstitution(inst);

  const find = (cip4: string, credlev: string) =>
    result.programs.find((p) => p.cip4 === cip4 && p.credlev === credlev);

  it('Music MM (5009/Master\'s) — FAIL at -32.65%, n=28', () => {
    const v = find('5009', "Master's");
    expect(v).toBeDefined();
    expect(v?.verdict).toBe('FAIL');
    expect(v?.cohort_count).toBe(28);
    expect(v?.median_earn_p4).toBe(32534.0);
    expect(v?.benchmark).toBe(48304.0);
    // memo: -32.6%, fixture: -32.65% (4-decimal precision)
    expect(v?.ep_gap_pct).toBeCloseTo(-0.3265, 4);
    expect(v?.noise_band.fired).toBe(false); // -32.65% well outside ±15%
    expect(v?.cross_validation.status).toBe('agree');
    // R17 elevation flag fires for 50.09 (Music)
    expect(v?.rules_fired.map((r) => r.id)).toContain('R17');
    // R18 graduate loan-cap advisory
    expect(v?.rules_fired.map((r) => r.id)).toContain('R18');
  });

  it('Art MFA (5007/Master\'s) — FAIL at -20.40%, n=23', () => {
    const v = find('5007', "Master's");
    expect(v).toBeDefined();
    expect(v?.verdict).toBe('FAIL');
    expect(v?.cohort_count).toBe(23);
    expect(v?.median_earn_p4).toBe(38452.0);
    expect(v?.ep_gap_pct).toBeCloseTo(-0.204, 3);
    expect(v?.noise_band.fired).toBe(false);
    expect(v?.cross_validation.status).toBe('agree');
    expect(v?.rules_fired.map((r) => r.id)).toContain('R17');
  });

  it('English MA (2301/Master\'s) — FAIL at -4.97%, n=29 (REV-2 cp-j0gw.1)', () => {
    // REV-2 narrative correction (cp-fiq8.2.2, 2026-05-03): the AHEAD-published
    // per-cell flag override surfaces this as the third CSULB direct-fail. Gap
    // is small (-4.97%) but PPD-published verdict is authoritative — falls
    // OUTSIDE the noise band trigger range only because PPD asserts FAIL.
    // Source: analyses/csulb-impact-passes/narrative.md REV-2; senate packet
    // briefs/senate-distribution-2026-05-04/.
    const v = find('2301', "Master's");
    expect(v).toBeDefined();
    expect(v?.verdict).toBe('FAIL');
    expect(v?.cohort_count).toBe(29);
    expect(v?.median_earn_p4).toBe(47026.0);
    expect(v?.benchmark).toBe(49483.0);
    expect(v?.ep_gap_pct).toBeCloseTo(-0.0497, 4);
    // PPD-published agrees with tool re-derivation (both FAIL).
    expect(v?.cross_validation.status).toBe('agree');
    // R08 fires — graduate lowest-of-three benchmark route.
    expect(v?.rules_fired.map((r) => r.id)).toContain('R08');
    // R18 fires — graduate loan-cap advisory.
    expect(v?.rules_fired.map((r) => r.id)).toContain('R18');
    // R19 fires — gap is INSIDE ±15% noise band; verdict could read other way
    // on the same data with privacy noise.
    expect(v?.noise_band.fired).toBe(true);
    expect(v?.noise_band.provenance).toBe('gap_tool_derived');
  });

  it('Theatre BA (5005/Bachelor) — PASS at +6.06%, n=81, in R19 noise band', () => {
    const v = find('5005', 'Bachelor');
    expect(v).toBeDefined();
    expect(v?.verdict).toBe('PASS');
    expect(v?.cohort_count).toBe(81);
    expect(v?.median_earn_p4).toBe(38270.0);
    expect(v?.ep_gap_pct).toBeCloseTo(0.0606, 4);
    expect(v?.noise_band.fired).toBe(true);
    expect(v?.noise_band.provenance).toBe('gap_tool_derived');
    expect(v?.noise_band.message).toMatch(/noise band/i);
    expect(v?.cross_validation.status).toBe('agree');
    // R19 fires
    expect(v?.rules_fired.map((r) => r.id)).toContain('R19');
    // R17 elevation flag fires for 50.05 (Drama/Theatre)
    expect(v?.rules_fired.map((r) => r.id)).toContain('R17');
    // R09 (UG state-HS-only baseline) fires for Bachelor
    expect(v?.rules_fired.map((r) => r.id)).toContain('R09');
    // R08 (graduate lowest-of-three) does NOT fire for Bachelor
    expect(v?.rules_fired.map((r) => r.id)).not.toContain('R08');
    // R18 (graduate loan caps) does NOT fire for Bachelor
    expect(v?.rules_fired.map((r) => r.id)).not.toContain('R18');
  });

  it('Cinematic Arts BA (5006/Bachelor) — absent from fixture (B16 invisibility)', () => {
    // The base analyzeInstitution path only surfaces programs PPD publishes;
    // 5006/Bachelor is genuinely absent from the CSULB slice.
    const v = find('5006', 'Bachelor');
    expect(v).toBeUndefined();
  });

  it('queried-CIPs path surfaces Cinematic Arts BA as NOT MEASURED with B16 provenance', () => {
    const queried = analyzeQueriedPrograms(inst, [
      { cip4: '5006', credlev: 'Bachelor' },
      { cip4: '5009', credlev: "Master's" },
      { cip4: '5007', credlev: "Master's" },
      { cip4: '5005', credlev: 'Bachelor' },
    ]);
    const v = queried.programs.find(
      (p) => p.cip4 === '5006' && p.credlev === 'Bachelor',
    );
    expect(v).toBeDefined();
    expect(v?.verdict).toBe('NOT MEASURED');
    expect(v?.not_measured_reason).toBe('b16_invisible_to_ppd');
    expect(v?.cross_validation.status).toBe('both-not-measured');
    // R12 fires with the b16 invisibility note
    const r12 = v?.rules_fired.find((r) => r.id === 'R12');
    expect(r12).toBeDefined();
    expect(r12?.note).toMatch(/absent from PPD/i);
    expect(r12?.note).toMatch(/cohort cascade did not run/i);
  });

  it('all eight v6 panels auto-trigger on the CSULB run', () => {
    const ids = result.panels.map((p) => p.id);
    expect(ids.sort()).toEqual([
      'M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14',
    ]);
  });

  it('integrity envelope reports primary-source reminder and counts', () => {
    expect(result.integrity_envelope.primary_source_reminder).toBe(
      'Re-derive against primary sources before any external submission.',
    );
    expect(result.integrity_envelope.ppd_release).toBe('2026');
    expect(result.integrity_envelope.build_date).toBe('2026-04-29');
    expect(result.integrity_envelope.noise_band_advisories_count).toBeGreaterThan(0);
    expect(result.integrity_envelope.cross_validation_disagreements).toBe(0);
  });

  it('integrity envelope surfaces simulation framing (cp-j0gw.3)', () => {
    expect(result.integrity_envelope.simulation_framing).toMatch(/FORWARD SIMULATION/);
    expect(result.integrity_envelope.simulation_framing).toMatch(/PPD:2026/);
    expect(result.integrity_envelope.simulation_framing).toMatch(/2027-07-01/);
  });

  it('integrity envelope surfaces expertise disclaimer (cp-j0gw.6)', () => {
    expect(result.integrity_envelope.expertise_disclaimer).toMatch(/not attorneys/i);
    expect(result.integrity_envelope.expertise_disclaimer).toMatch(/not.*legislative analysts/i);
    expect(result.integrity_envelope.expertise_disclaimer).toMatch(/Independently verify/i);
  });

  it('footer reminder is present on every result page', () => {
    expect(result.footer_reminder).toBe(
      'Re-derive against primary sources before any external submission.',
    );
  });

  it('cross-validation banner does NOT fire on CSULB (no >5% disagreement)', () => {
    expect(result.cross_validation_banner).toBeNull();
  });

  it('hidden-program surfacer is deterministic (post-cp-0on.1 — candidates populated)', () => {
    // PAR→DET upgrade landed via cp-0on.5: the CSULB fixture carries
    // `hidden_program_candidates` from amber's IPEDS Completions join, so
    // R14 surfaces the list deterministically.
    expect(result.hidden_programs.available).toBe(true);
    expect(result.hidden_programs.data_status).toBe('DET');
    expect(result.hidden_programs.parametric_note).toBeNull();
    expect(result.hidden_programs.programs.length).toBeGreaterThan(0);
    // Provenance cites the IPEDS Completions C-survey vintage.
    expect(result.hidden_programs.provenance).toMatch(/IPEDS Completions/);
  });
});
