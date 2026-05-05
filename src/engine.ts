// Engine — orchestrates rules R01–R20 over an institution's program records
// and emits the AnalysisResult shape consumed by the API + UI.

import type {
  AnalysisResult,
  Credlev,
  HiddenProgram,
  HiddenProgramCandidate,
  HiddenProgramSurface,
  InstitutionRecord,
  IntegrityEnvelope,
  NoiseBandAnnotation,
  ProgramRecord,
  ProgramVerdict,
  RuleFire,
  VerdictWord,
} from './types.js';
import { CITATIONS, M_DOCS } from './citations.js';
import {
  EXPERTISE_DISCLAIMER,
  PRIMARY_SOURCE_REMINDER,
  SIMULATION_FRAMING,
} from './citations.js';
import {
  RULES,
  RULE_ORDER,
  type ProgramRuleContext,
} from './rules.js';
// CITATIONS + M_DOCS are imported above for the queried-CIPs synthesis path.
import {
  deriveCrossValidationStatus,
  deriveNotMeasuredReason,
  derivePpdVerdict,
  deriveSurfacedVerdict,
  deriveToolVerdict,
} from './verdict.js';
import { buildPanels, panelsTriggeredByProgram } from './panels.js';

const NOISE_BAND_THRESHOLD = 0.15;
const CROSS_VALIDATION_BANNER_PCT = 0.05;

function buildNoiseBandAnnotation(
  program: ProgramRecord,
  surfacedVerdict: VerdictWord,
): NoiseBandAnnotation {
  if (surfacedVerdict === 'NOT MEASURED') {
    return { fired: false, provenance: null, message: null };
  }
  if (program.suppression.earn_suppressed || program.median_earn_p4 === null) {
    return {
      fired: true,
      provenance: 'earnings_suppressed_ppd_published',
      message:
        'Verdict is PPD-published; underlying earnings cell suppressed under federal privacy rule. Noise-band test is structurally inapplicable.',
    };
  }
  if (program.ep_gap_pct === null) {
    return { fired: false, provenance: null, message: null };
  }
  if (Math.abs(program.ep_gap_pct) > NOISE_BAND_THRESHOLD) {
    return { fired: false, provenance: null, message: null };
  }
  return {
    fired: true,
    provenance: 'gap_tool_derived',
    message:
      "This verdict is within the data's noise band. With the rule's privacy noise, the verdict could read the other way on the same data. Gap is tool-derived from PPD-published earnings and benchmark.",
  };
}

function evaluateProgram(
  program: ProgramRecord,
  institution: InstitutionRecord,
): ProgramVerdict {
  const toolVerdict = deriveToolVerdict(program);
  const ppdVerdict = derivePpdVerdict(program);
  const surfacedVerdict = deriveSurfacedVerdict(program);
  const notMeasuredReason = deriveNotMeasuredReason(program);

  const ctx: ProgramRuleContext = {
    program,
    institution,
    toolVerdict,
    ppdVerdict,
    surfacedVerdict,
    notMeasuredReason,
  };

  const fires: RuleFire[] = [];
  for (const id of RULE_ORDER) {
    const fn = RULES[id];
    if (fn === undefined) continue;
    const fire = fn(ctx);
    if (fire !== null) fires.push(fire);
  }

  const verdict: ProgramVerdict = {
    cip4: program.cip4,
    cip4_title: program.cip4_title,
    credlev: program.credlev,
    verdict: surfacedVerdict,
    cohort_count: program.cohort_count,
    median_earn_p4: program.median_earn_p4,
    benchmark: program.benchmark,
    benchmark_route: program.benchmark_route,
    ep_gap_pct: program.ep_gap_pct,
    not_measured_reason: notMeasuredReason,
    noise_band: buildNoiseBandAnnotation(program, surfacedVerdict),
    cross_validation: {
      tool: toolVerdict,
      ppd: ppdVerdict,
      status: deriveCrossValidationStatus(toolVerdict, ppdVerdict),
    },
    rules_fired: fires,
    panels_triggered: [],
  };
  verdict.panels_triggered = panelsTriggeredByProgram(verdict);
  return verdict;
}

function buildIntegrityEnvelope(
  institution: InstitutionRecord,
  verdicts: readonly ProgramVerdict[],
): IntegrityEnvelope {
  let fully_measured = 0;
  let ppd_suppressed = 0;
  let irs_below_floor = 0;
  let cohort_below_floor = 0;
  let out_of_scope = 0;
  let noise_band = 0;
  let disagreements = 0;

  for (const v of verdicts) {
    if (v.noise_band.fired) noise_band += 1;
    if (v.cross_validation.status === 'disagree') disagreements += 1;

    if (v.verdict === 'NOT MEASURED') {
      switch (v.not_measured_reason) {
        case 'out_of_scope':
          out_of_scope += 1;
          break;
        case 'privacy_suppressed':
          ppd_suppressed += 1;
          break;
        case 'earnings_below_floor':
          irs_below_floor += 1;
          break;
        case 'cohort_below_floor':
        default:
          cohort_below_floor += 1;
      }
    } else {
      fully_measured += 1;
    }
  }

  return {
    build_date: institution.build_date,
    ppd_release: institution.ppd_release,
    noise_band_advisories_count: noise_band,
    cross_validation_disagreements: disagreements,
    data_status_summary: {
      fully_measured,
      ppd_suppressed,
      irs_below_floor,
      cohort_below_floor,
      out_of_scope,
    },
    primary_source_reminder: PRIMARY_SOURCE_REMINDER,
    simulation_framing: SIMULATION_FRAMING,
    expertise_disclaimer: EXPERTISE_DISCLAIMER,
  };
}

