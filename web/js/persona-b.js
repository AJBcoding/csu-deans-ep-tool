// Persona B controller — UNITID auto-pull. Submits to GET /api/v1/analysis/:unitid.

import { getAnalysisByUnitid, ApiError } from './api.js';
import { loadCitations, hydrateCitations } from './citations.js';
import { loadPanel, autoTriggeredIds, learnMoreIds } from './panels.js';
import { renderResult } from './render.js';
import { mountPdfButton, defaultPrintFooter } from './pdf.js';

const form = document.getElementById('run-form');
const input = document.getElementById('unitid-input');
const status = document.getElementById('status-line');
const region = document.getElementById('result-region');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

async function loadPanelsForResult(result) {
  const auto = new Set(autoTriggeredIds());
  const triggeredAuto = (result.panels ?? [])
    .map((p) => p.id)
    .filter((id) => auto.has(id));
  const learnMore = learnMoreIds();

  const fetched = await Promise.all(
    [...triggeredAuto, ...learnMore].map(async (id) => {
      try {
        return [id, await loadPanel(id)];
      } catch {
        return [id, ''];
      }
    }),
  );
  const byId = Object.fromEntries(fetched);
  return { byId, learnMore };
}

async function run(unitid) {
  setStatus('Running deterministic analysis…');
  region.hidden = true;
  region.innerHTML = '';
  try {
    const [result, citations] = await Promise.all([
      getAnalysisByUnitid(unitid),
      loadCitations().catch(() => null),
    ]);
    const { byId, learnMore } = await loadPanelsForResult(result);
    region.innerHTML = renderResult(result, byId, learnMore);
    if (citations) hydrateCitations(region, citations);
    mountPdfButton(region, { printFooterText: defaultPrintFooter(result) });
    region.hidden = false;
    setStatus(
      `Showing ${result.programs.length} program${result.programs.length === 1 ? '' : 's'} for ${result.instnm}.`,
    );
    region.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    if (err instanceof ApiError) {
      setStatus(err.message, true);
    } else {
      setStatus(`Could not reach the analysis service: ${err.message}`, true);
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = input.value.trim();
  if (!/^[0-9]+$/.test(value)) {
    setStatus('UNITID must be numeric.', true);
    input.focus();
    return;
  }
  run(value);
});

const presetUnitid = new URLSearchParams(window.location.search).get('unitid');
if (presetUnitid !== null && /^[0-9]+$/.test(presetUnitid)) {
  input.value = presetUnitid;
  run(presetUnitid);
}
