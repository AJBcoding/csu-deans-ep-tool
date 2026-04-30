// Citations DB loader + case-insensitive lookup against
// content/citations.json (cp-0on.3 + cp-0on.3.1 namespace alignment).
//
// Two anchor conventions hydrate from the same map:
//   1. rule-internal anchors (e.g. M01#stage-1-rule)
//   2. panel-theme anchors    (e.g. M01#EXPANSION-LOGIC, stored uppercase)
// All consumers must normalize to uppercase before lookup.

let cached = null;

/** Allow tests to inject a citations object. */
export function setCitationsForTesting(json) {
  cached = json === null ? null : normalize(json);
}

function normalize(json) {
  const map = new Map();
  if (json && typeof json === 'object' && json.mdoc_anchors) {
    for (const key of Object.keys(json.mdoc_anchors)) {
      map.set(key.toUpperCase(), json.mdoc_anchors[key]);
    }
  }
  const rules = json && typeof json === 'object' && json.rules ? json.rules : {};
  return { map, rules, raw: json };
}

export async function loadCitations(url = './content/citations.json') {
  if (cached !== null) return cached;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Failed to load citations.json: ${response.status}`);
  }
  const json = await response.json();
  cached = normalize(json);
  return cached;
}

/** Case-insensitive lookup against mdoc_anchors. Returns null when absent. */
export function lookupCitation(citations, key) {
  if (citations === null || typeof key !== 'string') return null;
  return citations.map.get(key.toUpperCase()) ?? null;
}

/**
 * Hydrate every <a class="cite" data-cite="…"> within rootEl by setting
 * a `title` attribute (citation source-line) and an `href` (panel anchor).
 * Unresolved keys remain inert; their `href="#"` stays.
 */
export function hydrateCitations(rootEl, citations) {
  if (!rootEl || citations === null) return 0;
  const anchors = rootEl.querySelectorAll('a.cite[data-cite]');
  let resolved = 0;
  anchors.forEach((a) => {
    const key = a.getAttribute('data-cite');
    const entry = lookupCitation(citations, key);
    if (entry === null) return;
    if (typeof entry.title === 'string' && a.getAttribute('title') === null) {
      a.setAttribute('title', entry.title);
    }
    if (typeof entry.section_heading === 'string') {
      const existing = a.getAttribute('title');
      const note = `${entry.section_heading} (${entry.file ?? entry.mdoc ?? ''})`;
      a.setAttribute('title', existing !== null && existing !== '' ? existing : note);
    }
    resolved += 1;
  });
  return resolved;
}
