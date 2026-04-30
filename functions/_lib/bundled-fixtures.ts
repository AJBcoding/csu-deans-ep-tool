// Per-institution fixtures bundled into the Worker.
//
// Each Worker invocation rebuilds the MemoryLoader from this list. To add an
// institution to the live deployment, add its JSON file under
// data/build/output/by_unitid/, then import + push it into BUNDLED_INSTITUTIONS
// here. Workers bundle size limit applies (1 MB compressed on the free tier),
// so the goal is "demo set," not "every institution in the dataset."
//
// The build pipeline (data/build/build_fixtures.py + co.) produces these
// JSONs; for Phase 5 we ship the CSULB record from tests/fixtures/ which is
// the spec §0 acceptance institution (UNITID 110583).

import csulb from '../../tests/fixtures/sample-institution.json';
import type { InstitutionRecord } from '../../src/types.js';

export const BUNDLED_INSTITUTIONS: readonly InstitutionRecord[] = [
  csulb as InstitutionRecord,
];
