// Handler unit tests — exercise each route's pure handler against a synthetic
// in-memory loader. Faster than spinning up the HTTP listener and they
// isolate the contract from transport concerns.

import { describe, expect, it } from 'vitest';
import { MemoryLoader } from '../../src/api/loader.js';
import {
  handleAnalysisGet,
  handleAnalysisPost,
  handleHealth,
  handleInstitutionMetadata,
  handleInstitutionsList,
  handleMethodNotAllowed,
  handleNotFound,
  handlePanelBody,
  handlePanelsManifest,
} from '../../src/api/handlers.js';
import {
  API_PATH_VERSION,
  API_SCHEMA_VERSION,
  AUTO_TRIGGERED_PANELS,
  PANEL_IDS,
  type AnalysisGetResponse,
  type ApiErrorResponse,
  type HealthResponse,
  type InstitutionMetadataResponse,
  type InstitutionsListResponse,
  type PanelBodyResponse,
  type PanelManifestResponse,
} from '../../src/api/contract.js';
import { loadCsulb } from '../helpers.js';

const csulb = loadCsulb();
const loader = new MemoryLoader([csulb]);
const FROZEN_TIME = '2026-04-30T00:00:00.000Z';

describe('GET /api/v1/health', () => {
  it('returns api schema metadata', () => {
    const result = handleHealth(loader);
    expect(result.status).toBe(200);
    const body = result.body as HealthResponse;
    expect(body.status).toBe('ok');
    expect(body.api_schema_version).toBe(API_SCHEMA_VERSION);
    expect(body.api_path_version).toBe(API_PATH_VERSION);
    expect(body.ppd_release).toBe('2026');
    expect(body.build_date).toBe('2026-04-29');
    expect(body.institutions_loaded).toBe(1);
  });
});

describe('GET /api/v1/institutions', () => {
  it('returns the directory entries matching a query', () => {
    const result = handleInstitutionsList(loader, { q: 'long beach' });
    expect(result.status).toBe(200);
    const body = result.body as InstitutionsListResponse;
    expect(body.total_matches).toBe(1);
    expect(body.results[0]?.unitid).toBe('110583');
    expect(body.results[0]?.instnm).toContain('Long Beach');
    expect(body.footer_reminder).toMatch(/Re-derive/);
  });

  it('returns empty results when query has no match', () => {
    const result = handleInstitutionsList(loader, { q: 'no such school' });
    const body = result.body as InstitutionsListResponse;
    expect(body.total_matches).toBe(0);
    expect(body.results).toEqual([]);
  });

  it('400s on a non-numeric limit', () => {
    const result = handleInstitutionsList(loader, { limit: 'abc' });
    expect(result.status).toBe(400);
    const body = result.body as ApiErrorResponse;
    expect(body.error.code).toBe('INVALID_QUERY');
  });

  it('400s on a malformed state', () => {
    const result = handleInstitutionsList(loader, { state: 'XXX' });
    expect(result.status).toBe(400);
  });

  it('filters by state', () => {
    const result = handleInstitutionsList(loader, { state: 'CA' });
    const body = result.body as InstitutionsListResponse;
    expect(body.total_matches).toBe(1);
  });

  it('returns nothing when state filter excludes all', () => {
    const result = handleInstitutionsList(loader, { state: 'NY' });
    const body = result.body as InstitutionsListResponse;
    expect(body.total_matches).toBe(0);
  });
});

describe('GET /api/v1/institutions/:unitid', () => {
  it('returns the slim institution slice', () => {
    const result = handleInstitutionMetadata(loader, '110583');
    expect(result.status).toBe(200);
    const body = result.body as InstitutionMetadataResponse;
    expect(body.unitid).toBe('110583');
    expect(body.opeid6).toBe('001139');
    expect(body.programs_preview.length).toBe(body.n_programs);
  });

  it('400s on non-numeric unitid', () => {
    const result = handleInstitutionMetadata(loader, 'abc');
    expect(result.status).toBe(400);
  });

  it('404s on unknown unitid', () => {
    const result = handleInstitutionMetadata(loader, '999999');
    expect(result.status).toBe(404);
    const body = result.body as ApiErrorResponse;
    expect(body.error.code).toBe('UNITID_NOT_FOUND');
  });
});

