// Phase 2 API contract — request / response types for the public API server.
//
// The Phase 1 rules engine types in `src/types.ts` define the verdict shape;
// this module wraps them in API envelopes and adds request shapes for the
// two Persona-A/B entry points and the institution-search endpoint.
//
// Schema versioning is independent from the engine: bump `API_SCHEMA_VERSION`
// on any contract-breaking change (renamed/removed field, type narrowing).
// Additive changes (new optional fields, new enum values) keep the version.

import type {
  AnalysisResult,
  Credlev,
  InstitutionRecord,
} from '../types.js';

/** Bump on contract-breaking changes. Additive changes keep the version. */
export const API_SCHEMA_VERSION = '1.0.0';

/** Path version embedded in URLs (`/api/v1/...`). Independent of schema version. */
export const API_PATH_VERSION = 'v1';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/health
// ─────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok';
  api_schema_version: string;
  api_path_version: string;
  /** PPD release vintage the loaded fixtures were built from. */
  ppd_release: string;
  /** Build date of the loaded fixtures (matches integrity_envelope). */
  build_date: string;
  /** How many institutions are currently loaded into the fixture cache. */
  institutions_loaded: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/institutions?q=<query>&limit=<n>
// Institution-picker for Personas A.1 / B.1.
// ─────────────────────────────────────────────────────────────────────────────

export interface InstitutionsListRequest {
  q?: string;
  /** Default 25, max 100. */
  limit?: number;
  /** Filter to a single state (2-letter code). */
  state?: string;
}

export interface InstitutionDirectoryEntry {
  unitid: string;
  instnm: string;
  stabbr: string;
  /** 1=public, 2=private not-for-profit, 3=private for-profit (IPEDS HD). */
  control: number;
  /** 1=4-year+, 2=2-year, 3=<2-year (IPEDS HD). */
  iclevel: number;
  n_programs: number;
}

export interface InstitutionsListResponse {
  api_schema_version: string;
  query: string;
  total_matches: number;
  results: InstitutionDirectoryEntry[];
  /** Footer reminder rendered on every result page per spec §1.4. */
  footer_reminder: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/institutions/:unitid
// Slim institution metadata (pre-fetch for the run screen).
// ─────────────────────────────────────────────────────────────────────────────

export interface InstitutionMetadataResponse {
  api_schema_version: string;
  unitid: string;
  instnm: string;
  stabbr: string;
  opeid6: string;
  control: number;
  iclevel: number;
  sector: number;
  ppd_release: string;
  build_date: string;
  n_programs: number;
  /** Preview of program (cip4, credlev) pairs, ordered as they appear in PPD. */
  programs_preview: ProgramPreview[];
  footer_reminder: string;
}

export interface ProgramPreview {
  cip4: string;
  cip4_title: string;
  credlev: Credlev;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/analysis/:unitid
// Persona B path — auto-pull all PPD-published programs at the institution.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisGetResponse extends AnalysisResult {
  api_schema_version: string;
  /** 'persona_b' for the auto-pull path; 'persona_a' for queried-CIPs. */
  request_persona: 'persona_a' | 'persona_b';
  /** Server time the analysis was emitted; tool result is otherwise deterministic. */
  emitted_at: string;
  /** The path that produced this result. Echoed for client logging. */
  request_path: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analysis
// Persona A path — Dean supplies queried (cip4, credlev) pairs. Programs absent
// from PPD surface as NOT_MEASURED with `b16_invisible_to_ppd` reason.
// ─────────────────────────────────────────────────────────────────────────────

export interface QueriedCip {
  cip4: string;
  credlev: Credlev;
}

export interface AnalysisPostRequest {
  unitid: string;
  /** When omitted or empty, server returns the auto-pull path (Persona B). */
  queried_cips?: QueriedCip[];
}

export type AnalysisPostResponse = AnalysisGetResponse;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/panels/:panel_id
// Pre-rendered M-doc panel content. Phase 4 lands the actual HTML files;
// Phase 2 contract surfaces the panel manifest so consumers know which
// panel ids exist (M01–M17 minus M16).
// ─────────────────────────────────────────────────────────────────────────────

export const PANEL_IDS = [
  'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08', 'M09',
  'M10', 'M11', 'M12', 'M13', 'M14', 'M15', 'M17',
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export const AUTO_TRIGGERED_PANELS = [
  'M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14',
] as const satisfies readonly PanelId[];

export const LEARN_MORE_PANELS = [
  'M02', 'M06', 'M08', 'M09', 'M10', 'M11', 'M15', 'M17',
] as const satisfies readonly PanelId[];

export interface PanelManifestEntry {
  id: PanelId;
  trigger: 'auto' | 'learn-more';
  m_doc: string;
  /** Whether the HTML body is currently bundled. False until Phase 4 lands. */
  body_available: boolean;
}

export interface PanelManifestResponse {
  api_schema_version: string;
  panels: PanelManifestEntry[];
  m16_deferred_note: string;
  footer_reminder: string;
}

export interface PanelBodyResponse {
  api_schema_version: string;
  id: PanelId;
  trigger: 'auto' | 'learn-more';
  /** Either the pre-rendered HTML body (Phase 4) or null with parametric note. */
  html: string | null;
  body_available: boolean;
  parametric_note: string | null;
  footer_reminder: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Error envelope — every non-2xx response carries this shape.
// ─────────────────────────────────────────────────────────────────────────────

export interface ApiErrorResponse {
  api_schema_version: string;
  error: {
    code:
      | 'BAD_REQUEST'
      | 'UNITID_NOT_FOUND'
      | 'INVALID_QUERIED_CIPS'
      | 'INVALID_QUERY'
      | 'METHOD_NOT_ALLOWED'
      | 'NOT_FOUND'
      | 'INTERNAL_ERROR';
    message: string;
    details?: Record<string, unknown>;
  };
  footer_reminder: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader interface — abstract the fixture source so the server can be wired
// against on-disk JSON in production and synthetic fixtures in tests.
// ─────────────────────────────────────────────────────────────────────────────

export interface FixtureLoader {
  /** List metadata for institutions matching the query (case-insensitive substring). */
  list(query: string, limit: number, state?: string): InstitutionDirectoryEntry[];
  /** Look up the full institution record by UNITID. Returns null if absent. */
  get(unitid: string): InstitutionRecord | null;
  /** Loaded count (for the health endpoint). */
  count(): number;
  /** Build date of the loaded fixtures. */
  buildDate(): string;
  /** PPD release of the loaded fixtures. */
  ppdRelease(): string;
}
