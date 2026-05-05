// Pure-function renderer — turns an AnalysisResult (per Phase 2 contract)
// into HTML strings. All Dean-facing strings live here (or come from
// engine output) and must lint clean against content/glossary.json.
//
// Drill-in is collapsed by default per spec §7.3.

export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPct(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatInt(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US');
}

const NOT_MEASURED_REASON_TEXT = {
  out_of_scope:
    'The program is not in the federal earnings-premium test scope (e.g. credential level not listed in § 84001).',
  privacy_suppressed:
    'The Department published a privacy suppression on the underlying earnings cell. No median is released.',
  earnings_below_floor:
    'The number of qualifying graduates with reportable IRS earnings is below the 16-reporter floor in proposed § 668.404(d).',
  cohort_below_floor:
    'After all four expansion stages, the qualifying-graduate count remains under 30. Proposed § 668.403(d)(1) directs no median be published.',
  b16_invisible_to_ppd:
    'The Department does not publish a row for this program at this institution. The expansion machinery never ran. The IPEDS Completions submission and the published dataset disagree on whether this program exists at this campus; institutional research review is warranted.',
};

function renderRuleList(rules) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return '<p class="rule-list-empty">No rules fired for this program.</p>';
  }
  const items = rules
    .map((r) => {
      const note =
        typeof r.note === 'string' && r.note.length > 0
          ? `<span class="rule-note">${escapeHtml(r.note)}</span>`
          : '';
      const dataStatus =
        typeof r.data_status === 'string' && r.data_status.length > 0
          ? ` <span class="rule-data-status">[${escapeHtml(r.data_status)}]</span>`
          : '';
      return `<li>
        <span class="rule-id">${escapeHtml(r.id)}</span>
        <span class="rule-title">${escapeHtml(r.title)}</span>${dataStatus}
        <span class="rule-citation">${escapeHtml(r.citation)} · ${escapeHtml(r.m_doc)}</span>
        ${note}
      </li>`;
    })
    .join('');
  return `<ul class="rule-list">${items}</ul>`;
}

function renderPanelTriggerList(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  const links = ids
    .map(
      (id) =>
        `<a class="panel-link" href="#panel-${escapeHtml(id)}" data-panel-target="${escapeHtml(id)}">${escapeHtml(id)}</a>`,
    )
    .join('');
  return `<div class="panel-trigger-list" aria-label="Panels triggered by this program">${links}</div>`;
}

export function renderVerdictCard(program) {
  const verdict = program.verdict;
  const noiseFired = program.noise_band && program.noise_band.fired === true;
  const dataAttrs = [
    `data-verdict="${escapeHtml(verdict)}"`,
    `data-cip4="${escapeHtml(program.cip4)}"`,
    `data-credlev="${escapeHtml(program.credlev)}"`,
    `data-noise-band="${noiseFired ? 'true' : 'false'}"`,
  ].join(' ');

  const figures = `
    <div class="figures" aria-label="Verdict figures">
      <span class="label">Cohort (n)</span>
      <span class="value">${formatInt(program.cohort_count)}</span>
      <span class="label">Median earnings, year-4</span>
      <span class="value">${formatMoney(program.median_earn_p4)}</span>
      <span class="label">Benchmark (${escapeHtml(program.benchmark_route)})</span>
      <span class="value">${formatMoney(program.benchmark)}</span>
      <span class="label">Gap to benchmark</span>
      <span class="value">${formatPct(program.ep_gap_pct)}</span>
    </div>
  `;

  const noiseBandNote =
    noiseFired && typeof program.noise_band.message === 'string'
      ? `<p class="noise-band-note">${escapeHtml(program.noise_band.message)}</p>`
      : '';

  const notMeasuredNote =
    verdict === 'NOT MEASURED' && program.not_measured_reason
      ? `<p class="not-measured-note"><strong>Reason:</strong> ${escapeHtml(
          NOT_MEASURED_REASON_TEXT[program.not_measured_reason] ??
            program.not_measured_reason,
        )}</p>`
      : '';

  const xv =
    program.cross_validation && program.cross_validation.status === 'disagree'
      ? `<p class="xv-note"><strong>Cross-validation:</strong> the tool's re-derivation reads ${escapeHtml(
          program.cross_validation.tool,
        )}; the Department's published verdict reads ${escapeHtml(
          program.cross_validation.ppd ?? '—',
        )}.</p>`
      : '';

  const derivationLabel = {
    ppd_published_authoritative:
      'Verdict carried by AHEAD\'s published per-cell flag (regulatory-authoritative; cp-wssr override).',
    tool_re_derived:
      'Verdict computed by this tool from PPD-published earnings + benchmark; AHEAD did not publish a flag.',
    not_measured: 'Insufficient inputs — no verdict possible. See reason above.',
  };
  const derivation = program.derivation_basis
    ? `<p class="derivation-basis"><strong>Verdict basis:</strong> ${escapeHtml(
        derivationLabel[program.derivation_basis] ?? program.derivation_basis,
      )}</p>`
    : '';

  const recipe = program.verification_recipe
    ? renderVerificationRecipe(program.verification_recipe)
    : '';

  return `
    <article class="verdict-card" ${dataAttrs}>
      <div class="program-line">
        <h3 class="program-title">${escapeHtml(program.cip4_title)}</h3>
        <span class="program-meta">CIP ${escapeHtml(program.cip4)} · ${escapeHtml(program.credlev)}</span>
        <span class="verdict-tag">${escapeHtml(verdict)}</span>
      </div>
      ${figures}
      ${noiseBandNote}
      ${notMeasuredNote}
      ${xv}
      ${derivation}
      ${renderPanelTriggerList(program.panels_triggered)}
      <details class="drill-in">
        <summary>Why this verdict — rules fired</summary>
        ${renderRuleList(program.rules_fired)}
      </details>
      ${recipe}
    </article>
  `;
}

