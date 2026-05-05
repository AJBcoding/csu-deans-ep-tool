// Auto-triggered M-doc panel registry — eight panels per spec §5.
//
// Headers come verbatim from spec §5 (peer-voice rewrite, Pass-5).
// "Learn more" panels (M02, M06, M08, M09, M10, M11, M15, M17) are not
// auto-triggered — they ship as static explainer pages.
//
// M16 is intentionally deferred per analyses/mechanisms/_index.md.

import { M_DOCS } from './citations.js';
import type {
  ProgramVerdict,
  PanelDescriptor,
  InstitutionRecord,
} from './types.js';

interface PanelDef {
  id: string;
  m_doc: string;
  header: string;
  /** Returns reason string when triggered, or null. */
  trigger: (
    verdicts: readonly ProgramVerdict[],
    institution: InstitutionRecord,
  ) => string | null;
}

const PANELS: PanelDef[] = [
  {
    id: 'M01',
    m_doc: M_DOCS.M01,
    header:
      "The rule's cohort-expansion logic. A program with fewer than 30 qualifying graduates pulls in graduates from related programs (same 4-digit CIP family, then same 2-digit family) until 30 is reached or expansion exhausts.",
    trigger: () =>
      'Cohort cascade applies to every measured program in the analysis.',
  },
  {
    id: 'M03',
    m_doc: M_DOCS.M03,
    header:
      'How the benchmark is selected. Graduate programs are compared against the lowest of three figures (state bachelor\'s, state field-of-study bachelor\'s, national field-of-study bachelor\'s). Undergraduate programs against the state\'s high-school-only earners aged 25–34.',
    trigger: (verdicts) => {
      const measured = verdicts.filter((v) => v.verdict !== 'NOT MEASURED');
      return measured.length > 0
        ? `Benchmark route surfaced for ${measured.length} measured program${measured.length === 1 ? '' : 's'}.`
        : null;
    },
  },
  {
    id: 'M04',
    m_doc: M_DOCS.M04,
    header:
      'Operational specificity. Two annual failures within three measurement years triggers Title IV Direct Loan ineligibility. Disclosure obligations attach on first failure.',
    trigger: (verdicts) => {
      const measured = verdicts.filter((v) => v.verdict !== 'NOT MEASURED');
      return measured.length > 0
        ? `${measured.length} measured program${measured.length === 1 ? '' : 's'} subject to the operational test.`
        : null;
    },
  },
  {
    id: 'M05',
    m_doc: M_DOCS.M05,
    header:
      'Title IV Direct Loan ineligibility scope. Students cannot take new federal loans to enroll in an ineligible program; existing borrowers are unaffected for prior disbursements.',
    trigger: (verdicts) => {
      const failing = verdicts.filter((v) => v.verdict === 'FAIL');
      return failing.length > 0
        ? `${failing.length} program${failing.length === 1 ? '' : 's'} fail the EP test on this dataset.`
        : null;
    },
  },
  {
    id: 'M07',
    m_doc: M_DOCS.M07,
    header:
      'Disclosure obligations under proposed § 668.43(d)(1). First-failure release date triggers a written notice on admissions materials; pre-existing 2023 GE-rule language is the procedural model.',
    trigger: (verdicts) => {
      const failing = verdicts.filter((v) => v.verdict === 'FAIL');
      return failing.length > 0
        ? `Disclosure obligations attach on calendar 2027 release for ${failing.length} failing program${failing.length === 1 ? '' : 's'}.`
        : null;
    },
  },
  {
    id: 'M12',
    m_doc: M_DOCS.M12,
    header:
      "Programs without a published measure. The 'no measure' state is operationally distinct from passing — there is no procedural anchor for appeal under the proposed § 668.603 calc-error-only scope.",
    trigger: (verdicts) => {
      const notMeasured = verdicts.filter((v) => v.verdict === 'NOT MEASURED');
      return notMeasured.length > 0
        ? `${notMeasured.length} program${notMeasured.length === 1 ? '' : 's'} surface as NOT MEASURED.`
        : null;
    },
  },
  {
    id: 'M13',
    m_doc: M_DOCS.M13,
    header:
      'Calendar dates that matter. First measurement: calendar 2027 (PPD:2026). Second: calendar 2028 (PPD:2027). Earliest Title IV Direct Loan eligibility loss: AY 2028-29.',
    trigger: () =>
      'Timing markers anchor every verdict (calendar 2027 first measurement; AY 2028-29 earliest ineligibility).',
  },
  {
    id: 'M14',
    m_doc: M_DOCS.M14,
    header:
      "RIA Table 3.19 named populations. The Department's own analysis flags some CIP families as 10–20× more likely to fail; per-CIP elevation factors recomputed against PPD data run higher than the prose.",
    trigger: (verdicts) => {
      const elevated = verdicts.filter((v) =>
        v.rules_fired.some((r) => r.id === 'R17'),
      );
      return elevated.length > 0
        ? `${elevated.length} program${elevated.length === 1 ? '' : 's'} in RIA Table 3.19 elevation list.`
        : null;
    },
  },
  {
    // cp-j0gw.7 — § 668.16(t) institution-level cascade. Auto-fires when any
    // program at the institution surfaces as FAIL, since that is the trigger
    // condition the cascade design is meant to escalate from.
    id: 'M18',
    m_doc: M_DOCS.M18,
    header:
      "When a program failure could spread to the whole institution. Proposed § 668.16(t) lets program-level failures escalate into an institution-level Title IV finding. Five independent legal frames each give the Department's chosen design a separate problem to answer.",
    trigger: (verdicts) => {
      const failing = verdicts.filter((v) => v.verdict === 'FAIL');
      if (failing.length === 0) return null;
      return `${failing.length} failing program${failing.length === 1 ? '' : 's'} put institution-level § 668.16(t) cascade machinery in scope for this institution.`;
    },
  },
];

export function buildPanels(
  verdicts: readonly ProgramVerdict[],
  institution: InstitutionRecord,
): PanelDescriptor[] {
  const out: PanelDescriptor[] = [];
  for (const def of PANELS) {
    const reason = def.trigger(verdicts, institution);
    if (reason !== null) {
      out.push({
        id: def.id,
        m_doc: def.m_doc,
        header: def.header,
        trigger_reason: reason,
      });
    }
  }
  return out;
}

/**
 * Per-program panel attribution — which panels fire because of THIS program.
 * Used to render the verdict drill-in's "see related panels" links.
 */
export function panelsTriggeredByProgram(verdict: ProgramVerdict): string[] {
  const ids: string[] = ['M01', 'M13']; // always fire
  if (verdict.verdict !== 'NOT MEASURED') ids.push('M03', 'M04');
  if (verdict.verdict === 'FAIL') ids.push('M05', 'M07', 'M18');
  if (verdict.verdict === 'NOT MEASURED') ids.push('M12');
  if (verdict.rules_fired.some((r) => r.id === 'R17')) ids.push('M14');
  return ids;
}
