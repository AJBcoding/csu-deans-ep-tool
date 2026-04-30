// Rule registry — R01 through R20.
//
// Each rule is a pure function over (program, institution, derivedContext).
// Rules return a `RuleFire` if they fire for this program, or null.
//
// Citation strings come from `./citations.ts` (one source of truth).
// The narrative anchors for each rule trace to
// briefs/2026-04-28-csu-deans-ep-tool/source-notes.md.

import type {
  InstitutionRecord,
  ProgramRecord,
  RuleFire,
  VerdictWord,
  NotMeasuredReason,
} from './types.js';
import { CITATIONS, M_DOCS } from './citations.js';
import {
  isGraduateLevel,
  isUndergraduateLevel,
  deriveCrossValidationStatus,
} from './verdict.js';

export interface ProgramRuleContext {
  program: ProgramRecord;
  institution: InstitutionRecord;
  toolVerdict: VerdictWord;
  ppdVerdict: VerdictWord | null;
  surfacedVerdict: VerdictWord;
  notMeasuredReason: NotMeasuredReason | null;
}

export type RuleFn = (ctx: ProgramRuleContext) => RuleFire | null;

// ─────────────────────────────────────────────────────────────────────────────
// R01–R04 — cohort cascade (NPRM raw.txt 2272–2335 + OBBBA § 84001(c)(4))
//
// Per Pass-3 finding (SPEC-DELTA §1): PPD publishes at 4-digit grain. R01/R02
// run against IPEDS Completions for the *upper bound* only — that join is
// Phase 1 (c) (amber sub-sling). Until amber lands the join, R01/R02 fire as
// parametric advisories anchored to the cascade text. R03 fires for every
// measured row (PPD's published 4-digit cell IS the Stage-3 input). R04 fires
// only when PPD's documented expansion crossed into 2-digit territory; we
// cannot detect that from the published cell (PPD does not surface the stage
// reached) so R04 fires as a parametric advisory against R03's anchor.
// ─────────────────────────────────────────────────────────────────────────────

const R01: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  return {
    id: 'R01',
    title: 'Cohort cascade Stage 1 — single-year 6-digit',
    citation: CITATIONS.NPRM_2272_2286,
    m_doc: M_DOCS.M01,
    data_status: 'PAR',
    note:
      'Upper-bound stage; PPD publishes at 4-digit, so the 6-digit single-year cohort surfaces only via IPEDS Completions (Phase 1 build-side join — pending).',
  };
};

const R02: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  return {
    id: 'R02',
    title: 'Cohort cascade Stage 2 — 5 years pooled at 6-digit',
    citation: CITATIONS.NPRM_2287_2300,
    m_doc: M_DOCS.M01,
    data_status: 'PAR',
    note:
      'Upper-bound stage from IPEDS Completions C-survey (Phase 1 build-side join — pending). Statutory anchor: OBBBA § 84001(c)(4)(A).',
  };
};

const R03: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  return {
    id: 'R03',
    title: 'Cohort cascade Stage 3 — 4-digit CIP cell at PPD',
    citation: CITATIONS.NPRM_2301_2320,
    m_doc: M_DOCS.M01,
    data_status: 'DET',
    note:
      'Tool reads the PPD-published 4-digit cell directly. PPD has already applied Stages 1–3 expansion logic.',
  };
};

