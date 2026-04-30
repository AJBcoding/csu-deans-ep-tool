// Phase 3 UI — end-to-end test for the dev server. Boots the wrapper that
// serves both /api/* and /web/* on a single port, fetches via real HTTP, then
// renders the JSON through web/js/render.js to assert the CSULB acceptance.
//
// The dev server is the same one developers boot with `npm run dev`, so this
// test exercises the deployed-shape pipeline.

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { renderResult } from '../../web/js/render.js';

let proc: ChildProcess;
const PORT = 19191;
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/v1/health`);
      if (r.ok) return;
    } catch {
      // server not up yet
    }
    await sleep(100);
  }
  throw new Error('dev server failed to come up');
}

beforeAll(async () => {
  proc = spawn(
    'npx',
    ['tsx', resolve(__dirname, '..', '..', 'scripts', 'dev-server.ts'), '--port', String(PORT)],
    {
      cwd: resolve(__dirname, '..', '..'),
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  );
  await waitForReady();
}, 30_000);

afterAll(async () => {
  if (proc !== undefined && !proc.killed) {
    proc.kill('SIGTERM');
    await sleep(200);
  }
});

describe('dev server — static UI surface', () => {
  it('serves the landing page', async () => {
    const r = await fetch(`${BASE}/`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toMatch(/text\/html/);
    const body = await r.text();
    expect(body).toContain('CSU Deans EP Tool');
    expect(body).toContain('Pull by UNITID');
  });

  it('serves persona-b.html', async () => {
    const r = await fetch(`${BASE}/persona-b.html`);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('id="run-form"');
    expect(body).toContain('persona-b.js');
  });

  it('serves persona-a.html with queried-CIPs fieldset', async () => {
    const r = await fetch(`${BASE}/persona-a.html`);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('Programs to check');
    expect(body).toContain('persona-a.js');
  });

  it('serves citations.json via /content/', async () => {
    const r = await fetch(`${BASE}/content/citations.json`);
    expect(r.status).toBe(200);
    const json = await r.json();
    expect(typeof json.mdoc_anchors).toBe('object');
  });

  it('serves panel HTML via /content/mdocs/', async () => {
    const r = await fetch(`${BASE}/content/mdocs/M01.html`);
    expect(r.status).toBe(200);
    const body = await r.text();
    expect(body).toContain('data-panel-id="M01"');
  });
});

describe('dev server — Persona B end-to-end', () => {
  it('GET /api/v1/analysis/110583 → CSULB result with Music MM FAIL', async () => {
    const r = await fetch(`${BASE}/api/v1/analysis/110583`);
    expect(r.status).toBe(200);
    const result = await r.json();
    const html = renderResult(result, {}, []);

    // Verdicts surface in the rendered HTML
    expect(html).toMatch(/CIP 5009.*Master&#39;s.*FAIL/s);
    expect(html).toMatch(/-32\.65%/);
    expect(html).toMatch(/CIP 5007.*Master&#39;s.*FAIL/s);
    expect(html).toMatch(/CIP 5005.*Bachelor.*PASS/s);
    expect(html).toMatch(/data-noise-band="true"/);

    // Footer reminder
    expect(html).toContain(
      'Re-derive against primary sources before any external submission.',
    );
  });
});

describe('dev server — Persona A end-to-end (B16 invisibility)', () => {
  it('POST /api/v1/analysis with 5006/Bachelor surfaces NOT MEASURED b16', async () => {
    const r = await fetch(`${BASE}/api/v1/analysis`, {
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
    expect(r.status).toBe(200);
    const result = await r.json();

    const cinematic = result.programs.find(
      (p: { cip4: string; credlev: string }) =>
        p.cip4 === '5006' && p.credlev === 'Bachelor',
    );
    expect(cinematic).toBeDefined();
    expect(cinematic.verdict).toBe('NOT MEASURED');
    expect(cinematic.not_measured_reason).toBe('b16_invisible_to_ppd');

    const html = renderResult(result, {}, []);
    expect(html).toMatch(/CIP 5006.*Bachelor.*NOT MEASURED/s);
    expect(html).toContain('Department does not publish a row for this program');
  });
});