function buildCrossValidationBanner(
  verdicts: readonly ProgramVerdict[],
): string | null {
  const measured = verdicts.filter((v) => v.cross_validation.status === 'agree' || v.cross_validation.status === 'disagree');
  if (measured.length === 0) return null;
  const disagreements = measured.filter((v) => v.cross_validation.status === 'disagree');
  if (disagreements.length === 0) return null;
  const ratio = disagreements.length / measured.length;
  if (ratio <= CROSS_VALIDATION_BANNER_PCT) return null;
  const pct = (ratio * 100).toFixed(1);
  return `On this institution, the tool's re-derivation differs from the Department's pre-computed verdict on ${disagreements.length} of ${measured.length} measured programs (${pct}%). This is above the 5% systemic-flag threshold and warrants institutional-research review of the rule's application to your CIP slate.`;
}

function buildHiddenProgramSurface(
  institution: InstitutionRecord,
): HiddenProgramSurface {
  // R14 PAR→DET upgrade (cp-0on.5): when the build pipeline emits
  // `hidden_program_candidates` (cp-0on.1 IPEDS Completions join), surface
  // them deterministically. PAR fallback covers legacy fixtures.
  const candidates = institution.hidden_program_candidates;
  if (candidates !== undefined && candidates.length > 0) {
    const programs: HiddenProgram[] = candidates.map(
      (c: HiddenProgramCandidate): HiddenProgram => ({
        cip6: c.cip6,
        // IPEDS C-survey does not publish CIP titles inline; surface the
        // dotted cip6 as a stable identifier and let the UI layer hydrate
        // the human-readable title from a CIP code dictionary.
        title: c.cip6,
        credlev: c.credlev,
        cohort_range_label: formatCompletersRange(c.completers_total),
      }),
    );
    return {
      available: true,
      programs,
      provenance: `IPEDS Completions C${candidates[0]!.vintage}_A (MAJORNUM=1). Candidates are (cip6, credlev) pairs at this institution that confer awards in IPEDS but have no PPD program cell at the corresponding (cip4, credlev). The federal privacy rule replaces cell sizes 10–19 with the midpoint value 15; ranges shown as "between 10 and 19" rather than "15".`,
      parametric_note: null,
      data_status: 'DET',
    };
  }
  return {
    available: false,
    programs: [],
    provenance:
      'IPEDS Completions C-survey 2019–2024 (build-side join — Phase 1 (c), amber sub-sling pending). The federal privacy rule replaces cell sizes 10–19 with the midpoint value 15; ranges shown as "between 10 and 19" rather than "15".',
    parametric_note:
      'Hidden-program surfacer is parametric on this fixture (legacy build pre-cp-0on.1). Programs that the cohort cascade may pool in are not enumerated; the cascade text (R01–R04) still surfaces in each verdict drill-in.',
    data_status: 'PAR',
  };
}

function formatCompletersRange(n: number): string {
  if (n >= 20) return `${n} completers`;
  if (n >= 10) return 'between 10 and 19 completers';
  return `${n} completers`;
}

function compareVerdictSeverity(a: ProgramVerdict, b: ProgramVerdict): number {
  // Severity-first ordering for display (most-failing first per spec §1.1):
  //   FAIL (most negative gap first) → NOT MEASURED → PASS (smallest positive gap first)
  const order = (v: ProgramVerdict): number => {
    if (v.verdict === 'FAIL') return 0;
    if (v.verdict === 'NOT MEASURED') return 1;
    return 2;
  };
  const oa = order(a);
  const ob = order(b);
  if (oa !== ob) return oa - ob;
  // Within FAIL: most negative first.
  if (a.verdict === 'FAIL' && b.verdict === 'FAIL') {
    const ga = a.ep_gap_pct ?? 0;
    const gb = b.ep_gap_pct ?? 0;
    return ga - gb;
  }
  // Within PASS: noise-band first, then smallest positive gap.
  if (a.verdict === 'PASS' && b.verdict === 'PASS') {
    const nba = a.noise_band.fired ? 0 : 1;
    const nbb = b.noise_band.fired ? 0 : 1;
    if (nba !== nbb) return nba - nbb;
    const ga = a.ep_gap_pct ?? 0;
    const gb = b.ep_gap_pct ?? 0;
    return ga - gb;
  }
  // Stable secondary: cip4 then credlev for determinism.
  if (a.cip4 !== b.cip4) return a.cip4 < b.cip4 ? -1 : 1;
  return a.credlev < b.credlev ? -1 : 1;
}

