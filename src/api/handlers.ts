// Endpoint handlers — pure functions over (loader, request) → response.
// Separated from `server.ts` so they can be unit-tested in-process without
// spinning up an HTTP listener.

import {
  analyzeInstitution,
  analyzeQueriedPrograms,
} from '../engine.js';
import { PRIMARY_SOURCE_REMINDER } from '../citations.js';
import type { InstitutionRecord, Credlev } from '../types.js';
import {
  API_PATH_VERSION,
  API_SCHEMA_VERSION,
  AUTO_TRIGGERED_PANELS,
  LEARN_MORE_PANELS,
  PANEL_IDS,
  type AnalysisGetResponse,
  type AnalysisPostRequest,
  type ApiErrorResponse,
  type FixtureLoader,
  type HealthResponse,
  type InstitutionMetadataResponse,
  type InstitutionsListResponse,
  type PanelBodyResponse,
  type PanelId,
  type PanelManifestResponse,
  type ProgramPreview,
} from './contract.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const VALID_CREDLEVS: readonly Credlev[] = [
  'Bachelor',
  "Master's",
  'Doctoral',
  'First Professional Degree',
  'Associate',
  'Undergrad Certificate',
  'Post-Bacc Certificate',
  'Graduate Certificate',
];

export type HandlerResult =
  | { status: 200; body: unknown }
  | { status: 400 | 404 | 405 | 500; body: ApiErrorResponse };

function makeError(
  status: 400 | 404 | 405 | 500,
  code: ApiErrorResponse['error']['code'],
  message: string,
  details?: Record<string, unknown>,
): HandlerResult {
  return {
    status,
    body: {
      api_schema_version: API_SCHEMA_VERSION,
      error: { code, message, ...(details ? { details } : {}) },
      footer_reminder: PRIMARY_SOURCE_REMINDER,
    },
  };
}

