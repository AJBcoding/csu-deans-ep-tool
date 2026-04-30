// Type declarations for web/js/pdf.js.
// The runtime is plain ES module JS (zero-build static deploy); these
// declarations exist so TS test files and persona controllers can import
// the PDF helpers with type safety on the public surface.

export interface MountPdfButtonOptions {
  /** Override the button label. Defaults to "Save as PDF". */
  label?: string;
  /** Optional print-only footer string (tool/institution/build provenance). */
  printFooterText?: string;
}

export function mountPdfButton(
  resultRegion: HTMLElement | null,
  options?: MountPdfButtonOptions,
): void;

export function defaultPrintFooter(result: unknown): string;
