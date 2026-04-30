// Server integration tests — boot a real http listener on an ephemeral port
// and exercise endpoints over fetch. These complement the handler unit tests
// by verifying the transport layer (CORS headers, body parsing, JSON encoding,
// status codes, error paths in the router itself).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type RunningServer } from '../../src/api/server.js';
import { MemoryLoader } from '../../src/api/loader.js';
import { loadCsulb } from '../helpers.js';
import {
  API_SCHEMA_VERSION,
  type AnalysisGetResponse,
  type ApiErrorResponse,
  type HealthResponse,
  type InstitutionsListResponse,
  type PanelManifestResponse,
} from '../../src/api/contract.js';

const FROZEN_TIME = '2026-04-30T00:00:00.000Z';

let server: RunningServer;
let baseUrl: string;

beforeAll(async () => {
  const loader = new MemoryLoader([loadCsulb()]);
  server = await startServer({
    loader,
    port: 0,
    host: '127.0.0.1',
    now: () => FROZEN_TIME,
  });
  baseUrl = `http://${server.address.host}:${server.address.port}`;
});

afterAll(async () => {
  await server.close();
});

describe('Server integration — transport layer', () => {
  it('GET /api/v1/health returns 200 with CORS headers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    const body = (await res.json()) as HealthResponse;
    expect(body.status).toBe('ok');
    expect(body.api_schema_version).toBe(API_SCHEMA_VERSION);
  });

  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Methods')).toMatch(/POST/);
  });

  it('GET /api/v1/institutions?q= routes the query', async () => {
    const res = await fetch(`${baseUrl}/api/v1/institutions?q=Long%20Beach`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as InstitutionsListResponse;
    expect(body.total_matches).toBe(1);
    expect(body.results[0]?.unitid).toBe('110583');
  });

  it('GET /api/v1/institutions/110583 returns institution metadata', async () => {
    const res = await fetch(`${baseUrl}/api/v1/institutions/110583`);
    expect(res.status).toBe(200);
  });

  it('GET /api/v1/analysis/110583 reproduces dean memo numbers', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analysis/110583`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as AnalysisGetResponse;
    const music = body.programs.find((p) => p.cip4 === '5009' && p.credlev === "Master's");
    expect(music?.verdict).toBe('FAIL');
    expect(music?.ep_gap_pct).toBeCloseTo(-0.3265, 4);
    expect(body.emitted_at).toBe(FROZEN_TIME);
  });

  it('POST /api/v1/analysis with queried_cips surfaces b16_invisible_to_ppd', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitid: '110583',
        queried_cips: [
          { cip4: '5006', credlev: 'Bachelor' },
          { cip4: '5009', credlev: "Master's" },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AnalysisGetResponse;
    expect(body.request_persona).toBe('persona_a');
    const cine = body.programs.find((p) => p.cip4 === '5006' && p.credlev === 'Bachelor');
    expect(cine?.verdict).toBe('NOT MEASURED');
    expect(cine?.not_measured_reason).toBe('b16_invisible_to_ppd');
  });

  it('POST /api/v1/analysis with malformed body returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/v1/analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe('BAD_REQUEST');
  });

  it('GET /api/v1/panels returns the 16-panel manifest', async () => {
    const res = await fetch(`${baseUrl}/api/v1/panels`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as PanelManifestResponse;
    expect(body.panels).toHaveLength(16);
    expect(body.panels.map((p) => p.id)).not.toContain('M16');
  });

  it('GET /api/v1/panels/M16 returns 404 with deferral note', async () => {
    const res = await fetch(`${baseUrl}/api/v1/panels/M16`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.message).toMatch(/intentionally deferred/i);
  });

  it('Method-not-allowed: POST /api/v1/health → 405', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`, { method: 'POST' });
    expect(res.status).toBe(405);
  });

  it('Unknown route → 404 with NOT_FOUND code', async () => {
    const res = await fetch(`${baseUrl}/api/v1/bogus`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ApiErrorResponse;
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('determinism — same request produces byte-identical body', async () => {
    const url = `${baseUrl}/api/v1/analysis/110583`;
    const r1 = await fetch(url).then((r) => r.text());
    const r2 = await fetch(url).then((r) => r.text());
    expect(r1).toBe(r2);
  });
});
