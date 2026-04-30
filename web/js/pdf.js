// PDF export — invokes the browser's print pipeline against the result region.
//
// Determinism rationale (spec §0): window.print() rasterizes the existing DOM
// using the browser's deterministic layout + print engine. There is no LLM,
// no async inference, no random source. Same input record + same stylesheet
// produces the same PDF every time. This is the same code path Puppeteer /
// headless-Chromium uses server-side; we run it client-side because a) every
// dean has a browser, b) it preserves the no-server-cost posture for Persona
// A and B paths, and c) mobile Safari supports it via Share -> Save to Files.
//
// Spec §9 anchors enforced by the print stylesheet (web/css/main.css):
//   - verdict-card colorbands preserved
//   - rules_fired list forced open (citation is load-bearing per §0)
//   - snapshot metadata (build date, federal-data release, noise-band count,
//     cross-validation status) preserved
//   - primary_source_reminder + footer_reminder repeated on the printed page
//   - hidden chrome: site header, run-form, status line, panels region

/**
 * Inject a "Save as PDF" button at the top of the result region.
 * Idempotent: removes any existing toolbar before re-mounting so re-runs don't
 * accumulate buttons.
 *
 * @param {HTMLElement} resultRegion — the container that holds the rendered
 *   AnalysisResult (e.g., #result-region on persona-a / persona-b).
 * @param {object} [options]
 * @param {string} [options.label] — button label.
 * @param {string} [options.printFooterText] — optional text for the print-only
 *   footer (tool identifier + build provenance). Repeated on every printed
 *   page via the .pdf-print-footer class.
 */
export function mountPdfButton(resultRegion, options = {}) {
  if (!resultRegion) return;
  const label = options.label ?? 'Save as PDF';
  const footerText = options.printFooterText ?? '';

  const existing = resultRegion.querySelector('.pdf-toolbar');
  if (existing) existing.remove();
  const existingFooter = resultRegion.querySelector('.pdf-print-footer');
  if (existingFooter) existingFooter.remove();

  const toolbar = document.createElement('div');
  toolbar.className = 'pdf-toolbar';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pdf-button';
  button.textContent = label;
  button.setAttribute(
    'aria-label',
    'Save this analysis as a one-page PDF (opens the browser print dialog)',
  );
  button.addEventListener('click', () => {
    if (typeof window.print === 'function') {
      window.print();
    }
  });
  toolbar.appendChild(button);
  resultRegion.insertBefore(toolbar, resultRegion.firstChild);

  if (footerText !== '') {
    const footer = document.createElement('p');
    footer.className = 'pdf-print-footer';
    footer.textContent = footerText;
    resultRegion.appendChild(footer);
  }
}

/**
 * Build the standard print-only footer string from an AnalysisResult.
 * Surfaces the tool identifier, the institution context, and the data
 * provenance (build_date + ppd_release) so a printed PDF is self-identifying
 * even if it's separated from its URL.
 *
 * @param {object} result — AnalysisResult per Phase 2 contract.
 * @returns {string}
 */
export function defaultPrintFooter(result) {
  if (!result || typeof result !== 'object') return '';
  const env = result.integrity_envelope ?? {};
  const inst = result.instnm ?? '';
  const unitid = result.unitid ?? '';
  const stabbr = result.stabbr ?? '';
  const build = env.build_date ?? '';
  const release = env.ppd_release ?? '';
  const parts = [
    'CSU Deans EP Tool',
    inst !== '' ? `${inst} (UNITID ${unitid}${stabbr ? `, ${stabbr}` : ''})` : '',
    build !== '' ? `Build ${build}` : '',
    release !== '' ? `PPD ${release}` : '',
  ].filter((p) => p !== '');
  return parts.join(' · ');
}
