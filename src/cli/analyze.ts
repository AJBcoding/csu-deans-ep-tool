// CLI — read a fixture file and emit the full AnalysisResult as JSON.
//
//   tsx src/cli/analyze.ts tests/fixtures/sample-institution.json
//   tsx src/cli/analyze.ts data/build/output/by_unitid/110583.json --pretty
//
// Used for manual smoke-testing during Phase 1 development.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeInstitution } from '../engine.js';
import type { InstitutionRecord } from '../types.js';

function main(): void {
  const args = process.argv.slice(2);
  const fixturePath = args[0];
  const pretty = args.includes('--pretty');
  if (fixturePath === undefined) {
    process.stderr.write(
      'usage: tsx src/cli/analyze.ts <fixture.json> [--pretty]\n',
    );
    process.exit(1);
  }
  const raw = readFileSync(resolve(fixturePath), 'utf8');
  const institution = JSON.parse(raw) as InstitutionRecord;
  const result = analyzeInstitution(institution);
  process.stdout.write(JSON.stringify(result, null, pretty ? 2 : 0));
  process.stdout.write('\n');
}

main();