describe('GET /api/v1/analysis/:unitid (Persona B)', () => {
  it('returns AnalysisResult with persona_b request flag', () => {
    const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
    expect(result.status).toBe(200);
    const body = result.body as AnalysisGetResponse;
    expect(body.api_schema_version).toBe(API_SCHEMA_VERSION);
    expect(body.request_persona).toBe('persona_b');
    expect(body.emitted_at).toBe(FROZEN_TIME);
    expect(body.unitid).toBe('110583');
    expect(body.programs.length).toBe(194);
  });

  it('reproduces dean memo v10 §1 numbers — Music MM FAIL @ -32.65%', () => {
    const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
    const body = result.body as AnalysisGetResponse;
    const music = body.programs.find(
      (p) => p.cip4 === '5009' && p.credlev === "Master's",
    );
    expect(music).toBeDefined();
    expect(music?.verdict).toBe('FAIL');
    expect(music?.cohort_count).toBe(28);
    expect(music?.ep_gap_pct).toBeCloseTo(-0.3265, 4);
    expect(music?.rules_fired.map((r) => r.id)).toContain('R17');
  });

  it('reproduces dean memo v10 §1 numbers — Art MFA FAIL @ -20.40%', () => {
    const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
    const body = result.body as AnalysisGetResponse;
    const art = body.programs.find(
      (p) => p.cip4 === '5007' && p.credlev === "Master's",
    );
    expect(art?.verdict).toBe('FAIL');
    expect(art?.cohort_count).toBe(23);
    expect(art?.ep_gap_pct).toBeCloseTo(-0.204, 3);
  });

  it('reproduces dean memo v10 §1 numbers — Theatre BA PASS @ +6.06% noise band', () => {
    const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
    const body = result.body as AnalysisGetResponse;
    const theatre = body.programs.find(
      (p) => p.cip4 === '5005' && p.credlev === 'Bachelor',
    );
    expect(theatre?.verdict).toBe('PASS');
    expect(theatre?.cohort_count).toBe(81);
    expect(theatre?.ep_gap_pct).toBeCloseTo(0.0606, 4);
    expect(theatre?.noise_band.fired).toBe(true);
    expect(theatre?.noise_band.provenance).toBe('gap_tool_derived');
  });

  it('all nine v6+ext panels auto-trigger (cp-j0gw.7 adds M18)', () => {
    const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
    const body = result.body as AnalysisGetResponse;
    expect(body.panels.map((p) => p.id).sort()).toEqual([
      'M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14', 'M18',
    ]);
  });

  it('integrity envelope carries primary-source reminder', () => {
    const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
    const body = result.body as AnalysisGetResponse;
    expect(body.integrity_envelope.primary_source_reminder).toBe(
      'Re-derive against primary sources before any external submission.',
    );
    expect(body.footer_reminder).toBe(
      'Re-derive against primary sources before any external submission.',
    );
  });

  it('404s on unknown unitid', () => {
    const result = handleAnalysisGet(loader, '999999', FROZEN_TIME);
    expect(result.status).toBe(404);
  });
});

