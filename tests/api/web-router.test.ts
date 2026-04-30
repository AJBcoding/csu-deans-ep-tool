// Phase 5 — Web Standards router tests.
//
// Mirrors the Phase 2 server.test.ts coverage but exercises the Request ->
// Response router that powers the Cloudflare Pages Function. Same handlers,
// different transport.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { routeRequest } from '../../src/api/web-router.js';
import { MemoryLoader } from '../../src/api/loader.js';
import type { InstitutionRecord } from '../../src/types.js';

function loadCsulb(): InstitutionRecord {
  const path = resolve(__dirname, '..', 'fixtures', 'sample-institution.json');
  return JSON.parse(readFileSync(path, 'utf8')) as InstitutionRecord;
}

const FROZEN_NOW = '2026-04-30T00:00:00Z';

function buildLoader(): MemoryLoader {
  return new MemoryLoader([loadCsulb()]);
}

describe('web-router — health endpoint', () => {
  it('GET /api/v1/health returns 200 with health body', async () => {
    const loader = buildLoader();
    const res = await routeRequest(
      new Request('https://example.test/api/v1/health'),
      { loader, now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/json/);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const body = (await res.json()) as { status: string; institutions_loaded: number };
    expect(body.status).toBe('ok');
    expect(body.institutions_loaded).toBe(1);
  });

  it('rejects POST on /health with 405', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/health', { method: 'POST' }),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(405);
  });

  it('responds to OPTIONS preflight with 204 + CORS headers', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/health', { method: 'OPTIONS' }),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

describe('web-router — analysis endpoints', () => {
  it('GET /api/v1/analysis/110583 returns CSULB Persona B verdicts', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/analysis/110583'),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      unitid: string;
      programs: Array<{ cip4: string; credlev: string; verdict: string }>;
    };
    expect(body.unitid).toBe('110583');
    expect(body.programs.length).toBeGreaterThan(0);

    // Spec §0 acceptance checks (mirrors Phase 2 server tests):
    const findProgram = (cip4: string, credlev: string) =>
      body.programs.find((p) => p.cip4 === cip4 && p.credlev === credlev);
    const musicMM = findProgram('5009', "Master's");
    const artMFA = findProgram('5007', "Master's");
    const theatreBA = findProgram('5005', 'Bachelor');
    expect(musicMM?.verdict).toBe('FAIL');
    expect(artMFA?.verdict).toBe('FAIL');
    expect(theatreBA?.verdict).toBe('PASS');
  });

  it('POST /api/v1/analysis with Cinematic Arts BA returns NOT MEASURED with b16_invisible', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitid: '110583',
          queried_cips: [{ cip4: '5006', credlev: 'Bachelor' }],
        }),
      }),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      programs: Array<{
        cip4: string;
        verdict: string;
        not_measured_reason?: string;
      }>;
    };
    const cinematic = body.programs.find((p) => p.cip4 === '5006');
    expect(cinematic?.verdict).toBe('NOT MEASURED');
    expect(cinematic?.not_measured_reason).toBe('b16_invisible_to_ppd');
  });

  it('POST /api/v1/analysis with malformed JSON returns 400', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});

describe('web-router — institutions / panels', () => {
  it('GET /api/v1/institutions returns the loader directory', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/institutions?q=long%20beach'),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { results: Array<{ unitid: string }> };
    expect(body.results.length).toBeGreaterThanOrEqual(1);
    expect(body.results[0]!.unitid).toBe('110583');
  });

  it('GET /api/v1/institutions/110583 returns CSULB metadata', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/institutions/110583'),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unitid: string; instnm: string };
    expect(body.unitid).toBe('110583');
  });

  it('GET /api/v1/panels returns the manifest', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/panels'),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { panels: Array<{ id: string }> };
    expect(body.panels.length).toBeGreaterThan(0);
  });

  it('GET unknown panel id returns 404', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/panels/M99'),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(404);
  });

  it('GET unknown route returns 404 with NOT_FOUND envelope', async () => {
    const res = await routeRequest(
      new Request('https://example.test/api/v1/nope'),
      { loader: buildLoader(), now: () => FROZEN_NOW },
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