/**
 * Synthesize a NOT_MEASURED verdict for a queried program absent from PPD —
 * the "B16 invisibility" case. Surfaces R12 with the b16_invisible_to_ppd
 * reason and R03/R05 advisories pointing to the cascade text. Cross-validation
 * is `both-not-measured` — neither tool nor PPD can verdict.
 */
function evaluateInvisibleProgram(
  cip4: string,
  credlev: Credlev,
  institution: InstitutionRecord,
): ProgramVerdict {
  const fires: RuleFire[] = [
    {
      id: 'R03',
      title: 'Cohort cascade Stage 3 — 4-digit CIP cell at PPD',
      citation: CITATIONS.NPRM_2301_2320,
      m_doc: M_DOCS.M01,
      data_status: 'DET',
      note: 'No PPD cell exists for this (cip4, credlev) at this institution. The cascade did not run.',
    },
    {
      id: 'R05',
      title: 'Cascade exhausted — no median published',
      citation: CITATIONS.PROP_668_403_D1,
      m_doc: M_DOCS.M01,
      data_status: 'DET',
      note: 'Pre-cascade absence: program is invisible to the EP test machinery. Earlier than the formal cascade-exhaustion path (cell never published, not cascade-exhausted).',
    },
    {
      id: 'R12',
      title: 'NOT MEASURED branch',
      citation: CITATIONS.PROP_668_403_D1,
      m_doc: M_DOCS.M12,
      data_status: 'DET',
      note: 'Reason: program is absent from PPD entirely for this institution — no row at this (cip4, credlev). The cohort cascade did not run because there is no published cell. Surfaces only via the queried-CIPs path; warrants institutional-research review of the IPEDS Completions submission.',
    },
  ];
  const verdict: ProgramVerdict = {
    cip4,
    cip4_title: '(unknown — program absent from PPD)',
    credlev,
    verdict: 'NOT MEASURED',
    cohort_count: null,
    median_earn_p4: null,
    benchmark: null,
    benchmark_route: 'Not Listed in Section 84001',
    ep_gap_pct: null,
    not_measured_reason: 'b16_invisible_to_ppd',
    noise_band: { fired: false, provenance: null, message: null },
    cross_validation: {
      tool: 'NOT MEASURED',
      ppd: null,
      status: 'both-not-measured',
    },
    rules_fired: fires,
    panels_triggered: ['M01', 'M12', 'M13'],
  };
  // Mark the program for the institution-context callers.
  void institution;
  return verdict;
}

export interface QueriedProgram {
  cip4: string;
  credlev: Credlev;
}

/**
 * Public entry point — analyze an institution and produce the full
 * AnalysisResult consumed by the API + UI layers.
 */
export function analyzeInstitution(
  institution: InstitutionRecord,
): AnalysisResult {
  const verdicts = institution.programs
    .map((p) => evaluateProgram(p, institution))
    .sort(compareVerdictSeverity);

  const panels = buildPanels(verdicts, institution);
  const cross_validation_banner = buildCrossValidationBanner(verdicts);
  const integrity_envelope = buildIntegrityEnvelope(institution, verdicts);
  const hidden_programs = buildHiddenProgramSurface(institution);

  return {
    unitid: institution.unitid,
    instnm: institution.instnm,
    stabbr: institution.stabbr,
    programs: verdicts,
    hidden_programs,
    panels,
    cross_validation_banner,
    integrity_envelope,
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
}

/**
 * Persona A entry point — Dean enters known (cip4, credlev) pairs, the engine
 * verdicts each. Programs absent from PPD surface as NOT MEASURED with the
 * b16_invisible_to_ppd reason. The institution's full PPD slice is NOT
 * surfaced in this path; only queried programs appear.
 */
export function analyzeQueriedPrograms(
  institution: InstitutionRecord,
  queried: readonly QueriedProgram[],
): AnalysisResult {
  const verdicts: ProgramVerdict[] = queried.map((q) => {
    const match = institution.programs.find(
      (p) => p.cip4 === q.cip4 && p.credlev === q.credlev,
    );
    if (match !== undefined) return evaluateProgram(match, institution);
    return evaluateInvisibleProgram(q.cip4, q.credlev, institution);
  });
  verdicts.sort(compareVerdictSeverity);

  const panels = buildPanels(verdicts, institution);
  const cross_validation_banner = buildCrossValidationBanner(verdicts);
  const integrity_envelope = buildIntegrityEnvelope(institution, verdicts);
  const hidden_programs = buildHiddenProgramSurface(institution);

  return {
    unitid: institution.unitid,
    instnm: institution.instnm,
    stabbr: institution.stabbr,
    programs: verdicts,
    hidden_programs,
    panels,
    cross_validation_banner,
    integrity_envelope,
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
}
