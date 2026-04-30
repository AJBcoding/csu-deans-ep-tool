// Type declarations for web/js/citations.js.

export interface CitationEntry {
  mdoc?: string;
  convention?: string;
  title?: string;
  section_heading?: string;
  file?: string;
}

export interface CitationsBundle {
  map: Map<string, CitationEntry>;
  rules: Record<string, unknown>;
  raw: unknown;
}

export function setCitationsForTesting(json: unknown | null): void;
export function loadCitations(url?: string): Promise<CitationsBundle>;
export function lookupCitation(
  citations: CitationsBundle | null,
  key: string | null | undefined,
): CitationEntry | null;
export function hydrateCitations(
  rootEl: Element | { querySelectorAll(s: string): { forEach(cb: (a: unknown) => void): void } } | null,
  citations: CitationsBundle | null,
): number;
