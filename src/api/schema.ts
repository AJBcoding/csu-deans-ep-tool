// JSON Schema (draft 2020-12) describing the API contract.
//
// This is the runtime/wire contract for Persona C consumers. The TypeScript
// types in `contract.ts` are the engine-side source of truth; this module
// hand-mirrors them as JSON Schema so the contract is consumable by tools
// outside the TypeScript ecosystem (Python clients, OpenAPI generators,
// schema-diff CI checks, etc.).
//
// When the TS types change, update this schema in the same commit. The
// `tests/api/schema-parity.test.ts` test verifies the schema is structurally
// consistent with sample responses produced by the engine.

import { API_SCHEMA_VERSION } from './contract.js';

const $defs = {
  Credlev: {
    type: 'string',
    enum: [
      'Bachelor',
      "Master's",
      'Doctoral',
      'First Professional Degree',
      'Associate',
      'Undergrad Certificate',
      'Post-Bacc Certificate',
      'Graduate Certificate',
    ],
  },
  BenchmarkRoute: {
    type: 'string',
    enum: [
      'Same-State HS Median',
      'Same-State BA Median',
      'Same-State, Same-Field BA Median',
      'National HS Median',
      'National BA Median',
      'National Same-Field BA Median',
      'Tie for Lowest Test',
      'Not Listed in Section 84001',
    ],
  },
  VerdictWord: {
    type: 'string',
    enum: ['PASS', 'FAIL', 'NOT MEASURED'],
  },
  NotMeasuredReason: {
    type: 'string',
    enum: [
      'out_of_scope',
      'privacy_suppressed',
      'earnings_below_floor',
      'cohort_below_floor',
      'b16_invisible_to_ppd',
    ],
  },
  DataStatus: {
    type: 'string',
    enum: ['DET', 'PAR', 'ADV'],
  },
  CrossValidationStatus: {
    type: 'string',
    enum: [
      'agree',
      'disagree',
      'ppd-not-published',
      'tool-not-measured-ppd-published',
      'both-not-measured',
    ],
  },
  RuleFire: {
    type: 'object',
    required: ['id', 'title', 'citation', 'm_doc', 'data_status'],
    additionalProperties: false,
    properties: {
      id: { type: 'string', pattern: '^R[0-9]{2}$' },
      title: { type: 'string' },
      citation: { type: 'string' },
      m_doc: { type: 'string' },
      data_status: { $ref: '#/$defs/DataStatus' },
      note: { type: 'string' },
    },
  },
  NoiseBandAnnotation: {
    type: 'object',
    required: ['fired', 'provenance', 'message'],
    additionalProperties: false,
    properties: {
      fired: { type: 'boolean' },
      provenance: {
        oneOf: [
          { type: 'string', enum: ['gap_tool_derived', 'earnings_suppressed_ppd_published'] },
          { type: 'null' },
        ],
      },
      message: { type: ['string', 'null'] },
    },
  },
  CrossValidation: {
    type: 'object',
    required: ['tool', 'ppd', 'status'],
    additionalProperties: false,
    properties: {
      tool: { $ref: '#/$defs/VerdictWord' },
      ppd: { oneOf: [{ $ref: '#/$defs/VerdictWord' }, { type: 'null' }] },
      status: { $ref: '#/$defs/CrossValidationStatus' },
    },
  },
  ProgramVerdict: {
    type: 'object',
    required: [
      'cip4',
      'cip4_title',
      'credlev',
      'verdict',
      'cohort_count',
      'median_earn_p4',
      'benchmark',
      'benchmark_route',
      'ep_gap_pct',
      'not_measured_reason',
      'noise_band',
      'cross_validation',
      'rules_fired',
      'panels_triggered',
    ],
    additionalProperties: false,
    properties: {
      cip4: { type: 'string', pattern: '^[0-9]{4}$' },
      cip4_title: { type: 'string' },
      credlev: { $ref: '#/$defs/Credlev' },
      verdict: { $ref: '#/$defs/VerdictWord' },
      cohort_count: { type: ['integer', 'null'] },
      median_earn_p4: { type: ['number', 'null'] },
      benchmark: { type: ['number', 'null'] },
      benchmark_route: { $ref: '#/$defs/BenchmarkRoute' },
      ep_gap_pct: { type: ['number', 'null'] },
      not_measured_reason: {
        oneOf: [{ $ref: '#/$defs/NotMeasuredReason' }, { type: 'null' }],
      },
      noise_band: { $ref: '#/$defs/NoiseBandAnnotation' },
      cross_validation: { $ref: '#/$defs/CrossValidation' },
      rules_fired: {
        type: 'array',
        items: { $ref: '#/$defs/RuleFire' },
      },
      panels_triggered: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
  HiddenProgram: {
    type: 'object',
    required: ['cip6', 'title', 'credlev', 'cohort_range_label'],
    additionalProperties: false,
    properties: {
      cip6: { type: 'string' },
      title: { type: 'string' },
      credlev: { $ref: '#/$defs/Credlev' },
      cohort_range_label: { type: 'string' },
    },
  },
  HiddenProgramSurface: {
    type: 'object',
    required: ['available', 'programs', 'provenance', 'parametric_note'],
    additionalProperties: false,
    properties: {
      available: { type: 'boolean' },
      programs: { type: 'array', items: { $ref: '#/$defs/HiddenProgram' } },
      provenance: { type: 'string' },
      parametric_note: { type: ['string', 'null'] },
    },
  },
  PanelDescriptor: {
    type: 'object',
    required: ['id', 'm_doc', 'header', 'trigger_reason'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      m_doc: { type: 'string' },
      header: { type: 'string' },
      trigger_reason: { type: 'string' },
    },
  },
  IntegrityEnvelope: {
    type: 'object',
    required: [
      'build_date',
      'ppd_release',
      'noise_band_advisories_count',
      'cross_validation_disagreements',
      'data_status_summary',
      'primary_source_reminder',
      'simulation_framing',
      'expertise_disclaimer',
    ],
    additionalProperties: false,
    properties: {
      build_date: { type: 'string' },
      ppd_release: { type: 'string' },
      noise_band_advisories_count: { type: 'integer', minimum: 0 },
      cross_validation_disagreements: { type: 'integer', minimum: 0 },
      data_status_summary: {
        type: 'object',
        required: [
          'fully_measured',
          'ppd_suppressed',
          'irs_below_floor',
          'cohort_below_floor',
          'out_of_scope',
        ],
        additionalProperties: false,
        properties: {
          fully_measured: { type: 'integer', minimum: 0 },
          ppd_suppressed: { type: 'integer', minimum: 0 },
          irs_below_floor: { type: 'integer', minimum: 0 },
          cohort_below_floor: { type: 'integer', minimum: 0 },
          out_of_scope: { type: 'integer', minimum: 0 },
        },
      },
      primary_source_reminder: { type: 'string' },
      simulation_framing: { type: 'string' },
      expertise_disclaimer: { type: 'string' },
    },
  },
  AnalysisResultBase: {
    type: 'object',
    required: [
      'unitid',
      'instnm',
      'stabbr',
      'programs',
      'hidden_programs',
      'panels',
      'cross_validation_banner',
      'integrity_envelope',
      'footer_reminder',
    ],
    additionalProperties: false,
    properties: {
      unitid: { type: 'string' },
      instnm: { type: 'string' },
      stabbr: { type: 'string' },
      programs: { type: 'array', items: { $ref: '#/$defs/ProgramVerdict' } },
      hidden_programs: { $ref: '#/$defs/HiddenProgramSurface' },
      panels: { type: 'array', items: { $ref: '#/$defs/PanelDescriptor' } },
      cross_validation_banner: { type: ['string', 'null'] },
      integrity_envelope: { $ref: '#/$defs/IntegrityEnvelope' },
      footer_reminder: { type: 'string' },
    },
  },
  QueriedCip: {
    type: 'object',
    required: ['cip4', 'credlev'],
    additionalProperties: false,
    properties: {
      cip4: { type: 'string', pattern: '^[0-9]{4}$' },
      credlev: { $ref: '#/$defs/Credlev' },
    },
  },
  ApiError: {
    type: 'object',
    required: ['api_schema_version', 'error', 'footer_reminder'],
    additionalProperties: false,
    properties: {
      api_schema_version: { type: 'string' },
      error: {
        type: 'object',
        required: ['code', 'message'],
        additionalProperties: false,
        properties: {
          code: {
            type: 'string',
            enum: [
              'BAD_REQUEST',
              'UNITID_NOT_FOUND',
              'INVALID_QUERIED_CIPS',
              'INVALID_QUERY',
              'METHOD_NOT_ALLOWED',
              'NOT_FOUND',
              'INTERNAL_ERROR',
            ],
          },
          message: { type: 'string' },
          details: { type: 'object' },
        },
      },
      footer_reminder: { type: 'string' },
    },
  },
} as const;

export const API_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://csu-deans-ep-tool/api/v1/contract.schema.json',
  title: 'CSU Deans EP Tool — Persona C public API contract',
  description:
    `API schema version ${API_SCHEMA_VERSION}. Surfaces the response shapes for ` +
    'GET /api/v1/health, GET /api/v1/institutions, GET /api/v1/institutions/:unitid, ' +
    'GET /api/v1/analysis/:unitid, POST /api/v1/analysis, GET /api/v1/panels, ' +
    'GET /api/v1/panels/:id. Aligned with design.v6 §4-§7 (rules engine, response ' +
    'shape, integrity envelope) and Phase 1 (a) rules engine R01–R20.',
  type: 'object',
  $defs,
  oneOf: [
    { $ref: '#/$defs/AnalysisResultBase' },
    { $ref: '#/$defs/ApiError' },
  ],
  // Endpoint-specific response schemas, exposed for consumers that want
  // to validate one endpoint at a time.
  properties: {
    HealthResponse: {
      type: 'object',
      required: [
        'status',
        'api_schema_version',
        'api_path_version',
        'ppd_release',
        'build_date',
        'institutions_loaded',
      ],
      properties: {
        status: { const: 'ok' },
        api_schema_version: { type: 'string' },
        api_path_version: { type: 'string' },
        ppd_release: { type: 'string' },
        build_date: { type: 'string' },
        institutions_loaded: { type: 'integer', minimum: 0 },
      },
    },
    InstitutionsListResponse: {
      type: 'object',
      required: [
        'api_schema_version',
        'query',
        'total_matches',
        'results',
        'footer_reminder',
      ],
      properties: {
        api_schema_version: { type: 'string' },
        query: { type: 'string' },
        total_matches: { type: 'integer', minimum: 0 },
        results: {
          type: 'array',
          items: {
            type: 'object',
            required: ['unitid', 'instnm', 'stabbr', 'control', 'iclevel', 'n_programs'],
            properties: {
              unitid: { type: 'string' },
              instnm: { type: 'string' },
              stabbr: { type: 'string' },
              control: { type: 'integer' },
              iclevel: { type: 'integer' },
              n_programs: { type: 'integer', minimum: 0 },
            },
          },
        },
        footer_reminder: { type: 'string' },
      },
    },
    InstitutionMetadataResponse: {
      type: 'object',
      required: [
        'api_schema_version',
        'unitid',
        'instnm',
        'stabbr',
        'opeid6',
        'control',
        'iclevel',
        'sector',
        'ppd_release',
        'build_date',
        'n_programs',
        'programs_preview',
        'footer_reminder',
      ],
      properties: {
        api_schema_version: { type: 'string' },
        unitid: { type: 'string' },
        instnm: { type: 'string' },
        stabbr: { type: 'string' },
        opeid6: { type: 'string' },
        control: { type: 'integer' },
        iclevel: { type: 'integer' },
        sector: { type: 'integer' },
        ppd_release: { type: 'string' },
        build_date: { type: 'string' },
        n_programs: { type: 'integer', minimum: 0 },
        programs_preview: {
          type: 'array',
          items: {
            type: 'object',
            required: ['cip4', 'cip4_title', 'credlev'],
            properties: {
              cip4: { type: 'string' },
              cip4_title: { type: 'string' },
              credlev: { $ref: '#/$defs/Credlev' },
            },
          },
        },
        footer_reminder: { type: 'string' },
      },
    },
    AnalysisResponse: {
      allOf: [
        { $ref: '#/$defs/AnalysisResultBase' },
        {
          type: 'object',
          required: ['api_schema_version', 'request_persona', 'emitted_at', 'request_path'],
          properties: {
            api_schema_version: { type: 'string' },
            request_persona: { type: 'string', enum: ['persona_a', 'persona_b'] },
            emitted_at: { type: 'string' },
            request_path: { type: 'string' },
          },
        },
      ],
    },
    AnalysisPostRequest: {
      type: 'object',
      required: ['unitid'],
      properties: {
        unitid: { type: 'string', pattern: '^[0-9]+$' },
        queried_cips: {
          type: 'array',
          items: { $ref: '#/$defs/QueriedCip' },
        },
      },
    },
    PanelManifestResponse: {
      type: 'object',
      required: ['api_schema_version', 'panels', 'm16_deferred_note', 'footer_reminder'],
      properties: {
        api_schema_version: { type: 'string' },
        panels: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'trigger', 'm_doc', 'body_available'],
            properties: {
              id: { type: 'string' },
              trigger: { type: 'string', enum: ['auto', 'learn-more'] },
              m_doc: { type: 'string' },
              body_available: { type: 'boolean' },
            },
          },
        },
        m16_deferred_note: { type: 'string' },
        footer_reminder: { type: 'string' },
      },
    },
    PanelBodyResponse: {
      type: 'object',
      required: [
        'api_schema_version',
        'id',
        'trigger',
        'html',
        'body_available',
        'parametric_note',
        'footer_reminder',
      ],
      properties: {
        api_schema_version: { type: 'string' },
        id: { type: 'string' },
        trigger: { type: 'string', enum: ['auto', 'learn-more'] },
        html: { type: ['string', 'null'] },
        body_available: { type: 'boolean' },
        parametric_note: { type: ['string', 'null'] },
        footer_reminder: { type: 'string' },
      },
    },
  },
} as const;

export type ApiJsonSchema = typeof API_JSON_SCHEMA;
