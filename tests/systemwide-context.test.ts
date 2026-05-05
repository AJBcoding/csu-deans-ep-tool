// systemwide-context.test.ts — verify the cp-j0gw.8 systemwide-cip-context.json
// bundle is well-formed and that the renderer surfaces the per-CIP context line
// when the data is preloaded.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface SystemwideContext {
  schema_version: string;
  build_date: string;
  ppd_release: string;
  scope_label: string;
  source_csv_path: string;
  reproducer_script: string;
  failure_type_legend: Record<string, string>;
  totals: Record<string, { n_cells: number; n_campuses: number; n_unique_cip4: number }>;
  n_campuses_in_scope: number;
  n_unique_cip4: number;
  by_cip: Record<string, {
    cip4: string;
    cip4_title: string;
    a_direct_fail: number;
    c_invisible: number;
    d_knife_edge: number;
    e_pool_suppressed: number;
    total_cells: number;
    n_unique_campuses: number;
  }>;
  disclaimer: string;
}

const ctx: SystemwideContext = JSON.parse(
  readFileSync(
    resolve(__dirname, '..', 'content', 'systemwide-cip-context.json'),
    'utf8',
  ),
);

describe('systemwide-cip-context.json (cp-j0gw.8)', () => {
  it('reports 22 CSU campuses in scope', () => {
    expect(ctx.n_campuses_in_scope).toBe(22);
  });

  it('reports 81 unique CIP-4 codes', () => {
    expect(ctx.n_unique_cip4).toBe(81);
    expect(Object.keys(ctx.by_cip).length).toBe(81);
  });

  it('totals match the senate-packet headline (196 cells, type breakdown)', () => {
    expect(ctx.totals.A_directly_failing_AHEAD?.n_cells).toBe(21);
    expect(ctx.totals.C_invisible_no_AHEAD_row?.n_cells).toBe(86);
    expect(ctx.totals.D_knife_edge_passing_within_20pct?.n_cells).toBe(66);
    expect(ctx.totals.E_suppressed_pool_has_failing_siblings?.n_cells).toBe(23);
    const total =
      ctx.totals.A_directly_failing_AHEAD!.n_cells +
      ctx.totals.C_invisible_no_AHEAD_row!.n_cells +
      ctx.totals.D_knife_edge_passing_within_20pct!.n_cells +
      ctx.totals.E_suppressed_pool_has_failing_siblings!.n_cells;
    expect(total).toBe(196);
  });

  it('CIP 50.09 (Music) shows multi-campus exposure (12 of 22 campuses)', () => {
    const music = ctx.by_cip['5009'];
    expect(music).toBeDefined();
    expect(music?.cip4_title).toMatch(/Music/i);
    expect(music?.n_unique_campuses).toBe(12);
    expect(music?.total_cells).toBe(13);
  });

  it('CIP 50.05 (Drama) shows multi-campus exposure (9 of 22 campuses)', () => {
    const drama = ctx.by_cip['5005'];
    expect(drama).toBeDefined();
    expect(drama?.cip4_title).toMatch(/Drama|Theatre/i);
    expect(drama?.n_unique_campuses).toBe(9);
  });

  it('CIP 23.01 (English MA — REV-2 finding) is in the systemwide map', () => {
    const english = ctx.by_cip['2301'];
    expect(english).toBeDefined();
    expect(english?.cip4_title).toMatch(/English/i);
    expect(english?.n_unique_campuses).toBeGreaterThan(0);
  });

  it('disclaimer marks the data as forward simulation, not observation', () => {
    expect(ctx.disclaimer).toMatch(/forward[- ]simulated/i);
    expect(ctx.disclaimer).toMatch(/Verify against the source/i);
  });

  it('includes reproducer-script pointer (CIPcodes-side path)', () => {
    expect(ctx.reproducer_script).toMatch(/03_build_systemwide\.py/);
    expect(ctx.source_csv_path).toMatch(/3cut-2026-05-04/);
  });

  it('every by_cip entry has the four failure-type counts that sum to total_cells', () => {
    for (const [cip4, entry] of Object.entries(ctx.by_cip)) {
      const sum =
        entry.a_direct_fail +
        entry.c_invisible +
        entry.d_knife_edge +
        entry.e_pool_suppressed;
      expect(sum, `cip4=${cip4}`).toBe(entry.total_cells);
    }
  });
});
