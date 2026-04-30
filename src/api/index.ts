// Public surface for the API layer — re-exports so consumers can import from
// '../src/api' rather than reaching into individual modules.

export {
  API_SCHEMA_VERSION,
  API_PATH_VERSION,
  PANEL_IDS,
  AUTO_TRIGGERED_PANELS,
  LEARN_MORE_PANELS,
} from './contract.js';
export type {
  AnalysisGetResponse,
  AnalysisPostRequest,
  AnalysisPostResponse,
  ApiErrorResponse,
  FixtureLoader,
  HealthResponse,
  InstitutionDirectoryEntry,
  InstitutionMetadataResponse,
  InstitutionsListRequest,
  InstitutionsListResponse,
  PanelBodyResponse,
  PanelId,
  PanelManifestEntry,
  PanelManifestResponse,
  ProgramPreview,
  QueriedCip,
} from './contract.js';

export { DiskFixtureLoader, MemoryLoader } from './loader.js';
export {
  handleAnalysisGet,
  handleAnalysisPost,
  handleHealth,
  handleInstitutionMetadata,
  handleInstitutionsList,
  handleMethodNotAllowed,
  handleNotFound,
  handlePanelBody,
  handlePanelsManifest,
  type HandlerResult,
} from './handlers.js';
export { buildRouter, startServer, type RunningServer, type ServerOptions } from './server.js';
