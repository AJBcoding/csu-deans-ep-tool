// @vitest-environment happy-dom
//
// Phase 5 — PDF export contract tests.
//
// The PDF export pipeline is two parts:
//   (1) A "Save as PDF" button injected into the result region by pdf.js
//   (2) A @media print stylesheet in main.css that compresses the result
//       into a one-page printable artifact preserving spec §9 content.
//
// These tests exercise the static contract: the button exists, the print
// stylesheet has the spec §9 anchors, and the print footer string includes
// the load-bearing provenance fields. We don't drive a headless browser
// here (Vitest test, not e2e); the print rendering itself is the browser's
// deterministic responsibility once the CSS rules are correct.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mountPdfButton, defaultPrintFooter } from '../../web/js/pdf.js';

function readMainCss(): string {
  return readFileSync(
    resolve(__dirname, '..', '..', 'web', 'css', 'main.css'),
    'utf8',
  );
}

describe('pdf.js — mountPdfButton', () => {
  it('inserts a .pdf-toolbar with a button at the top of the region', () => {
    const region = document.createElement('section');
    region.innerHTML = '<p>existing content</p>';
    mountPdfButton(region);

    const toolbar = region.querySelector('.pdf-toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar!.parentElement).toBe(region);
    expect(region.firstChild).toBe(toolbar);

    const button = toolbar!.querySelector<HTMLButtonElement>('.pdf-button');
    expect(button).not.toBeNull();
    expect(button!.type).toBe('button');
    expect(button!.textContent).toBe('Save as PDF');
    expect(button!.getAttribute('aria-label')).toContain('PDF');
  });

  it('is idempotent — re-mounting replaces, does not duplicate', () => {
    const region = document.createElement('section');
    mountPdfButton(region);
    mountPdfButton(region);
    mountPdfButton(region);

    expect(region.querySelectorAll('.pdf-toolbar').length).toBe(1);
    expect(region.querySelectorAll('.pdf-print-footer').length).toBe(0);
  });

  it('appends the print-only footer when provided, not duplicated', () => {
    const region = document.createElement('section');
    mountPdfButton(region, { printFooterText: 'CSULB · Build 2026-04-29' });
    mountPdfButton(region, { printFooterText: 'CSULB · Build 2026-04-29' });

    const footers = region.querySelectorAll('.pdf-print-footer');
    expect(footers.length).toBe(1);
    expect(footers[0]!.textContent).toContain('CSULB');
    expect(footers[0]!.textContent).toContain('Build 2026-04-29');
  });

  it('clicking the button calls window.print()', () => {
    const region = document.createElement('section');
    document.body.appendChild(region);
    mountPdfButton(region);

    let printed = 0;
    const originalPrint = window.print;
    window.print = () => {
      printed += 1;
    };
    try {
      const button = region.querySelector<HTMLButtonElement>('.pdf-button');
      button!.click();
      expect(printed).toBe(1);
    } finally {
      window.print = originalPrint;
      region.remove();
    }
  });

  it('handles a null/missing region gracefully (no throw)', () => {
    expect(() => mountPdfButton(null as unknown as HTMLElement)).not.toThrow();
  });
});

describe('pdf.js — defaultPrintFooter', () => {
  it('includes the tool identifier, institution name+UNITID+state, build date, and PPD release', () => {
    const footer = defaultPrintFooter({
      instnm: 'California State University-Long Beach',
      unitid: '110583',
      stabbr: 'CA',
      integrity_envelope: {
        build_date: '2026-04-29',
        ppd_release: '2026',
      },
    });
    expect(footer).toContain('CSU Deans EP Tool');
    expect(footer).toContain('California State University-Long Beach');
    expect(footer).toContain('110583');
    expect(footer).toContain('CA');
    expect(footer).toContain('2026-04-29');
    expect(footer).toContain('2026');
  });

  it('returns empty string for null input', () => {
    expect(defaultPrintFooter(null)).toBe('');
    expect(defaultPrintFooter(undefined)).toBe('');
  });

  it('omits parts that are missing rather than rendering "undefined"', () => {
    const footer = defaultPrintFooter({ instnm: 'X', unitid: '1' });
    expect(footer).not.toContain('undefined');
  });
});

describe('print stylesheet — spec §9 contract anchors', () => {
  const css = readMainCss();

  it('declares an @media print block', () => {
    expect(css).toMatch(/@media\s+print/);
  });

  it('forces print-color-adjust so verdict colorbands survive printing', () => {
    expect(css).toMatch(/print-color-adjust:\s*exact/);
  });

  it('preserves verdict colorbands for FAIL / PASS / NOT MEASURED', () => {
    // The print block re-asserts background colors with !important so
    // browsers that strip backgrounds in print don't drop the colorband.
    const printBlock = css.slice(css.indexOf('@media print'));
    expect(printBlock).toMatch(/data-verdict="FAIL"/);
    expect(printBlock).toMatch(/data-verdict="PASS"/);
    expect(printBlock).toMatch(/data-verdict="NOT MEASURED"/);
  });

  it('forces the rules-fired drill-in OPEN in print (citations are load-bearing)', () => {
    const printBlock = css.slice(css.indexOf('@media print'));
    expect(printBlock).toMatch(/details\.drill-in/);
    expect(printBlock).toMatch(/display:\s*block\s*!important/);
  });

  it('keeps the integrity envelope visible (build_date / ppd_release are required output)', () => {
    const printBlock = css.slice(css.indexOf('@media print'));
    expect(printBlock).toMatch(/\.integrity-envelope/);
  });

  it('hides the "Save as PDF" toolbar in the printed output', () => {
    const printBlock = css.slice(css.indexOf('@media print'));
    const hideSection = printBlock.match(/[^}]*display:\s*none\s*!important/g);
    expect(hideSection).not.toBeNull();
    expect(hideSection!.some((s) => s.includes('.pdf-toolbar'))).toBe(true);
  });

  it('renders the print-only footer in print and hides it on screen', () => {
    expect(css).toMatch(/\.pdf-print-footer/);
    const screenBlock = css.slice(css.indexOf('@media screen'));
    expect(screenBlock).toMatch(/\.pdf-print-footer\s*{[^}]*display:\s*none/);
  });

  it('uses page-break-inside: avoid on verdict cards (no card splits across pages)', () => {
    const printBlock = css.slice(css.indexOf('@media print'));
    expect(printBlock).toMatch(/page-break-inside:\s*avoid/);
    expect(printBlock).toMatch(/break-inside:\s*avoid/);
  });
});
