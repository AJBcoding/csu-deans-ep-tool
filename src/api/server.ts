// Persona C public API server — minimal Node `http` listener routing to the
// pure handlers in `./handlers.ts`.
//
// Tech-stack constraint (spec §9): static site + thin API. No Express,
// Fastify, or other framework dependencies. The router is hand-rolled,
// the body parser is hand-rolled, the result is ~100 lines and zero
// runtime deps beyond Node stdlib.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import {
  handleAnalysisGet,
  handleAnalysisPost,
  handleHealth,
  handleInstitutionMetadata,
  handleInstitutionsList,
  handleMethodNotAllowed,
  handleNotFound,
  handlePanelBody,
  handlePanelsManifest,
  type HandlerResult,
} from './handlers.js';
import {
  API_SCHEMA_VERSION,
  type ApiErrorResponse,
  type FixtureLoader,
} from './contract.js';
import { PRIMARY_SOURCE_REMINDER } from '../citations.js';

export interface ServerOptions {
  loader: FixtureLoader;
  /** Override the timestamp used in `emitted_at` (tests need determinism). */
  now?: () => string;
  /** When true, log each request line to stderr. Default false. */
  log?: boolean;
}

const ALLOWED_ORIGIN = '*';
const MAX_BODY_BYTES = 64 * 1024; // 64KB — Persona-A queried-CIPs bodies are tiny.

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function writeJson(res: ServerResponse, result: HandlerResult): void {
  setCorsHeaders(res);
  res.statusCode = result.status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.end(JSON.stringify(result.body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error(`Request body exceeded ${MAX_BODY_BYTES} bytes`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function buildRouter(options: ServerOptions) {
  const { loader, now = () => new Date().toISOString() } = options;

  return async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;

    if (options.log === true) {
      process.stderr.write(`${method} ${path}${url.search}\n`);
    }

    if (method === 'OPTIONS') {
      setCorsHeaders(res);
      res.statusCode = 204;
      res.end();
      return;
    }

    // GET /api/v1/health
    if (path === '/api/v1/health') {
      if (method !== 'GET') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      writeJson(res, handleHealth(loader));
      return;
    }

    // GET /api/v1/institutions
    if (path === '/api/v1/institutions') {
      if (method !== 'GET') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      const q = url.searchParams.get('q') ?? undefined;
      const limit = url.searchParams.get('limit') ?? undefined;
      const state = url.searchParams.get('state') ?? undefined;
      writeJson(
        res,
        handleInstitutionsList(loader, {
          ...(q !== undefined ? { q } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(state !== undefined ? { state } : {}),
        }),
      );
      return;
    }

    // GET /api/v1/institutions/:unitid
    const instMatch = path.match(/^\/api\/v1\/institutions\/([^/]+)$/);
    if (instMatch !== null) {
      if (method !== 'GET') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      writeJson(res, handleInstitutionMetadata(loader, instMatch[1]!));
      return;
    }

    // GET /api/v1/analysis/:unitid
    const analysisGetMatch = path.match(/^\/api\/v1\/analysis\/([^/]+)$/);
    if (analysisGetMatch !== null) {
      if (method !== 'GET') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      writeJson(res, handleAnalysisGet(loader, analysisGetMatch[1]!, now()));
      return;
    }

    // POST /api/v1/analysis
    if (path === '/api/v1/analysis') {
      if (method !== 'POST') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      try {
        const raw = await readBody(req);
        const parsed = raw === '' ? {} : JSON.parse(raw);
        writeJson(res, handleAnalysisPost(loader, parsed, now()));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const errBody: ApiErrorResponse = {
          api_schema_version: API_SCHEMA_VERSION,
          error: { code: 'BAD_REQUEST', message },
          footer_reminder: PRIMARY_SOURCE_REMINDER,
        };
        writeJson(res, { status: 400, body: errBody });
      }
      return;
    }

    // GET /api/v1/panels
    if (path === '/api/v1/panels') {
      if (method !== 'GET') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      writeJson(res, handlePanelsManifest());
      return;
    }

    // GET /api/v1/panels/:id
    const panelMatch = path.match(/^\/api\/v1\/panels\/([^/]+)$/);
    if (panelMatch !== null) {
      if (method !== 'GET') {
        writeJson(res, handleMethodNotAllowed(method, path));
        return;
      }
      writeJson(res, handlePanelBody(panelMatch[1]!));
      return;
    }

    writeJson(res, handleNotFound(path));
  };
}

export interface RunningServer {
  address: { port: number; host: string };
  close(): Promise<void>;
}

export async function startServer(
  options: ServerOptions & { port?: number; host?: string },
): Promise<RunningServer> {
  const port = options.port ?? 0;
  const host = options.host ?? '127.0.0.1';
  const route = buildRouter(options);
  const server = createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      // Last-resort 500 handler — handlers should never throw, but if they do,
      // surface the error envelope rather than crashing the listener.
      const message = err instanceof Error ? err.message : 'Unknown error';
      const errBody: ApiErrorResponse = {
        api_schema_version: API_SCHEMA_VERSION,
        error: { code: 'INTERNAL_ERROR', message },
        footer_reminder: PRIMARY_SOURCE_REMINDER,
      };
      setCorsHeaders(res);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(errBody));
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const addr = server.address();
      if (typeof addr !== 'object' || addr === null) {
        reject(new Error('Failed to obtain server address'));
        return;
      }
      resolve({
        address: { port: addr.port, host: addr.address },
        close: () =>
          new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => (err ? rejectClose(err) : resolveClose()));
          }),
      });
    });
  });
}
