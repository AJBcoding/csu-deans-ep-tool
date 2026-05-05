// M01 cohort-floor demo widget — verdict-flip logic + DOM wiring.
//
// Model (cp-j0gw.11 spec):
//   - Slider chooses a cohort floor in the range [16, 30].
//   - 16 = the AHEAD count_wne_p4 single-window publication threshold.
//   - 30 = the OBBBA statutory floor for the pooled measurement cohort
//          (NPRM § 668.403(d)(1); HEA § 454(c)(4)(A)).
//   - For each illustrative program, the verdict at a given floor is:
//       MEASURED      if n >= floor
//       MEASURED      if n < floor AND ahead_published === true AND n >= 16
//                       (the cp-wssr AHEAD-published-flag override:
//                        when AHEAD already published a verdict in the
//                        16 <= n < 30 gap, the override honors it)
//       NOT MEASURED  otherwise
//
// The data set is illustrative and labeled as such on the page — no
// institution-specific completer counts.

export const FLOOR_MIN = 16;
export const FLOOR_MAX = 30;
export const FLOOR_DEFAULT = 30;

/** Illustrative programs (synthetic, labeled "illustrative" on the page). */
export const SAMPLE_PROGRAMS = Object.freeze([
  { id: 'p01', label: 'Program A — 4-yr, CIP 50.07',  n: 38, ahead_published: true  },
  { id: 'p02', label: 'Program B — 4-yr, CIP 50.05',  n: 32, ahead_published: true  },
  { id: 'p03', label: 'Program C — 4-yr, CIP 50.06',  n: 28, ahead_published: true  },
  { id: 'p04', label: 'Program D — 4-yr, CIP 50.07',  n: 25, ahead_published: true  },
  { id: 'p05', label: 'Program E — 4-yr, CIP 50.09',  n: 22, ahead_published: true  },
  { id: 'p06', label: 'Program F — 4-yr, CIP 50.04',  n: 20, ahead_published: false },
  { id: 'p07', label: 'Program G — 4-yr, CIP 50.0102', n: 18, ahead_published: true  },
  { id: 'p08', label: 'Program H — 4-yr, CIP 50.10',  n: 17, ahead_published: false },
  { id: 'p09', label: 'Program I — 4-yr, CIP 50.0901', n: 16, ahead_published: true  },
  { id: 'p10', label: 'Program J — 4-yr, CIP 50.06',  n: 14, ahead_published: false },
  { id: 'p11', label: 'Program K — 4-yr, CIP 50.07',  n: 11, ahead_published: false },
  { id: 'p12', label: 'Program L — 4-yr, CIP 50.05',  n:  7, ahead_published: false },
]);

/**
 * Compute the verdict for one program at a given cohort floor.
 *
 * @param {{n:number, ahead_published:boolean}} program
 * @param {number} floor   integer in [FLOOR_MIN, FLOOR_MAX]
 * @returns {'MEASURED'|'MEASURED_OVERRIDE'|'NOT_MEASURED'}
 */
export function computeVerdict(program, floor) {
  if (!Number.isFinite(program?.n)) return 'NOT_MEASURED';
  if (program.n >= floor) return 'MEASURED';
  if (program.ahead_published === true && program.n >= FLOOR_MIN) {
    return 'MEASURED_OVERRIDE';
  }
  return 'NOT_MEASURED';
}

/**
 * Categorize all programs at a given floor into measured / override / not-measured.
 * @param {ReadonlyArray<{id:string,label:string,n:number,ahead_published:boolean}>} programs
 * @param {number} floor
 */
export function summarizeAt(programs, floor) {
  const measured = [];
  const override = [];
  const notMeasured = [];
  for (const p of programs) {
    const v = computeVerdict(p, floor);
    if (v === 'MEASURED') measured.push(p);
    else if (v === 'MEASURED_OVERRIDE') override.push(p);
    else notMeasured.push(p);
  }
  return { floor, measured, override, notMeasured };
}

/**
 * Detect programs whose verdict differs between two floor settings.
 * Returns an array of { program, from, to } records, ordered as in the input.
 */
export function detectFlips(programs, fromFloor, toFloor) {
  const flips = [];
  for (const p of programs) {
    const from = computeVerdict(p, fromFloor);
    const to = computeVerdict(p, toFloor);
    if (from !== to) flips.push({ program: p, from, to });
  }
  return flips;
}

/* ─── DOM wiring ───────────────────────────────────────────────────── */

const VERDICT_LABELS = {
  MEASURED: 'MEASURED',
  MEASURED_OVERRIDE: 'MEASURED (AHEAD override)',
  NOT_MEASURED: 'NOT MEASURED',
};

function renderProgramRow(program, verdict) {
  const row = document.createElement('li');
  row.className = `cf-row cf-${verdict.toLowerCase().replace(/_/g, '-')}`;
  row.innerHTML = `
    <span class="cf-row-label">${program.label}</span>
    <span class="cf-row-n">n=${program.n}</span>
    <span class="cf-row-verdict">${VERDICT_LABELS[verdict]}</span>
  `;
  return row;
}

function render(rootEl, summary) {
  const slot = rootEl.querySelector('[data-cf-list]');
  if (!slot) return;
  slot.innerHTML = '';
  for (const p of [...summary.measured, ...summary.override, ...summary.notMeasured]) {
    const v = computeVerdict(p, summary.floor);
    slot.appendChild(renderProgramRow(p, v));
  }
  const counters = rootEl.querySelector('[data-cf-counts]');
  if (counters) {
    counters.innerHTML = `
      <span class="cf-count cf-count-measured">${summary.measured.length} measured</span>
      <span class="cf-count cf-count-override">${summary.override.length} AHEAD override</span>
      <span class="cf-count cf-count-not-measured">${summary.notMeasured.length} not measured</span>
    `;
  }
  const floorLabel = rootEl.querySelector('[data-cf-floor]');
  if (floorLabel) floorLabel.textContent = String(summary.floor);
}

/**
 * Initialize the widget against a root element. Idempotent; safe to call once.
 * @param {HTMLElement} rootEl
 * @param {ReadonlyArray} programs
 */
export function initCohortFloorDemo(rootEl, programs = SAMPLE_PROGRAMS) {
  if (!rootEl) return;
  const slider = rootEl.querySelector('[data-cf-slider]');
  if (!slider) return;
  const apply = () => {
    const raw = Number(slider.value);
    const floor = Number.isFinite(raw)
      ? Math.min(FLOOR_MAX, Math.max(FLOOR_MIN, Math.round(raw)))
      : FLOOR_DEFAULT;
    render(rootEl, summarizeAt(programs, floor));
  };
  slider.addEventListener('input', apply);
  slider.addEventListener('change', apply);
  apply();
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const rootEl = document.querySelector('[data-cf-root]');
    if (rootEl) initCohortFloorDemo(rootEl);
  });
}
