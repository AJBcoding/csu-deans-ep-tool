// Cloudflare Pages Functions catch-all for /api/v1/* — wraps the Web Standards
// router (src/api/web-router.ts) into the Pages Functions onRequest signature.
//
// Bundle: only the fixtures bundled into _lib/bundled-fixtures.ts are visible
// at runtime; the dev server can read the full data/build/output/by_unitid
// directory but Workers can't touch the filesystem. We start with CSULB
// (UNITID 110583) — the spec §0 acceptance institution — and extend the
// bundle as the build pipeline produces additional per-institution fixtures.
//
// Cold-start cost: building the MemoryLoader from N bundled records is
// O(N) and runs once per Worker isolate, not per request.

import { routeRequest } from '../../../src/api/web-router.js';
import { MemoryLoader } from '../../../src/api/loader.js';
import { BUNDLED_INSTITUTIONS } from '../../_lib/bundled-fixtures.js';

let cachedLoader: MemoryLoader | null = null;

function getLoader(): MemoryLoader {
  if (cachedLoader === null) {
    cachedLoader = new MemoryLoader(BUNDLED_INSTITUTIONS);
  }
  return cachedLoader;
}

interface PagesContext {
  request: Request;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const loader = getLoader();
  return routeRequest(context.request, { loader });
};
