// Phase 5 — Pages Functions catch-all entry point smoke test.
//
// Exercises the actual Cloudflare Pages onRequest export (not just the inner
// router) so the bundled fixture wiring + memo loader cache are also covered.
// This is the smallest test that proves the deployed Worker would respond
// 200 to a CSULB request.

import { describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/api/v1/[[path]].js';

describe('Pages Functions entry — /api/v1/[[path]]', () => {
  it('GET /api/v1/health responds 200 with bundled CSULB visible to the loader', async () => {
    const res = await onRequest({
      request: new Request('https://example.test/api/v1/health'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; institutions_loaded: number };
    expect(body.status).toBe('ok');
    expect(body.institutions_loaded).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/analysis/110583 returns CSULB Persona B verdicts (acceptance)', async () => {
    const res = await onRequest({
      request: new Request('https://example.test/api/v1/analysis/110583'),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      unitid: string;
      programs: Array<{ cip4: string; credlev: string; verdict: string }>;
    };
    expect(body.unitid).toBe('110583');
    const findProgram = (cip4: string, credlev: string) =>
      body.programs.find((p) => p.cip4 === cip4 && p.credlev === credlev);
    expect(findProgram('5009', "Master's")?.verdict).toBe('FAIL');
    expect(findProgram('5007', "Master's")?.verdict).toBe('FAIL');
    expect(findProgram('5005', 'Bachelor')?.verdict).toBe('PASS');
  });

  it('POST /api/v1/analysis with Cinematic Arts BA returns NOT MEASURED + b16_invisible (acceptance)', async () => {
    const res = await onRequest({
      request: new Request('https://example.test/api/v1/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unitid: '110583',
          queried_cips: [{ cip4: '5006', credlev: 'Bachelor' }],
        }),
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      programs: Array<{ cip4: string; verdict: string; not_measured_reason?: string }>;
    };
    const cinematic = body.programs.find((p) => p.cip4 === '5006');
    expect(cinematic?.verdict).toBe('NOT MEASURED');
    expect(cinematic?.not_measured_reason).toBe('b16_invisible_to_ppd');
  });
});
