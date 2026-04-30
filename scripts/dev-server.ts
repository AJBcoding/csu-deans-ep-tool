// Development server — serves the Phase 3 web/ UI plus the Phase 2 API on a
// single port. Wraps `src/api/server.ts`'s router; does not touch it.
//
//   tsx scripts/dev-server.ts --port 8787
//
// Behavior:
//   • /api/v1/*           → handled by buildRouter()
//   • /content/*          → served from <repo>/content/* (panels + citations.json)
//   • /                   → /web/index.html
//   • /<other>            → served from <repo>/web/* if present, else 404
//
// Fixture loading mirrors src/api/cli.ts: prefer data/build/output/by_unitid;
// fall back to tests/fixtures/sample-institution.json so a developer can
// boot without running the Python build pipeline.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { URL } from 'node:url';
import { buildRouter } from '../src/api/server.js';
import { DiskFixtureLoader, MemoryLoader } from '../src/api/loader.js';
import type { InstitutionRecord } from '../src/types.js';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

interface CliArgs {
  fixtures: string;
  port: number;
  host: string;
  webRoot: string;
  contentRoot: string;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {
    fixtures: 'data/build/output/by_unitid',
    port: 8787,
    host: '127.0.0.1',
    webRoot: 'web',
    contentRoot: 'content',
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

function buildLoader(fixtures: string) {
  const dir = resolve(fixtures);
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    const loader = new DiskFixtureLoader(dir);
    process.stderr.write(
      `Loaded ${loader.count()} institutions from ${dir}.\n`,
    );
    return loader;
  }
  const sample = resolve('tests/fixtures/sample-institution.json');
  if (!existsSync(sample)) {
    throw new Error(
      `Neither ${dir} nor ${sample} exists. Run the Python build pipeline or supply --fixtures.`,
    );
  }
  const record = JSON.parse(readFileSync(sample, 'utf8')) as InstitutionRecord;
  process.stderr.write(
    `Fallback: loaded fixture from ${sample} (UNITID ${record.unitid}, ${record.instnm}).\n`,
  );
  return new MemoryLoader([record]);
}

function safeJoin(root: string, requested: string): string | null {
  // Strip query/hash and decode percent-encoding.
  const decoded = decodeURIComponent(requested);
  const joined = normalize(join(root, decoded));
  if (!joined.startsWith(root)) return null;
  return joined;
}

function serveStatic(
  res: ServerResponse,
  filePath: string,
): boolean {
  if (!existsSync(filePath)) return false;
  const st = statSync(filePath);
  if (!st.isFile()) return false;
  const body = readFileSync(filePath);
  const ext = extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
  return true;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const loader = buildLoader(args.fixtures);
  const apiRoute = buildRouter({ loader });

  const webRoot = resolve(args.webRoot);
  const contentRoot = resolve(args.contentRoot);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    // API routes — delegate to the Phase 2 router.
    if (path.startsWith('/api/')) {
      apiRoute(req, res).catch((err: unknown) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message } }));
      });
      return;
    }

    // Only GET/HEAD past this point.
    if (method !== 'GET' && method !== 'HEAD') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET, HEAD');
      res.end();
      return;
    }

    // /content/* → repo content/ (panels + citations.json).
    if (path.startsWith('/content/')) {
      const candidate = safeJoin(contentRoot, path.replace(/^\/content\//, ''));
      if (candidate !== null && serveStatic(res, candidate)) return;
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    // / → /index.html
    const requested = path === '/' ? '/index.html' : path;
    const candidate = safeJoin(webRoot, requested.replace(/^\//, ''));
    if (candidate !== null && serveStatic(res, candidate)) return;

    res.statusCode = 404;
    res.end('Not found');
  });

  server.listen(args.port, args.host, () => {
    const addr = server.address();
    const port = typeof addr === 'object' && addr !== null ? addr.port : args.port;
    process.stderr.write(`Dev server: http://${args.host}:${port}/\n`);
    process.stderr.write(`  UI:       http://${args.host}:${port}/index.html\n`);
    process.stderr.write(`  API:      http://${args.host}:${port}/api/v1/health\n`);
    process.stderr.write(`  Content:  http://${args.host}:${port}/content/citations.json\n`);
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`startup failed: ${(err as Error).message ?? String(err)}\n`);
  process.exit(1);
});
