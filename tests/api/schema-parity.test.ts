// Schema-parity test — every JSON Schema enum / required-field claim must
// match what the engine actually emits on a real CSULB analysis. This is
// the cheap (zero-dep) way to keep the JSON Schema in sync with the TS
// types; a real ajv-based validation could replace it later if a Persona C
// consumer needs strict JSON Schema validation in production.

import { describe, expect, it } from 'vitest';
import { handleAnalysisGet, handleAnalysisPost } from '../../src/api/handlers.js';
import { MemoryLoader } from '../../src/api/loader.js';
import { API_JSON_SCHEMA } from '../../src/api/schema.js';
import { AUTO_TRIGGERED_PANELS, PANEL_IDS } from '../../src/api/contract.js';
import { loadCsulb } from '../helpers.js';
import type { AnalysisGetResponse } from '../../src/api/contract.js';

const FROZEN_TIME = '2026-04-30T00:00:00.000Z';

describe('JSON Schema parity with engine output', () => {
  const loader = new MemoryLoader([loadCsulb()]);
  const result = handleAnalysisGet(loader, '110583', FROZEN_TIME);
  const body = result.body as AnalysisGetResponse;

  it('every Credlev that appears in CSULB output is in the schema enum', () => {
    const seen = new Set(body.programs.map((p) => p.credlev));
    const enumerated = new Set(API_JSON_SCHEMA.$defs.Credlev.enum);
    for (const c of seen) {
      expect(enumerated.has(c)).toBe(true);
    }
  });

  it('every BenchmarkRoute that appears in CSULB output is in the schema enum', () => {
    const seen = new Set(body.programs.map((p) => p.benchmark_route));
    const enumerated = new Set(API_JSON_SCHEMA.$defs.BenchmarkRoute.enum);
    for (const r of seen) {
      expect(enumerated.has(r)).toBe(true);
    }
  });

  it('every VerdictWord that appears in CSULB output is in the schema enum', () => {
    const seen = new Set(body.programs.map((p) => p.verdict));
    const enumerated = new Set(API_JSON_SCHEMA.$defs.VerdictWord.enum);
    for (const v of seen) {
      expect(enumerated.has(v)).toBe(true);
    }
  });

  it('every cross-validation status emitted is in the schema enum', () => {
    const seen = new Set(body.programs.map((p) => p.cross_validation.status));
    const enumerated = new Set(API_JSON_SCHEMA.$defs.CrossValidationStatus.enum);
    for (const s of seen) {
      expect(enumerated.has(s)).toBe(true);
    }
  });

  it('every NotMeasuredReason emitted (auto-pull + queried-CIPs) is in schema enum', () => {
    const autoReasons = body.programs
      .map((p) => p.not_measured_reason)
      .filter((r) => r !== null);
    const queried = handleAnalysisPost(
      loader,
      {
        unitid: '110583',
        queried_cips: [
          { cip4: '5006', credlev: 'Bachelor' },
          { cip4: '0501', credlev: "Master's" },
          { cip4: '0501', credlev: 'Undergrad Certificate' },
        ],
      },
      FROZEN_TIME,
    ).body as AnalysisGetResponse;
    const queriedReasons = queried.programs
      .map((p) => p.not_measured_reason)
      .filter((r) => r !== null);
    const allSeen = new Set([...autoReasons, ...queriedReasons]);
    const enumerated = new Set(API_JSON_SCHEMA.$defs.NotMeasuredReason.enum);
    for (const r of allSeen) {
      expect(enumerated.has(r)).toBe(true);
    }
    // Both the chair-greenlit 4th reason and the cp-0on b16 5th reason are present.
    expect(enumerated.has('out_of_scope')).toBe(true);
    expect(enumerated.has('b16_invisible_to_ppd')).toBe(true);
  });

  it('every DataStatus tag emitted on rules_fired is in the schema enum', () => {
    const seen = new Set(
      body.programs.flatMap((p) => p.rules_fired.map((r) => r.data_status)),
    );
    const enumerated = new Set(API_JSON_SCHEMA.$defs.DataStatus.enum);
    for (const t of seen) {
      expect(enumerated.has(t)).toBe(true);
    }
  });

  it('AUTO_TRIGGERED_PANELS matches spec §5 + cp-j0gw.7 ext (nine panels incl. M18)', () => {
    expect([...AUTO_TRIGGERED_PANELS].sort()).toEqual([
      'M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14', 'M18',
    ]);
  });

  it('PANEL_IDS excludes M16 (intentionally deferred); cp-j0gw.7 adds M18', () => {
    expect(PANEL_IDS).not.toContain('M16');
    expect(PANEL_IDS).toContain('M18');
    expect(PANEL_IDS).toHaveLength(17);
  });

  it('integrity envelope required fields all present in the engine output', () => {
    const required = API_JSON_SCHEMA.$defs.IntegrityEnvelope.required;
    for (const field of required) {
      expect(field in body.integrity_envelope).toBe(true);
    }
  });

  it('AnalysisResult required fields all present in the engine output', () => {
    const required = API_JSON_SCHEMA.$defs.AnalysisResultBase.required;
    for (const field of required) {
      expect(field in body).toBe(true);
    }
  });
});
