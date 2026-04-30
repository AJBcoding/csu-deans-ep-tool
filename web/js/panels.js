// Panel loader — fetches pre-rendered M-doc panel HTML from
// content/mdocs/{id}.html and caches per session.

const AUTO_TRIGGERED = new Set([
  'M01', 'M03', 'M04', 'M05', 'M07', 'M12', 'M13', 'M14',
]);

const LEARN_MORE = ['M02', 'M06', 'M08', 'M09', 'M10', 'M11', 'M15', 'M17'];

const cache = new Map();
const overrides = new Map();

/** Test seam: inject a panel HTML body for a given id. */
export function setPanelForTesting(id, html) {
  if (html === null) overrides.delete(id);
  else overrides.set(id, html);
}

/** List the panel ids that are auto-triggered (8 total per spec §5). */
export function autoTriggeredIds() {
  return [...AUTO_TRIGGERED];
}

/** List the learn-more panel ids (8 total). */
export function learnMoreIds() {
  return [...LEARN_MORE];
}

export function isAutoTriggered(id) {
  return AUTO_TRIGGERED.has(id);
}

export async function loadPanel(id, basePath = './content/mdocs') {
  if (overrides.has(id)) return overrides.get(id);
  if (cache.has(id)) return cache.get(id);
  const url = `${basePath}/${id}.html`;
  const response = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!response.ok) {
    throw new Error(`Failed to load panel ${id}: ${response.status}`);
  }
  const html = await response.text();
  cache.set(id, html);
  return html;
}

export async function loadAllLearnMore(basePath) {
  return Promise.all(LEARN_MORE.map((id) => loadPanel(id, basePath)));
}
