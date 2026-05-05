// Primary-source citation strings, anchored to
// briefs/2026-04-28-csu-deans-ep-tool/source-notes.md.
//
// One spot, one set of strings — when a citation needs to update across the
// rules engine (e.g. a regulation's section number changes between NPRM and
// final rule), it changes here once.

export const CITATIONS = {
  // OBBBA (Public Law 119-21)
  OBBBA_84001_C2:
    'OBBBA § 84001(c)(2) — PLAW-119publ21 lines 16474–16489',
  OBBBA_84001_C3_B_i_I:
    'OBBBA § 84001(c)(3)(B)(i)(I) — PLAW-119publ21 lines 16506–16539',
  OBBBA_84001_C3_B_i_II:
    'OBBBA § 84001(c)(3)(B)(i)(II) — PLAW-119publ21 lines 16506–16539',
  OBBBA_84001_C3_B_ii:
    'OBBBA § 84001(c)(3)(B)(ii) — PLAW-119publ21 lines 16506–16539',
  OBBBA_84001_C4_A:
    'OBBBA § 84001(c)(4)(A) — PLAW-119publ21 lines 16540–16552',
  OBBBA_84001_C4_B:
    'OBBBA § 84001(c)(4)(B) — PLAW-119publ21 lines 16540–16552',
  OBBBA_81001:
    'OBBBA § 81001 — PLAW-119publ21 (graduate loan caps; independent of EP test)',

  // STATS NPRM (FR 2026-07666) — text of the proposed regulations
  NPRM_2272_2286:
    'STATS NPRM § IX.GD Cohort Period — raw.txt 2272–2286',
  NPRM_2287_2300:
    'STATS NPRM § IX.GD Cohort Period — raw.txt 2287–2300',
  NPRM_2301_2320:
    'STATS NPRM § IX.GD Cohort Period — raw.txt 2301–2320',
  NPRM_2321_2335:
    'STATS NPRM § IX.GD Cohort Period — raw.txt 2321–2335',
  NPRM_2336_2344:
    'STATS NPRM § IX.GD Cohort Period — raw.txt 2336–2344',
  NPRM_2793_2834:
    'STATS NPRM § IX.GD Earnings Threshold — raw.txt 2793–2834',
  NPRM_RIA_TABLE_3_19:
    'STATS NPRM RIA Table 3.19 (named populations) — raw.txt 8956–8970',
  NPRM_RIA_21099:
    'STATS NPRM RIA p. 21099 (first measurement timing)',
  NPRM_RIA_21163:
    'STATS NPRM RIA p. 21163 (PPD release sequence)',
  NPRM_RIA_21169:
    'STATS NPRM RIA p. 21169 (cohort window)',

  // Proposed regulations (CFR amendments)
  PROP_668_402_C3:
    'Proposed § 668.402(c)(3) — 50%-in-state benchmark route',
  PROP_668_403_D1:
    'Proposed § 668.403(d)(1) — Earnings premium measures not issued',
  PROP_668_404_D:
    'Proposed § 668.404(d) — IRS reporter floor (n ≥ 16)',
  PROP_668_43_D1:
    'Proposed § 668.43(d)(1) — first-failure disclosure',
  PROP_668_603:
    'Proposed § 668.603 — appeal scope (calc-error only)',
  PROP_668_16_T:
    'Proposed § 668.16(t) — institutional cascade',

  // PPD:2026 Technical Documentation
  PPD_TECH_APPENDIX_P7_PRIVACY:
    'PPD:2026 Technical Data Appendix p. 7 — privacy noise + 9% suppression',
  PPD_TECH_APPENDIX_P7_IRS_16:
    'PPD:2026 Technical Data Appendix p. 7 — 16 IRS-reporter floor',
  PPD_TECH_APPENDIX_ACS_30:
    'PPD:2026 Technical Data Appendix — ACS n=30 cell drop',
  PPD_TECH_APPENDIX_MIDPOINT_15:
    'PPD:2026 Technical Data Appendix — midpoint-15 substitution rule (cells 10-19)',
  PPD_TECH_APPENDIX_OBBB_VARIABLE:
    'PPD:2026 Technical Data Appendix — modified variables aligned to OBBBA earnings test',
  PPD_TECH_ERRATUM_2026_01_02:
    'PPD:2026 Technical Appendix Jan 2 2026 erratum — `mstr_obbb_fail_cip2_wageb` post-bacc cert miscount (<0.04% of programs)',
} as const;

export type CitationKey = keyof typeof CITATIONS;

/** M-doc anchor identifiers used by both rules and panel renderer. */
export const M_DOCS = {
  M01: 'M01-cohort-visibility-cascade',
  M02: 'M02-earnings-numerator',
  M03: 'M03-benchmark-construction',
  M04: 'M04-pass-fail-trigger',
  M05: 'M05-program-level-consequence',
  M06: 'M06-institution-level-consequence',
  M07: 'M07-student-warnings-disclosures',
  M08: 'M08-obbba-loan-caps',
  M09: 'M09-appeal-remedy-pathways',
  M10: 'M10-authority-architecture-litigation-posture',
  M11: 'M11-institutional-administrative-compliance',
  M12: 'M12-reporting-cadence-data-quality',
  M13: 'M13-effective-date-timing-grandfathering',
  M14: 'M14-targeting-named-populations',
  M15: 'M15-strategic-response-scenarios',
  M17: 'M17-bd-csd-delays',
  // M16 is intentionally deferred per analyses/mechanisms/_index.md.
} as const;

/** Footer reminder rendered on every result page per spec §1.4. */
export const PRIMARY_SOURCE_REMINDER =
  'Re-derive against primary sources before any external submission.';

/**
 * Forward-simulation framing per cp-dw65 (cp-j0gw.3). Every EP-test verdict
 * surfaced by this tool is a SIMULATION run against AHEAD's negotiator
 * analytic file (PPD:2026), not an observation of the implemented rule. The
 * first official STATS earnings-premium release is scheduled for 2027-07-01.
 */
export const SIMULATION_FRAMING =
  'FORWARD SIMULATION — verdicts shown here are computed on the PPD:2026 negotiator analytic file. The first official STATS earnings-premium release is scheduled for 2027-07-01. Conditional on AHEAD-published projections holding.';

/**
 * Expertise disclaimer per cp-j0gw.6. We are not attorneys and not legislative
 * analysts. Findings derive from publicly available data; verify against
 * primary sources before any external use.
 */
export const EXPERTISE_DISCLAIMER =
  'This tool is built by educators, not attorneys or legislative analysts. Every finding is derived from publicly available federal data using the rules engine documented in this repo. Independently verify all numbers and citations against the primary sources before any external submission, public comment, or institutional decision.';
