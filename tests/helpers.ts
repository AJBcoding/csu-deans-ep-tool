// Shared test helpers — fixture loaders + a synthetic-program factory so
// per-rule tests don't have to hand-author full ProgramRecord objects.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  BenchmarkRoute,
  Credlev,
  InstitutionRecord,
  ProgramRecord,
  SuppressionFlags,
} from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function loadCsulb(): InstitutionRecord {
  const path = resolve(__dirname, 'fixtures/sample-institution.json');
  return JSON.parse(readFileSync(path, 'utf8')) as InstitutionRecord;
}

export function findProgram(
  inst: InstitutionRecord,
  cip4: string,
  credlev: Credlev,
): ProgramRecord {
  const p = inst.programs.find(
    (x) => x.cip4 === cip4 && x.credlev === credlev,
  );
  if (p === undefined) {
    throw new Error(`fixture missing ${cip4}/${credlev}`);
  }
  return p;
}

export interface ProgramOverrides {
  cip4?: string;
  cip4_title?: string;
  credlev?: Credlev;
  cohort_count?: number | null;
  median_earn_p4?: number | null;
  benchmark?: number | null;
  benchmark_route?: BenchmarkRoute;
  ep_gap_pct?: number | null;
  ppd_fail_obbb?: 0 | 1 | null;
  ppd_fail_master?: 0 | 1 | null;
  suppression?: Partial<SuppressionFlags>;
  in_state_share?: number | null;
}

/**
 * Build a synthetic program. Note: `null` overrides are preserved (we don't
 * use `??` because `null ?? default` collapses null to default — and tests
 * routinely need to set fields like median_earn_p4 to null to model
 * suppression states).
 */
export function makeProgram(o: ProgramOverrides = {}): ProgramRecord {
  const has = (k: keyof ProgramOverrides): boolean =>
    Object.prototype.hasOwnProperty.call(o, k);

  return {
    cip4: has('cip4') ? o.cip4! : '5009',
    cip4_title: has('cip4_title') ? o.cip4_title! : 'Music.',
    credlev: has('credlev') ? o.credlev! : "Master's",
    cohort_count: has('cohort_count') ? o.cohort_count! : 28,
    median_earn_p4: has('median_earn_p4') ? o.median_earn_p4! : 32534.0,
    benchmark: has('benchmark') ? o.benchmark! : 48304.0,
    benchmark_route: has('benchmark_route')
      ? o.benchmark_route!
      : 'National Same-Field BA Median',
    ep_gap_pct: has('ep_gap_pct') ? o.ep_gap_pct! : -0.3265,
    ppd_fail_obbb: has('ppd_fail_obbb') ? o.ppd_fail_obbb! : 1,
    ppd_fail_master: has('ppd_fail_master') ? o.ppd_fail_master! : 1,
    suppression: {
      missing_test: o.suppression?.missing_test ?? 0,
      earn_suppressed: o.suppression?.earn_suppressed ?? false,
      cohort_suppressed: o.suppression?.cohort_suppressed ?? false,
      out_of_scope: o.suppression?.out_of_scope ?? false,
    },
    ...(has('in_state_share') ? { in_state_share: o.in_state_share! } : {}),
  };
}

export function makeInstitution(programs: ProgramRecord[] = []): InstitutionRecord {
  return {
    unitid: '110583',
    opeid6: '001139',
    instnm: 'California State University-Long Beach',
    stabbr: 'CA',
    control: 1,
    iclevel: 1,
    sector: 1,
    ppd_release: '2026',
    build_date: '2026-04-29',
    programs,
  };
}
