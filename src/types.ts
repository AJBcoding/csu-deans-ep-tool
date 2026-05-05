// Schema types that mirror data/build/SCHEMA.md exactly.
// The build pipeline (Python, amber territory) is the authoritative producer;
// this engine is a strict consumer.

export type Credlev =
  | 'Bachelor'
  | "Master's"
  | 'Doctoral'
  | 'First Professional Degree'
  | 'Associate'
  | 'Undergrad Certificate'
  | 'Post-Bacc Certificate'
  | 'Graduate Certificate';

export type BenchmarkRoute =
  | 'Same-State HS Median'
  | 'Same-State BA Median'
  | 'Same-State, Same-Field BA Median'
  | 'National HS Median'
  | 'National BA Median'
  | 'National Same-Field BA Median'
  | 'Tie for Lowest Test'
  | 'Not Listed in Section 84001';

export interface SuppressionFlags {
  missing_test: 0 | 1;
  earn_suppressed: boolean;
  cohort_suppressed: boolean;
  out_of_scope: boolean;
}

export interface ProgramRecord {
  cip4: string;
  cip4_title: string;
  credlev: Credlev;
  cohort_count: number | null;
  median_earn_p4: number | null;
  benchmark: number | null;
  benchmark_route: BenchmarkRoute;
  ep_gap_pct: number | null;
  ppd_fail_obbb: 0 | 1 | null;
  ppd_fail_master: 0 | 1 | null;
  suppression: SuppressionFlags;
  // Phase 1 (b) populated by amber's FA-part-1 join (cp-0on.1). When present,
  // R07 fires with data_status=DET; when absent (legacy fixtures), R07 falls
  // back to a parametric advisory (data_status=PAR).
  in_state_share?: number | null;
}

/**
 * Hidden-program candidate as emitted by the build pipeline (Phase 1 (c) /
 * cp-0on.1 IPEDS Completions join — see data/build/SCHEMA.md "R14
 * hidden_program_candidates"). One row per (cip6, credlev) at the
 * institution that confers awards in IPEDS but has no PPD program cell.
 */
export interface HiddenProgramCandidate {
  cip6: string;
  credlev: Credlev;
  completers_total: number;
  vintage: string;
}

