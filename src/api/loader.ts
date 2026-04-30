// Fixture loader — reads pre-built per-institution JSON from
// `data/build/output/by_unitid/<UNITID>.json` (or a directory the consumer
// supplies) and exposes the FixtureLoader interface the server consumes.
//
// In tests we use the in-memory `MemoryLoader` instead, which lets us seed
// synthetic InstitutionRecord values without touching the filesystem.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type {
  FixtureLoader,
  InstitutionDirectoryEntry,
} from './contract.js';
import type { InstitutionRecord } from '../types.js';

interface CachedInstitution {
  meta: InstitutionDirectoryEntry;
  record: InstitutionRecord;
}

/**
 * Disk-backed loader. Reads a directory of UNITID-keyed JSON files at startup;
 * the runtime is fast enough that we cache everything in memory rather than
 * stat-on-each-request. ~5,000 institutions × ~30KB = ~150MB worst case.
 */
export class DiskFixtureLoader implements FixtureLoader {
  private cache = new Map<string, CachedInstitution>();
  private build_date: string = '';
  private ppd_release: string = '';

  constructor(directory: string) {
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      throw new Error(`Fixture directory not found: ${directory}`);
    }
    const files = readdirSync(directory).filter((f) => f.endsWith('.json'));
    for (const f of files) {
      const path = join(directory, f);
      const raw = readFileSync(path, 'utf8');
      const record = JSON.parse(raw) as InstitutionRecord;
      this.cache.set(record.unitid, {
        meta: {
          unitid: record.unitid,
          instnm: record.instnm,
          stabbr: record.stabbr,
          control: record.control,
          iclevel: record.iclevel,
          n_programs: record.programs.length,
        },
        record,
      });
      // First record wins for build_date / ppd_release; the build pipeline
      // emits identical values across all files in a release.
      if (this.build_date === '') this.build_date = record.build_date;
      if (this.ppd_release === '') this.ppd_release = record.ppd_release;
    }
  }

  list(query: string, limit: number, state?: string): InstitutionDirectoryEntry[] {
    const q = query.trim().toLowerCase();
    const results: InstitutionDirectoryEntry[] = [];
    for (const { meta } of this.cache.values()) {
      if (state !== undefined && meta.stabbr !== state.toUpperCase()) continue;
      if (q === '' || meta.instnm.toLowerCase().includes(q) || meta.unitid.includes(q)) {
        results.push(meta);
        if (results.length >= limit) break;
      }
    }
    // Stable order: by stabbr, then instnm — same as the build pipeline.
    results.sort((a, b) => {
      if (a.stabbr !== b.stabbr) return a.stabbr < b.stabbr ? -1 : 1;
      return a.instnm < b.instnm ? -1 : 1;
    });
    return results;
  }

  get(unitid: string): InstitutionRecord | null {
    return this.cache.get(unitid)?.record ?? null;
  }

  count(): number {
    return this.cache.size;
  }

  buildDate(): string {
    return this.build_date;
  }

  ppdRelease(): string {
    return this.ppd_release;
  }
}

/**
 * In-memory loader for tests + single-fixture demos. Construct with a list of
 * full InstitutionRecord values; the loader derives directory metadata from
 * each record on insert.
 */
export class MemoryLoader implements FixtureLoader {
  private cache = new Map<string, CachedInstitution>();
  private build_date: string;
  private ppd_release: string;

  constructor(records: readonly InstitutionRecord[]) {
    this.build_date = records[0]?.build_date ?? '';
    this.ppd_release = records[0]?.ppd_release ?? '';
    for (const record of records) {
      this.cache.set(record.unitid, {
        meta: {
          unitid: record.unitid,
          instnm: record.instnm,
          stabbr: record.stabbr,
          control: record.control,
          iclevel: record.iclevel,
          n_programs: record.programs.length,
        },
        record,
      });
    }
  }

  list(query: string, limit: number, state?: string): InstitutionDirectoryEntry[] {
    const q = query.trim().toLowerCase();
    const results: InstitutionDirectoryEntry[] = [];
    for (const { meta } of this.cache.values()) {
      if (state !== undefined && meta.stabbr !== state.toUpperCase()) continue;
      if (q === '' || meta.instnm.toLowerCase().includes(q) || meta.unitid.includes(q)) {
        results.push(meta);
        if (results.length >= limit) break;
      }
    }
    results.sort((a, b) => {
      if (a.stabbr !== b.stabbr) return a.stabbr < b.stabbr ? -1 : 1;
      return a.instnm < b.instnm ? -1 : 1;
    });
    return results;
  }

  get(unitid: string): InstitutionRecord | null {
    return this.cache.get(unitid)?.record ?? null;
  }

  count(): number {
    return this.cache.size;
  }

  buildDate(): string {
    return this.build_date;
  }

  ppdRelease(): string {
    return this.ppd_release;
  }
}
