// Persona A controller — Dean enters specific (cip4, credlev) pairs.

import { postAnalysis, ApiError } from './api.js';
import { loadCitations, hydrateCitations } from './citations.js';
import { loadPanel, autoTriggeredIds, learnMoreIds } from './panels.js';
import { renderResult } from './render.js';

const CREDLEVS = [
  'Bachelor',
  "Master's",
  'Doctoral',
  'First Professional Degree',
  'Associate',
  'Undergrad Certificate',
  'Post-Bacc Certificate',
  'Graduate Certificate',
];

const form = document.getElementById('run-form');
const input = document.getElementById('unitid-input');
const status = document.getElementById('status-line');
const region = document.getElementById('result-region');
const rowsContainer = document.getElementById('cip-rows');
const addRowBtn = document.getElementById('add-row');

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', isError);
}

function buildCipRow(initialCip = '', initialCredlev = 'Bachelor') {
  const row = document.createElement('div');
  row.className = 'cip-row';
  row.innerHTML = `
    <label>
      CIP-4
      <input
        type="text"
        class="cip4-input"
        inputmode="numeric"
        pattern="[0-9]{4}"
        maxlength="4"
        placeholder="e.g. 5006"
        value="${initialCip}"
      />
    </label>
    <label>
      Credential
      <select class="credlev-select">
        ${CREDLEVS.map(
          (c) => `<option value="${c}"${c === initialCredlev ? ' selected' : ''}>${c}</option>`,
        ).join('')}
      </select>
    </label>
    <button type="button" class="remove-row" aria-label="Remove this row">Remove</button>
  `;
  row.querySelector('.remove-row').addEventListener('click', () => {
    if (rowsContainer.querySelectorAll('.cip-row').length > 1) {
      row.remove();
    } else {
      setStatus('At least one program row is required.', true);
    }
  });
  return row;
}

addRowBtn.addEventListener('click', () => {
  rowsContainer.appendChild(buildCipRow());
});

rowsContainer.appendChild(buildCipRow());

function collectQueriedCips() {
  const rows = rowsContainer.querySelectorAll('.cip-row');
  const out = [];
  for (const row of rows) {
    const cip = row.querySelector('.cip4-input').value.trim();
    const credlev = row.querySelector('.credlev-select').value;
    if (cip === '') continue;
    if (!/^[0-9]{4}$/.test(cip)) {
      throw new Error(`CIP-4 must be exactly 4 digits — got "${cip}".`);
    }
    out.push({ cip4: cip, credlev });
  }
  return out;
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

async function run(unitid, queriedCips) {
  setStatus('Running deterministic analysis…');
  region.hidden = true;
  region.innerHTML = '';
  try {
    const [result, citations] = await Promise.all([
      postAnalysis(unitid, queriedCips),
      loadCitations().catch(() => null),
    ]);
    const { byId, learnMore } = await loadPanelsForResult(result);
    region.innerHTML = renderResult(result, byId, learnMore);
    if (citations) hydrateCitations(region, citations);
    region.hidden = false;
    setStatus(
      `Showing ${result.programs.length} queried program${result.programs.length === 1 ? '' : 's'} for ${result.instnm}.`,
    );
    region.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    if (err instanceof ApiError) {
      setStatus(err.message, true);
    } else {
      setStatus(err.message, true);
    }
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const unitid = input.value.trim();
  if (!/^[0-9]+$/.test(unitid)) {
    setStatus('UNITID must be numeric.', true);
    input.focus();
    return;
  }
  let queried;
  try {
    queried = collectQueriedCips();
  } catch (err) {
    setStatus(err.message, true);
    return;
  }
  if (queried.length === 0) {
    setStatus('Enter at least one CIP-4 to check.', true);
    return;
  }
  run(unitid, queried);
});
