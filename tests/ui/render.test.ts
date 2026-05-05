// Phase 3 UI — pure-function renderer tests.
// Imports the web/js/render.js ESM module directly; no DOM required.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  escapeHtml,
  renderResult,
  renderVerdictCard,
  renderIntegrityEnvelope,
} from '../../web/js/render.js';
import { handleAnalysisGet, handleAnalysisPost } from '../../src/api/handlers.js';
import { MemoryLoader } from '../../src/api/loader.js';
import type { InstitutionRecord } from '../../src/types.js';

function loadCsulb(): InstitutionRecord {
  const path = resolve(__dirname, '..', 'fixtures', 'sample-institution.json');
  return JSON.parse(readFileSync(path, 'utf8')) as InstitutionRecord;
}

const EMITTED_AT = '2026-04-30T00:00:00Z';

describe('renderer — escapeHtml', () => {
  it('escapes the five HTML characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
  it('returns empty for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('renderer — verdict card spec §6 / §7', () => {
  const loader = new MemoryLoader([loadCsulb()]);
  const result = handleAnalysisGet(loader, '110583', EMITTED_AT);
  expect(result.status).toBe(200);
  const body = result.body as { programs: unknown[] };
  const programs = body.programs as Array<{
    cip4: string;
    credlev: string;
    verdict: string;
    cohort_count: number | null;
    median_earn_p4: number | null;
    ep_gap_pct: number | null;
    noise_band: { fired: boolean };
    rules_fired: Array<{ id: string }>;
    panels_triggered: string[];
  }>;

  const find = (cip4: string, credlev: string) =>
    programs.find((p) => p.cip4 === cip4 && p.credlev === credlev);

  it('Music MM card: FAIL band, gap -32.65%, n=28', () => {
    const v = find('5009', "Master's");
    expect(v).toBeDefined();
    const html = renderVerdictCard(v);
    expect(html).toMatch(/data-verdict="FAIL"/);
    expect(html).toMatch(/-32\.65%/);
    expect(html).toMatch(/>28</);
    expect(html).toMatch(/class="verdict-tag">FAIL</);
    // Drill-in present and collapsed by default (no `open` attribute).
    expect(html).toMatch(/<details class="drill-in">/);
    expect(html).not.toMatch(/<details class="drill-in" open/);
  });

  it('Art MFA card: FAIL band, gap -20.40%, n=23', () => {
    const v = find('5007', "Master's");
    expect(v).toBeDefined();
    const html = renderVerdictCard(v);
    expect(html).toMatch(/data-verdict="FAIL"/);
    expect(html).toMatch(/-20\.40%/);
    expect(html).toMatch(/>23</);
  });

  it('Theatre BA card: PASS verdict, noise-band attribute set', () => {
    const v = find('5005', 'Bachelor');
    expect(v).toBeDefined();
    const html = renderVerdictCard(v);
    expect(html).toMatch(/data-verdict="PASS"/);
    expect(html).toMatch(/data-noise-band="true"/);
    expect(html).toMatch(/\+6\.06%/);
    expect(html).toMatch(/noise-band-note/);
  });

  it('verdict card emits panel-trigger anchors keyed to spec panels', () => {
    const v = find('5009', "Master's");
    expect(v).toBeDefined();
    const html = renderVerdictCard(v);
    for (const id of v!.panels_triggered) {
      expect(html).toContain(`data-panel-target="${id}"`);
    }
  });
});

describe('renderer — integrity envelope', () => {
  it('echoes the primary-source reminder per spec §13', () => {
    const env = {
      build_date: '2026-04-29',
      ppd_release: '2026',
      noise_band_advisories_count: 3,
      cross_validation_disagreements: 0,
      data_status_summary: {
        fully_measured: 25,
        ppd_suppressed: 12,
        irs_below_floor: 4,
        cohort_below_floor: 51,
        out_of_scope: 0,
      },
      primary_source_reminder:
        'Re-derive against primary sources before any external submission.',
    };
    const html = renderIntegrityEnvelope(env);
    expect(html).toContain('Re-derive against primary sources before any external submission.');
    expect(html).toMatch(/2026-04-29/);
    expect(html).toMatch(/>25</);
  });
});

describe('renderer — full CSULB result (Persona B)', () => {
  const loader = new MemoryLoader([loadCsulb()]);
  const result = handleAnalysisGet(loader, '110583', EMITTED_AT);
  const html = renderResult(result.body, {}, []);

  it('header surfaces UNITID and stabbr', () => {
    expect(html).toMatch(/UNITID 110583.*CA/s);
    expect(html).toMatch(/California State University-Long Beach/);
  });

  it('contains Music MM FAIL, Art MFA FAIL, Theatre BA PASS verdict tags', () => {
    // Renderer escapes the apostrophe in "Master's" to &#39;.
    expect(html).toMatch(/CIP 5009.*Master&#39;s.*FAIL/s);
    expect(html).toMatch(/CIP 5007.*Master&#39;s.*FAIL/s);
    expect(html).toMatch(/CIP 5005.*Bachelor.*PASS/s);
  });

  it('displays footer reminder twice (envelope + result footer)', () => {
    const matches = html.match(/Re-derive against primary sources before any external submission/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });

  it('renders 9 auto-triggered panel blocks (M01,M03,M04,M05,M07,M12,M13,M14,M18 — cp-j0gw.7)', () => {
    for (const id of ['M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14', 'M18']) {
      expect(html).toContain(`id="panel-${id}"`);
    }
  });
});

describe('renderer — Persona A queried-CIPs (B16 invisibility)', () => {
  const loader = new MemoryLoader([loadCsulb()]);
  const result = handleAnalysisPost(
    loader,
    {
      unitid: '110583',
      queried_cips: [
        { cip4: '5006', credlev: 'Bachelor' },
        { cip4: '5009', credlev: "Master's" },
      ],
    },
    EMITTED_AT,
  );
  expect(result.status).toBe(200);
  const html = renderResult(result.body, {}, []);

  it('surfaces Cinematic Arts BA as NOT MEASURED with B16 reason text', () => {
    expect(html).toMatch(/CIP 5006.*Bachelor.*NOT MEASURED/s);
    expect(html).toContain('Department does not publish a row for this program');
  });

  it('renders M12 panel block (NOT MEASURED branch)', () => {
    expect(html).toContain('id="panel-M12"');
  });

  it('contains the exact NOT MEASURED verdict tag for the invisible program', () => {
    expect(html).toMatch(
      /data-cip4="5006"[\s\S]*?<span class="verdict-tag">NOT MEASURED<\/span>/,
    );
  });
});