describe('POST /api/v1/analysis (Persona A)', () => {
  it('reproduces Cinematic Arts BA NOT_MEASURED via b16_invisible_to_ppd', () => {
    const result = handleAnalysisPost(
      loader,
      {
        unitid: '110583',
        queried_cips: [
          { cip4: '5009', credlev: "Master's" },
          { cip4: '5007', credlev: "Master's" },
          { cip4: '5005', credlev: 'Bachelor' },
          { cip4: '5006', credlev: 'Bachelor' }, // absent from CSULB PPD
        ],
      },
      FROZEN_TIME,
    );
    expect(result.status).toBe(200);
    const body = result.body as AnalysisGetResponse;
    expect(body.request_persona).toBe('persona_a');
    expect(body.programs).toHaveLength(4);
    const cinema = body.programs.find(
      (p) => p.cip4 === '5006' && p.credlev === 'Bachelor',
    );
    expect(cinema?.verdict).toBe('NOT MEASURED');
    expect(cinema?.not_measured_reason).toBe('b16_invisible_to_ppd');
    const r12 = cinema?.rules_fired.find((r) => r.id === 'R12');
    expect(r12?.note).toMatch(/absent from PPD/i);
  });

  it('falls back to Persona B when queried_cips is empty', () => {
    const result = handleAnalysisPost(
      loader,
      { unitid: '110583', queried_cips: [] },
      FROZEN_TIME,
    );
    const body = result.body as AnalysisGetResponse;
    expect(body.request_persona).toBe('persona_b');
    expect(body.programs.length).toBe(194);
  });

  it('400s on missing unitid', () => {
    const result = handleAnalysisPost(loader, {}, FROZEN_TIME);
    expect(result.status).toBe(400);
  });

  it('400s on invalid queried_cips shape', () => {
    const result = handleAnalysisPost(
      loader,
      { unitid: '110583', queried_cips: [{ cip4: 'abc' }] },
      FROZEN_TIME,
    );
    expect(result.status).toBe(400);
    const body = result.body as ApiErrorResponse;
    expect(body.error.code).toBe('INVALID_QUERIED_CIPS');
  });

  it('400s on invalid credlev', () => {
    const result = handleAnalysisPost(
      loader,
      {
        unitid: '110583',
        queried_cips: [{ cip4: '5009', credlev: 'Quaternary' }],
      },
      FROZEN_TIME,
    );
    expect(result.status).toBe(400);
  });

  it('404s on unknown unitid', () => {
    const result = handleAnalysisPost(loader, { unitid: '999999' }, FROZEN_TIME);
    expect(result.status).toBe(404);
  });
});

describe('GET /api/v1/panels', () => {
  it('returns 16 panels (M01–M17 minus M16)', () => {
    const result = handlePanelsManifest();
    const body = result.body as PanelManifestResponse;
    expect(body.panels).toHaveLength(PANEL_IDS.length);
    expect(body.panels.map((p) => p.id)).not.toContain('M16');
    expect(body.m16_deferred_note).toMatch(/Intentionally deferred/i);
  });

  it('flags 8 auto-triggered panels per spec §5', () => {
    const result = handlePanelsManifest();
    const body = result.body as PanelManifestResponse;
    const auto = body.panels.filter((p) => p.trigger === 'auto').map((p) => p.id);
    expect(auto.sort()).toEqual([...AUTO_TRIGGERED_PANELS].sort());
  });

  it('marks every panel body unavailable until Phase 4 lands', () => {
    const result = handlePanelsManifest();
    const body = result.body as PanelManifestResponse;
    for (const p of body.panels) {
      expect(p.body_available).toBe(false);
    }
  });
});

describe('GET /api/v1/panels/:id', () => {
  it('returns parametric stub for valid panel id', () => {
    const result = handlePanelBody('M01');
    expect(result.status).toBe(200);
    const body = result.body as PanelBodyResponse;
    expect(body.id).toBe('M01');
    expect(body.html).toBeNull();
    expect(body.body_available).toBe(false);
    expect(body.parametric_note).toMatch(/Phase 4/);
  });

  it('404s with M16 deferral note for M16', () => {
    const result = handlePanelBody('M16');
    expect(result.status).toBe(404);
    const body = result.body as ApiErrorResponse;
    expect(body.error.message).toMatch(/intentionally deferred/i);
  });

  it('404s for unknown panel id', () => {
    const result = handlePanelBody('M99');
    expect(result.status).toBe(404);
  });
});

describe('Fallback handlers', () => {
  it('handleNotFound emits NOT_FOUND envelope', () => {
    const result = handleNotFound('/api/v1/bogus');
    expect(result.status).toBe(404);
    const body = result.body as ApiErrorResponse;
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.footer_reminder).toMatch(/Re-derive/);
  });

  it('handleMethodNotAllowed emits METHOD_NOT_ALLOWED envelope', () => {
    const result = handleMethodNotAllowed('PUT', '/api/v1/health');
    expect(result.status).toBe(405);
    const body = result.body as ApiErrorResponse;
    expect(body.error.code).toBe('METHOD_NOT_ALLOWED');
  });
});
