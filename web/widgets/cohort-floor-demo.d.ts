// Type declarations for web/widgets/cohort-floor-demo.js (cp-j0gw.11).

export const FLOOR_MIN: 16;
export const FLOOR_MAX: 30;
export const FLOOR_DEFAULT: 30;

export interface SampleProgram {
  id: string;
  label: string;
  n: number;
  ahead_published: boolean;
}

export const SAMPLE_PROGRAMS: ReadonlyArray<SampleProgram>;

export type Verdict = 'MEASURED' | 'MEASURED_OVERRIDE' | 'NOT_MEASURED';

export function computeVerdict(
  program: { n?: number; ahead_published?: boolean } | null | undefined,
  floor: number,
): Verdict;

export interface FloorSummary<P = SampleProgram> {
  floor: number;
  measured: P[];
  override: P[];
  notMeasured: P[];
}

export function summarizeAt<P extends { n: number; ahead_published: boolean }>(
  programs: ReadonlyArray<P>,
  floor: number,
): FloorSummary<P>;

export interface FlipRecord<P = SampleProgram> {
  program: P;
  from: Verdict;
  to: Verdict;
}

export function detectFlips<P extends { n: number; ahead_published: boolean }>(
  programs: ReadonlyArray<P>,
  fromFloor: number,
  toFloor: number,
): Array<FlipRecord<P>>;

export function initCohortFloorDemo(
  rootEl: HTMLElement | null,
  programs?: ReadonlyArray<SampleProgram>,
): void;
