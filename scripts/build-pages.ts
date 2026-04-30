// Build the static-asset tree that Cloudflare Pages serves.
//
// Pages serves a single output directory; the dev surface is split between
// web/ (HTML/CSS/JS) and content/ (panels + citations.json + glossary.json).
// This script merges the two into dist-pages/ with the same path layout the
// browser expects:
//
//   dist-pages/
//     index.html, persona-a.html, persona-b.html
//     css/main.css
//     js/api.js, js/render.js, ...
//     content/
//       citations.json
//       glossary.json
//       mdocs/M01.html, M02.html, ...
//
// Functions (functions/api/v1/[[path]].ts) are NOT in dist-pages/ —
// Cloudflare Pages picks them up directly from the project's functions/
// directory at deploy time.
//
// Usage:
//   tsx scripts/build-pages.ts            # default output: dist-pages/
//   tsx scripts/build-pages.ts --out X    # override output dir

import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { resolve } from 'node:path';

interface Args {
  out: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { out: 'dist-pages' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--out' && argv[i + 1] !== undefined) {
      args.out = argv[i + 1]!;
      i += 1;
    }
  }
  return args;
}

function ensureExists(path: string, kind: string): void {
  if (!existsSync(path)) {
    throw new Error(`Required ${kind} not found at ${path}`);
  }
  const st = statSync(path);
  if (!st.isDirectory()) {
    throw new Error(`${path} is not a directory`);
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = resolve('.');
  const webDir = resolve(repoRoot, 'web');
  const contentDir = resolve(repoRoot, 'content');
  const outDir = resolve(repoRoot, args.out);

  ensureExists(webDir, 'web/ directory');
  ensureExists(contentDir, 'content/ directory');

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  cpSync(webDir, outDir, { recursive: true });
  cpSync(contentDir, resolve(outDir, 'content'), { recursive: true });

  process.stderr.write(`Built Pages output at ${outDir}\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`build-pages failed: ${(err as Error).message}\n`);
  process.exit(1);
}
