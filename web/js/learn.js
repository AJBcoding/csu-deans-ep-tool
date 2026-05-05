// learn.js — Mechanism Library page (cp-j0gw.9 + .10)
// Loads each M-doc HTML inline and wires the reading-depth toggle.

const PANEL_ORDER = [
  'M01', 'M03', 'M04', 'M07',
  'M05', 'M06', 'M18',
  'M12', 'M13', 'M14',
  'M02', 'M08', 'M09', 'M10', 'M11', 'M15', 'M17',
];

const DEPTH_KEY = 'csu-ep-tool:reading-depth';
const VALID_DEPTHS = new Set(['brief', 'standard', 'detail']);

async function loadPanel(id) {
  // In dev-server: /content/mdocs/* served from <repo>/content/mdocs/*.
  // In dist-pages build: content/ is copied alongside web/ outputs.
  const res = await fetch(`./content/mdocs/${id}.html`);
  if (!res.ok) {
    throw new Error(`Failed to load ${id}: HTTP ${res.status}`);
  }
  return await res.text();
}

async function renderPanels() {
  const region = document.getElementById('panel-region');
  if (!region) return;
  region.innerHTML = '';
  const fragments = await Promise.all(
    PANEL_ORDER.map(async (id) => {
      try {
        const html = await loadPanel(id);
        return `<div id="panel-${id}" class="panel-block">${html}</div>`;
      } catch (err) {
        return `<div id="panel-${id}" class="panel-block panel-error">Could not load ${id} — ${String(err)}</div>`;
      }
    }),
  );
  region.innerHTML = fragments.join('\n');
}

function applyDepth(depth) {
  if (!VALID_DEPTHS.has(depth)) return;
  document.body.setAttribute('data-depth', depth);
  try {
    localStorage.setItem(DEPTH_KEY, depth);
  } catch (e) {
    // localStorage unavailable (private mode) — ignore.
  }
  for (const input of document.querySelectorAll('.depth-toggle input[name="depth"]')) {
    input.checked = input.value === depth;
  }
}

function initDepthToggle() {
  let initial = 'standard';
  try {
    const stored = localStorage.getItem(DEPTH_KEY);
    if (stored && VALID_DEPTHS.has(stored)) initial = stored;
  } catch (e) {
    // ignore
  }
  applyDepth(initial);
  document.querySelectorAll('.depth-toggle input[name="depth"]').forEach((input) => {
    input.addEventListener('change', (ev) => {
      const target = ev.target;
      if (target instanceof HTMLInputElement && target.checked) {
        applyDepth(target.value);
      }
    });
  });
}

initDepthToggle();
renderPanels().catch((err) => {
  const region = document.getElementById('panel-region');
  if (region) {
    region.innerHTML = `<p class="panel-error">Failed to render mechanism panels — ${String(err)}</p>`;
  }
});