export function renderVerificationRecipe(recipe) {
  if (!recipe) return '';
  const fields = (recipe.source_fields ?? [])
    .map((f) => `<li>${escapeHtml(f)}</li>`)
    .join('');
  const steps = (recipe.steps ?? [])
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');
  return `
    <details class="verification-recipe">
      <summary>How to reproduce this number — verification recipe</summary>
      <dl>
        <dt>Source data</dt><dd>${escapeHtml(recipe.source_data)}</dd>
        <dt>Source grain</dt><dd>${escapeHtml(recipe.source_grain)}</dd>
        <dt>Engine reference</dt><dd><code>${escapeHtml(recipe.engine_reference)}</code></dd>
      </dl>
      <p><strong>Source fields:</strong></p>
      <ul class="recipe-fields">${fields}</ul>
      <p><strong>Steps:</strong></p>
      <ol class="recipe-steps">${steps}</ol>
      <p class="recipe-attribution">
        We are not attorneys or legislative analysts. Independently verify
        every number against the source-data and engine code above.
      </p>
    </details>
  `;
}

export function renderIntegrityEnvelope(env) {
  if (!env) return '';
  const s = env.data_status_summary ?? {
    fully_measured: 0,
    ppd_suppressed: 0,
    irs_below_floor: 0,
    cohort_below_floor: 0,
    out_of_scope: 0,
  };
  return `
    <section class="integrity-envelope" aria-label="What the dataset can and cannot tell you">
      <h2>What the dataset can and cannot tell you</h2>
      <dl>
        <dt>Build date</dt><dd>${escapeHtml(env.build_date)}</dd>
        <dt>Federal data release</dt><dd>${escapeHtml(env.ppd_release)}</dd>
        <dt>Programs measured end-to-end</dt><dd>${formatInt(s.fully_measured)}</dd>
        <dt>Programs with privacy suppression on earnings</dt><dd>${formatInt(s.ppd_suppressed)}</dd>
        <dt>Programs below the 16-reporter floor</dt><dd>${formatInt(s.irs_below_floor)}</dd>
        <dt>Programs below the 30-graduate floor</dt><dd>${formatInt(s.cohort_below_floor)}</dd>
        <dt>Programs out of scope</dt><dd>${formatInt(s.out_of_scope)}</dd>
        <dt>Verdicts within the noise band</dt><dd>${formatInt(env.noise_band_advisories_count)}</dd>
        <dt>Disagreements with the Department's pre-computed verdict</dt><dd>${formatInt(env.cross_validation_disagreements)}</dd>
      </dl>
      <p class="primary-source-reminder">${escapeHtml(env.primary_source_reminder)}</p>
      ${
        typeof env.simulation_framing === 'string' && env.simulation_framing.length > 0
          ? `<p class="simulation-framing"><strong>Simulation framing:</strong> ${escapeHtml(env.simulation_framing)}</p>`
          : ''
      }
      ${
        typeof env.expertise_disclaimer === 'string' && env.expertise_disclaimer.length > 0
          ? `<p class="expertise-disclaimer"><strong>About this tool:</strong> ${escapeHtml(env.expertise_disclaimer)}</p>`
          : ''
      }
    </section>
  `;
}

export function renderCrossValidationBanner(banner) {
  if (typeof banner !== 'string' || banner.length === 0) return '';
  return `<aside class="cross-validation-banner" role="alert">${escapeHtml(banner)}</aside>`;
}

