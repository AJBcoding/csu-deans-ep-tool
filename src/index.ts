// Public API — the single import surface for the rules engine.
//
// Consumers (the API server, tests, CLI) import from here. Internal modules
// are implementation detail and should not be reached for directly.

export {
  analyzeInstitution,
  analyzeQueriedPrograms,
  type QueriedProgram,
} from './engine.js';
export {
  PRIMARY_SOURCE_REMINDER,
  CITATIONS,
  M_DOCS,
} from './citations.js';
export {
  deriveToolVerdict,
  derivePpdVerdict,
  deriveSurfacedVerdict,
  deriveNotMeasuredReason,
  deriveCrossValidationStatus,
  isGraduateLevel,
  isUndergraduateLevel,
} from './verdict.js';
export { RULES, RULE_ORDER } from './rules.js';
export type {
  AnalysisResult,
  BenchmarkRoute,
  CrossValidation,
  Credlev,
  DataStatus,
  HiddenProgram,
  HiddenProgramSurface,
  InstitutionRecord,
  IntegrityEnvelope,
  NoiseBandAnnotation,
  NotMeasuredReason,
  PanelDescriptor,
  ProgramRecord,
  ProgramVerdict,
  RuleFire,
  SuppressionFlags,
  VerdictWord,
} from './types.js';
