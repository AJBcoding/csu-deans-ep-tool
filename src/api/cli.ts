// Dev server entry — boots the API against a directory of fixtures.
//
//   tsx src/api/cli.ts --fixtures data/build/output/by_unitid --port 8787
//
// Defaults: port 8787, fixture dir = data/build/output/by_unitid (relative
// to the worktree root). When no fixtures dir exists, falls back to a
// single-fixture in-memory loader seeded from tests/fixtures/sample-institution.json
// so a developer can boot the server and hit endpoints without running the
// Python build pipeline first.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startServer } from './server.js';
import { DiskFixtureLoader, MemoryLoader } from './loader.js';
import type { InstitutionRecord } from '../types.js';

interface CliArgs {
  fixtures: string;
  port: number;
  host: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    fixtures: 'data/build/output/by_unitid',
    port: 8787,
    host: '127.0.0.1',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--fixtures' && argv[i + 1] !== undefined) {
      args.fixtures = argv[i + 1]!;
      i += 1;
    } else if (a === '--port' && argv[i + 1] !== undefined) {
      args.port = Number.parseInt(argv[i + 1]!, 10);
      i += 1;
    } else if (a === '--host' && argv[i + 1] !== undefined) {
      args.host = argv[i + 1]!;
      i += 1;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dir = resolve(args.fixtures);

  let loader: DiskFixtureLoader | MemoryLoader;
  if (existsSync(dir)) {
    loader = new DiskFixtureLoader(dir);
    process.stderr.write(
      `Loaded ${loader.count()} institutions from ${dir} (PPD:${loader.ppdRelease()}, build ${loader.buildDate()}).\n`,
    );
  } else {
    const sample = resolve('tests/fixtures/sample-institution.json');
    if (!existsSync(sample)) {
      process.stderr.write(
        `Neither ${dir} nor ${sample} exists. Run the Python build pipeline or supply --fixtures.\n`,
      );
      process.exit(1);
    }
    const record = JSON.parse(readFileSync(sample, 'utf8')) as InstitutionRecord;
    loader = new MemoryLoader([record]);
    process.stderr.write(
      `Fallback: loaded single fixture from ${sample} (UNITID ${record.unitid}, ${record.instnm}).\n`,
    );
  }

  const running = await startServer({
    loader,
    port: args.port,
    host: args.host,
    log: true,
  });
  const { host, port } = running.address;
  process.stderr.write(`API listening on http://${host}:${port}\n`);
  process.stderr.write(`  GET  /api/v1/health\n`);
  process.stderr.write(`  GET  /api/v1/institutions?q=&limit=&state=\n`);
  process.stderr.write(`  GET  /api/v1/institutions/:unitid\n`);
  process.stderr.write(`  GET  /api/v1/analysis/:unitid\n`);
  process.stderr.write(`  POST /api/v1/analysis    body: {unitid, queried_cips?: [{cip4, credlev}]}\n`);
  process.stderr.write(`  GET  /api/v1/panels\n`);
  process.stderr.write(`  GET  /api/v1/panels/:id\n`);
}

main().catch((err) => {
  process.stderr.write(`startup failed: ${(err as Error).message ?? String(err)}\n`);
  process.exit(1);
});