export function renderHiddenPrograms(hidden) {
  if (!hidden) return '';
  if (hidden.available === true && Array.isArray(hidden.programs) && hidden.programs.length > 0) {
    const rows = hidden.programs
      .map(
        (h) => `
          <tr>
            <td>${escapeHtml(h.cip6)}</td>
            <td>${escapeHtml(h.title)}</td>
            <td>${escapeHtml(h.credlev)}</td>
            <td>${escapeHtml(h.cohort_range_label)}</td>
          </tr>`,
      )
      .join('');
    return `
      <section class="hidden-programs" aria-label="Programs the cohort expansion would pool in">
        <h2>Programs the rule's expansion would pool in</h2>
        <table>
          <thead><tr><th>CIP6</th><th>Title</th><th>Credential</th><th>Cohort range</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="provenance">${escapeHtml(hidden.provenance)}</p>
      </section>
    `;
  }
  const note = typeof hidden.parametric_note === 'string' ? hidden.parametric_note : '';
  return `
    <section class="hidden-programs hidden-programs--parametric" aria-label="Hidden-program surfacer (parametric)">
      <h2>Programs the rule's expansion would pool in</h2>
      <p>${escapeHtml(note)}</p>
      <p class="provenance">${escapeHtml(hidden.provenance ?? '')}</p>
    </section>
  `;
}

/**
 * Render the auto-triggered panels region. Each panel HTML body comes from
 * loadPanel(); this function composes the trigger reason header above each.
 */
export function renderAutoPanelsRegion(panels, panelBodyById) {
  if (!Array.isArray(panels) || panels.length === 0) return '';
  const blocks = panels
    .map((p) => {
      const body = panelBodyById[p.id] ?? '';
      const reason =
        typeof p.trigger_reason === 'string' && p.trigger_reason.length > 0
          ? `<p class="panel-trigger-reason">${escapeHtml(p.trigger_reason)}</p>`
          : '';
      return `<div class="panel-block" id="panel-${escapeHtml(p.id)}">
        ${reason}
        ${body}
      </div>`;
    })
    .join('');
  return `
    <section class="panels-region auto-panels-region" aria-label="Why these verdicts — rule mechanics">
      <h2>Why these verdicts — rule mechanics</h2>
      ${blocks}
    </section>
  `;
}

const LEARN_MORE_TITLES = {
  M02: 'How earnings are measured',
  M06: 'Institution-level consequences',
  M08: 'OBBBA loan-cap interactions',
  M09: 'Appeal pathways',
  M10: 'Authority architecture and litigation posture',
  M11: 'Administrative compliance',
  M15: 'Strategic response scenarios',
  M17: 'Borrower-defense and closed-school discharge timing',
};

export function renderLearnMoreRegion(panelBodyById, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return '';
  const blocks = ids
    .map((id) => {
      const body = panelBodyById[id] ?? '';
      if (body === '') return '';
      const summary = LEARN_MORE_TITLES[id] ?? id;
      return `
        <details id="panel-${escapeHtml(id)}">
          <summary>${escapeHtml(id)} — ${escapeHtml(summary)}</summary>
          ${body}
        </details>
      `;
    })
    .join('');
  return `
    <section class="panels-region learn-more-region" aria-label="Learn more">
      <h2>Learn more</h2>
      ${blocks}
    </section>
  `;
}

/** Top-level: render the full result region for an AnalysisResult. */
export function renderResult(result, panelBodyById = {}, learnMoreIds = []) {
  const xvBanner = renderCrossValidationBanner(result.cross_validation_banner);
  const integrity = renderIntegrityEnvelope(result.integrity_envelope);
  const cards = result.programs.map(renderVerdictCard).join('');
  const hidden = renderHiddenPrograms(result.hidden_programs);
  const autoPanels = renderAutoPanelsRegion(result.panels, panelBodyById);
  const learnMore = renderLearnMoreRegion(panelBodyById, learnMoreIds);

  return `
    <header class="result-header">
      <h2>${escapeHtml(result.instnm)} <small>UNITID ${escapeHtml(result.unitid)} · ${escapeHtml(result.stabbr)}</small></h2>
    </header>
    ${xvBanner}
    ${integrity}
    <section class="program-results" aria-label="Program verdicts">
      <h2>Program verdicts</h2>
      ${cards.length > 0 ? cards : '<p>No programs returned for this query.</p>'}
    </section>
    ${hidden}
    ${autoPanels}
    ${learnMore}
    <p class="primary-source-reminder result-footer-reminder">${escapeHtml(result.footer_reminder)}</p>
  `;
}