const R04: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  // PPD's 4-digit publication does not disclose whether 2-digit expansion was
  // reached. R04 fires as a parametric advisory pointing to the cascade text.
  return {
    id: 'R04',
    title: 'Cohort cascade Stage 4 — 2-digit CIP expansion',
    citation: CITATIONS.NPRM_2321_2335,
    m_doc: M_DOCS.M01,
    data_status: 'PAR',
    note:
      'PPD does not surface whether 2-digit expansion was reached for this cell. Drill-in points to the cascade text. Statutory anchor: OBBBA § 84001(c)(4)(B).',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R05 — cascade exhausted → no median published
// Fires when cohort_suppressed = true AND scope-included.
// (Out-of-scope cells are NOT cascade-exhausted; they were never measured.)
// ─────────────────────────────────────────────────────────────────────────────

const R05: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  if (!program.suppression.cohort_suppressed) return null;
  return {
    id: 'R05',
    title: 'Cascade exhausted — no median published',
    citation: CITATIONS.PROP_668_403_D1,
    m_doc: M_DOCS.M01,
    data_status: 'DET',
    note:
      'PPD-published `count_wne_p4 IS NULL` with scope-inclusion is the operationalization of cascade exhaustion (NPRM raw.txt 2336–2344).',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R06 — IRS match floor (n ≥ 16 reporters)
// PPD has already applied this floor (Tech Appendix p. 7). Fires when the
// earnings cell is suppressed but the cohort cell isn't (i.e., the IRS floor
// is the binding constraint, not the cascade). In PPD:2026 these always
// co-occur, but the rule remains conceptually distinct.
// ─────────────────────────────────────────────────────────────────────────────

const R06: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  if (!program.suppression.earn_suppressed) return null;
  return {
    id: 'R06',
    title: 'IRS match floor — fewer than 16 reporters',
    citation: CITATIONS.PROP_668_404_D,
    m_doc: M_DOCS.M02,
    data_status: 'DET',
    note: CITATIONS.PPD_TECH_APPENDIX_P7_IRS_16,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R07 — 50%-in-state benchmark route
// PAR→DET upgrade landed via cp-0on.5: amber's FA-part-1 / inst-completions
// join (cp-0on.1) populates `in_state_share` on every program record, so the
// CSULB run now fires DET. The PAR fallback is preserved for legacy fixtures
// produced before the build-side join landed.
// ─────────────────────────────────────────────────────────────────────────────

const R07: RuleFn = ({ program }) => {
  if (program.suppression.out_of_scope) return null;
  if (program.in_state_share === undefined || program.in_state_share === null) {
    return {
      id: 'R07',
      title: '50%-in-state benchmark route',
      citation: CITATIONS.OBBBA_84001_C3_B_i_II,
      m_doc: M_DOCS.M03,
      data_status: 'PAR',
      note:
        '`t4enrl_inst_instate_p1819` not present on this fixture (legacy build pre-cp-0on.1). Parametric fallback.',
    };
  }
  return {
    id: 'R07',
    title: '50%-in-state benchmark route',
    citation: CITATIONS.OBBBA_84001_C3_B_i_II,
    m_doc: M_DOCS.M03,
    data_status: 'DET',
    note: `In-state share: ${(program.in_state_share * 100).toFixed(1)}% (PPD field t4enrl_inst_instate_p1819).`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R08 — Graduate lowest-of-three benchmark
// Fires for graduate-level credlev. PPD's `which_test_cip2_wageb` discloses
// the rule branch selected.
// ─────────────────────────────────────────────────────────────────────────────

const R08: RuleFn = ({ program }) => {
  if (!isGraduateLevel(program.credlev)) return null;
  if (program.suppression.out_of_scope) return null;
  return {
    id: 'R08',
    title: 'Graduate lowest-of-three benchmark',
    citation: CITATIONS.OBBBA_84001_C3_B_ii,
    m_doc: M_DOCS.M03,
    data_status: 'DET',
    note: `PPD selected branch: ${program.benchmark_route}.`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R09 — Undergraduate state HS-only baseline
// ─────────────────────────────────────────────────────────────────────────────

const R09: RuleFn = ({ program }) => {
  if (!isUndergraduateLevel(program.credlev)) return null;
  if (program.suppression.out_of_scope) return null;
  return {
    id: 'R09',
    title: 'Undergraduate state high-school-only baseline',
    citation: CITATIONS.OBBBA_84001_C3_B_i_I,
    m_doc: M_DOCS.M03,
    data_status: 'DET',
    note: `PPD selected branch: ${program.benchmark_route}.`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R10 — ACS n=30 cell drop
// PPD applies this internally. R10 fires as informational provenance for the
// drill-in — when `which_test_cip2_wageb` excludes a state field-of-study cell,
// the n=30 floor is one reason.
// ─────────────────────────────────────────────────────────────────────────────

const R10: RuleFn = ({ program }) => {
  if (!isGraduateLevel(program.credlev)) return null;
  if (program.suppression.out_of_scope) return null;
  return {
    id: 'R10',
    title: 'ACS n=30 cell drop',
    citation: CITATIONS.NPRM_2793_2834,
    m_doc: M_DOCS.M03,
    data_status: 'DET',
    note: CITATIONS.PPD_TECH_APPENDIX_ACS_30,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R11 — EP measure gap calculation
// Fires whenever the gap is computable. The gap is tool-derived from
// PPD-published earnings + benchmark (SPEC-DELTA §2.2).
// ─────────────────────────────────────────────────────────────────────────────

const R11: RuleFn = ({ program }) => {
  if (program.ep_gap_pct === null) return null;
  return {
    id: 'R11',
    title: 'EP measure gap calculation',
    citation: CITATIONS.OBBBA_84001_C2,
    m_doc: M_DOCS.M04,
    data_status: 'DET',
    note: `gap = (median - benchmark) / benchmark = ${(program.ep_gap_pct * 100).toFixed(2)}% (tool-derived from PPD-published earnings + benchmark; gap is not a published PPD field).`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R12 — NOT MEASURED branch enumeration
// Per chair greenlight (SPEC-DELTA §2.3) the enumeration adds a fourth reason:
// "program is out of OBBBA § 84001 scope (e.g., undergraduate certificate)".
// ─────────────────────────────────────────────────────────────────────────────

const R12_REASON_TEXT: Record<NotMeasuredReason, string> = {
  out_of_scope:
    'program out of OBBBA § 84001 scope (e.g., undergraduate certificate; not subject to the EP test).',
  privacy_suppressed:
    'cell suppressed by federal privacy rule — data perturbation moved median earnings >9% from true value.',
  earnings_below_floor:
    'IRS records below 16 — earnings cell suppressed (PPD Technical Appendix p. 7).',
  cohort_below_floor:
    'cohort below 30 after expansion to 2-digit CIP family.',
  b16_invisible_to_ppd:
    'program is absent from PPD entirely for this institution — no row at this (cip4, credlev). The cohort cascade did not run because there is no published cell. Surfaces only via the queried-CIPs path; warrants institutional-research review of the IPEDS Completions submission.',
};

const R12: RuleFn = ({ surfacedVerdict, notMeasuredReason }) => {
  if (surfacedVerdict !== 'NOT MEASURED') return null;
  if (notMeasuredReason === null) return null;
  return {
    id: 'R12',
    title: 'NOT MEASURED branch',
    citation: CITATIONS.PROP_668_403_D1,
    m_doc: M_DOCS.M12,
    data_status: 'DET',
    note: `Reason: ${R12_REASON_TEXT[notMeasuredReason]}`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R13 — 2-of-3-year trigger
// Describes-but-does-not-execute at MVP (only PPD:2026 published). Fires
// always as informational provenance for the verdict-card timing prose.
// ─────────────────────────────────────────────────────────────────────────────

const R13: RuleFn = ({ surfacedVerdict }) => {
  if (surfacedVerdict === 'NOT MEASURED') return null;
  return {
    id: 'R13',
    title: '2-of-3-year trigger',
    citation: CITATIONS.OBBBA_84001_C2,
    m_doc: M_DOCS.M04,
    data_status: 'PAR',
    note:
      'Describes-but-does-not-execute at MVP. PPD:2027 + PPD:2028 enable full 2-of-3-year trace.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R14 — Hidden-program surfacer
// PAR→DET upgrade landed via cp-0on.5: amber's IPEDS Completions join
// (cp-0on.1) populates `institution.hidden_program_candidates`. Surfacer
// logic at the institution level lives in `engine.ts`
// (`buildHiddenProgramSurface`) — DET when candidates are present, PAR
// fallback when absent.
//
// Convention: R14 fires once AT THE INSTITUTION LEVEL, not per program. The
// engine surfaces it via `hidden_programs.data_status` + `programs[]` /
// `parametric_note`. Per-program rule fire is omitted to avoid duplicating
// the advisory across every card.
// ─────────────────────────────────────────────────────────────────────────────

const R14: RuleFn = () => null;

// ─────────────────────────────────────────────────────────────────────────────
// R15 — Institutional cascade advisory
// Per Pass-2 audit, this is an advisory pointing to M06 — the AND-vs-OR
// debate is unsettled. Fires whenever any program FAILs at the institution
// (engine handles institution-level emission; per-program emits when the
// program itself fails).
// ─────────────────────────────────────────────────────────────────────────────

const R15: RuleFn = ({ surfacedVerdict }) => {
  if (surfacedVerdict !== 'FAIL') return null;
  return {
    id: 'R15',
    title: 'Institutional cascade advisory',
    citation: CITATIONS.PROP_668_16_T,
    m_doc: M_DOCS.M06,
    data_status: 'ADV',
    note:
      'Whether § 668.16(t) reads as AND or OR with § 668.16(o) is unsettled. See M06 §3 for the debate.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R16 — Pandemic-cohort advisory
// PPD:2026 cohort window is AY 2017-18 + AY 2018-19, earnings calendar 2022/2023
// — peak COVID disruption for venue-dependent arts sectors. Fires for every
// measured program in PPD:2026; advisory only.
// ─────────────────────────────────────────────────────────────────────────────

const R16: RuleFn = ({ institution, surfacedVerdict }) => {
  if (institution.ppd_release !== '2026') return null;
  if (surfacedVerdict === 'NOT MEASURED') return null;
  return {
    id: 'R16',
    title: 'Pandemic-cohort advisory',
    citation: CITATIONS.NPRM_RIA_21169,
    m_doc: M_DOCS.M04,
    data_status: 'ADV',
    note:
      'PPD:2026 cohort: AY 2017-18 + AY 2018-19. Earnings observed in calendar 2022/2023 — peak COVID-19 venue disruption window. Advisory; does not modify the verdict.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R17 — RIA Table 3.19 elevation flag
// Static CIP6 prefix list anchored to RIA prose: 50.05 (Drama/Theatre),
// 50.07 (Visual Arts), 50.09 (Music), 51.15 (Mental Health Counseling),
// 13.12 (Teacher Education). 4-digit prefix match.
// ─────────────────────────────────────────────────────────────────────────────

const RIA_3_19_PREFIXES_CIP4 = ['5005', '5007', '5009', '5115', '1312'] as const;

const R17: RuleFn = ({ program }) => {
  if (!RIA_3_19_PREFIXES_CIP4.includes(program.cip4 as (typeof RIA_3_19_PREFIXES_CIP4)[number])) return null;
  return {
    id: 'R17',
    title: 'RIA Table 3.19 elevation flag',
    citation: CITATIONS.NPRM_RIA_TABLE_3_19,
    m_doc: M_DOCS.M14,
    data_status: 'ADV',
    note:
      "ED's own analysis (RIA Table 3.19) flags this CIP family as 10–20× more likely to fail. Per-CIP elevation factors recomputed against PPD data run higher than the RIA prose.",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R18 — OBBBA § 81001 graduate loan-cap advisory
// Independent of the EP test; binds graduate students directly via reduced
// annual + lifetime federal loan limits. Fires for any graduate-level
// credlev (the test isn't gated on PASS/FAIL — the loan caps apply
// regardless of the program's EP verdict).
// ─────────────────────────────────────────────────────────────────────────────

const R18: RuleFn = ({ program }) => {
  if (!isGraduateLevel(program.credlev)) return null;
  return {
    id: 'R18',
    title: 'OBBBA § 81001 graduate loan-cap advisory',
    citation: CITATIONS.OBBBA_81001,
    m_doc: M_DOCS.M08,
    data_status: 'ADV',
    note:
      'OBBBA § 81001 reduces annual + lifetime federal loan limits for graduate borrowers. Independent of the EP test — applies regardless of PASS/FAIL.',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R19 — Noise-band advisory
// Fires when abs(ep_gap_pct) <= 0.15 AND verdict is measured.
// Per chair greenlight (SPEC-DELTA §2.2):
//   - Provenance string clarifies gap is tool-derived from PPD-published
//     earnings + benchmark (gap is NOT itself published).
//   - Suppressed-earnings cells (verdict surfaces from PPD but earnings
//     suppressed) carry a parallel annotation.
// ─────────────────────────────────────────────────────────────────────────────

const NOISE_BAND_THRESHOLD = 0.15;

const R19: RuleFn = ({ program, surfacedVerdict }) => {
  if (surfacedVerdict === 'NOT MEASURED') return null;

  // Suppressed-earnings annotation: PPD published a verdict but the underlying
  // earnings cell is suppressed under federal privacy rule. The noise-band
  // test is structurally inapplicable because there's no gap to measure
  // against the threshold. Annotate explicitly.
  if (program.suppression.earn_suppressed || program.median_earn_p4 === null) {
    return {
      id: 'R19',
      title: 'Noise-band advisory — earnings cell suppressed',
      citation: CITATIONS.PPD_TECH_APPENDIX_P7_PRIVACY,
      m_doc: M_DOCS.M01,
      data_status: 'ADV',
      note:
        'Verdict is PPD-published; underlying earnings cell suppressed under federal privacy rule. Noise-band test is structurally inapplicable (no published gap to threshold).',
    };
  }

  if (program.ep_gap_pct === null) return null;
  if (Math.abs(program.ep_gap_pct) > NOISE_BAND_THRESHOLD) return null;

  return {
    id: 'R19',
    title: 'Noise-band advisory',
    citation: CITATIONS.PPD_TECH_APPENDIX_P7_PRIVACY,
    m_doc: M_DOCS.M01,
    data_status: 'ADV',
    note: `|gap| = ${(Math.abs(program.ep_gap_pct) * 100).toFixed(2)}% ≤ 15% noise threshold. Gap is tool-derived from PPD-published earnings and benchmark; the percentage gap is not itself a published PPD field. With the rule's privacy noise, this verdict could read the other way on the same data.`,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// R20 — Cross-validation against PPD pre-computed verdict
// ─────────────────────────────────────────────────────────────────────────────

const R20: RuleFn = ({ toolVerdict, ppdVerdict }) => {
  const status = deriveCrossValidationStatus(toolVerdict, ppdVerdict);
  if (status === 'both-not-measured') return null;
  const note = (() => {
    switch (status) {
      case 'agree':
        return `Tool re-derivation agrees with PPD pre-computed verdict (both ${toolVerdict}).`;
      case 'disagree':
        return `Tool re-derivation (${toolVerdict}) differs from PPD pre-computed verdict (${ppdVerdict}). Surfaces inline; institution-level disagreement >5% triggers banner.`;
      case 'ppd-not-published':
        return `Tool re-derivation: ${toolVerdict}. PPD published no verdict for this cell.`;
      case 'tool-not-measured-ppd-published':
        return `PPD published ${ppdVerdict} but tool inputs insufficient for independent re-derivation.`;
      default:
        return 'Cross-validation status indeterminate.';
    }
  })();
  return {
    id: 'R20',
    title: 'Cross-validation against PPD pre-computed verdict',
    citation: CITATIONS.PPD_TECH_APPENDIX_OBBB_VARIABLE,
    m_doc: M_DOCS.M12,
    data_status: 'DET',
    note,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Registry — preserves R01..R20 ordering for stable rules_fired output.
// ─────────────────────────────────────────────────────────────────────────────

export const RULES: Record<string, RuleFn> = {
  R01,
  R02,
  R03,
  R04,
  R05,
  R06,
  R07,
  R08,
  R09,
  R10,
  R11,
  R12,
  R13,
  R14,
  R15,
  R16,
  R17,
  R18,
  R19,
  R20,
};

export const RULE_ORDER: readonly string[] = [
  'R01', 'R02', 'R03', 'R04', 'R05',
  'R06', 'R07', 'R08', 'R09', 'R10',
  'R11', 'R12', 'R13', 'R14', 'R15',
  'R16', 'R17', 'R18', 'R19', 'R20',
];
