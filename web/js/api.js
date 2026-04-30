// Thin fetch wrapper around the Phase 2 API contract. Same-origin by default;
// override the base URL via ?api=… query string for cross-origin development.

const params = new URLSearchParams(window.location.search);
const API_BASE = params.get('api') ?? '/api/v1';

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function readJson(response) {
  const text = await response.text();
  if (text === '') return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function extractMessage(body, fallback) {
  if (body && typeof body === 'object' && 'error' in body && body.error) {
    const err = body.error;
    if (typeof err === 'object' && err && 'message' in err) {
      return String(err.message);
    }
  }
  return fallback;
}

/** Persona B path — auto-pull all PPD-published programs for a UNITID. */
export async function getAnalysisByUnitid(unitid) {
  const url = `${API_BASE}/analysis/${encodeURIComponent(unitid)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new ApiError(
      extractMessage(body, `Request failed: ${response.status}`),
      response.status,
      body,
    );
  }
  return body;
}

/** Persona A path — analyze a Dean-supplied (cip4, credlev) list. */
export async function postAnalysis(unitid, queriedCips) {
  const url = `${API_BASE}/analysis`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ unitid, queried_cips: queriedCips }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new ApiError(
      extractMessage(body, `Request failed: ${response.status}`),
      response.status,
      body,
    );
  }
  return body;
}