export interface InstitutionRecord {
  unitid: string;
  opeid6: string;
  instnm: string;
  stabbr: string;
  control: number;
  iclevel: number;
  sector: number;
  ppd_release: string;
  build_date: string;
  programs: ProgramRecord[];
  // Phase 1 (c) populated by amber's IPEDS Completions join (cp-0on.1). When
  // present + non-empty, the hidden-program surfacer (R14) materializes the
  // list with data_status=DET; when absent, the surfacer falls back to a
  // parametric advisory (data_status=PAR).
  hidden_program_candidates?: HiddenProgramCandidate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Verdict + rule output types (engine-internal, surfaced via API)
// ─────────────────────────────────────────────────────────────────────────────

export type VerdictWord = 'PASS' | 'FAIL' | 'NOT MEASURED';

/** Reason a program landed in NOT MEASURED. Strict-precedence enumeration; see R12. */
export type NotMeasuredReason =
  | 'out_of_scope'
  | 'privacy_suppressed'
  | 'earnings_below_floor'
  | 'cohort_below_floor'
  /**
   * "B16 invisibility" — the queried (cip4, credlev) pair is ABSENT from PPD
   * for this institution. Pre-cascade case: the cohort cascade never ran
   * because the program has zero rows in the published dataset. Surfaces only
   * via the queried-CIPs path (Persona A); auto-pulled program lists never
   * include programs PPD does not publish.
   */
  | 'b16_invisible_to_ppd';

/** Data-status tag carried by every rule fire (carried from spec §3.1 / Pass-2 audit). */
export type DataStatus = 'DET' | 'PAR' | 'ADV';

export interface RuleFire {
  /** Stable identifier, e.g. 'R03'. */
  id: string;
  /** Short human-readable label. */
  title: string;
  /** Citation string anchoring the rule (e.g. 'OBBBA § 84001(c)(2)'). */
  citation: string;
  /** M-doc anchor identifier, e.g. 'M01-cohort-visibility-cascade'. */
  m_doc: string;
  /** Determinism tag. */
  data_status: DataStatus;
  /** Optional fired-state annotation (R19/R12 use this). */
  note?: string;
}

export interface CrossValidation {
  tool: VerdictWord;
  ppd: VerdictWord | null;
  /**
   * - 'agree': both measured, same word
   * - 'disagree': both measured, different word
   * - 'ppd-not-published': tool measured, PPD published null
   * - 'tool-not-measured-ppd-published': tool can't measure, PPD has a value (rare)
   * - 'both-not-measured': neither side has a verdict
   */
  status:
    | 'agree'
    | 'disagree'
    | 'ppd-not-published'
    | 'tool-not-measured-ppd-published'
    | 'both-not-measured';
}

export interface NoiseBandAnnotation {
  fired: boolean;
  /**
   * Provenance string per chair greenlight (SPEC-DELTA §2.2).
   *
   * - `gap_tool_derived` — verdict's noise-band gap was computed from
   *   PPD-published earnings + benchmark; the percentage gap itself
   *   is NOT a published PPD field.
   * - `earnings_suppressed_ppd_published` — verdict surfaces from the
   *   PPD-published OBBBA flag, but the underlying earnings cell is
   *   suppressed under the federal privacy rule (`earn_suppressed=true`).
   *   Noise-band test is structurally inapplicable.
   * - `cohort_suppressed_ppd_published` — verdict surfaces from the
   *   PPD-published OBBBA flag, but the underlying earnings cell is
   *   not published because the cohort is below the floor or otherwise
   *   unavailable at 4-digit grain (`median_earn_p4 IS NULL` while the
   *   privacy-suppression flag is NOT the cause). Noise-band test is
   *   structurally inapplicable for a cohort-level reason rather than a
   *   privacy-rule reason; the distinction matters for explainability
   *   per SPEC-DELTA §2.3 four-layer suppression model.
   * - `null` — annotation not fired (verdict NOT MEASURED, gap outside
   *   threshold, or no published gap to evaluate).
   */
  provenance:
    | 'gap_tool_derived'
    | 'earnings_suppressed_ppd_published'
    | 'cohort_suppressed_ppd_published'
    | null;
  message: string | null;
}

export interface ProgramVerdict {
  cip4: string;
  cip4_title: string;
  credlev: Credlev;
  verdict: VerdictWord;
  cohort_count: number | null;
  median_earn_p4: number | null;
  benchmark: number | null;
  benchmark_route: BenchmarkRoute;
  ep_gap_pct: number | null;
  not_measured_reason: NotMeasuredReason | null;
  noise_band: NoiseBandAnnotation;
  cross_validation: CrossValidation;
  rules_fired: RuleFire[];
  panels_triggered: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Hidden-program surfacer (R14) and integrity envelope (spec §4)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hidden-program surface — programs at the institution that would be POOLED INTO
 * a CIP4 group during cascade expansion. Phase 1 (c) is the build-side IPEDS
 * Completions join (amber sub-sling); until that lands the runtime surfaces a
 * parametric advisory rather than a list.
 */
export interface HiddenProgramSurface {
  available: boolean;
  programs: HiddenProgram[];
  provenance: string;
  parametric_note: string | null;
  /**
   * Determinism tag mirroring the RuleFire convention. DET when
   * `institution.hidden_program_candidates` is populated and the surfacer
   * materializes the list; PAR when the build-side join has not landed and
   * only a parametric advisory is available (cp-0on.5 PAR→DET upgrade).
   */
  data_status: DataStatus;
}

export interface HiddenProgram {
  cip6: string;
  title: string;
  credlev: Credlev;
  cohort_range_label: string;
}

export interface IntegrityEnvelope {
  build_date: string;
  ppd_release: string;
  noise_band_advisories_count: number;
  cross_validation_disagreements: number;
  data_status_summary: {
    fully_measured: number;
    ppd_suppressed: number;
    irs_below_floor: number;
    cohort_below_floor: number;
    out_of_scope: number;
  };
  primary_source_reminder: string;
}

export interface PanelDescriptor {
  id: string;
  m_doc: string;
  header: string;
  trigger_reason: string;
}

export interface AnalysisResult {
  unitid: string;
  instnm: string;
  stabbr: string;
  programs: ProgramVerdict[];
  hidden_programs: HiddenProgramSurface;
  panels: PanelDescriptor[];
  cross_validation_banner: string | null;
  integrity_envelope: IntegrityEnvelope;
  /** Footer reminder rendered on every result page per spec §1.4. */
  footer_reminder: string;
}
