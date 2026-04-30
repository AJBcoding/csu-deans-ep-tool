// Type declarations for web/js/render.js.
// The runtime is plain ES module JS (zero-build static deploy); these
// declarations exist so TS test files can import the renderer with type
// safety on the public surface.

export function escapeHtml(value: unknown): string;
export function renderVerdictCard(program: unknown): string;
export function renderIntegrityEnvelope(env: unknown): string;
export function renderCrossValidationBanner(banner: string | null): string;
export function renderHiddenPrograms(hidden: unknown): string;
export function renderAutoPanelsRegion(
  panels: ReadonlyArray<{ id: string; trigger_reason?: string }>,
  panelBodyById: Record<string, string>,
): string;
export function renderLearnMoreRegion(
  panelBodyById: Record<string, string>,
  ids: ReadonlyArray<string>,
): string;
export function renderResult(
  result: unknown,
  panelBodyById?: Record<string, string>,
  learnMoreIds?: ReadonlyArray<string>,
): string;
