// Export the JSON Schema artifact for Persona C consumers.
//
//   npx tsx scripts/export-schema.ts
//
// Writes `docs/api/contract.schema.json`. The schema-parity test enforces
// that this stays consistent with the engine's emitted shapes.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { API_JSON_SCHEMA } from '../src/api/schema.js';

const target = resolve('docs/api/contract.schema.json');
writeFileSync(target, JSON.stringify(API_JSON_SCHEMA, null, 2) + '\n', 'utf8');
process.stderr.write(`Wrote ${target}\n`);