function buildProgramPreview(record: InstitutionRecord): ProgramPreview[] {
  return record.programs.map((p) => ({
    cip4: p.cip4,
    cip4_title: p.cip4_title,
    credlev: p.credlev,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/health
// ─────────────────────────────────────────────────────────────────────────────

export function handleHealth(loader: FixtureLoader): HandlerResult {
  const body: HealthResponse = {
    status: 'ok',
    api_schema_version: API_SCHEMA_VERSION,
    api_path_version: API_PATH_VERSION,
    ppd_release: loader.ppdRelease(),
    build_date: loader.buildDate(),
    institutions_loaded: loader.count(),
  };
  return { status: 200, body };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/institutions
// ─────────────────────────────────────────────────────────────────────────────

export function handleInstitutionsList(
  loader: FixtureLoader,
  query: { q?: string; limit?: string; state?: string },
): HandlerResult {
  const q = query.q ?? '';
  const limitRaw = query.limit ?? '25';
  const limit = Number.parseInt(limitRaw, 10);
  if (!Number.isFinite(limit) || limit < 1 || limit > 100) {
    return makeError(
      400,
      'INVALID_QUERY',
      'limit must be an integer in [1, 100].',
      { received: limitRaw },
    );
  }
  if (query.state !== undefined && !/^[A-Za-z]{2}$/.test(query.state)) {
    return makeError(
      400,
      'INVALID_QUERY',
      'state must be a 2-letter postal abbreviation.',
      { received: query.state },
    );
  }
  const results = loader.list(q, limit, query.state);
  const body: InstitutionsListResponse = {
    api_schema_version: API_SCHEMA_VERSION,
    query: q,
    total_matches: results.length,
    results,
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
  return { status: 200, body };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/institutions/:unitid
// ─────────────────────────────────────────────────────────────────────────────

export function handleInstitutionMetadata(
  loader: FixtureLoader,
  unitid: string,
): HandlerResult {
  if (!/^[0-9]+$/.test(unitid)) {
    return makeError(400, 'BAD_REQUEST', 'unitid must be numeric.', {
      received: unitid,
    });
  }
  const record = loader.get(unitid);
  if (record === null) {
    return makeError(
      404,
      'UNITID_NOT_FOUND',
      `No institution loaded for UNITID ${unitid}.`,
      { unitid },
    );
  }
  const body: InstitutionMetadataResponse = {
    api_schema_version: API_SCHEMA_VERSION,
    unitid: record.unitid,
    instnm: record.instnm,
    stabbr: record.stabbr,
    opeid6: record.opeid6,
    control: record.control,
    iclevel: record.iclevel,
    sector: record.sector,
    ppd_release: record.ppd_release,
    build_date: record.build_date,
    n_programs: record.programs.length,
    programs_preview: buildProgramPreview(record),
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
  return { status: 200, body };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/analysis/:unitid
// Persona B path — auto-pull all PPD-published programs.
// ─────────────────────────────────────────────────────────────────────────────

export function handleAnalysisGet(
  loader: FixtureLoader,
  unitid: string,
  emittedAt: string,
): HandlerResult {
  if (!/^[0-9]+$/.test(unitid)) {
    return makeError(400, 'BAD_REQUEST', 'unitid must be numeric.', {
      received: unitid,
    });
  }
  const record = loader.get(unitid);
  if (record === null) {
    return makeError(
      404,
      'UNITID_NOT_FOUND',
      `No institution loaded for UNITID ${unitid}.`,
      { unitid },
    );
  }
  const result = analyzeInstitution(record);
  const body: AnalysisGetResponse = {
    ...result,
    api_schema_version: API_SCHEMA_VERSION,
    request_persona: 'persona_b',
    emitted_at: emittedAt,
    request_path: `/api/v1/analysis/${unitid}`,
  };
  return { status: 200, body };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/analysis
// Persona A path — analyze a Dean-supplied (cip4, credlev) list. Programs
// absent from PPD surface as NOT_MEASURED with `b16_invisible_to_ppd`.
// ─────────────────────────────────────────────────────────────────────────────

function isQueriedCipsValid(
  raw: unknown,
): raw is Array<{ cip4: string; credlev: Credlev }> {
  if (!Array.isArray(raw)) return false;
  return raw.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { cip4?: unknown }).cip4 === 'string' &&
      typeof (item as { credlev?: unknown }).credlev === 'string' &&
      VALID_CREDLEVS.includes((item as { credlev: string }).credlev as Credlev),
  );
}

export function handleAnalysisPost(
  loader: FixtureLoader,
  body: unknown,
  emittedAt: string,
): HandlerResult {
  if (typeof body !== 'object' || body === null) {
    return makeError(400, 'BAD_REQUEST', 'Request body must be a JSON object.');
  }
  const req = body as Partial<AnalysisPostRequest>;
  if (typeof req.unitid !== 'string' || !/^[0-9]+$/.test(req.unitid)) {
    return makeError(400, 'BAD_REQUEST', 'unitid must be a numeric string.', {
      received: req.unitid,
    });
  }
  const record = loader.get(req.unitid);
  if (record === null) {
    return makeError(
      404,
      'UNITID_NOT_FOUND',
      `No institution loaded for UNITID ${req.unitid}.`,
      { unitid: req.unitid },
    );
  }
  const queried = req.queried_cips;
  if (queried !== undefined && !isQueriedCipsValid(queried)) {
    return makeError(
      400,
      'INVALID_QUERIED_CIPS',
      'queried_cips must be an array of {cip4, credlev} objects with a valid credlev.',
      { valid_credlevs: [...VALID_CREDLEVS] },
    );
  }
  const requestPath = '/api/v1/analysis';
  if (queried === undefined || queried.length === 0) {
    const result = analyzeInstitution(record);
    const responseBody: AnalysisGetResponse = {
      ...result,
      api_schema_version: API_SCHEMA_VERSION,
      request_persona: 'persona_b',
      emitted_at: emittedAt,
      request_path: requestPath,
    };
    return { status: 200, body: responseBody };
  }
  const result = analyzeQueriedPrograms(record, queried);
  const responseBody: AnalysisGetResponse = {
    ...result,
    api_schema_version: API_SCHEMA_VERSION,
    request_persona: 'persona_a',
    emitted_at: emittedAt,
    request_path: requestPath,
  };
  return { status: 200, body: responseBody };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/panels  +  GET /api/v1/panels/:id
// Phase 2 ships the manifest; the body endpoint returns a parametric stub
// pointing at Phase 4 (mdocs) for the actual HTML.
// ─────────────────────────────────────────────────────────────────────────────

const M16_DEFERRAL_NOTE =
  'M16 — individual-earnings computation form-by-form trace. Intentionally deferred per analyses/mechanisms/_index.md; M02 carries the frame-level analysis. M16 to be drafted as a paired companion to M02 if a Pass-3 deep-dive is needed.';

export function handlePanelsManifest(): HandlerResult {
  const autoSet = new Set<PanelId>(AUTO_TRIGGERED_PANELS);
  const body: PanelManifestResponse = {
    api_schema_version: API_SCHEMA_VERSION,
    panels: PANEL_IDS.map((id) => ({
      id,
      trigger: autoSet.has(id) ? 'auto' : 'learn-more',
      m_doc: id,
      body_available: false, // Phase 4 lands the HTML bodies.
    })),
    m16_deferred_note: M16_DEFERRAL_NOTE,
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
  return { status: 200, body };
}

export function handlePanelBody(panelId: string): HandlerResult {
  const validIds: readonly string[] = PANEL_IDS;
  if (!validIds.includes(panelId)) {
    if (panelId === 'M16') {
      return makeError(
        404,
        'NOT_FOUND',
        `Panel M16 is intentionally deferred. ${M16_DEFERRAL_NOTE}`,
        { m16_deferred_note: M16_DEFERRAL_NOTE },
      );
    }
    return makeError(
      404,
      'NOT_FOUND',
      `Panel ${panelId} is not in the manifest.`,
      { valid_ids: [...PANEL_IDS] },
    );
  }
  const id = panelId as PanelId;
  const autoSet = new Set<PanelId>(AUTO_TRIGGERED_PANELS);
  const learnSet = new Set<PanelId>(LEARN_MORE_PANELS);
  const trigger: 'auto' | 'learn-more' = autoSet.has(id)
    ? 'auto'
    : learnSet.has(id)
      ? 'learn-more'
      : 'learn-more';
  const body: PanelBodyResponse = {
    api_schema_version: API_SCHEMA_VERSION,
    id,
    trigger,
    html: null,
    body_available: false,
    parametric_note:
      'Panel HTML body lands with Phase 4 (mdocs glossary). Phase 2 contract surfaces the manifest entry only; consumers should treat null html as "fetch Phase 4 asset" rather than as a hard error.',
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
  return { status: 200, body };
}

// ─────────────────────────────────────────────────────────────────────────────
// 404 / 405 fallbacks
// ─────────────────────────────────────────────────────────────────────────────

export function handleNotFound(path: string): HandlerResult {
  return makeError(
    404,
    'NOT_FOUND',
    `No route matches ${path}. See GET /api/v1/health for live routes.`,
    { path },
  );
}

export function handleMethodNotAllowed(method: string, path: string): HandlerResult {
  return makeError(
    405,
    'METHOD_NOT_ALLOWED',
    `${method} is not allowed on ${path}.`,
    { method, path },
  );
}
