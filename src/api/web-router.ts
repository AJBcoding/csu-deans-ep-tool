// Web Standards API router — Request -> Response, no Node `http` dependency.
//
// This is the second of two router shapes for the same set of pure handlers:
//
//   • src/api/server.ts        Node `http` IncomingMessage / ServerResponse
//                              (used by scripts/dev-server.ts + Vitest server tests)
//
//   • src/api/web-router.ts    Web Standards Request / Response
//                              (used by Cloudflare Pages Functions; works on
//                              Workers, Bun, Deno, browsers — anything with the
//                              fetch API)
//
// Both delegate to the same pure handlers in handlers.ts. They are kept in
// lockstep by a shared route table contract surface — if you add an endpoint
// in one router, add it in the other and the handlers stay shared.
//
// The router is exported as a stand-alone async function rather than a
// builder closure so a Pages Functions handler can call it without keeping
// a long-lived loader instance per request (Workers re-instantiate the
// module per cold start; the loader is cheap to rebuild from the bundled
// fixture JSON, so we accept a fresh loader per call).

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

const ALLOWED_ORIGIN = '*';
const MAX_BODY_BYTES = 64 * 1024;

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonResponse(result: HandlerResult): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

function badRequestResponse(message: string): Response {
  const errBody: ApiErrorResponse = {
    api_schema_version: API_SCHEMA_VERSION,
    error: { code: 'BAD_REQUEST', message },
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
  return jsonResponse({ status: 400, body: errBody });
}

function internalErrorResponse(message: string): Response {
  const errBody: ApiErrorResponse = {
    api_schema_version: API_SCHEMA_VERSION,
    error: { code: 'INTERNAL_ERROR', message },
    footer_reminder: PRIMARY_SOURCE_REMINDER,
  };
  return jsonResponse({ status: 500, body: errBody });
}

export interface WebRouterOptions {
  loader: FixtureLoader;
  /** Override `emitted_at` for deterministic tests. */
  now?: () => string;
}

/**
 * Route a single Web Standards Request to the matching handler and return a
 * Response. Mirrors the route table in src/api/server.ts.
 */
export async function routeRequest(
  request: Request,
  options: WebRouterOptions,
): Promise<Response> {
  const { loader, now = () => new Date().toISOString() } = options;
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname;

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    if (path === '/api/v1/health') {
      if (method !== 'GET') return jsonResponse(handleMethodNotAllowed(method, path));
      return jsonResponse(handleHealth(loader));
    }

    if (path === '/api/v1/institutions') {
      if (method !== 'GET') return jsonResponse(handleMethodNotAllowed(method, path));
      const q = url.searchParams.get('q') ?? undefined;
      const limit = url.searchParams.get('limit') ?? undefined;
      const state = url.searchParams.get('state') ?? undefined;
      return jsonResponse(
        handleInstitutionsList(loader, {
          ...(q !== undefined ? { q } : {}),
          ...(limit !== undefined ? { limit } : {}),
          ...(state !== undefined ? { state } : {}),
        }),
      );
    }

    const instMatch = path.match(/^\/api\/v1\/institutions\/([^/]+)$/);
    if (instMatch !== null) {
      if (method !== 'GET') return jsonResponse(handleMethodNotAllowed(method, path));
      return jsonResponse(handleInstitutionMetadata(loader, instMatch[1]!));
    }

    const analysisGetMatch = path.match(/^\/api\/v1\/analysis\/([^/]+)$/);
    if (analysisGetMatch !== null) {
      if (method !== 'GET') return jsonResponse(handleMethodNotAllowed(method, path));
      return jsonResponse(handleAnalysisGet(loader, analysisGetMatch[1]!, now()));
    }

    if (path === '/api/v1/analysis') {
      if (method !== 'POST') return jsonResponse(handleMethodNotAllowed(method, path));
      const contentLength = Number.parseInt(
        request.headers.get('content-length') ?? '0',
        10,
      );
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return badRequestResponse(`Request body exceeded ${MAX_BODY_BYTES} bytes`);
      }
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) {
        return badRequestResponse(`Request body exceeded ${MAX_BODY_BYTES} bytes`);
      }
      let parsed: unknown;
      try {
        parsed = raw === '' ? {} : JSON.parse(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Invalid JSON';
        return badRequestResponse(message);
      }
      return jsonResponse(handleAnalysisPost(loader, parsed, now()));
    }

    if (path === '/api/v1/panels') {
      if (method !== 'GET') return jsonResponse(handleMethodNotAllowed(method, path));
      return jsonResponse(handlePanelsManifest());
    }

    const panelMatch = path.match(/^\/api\/v1\/panels\/([^/]+)$/);
    if (panelMatch !== null) {
      if (method !== 'GET') return jsonResponse(handleMethodNotAllowed(method, path));
      return jsonResponse(handlePanelBody(panelMatch[1]!));
    }

    return jsonResponse(handleNotFound(path));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return internalErrorResponse(message);
  }
}
