# Persona C public API — contract v1.0.0

Public-data-only HTTP API for the CSU Deans EP Tool. Consumed by:

- **Persona A** UI (Dean enters known CIPs) — uses `POST /api/v1/analysis`.
- **Persona B** UI (Dean explores) — uses `GET /api/v1/analysis/:unitid`.
- **Persona C** programmatic clients (IR analysts, accreditor review staff,
  reproducibility scripts) — every endpoint here.

Spec anchor: design.v6 §1 personas, §3 rules engine, §4 response shape,
§5 mechanism panels, §7 verdict / drill-in / "What this means" screens,
§9 tech stack (static site + thin API).

## Hard constraints

| Constraint | Where enforced |
|---|---|
| Public data only in request path | No request-time external calls; engine runs over pre-built per-institution JSON. |
| No LLM at request time | The rules engine is pure deterministic functions. The API server has no LLM dependency. |
| No accounts / no auth | Stateless. UNITID + queried CIP list is the entire input surface. |
| Cite every rule output | Each `RuleFire` carries `citation` (NPRM § / IRC § / OBBBA §) and `m_doc` (M-doc anchor). |
| Footer reminder on every result page | `footer_reminder` field on every successful response. Also surfaced inside `integrity_envelope.primary_source_reminder`. |
| Mobile-readable | UI concern (Phase 3); API supplies the data layer. |

## Versioning

Two independent dimensions:

- **Path version** (`/api/v1/...`) — bumped on URL or routing changes.
- **Schema version** (`api_schema_version` field, currently `1.0.0`) —
  bumped on contract-breaking response-shape changes. Additive changes
  (new optional field, new enum value) keep the version.

A consumer that asserts `api_schema_version === '1.0.0'` is guaranteed
that every field documented below is present and types match.

## Determinism

Identical inputs produce byte-identical response bodies, modulo the
`emitted_at` timestamp on `/api/v1/analysis*`. Tests in
`tests/api/server.test.ts` enforce this.

## Endpoints

### `GET /api/v1/health`

Liveness + build metadata.

**Response 200**

```json
{
  "status": "ok",
  "api_schema_version": "1.0.0",
  "api_path_version": "v1",
  "ppd_release": "2026",
  "build_date": "2026-04-29",
  "institutions_loaded": 1
}
```

### `GET /api/v1/institutions?q=&limit=&state=`

Institution-picker for Persona A.1 / B.1.

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | string | `""` | Case-insensitive substring on institution name OR UNITID. |
| `limit` | int [1, 100] | 25 | Max results. |
| `state` | 2-letter postal | — | Filter to a single state. |

**Response 200**

```json
{
  "api_schema_version": "1.0.0",
  "query": "long beach",
  "total_matches": 1,
  "results": [
    {
      "unitid": "110583",
      "instnm": "California State University-Long Beach",
      "stabbr": "CA",
      "control": 1,
      "iclevel": 1,
      "n_programs": 194
    }
  ],
  "footer_reminder": "Re-derive against primary sources before any external submission."
}
```

### `GET /api/v1/institutions/:unitid`

Slim institution slice — used to populate the run-screen confirmation
without paying for a full analysis.

**Response 200** — see `InstitutionMetadataResponse` in `contract.ts`.

### `GET /api/v1/analysis/:unitid` — Persona B path

Auto-pulls every program PPD publishes for the institution and analyzes
each. Returns the full `AnalysisResult` envelope (per design.v6 §4).

**Response 200** — `AnalysisGetResponse`. Top-level fields:

| Field | Type | Notes |
|---|---|---|
| `api_schema_version` | string | `"1.0.0"`. |
| `request_persona` | `'persona_a'` \| `'persona_b'` | Always `persona_b` here. |
| `emitted_at` | ISO-8601 string | Server clock at emission. |
| `request_path` | string | `/api/v1/analysis/<unitid>`. |
| `unitid` / `instnm` / `stabbr` | string | Identity. |
| `programs` | `ProgramVerdict[]` | One per PPD-published program at this UNITID, severity-ordered (FAIL → NOT MEASURED → PASS). |
| `hidden_programs` | `HiddenProgramSurface` | Phase 1 (c) parametric until amber lands the IPEDS Completions join. |
| `panels` | `PanelDescriptor[]` | Eight v6 auto-triggered panels (M01/M03/M04/M05/M07/M12/M13/M14) per spec §5; some omitted if no triggering condition. |
| `cross_validation_banner` | `string \| null` | Institution-level banner per spec §3.2 — fires when tool/PPD disagree on >5% of measured programs. |
| `integrity_envelope` | `IntegrityEnvelope` | `build_date`, `ppd_release`, `noise_band_advisories_count`, `cross_validation_disagreements`, `data_status_summary`, `primary_source_reminder`. |
| `footer_reminder` | string | `"Re-derive against primary sources before any external submission."` |

### `POST /api/v1/analysis` — Persona A path

Dean supplies a list of `(cip4, credlev)` pairs they want verdicted.
Programs absent from the institution's PPD slice surface as
`NOT MEASURED` with `not_measured_reason: "b16_invisible_to_ppd"`.

**Request body**

```json
{
  "unitid": "110583",
  "queried_cips": [
    { "cip4": "5009", "credlev": "Master's" },
    { "cip4": "5006", "credlev": "Bachelor" }
  ]
}
```

When `queried_cips` is omitted or empty, the server falls back to the
Persona B (auto-pull) path and sets `request_persona: "persona_b"`.

**Response 200** — same `AnalysisGetResponse` shape; `request_persona`
is `"persona_a"` when the queried list was non-empty.

### `GET /api/v1/panels` — manifest

Returns the 16-panel manifest. M16 is intentionally deferred per
analyses/mechanisms/_index.md and is NOT in the manifest — its
deferral note surfaces as `m16_deferred_note`.

```json
{
  "api_schema_version": "1.0.0",
  "panels": [
    { "id": "M01", "trigger": "auto", "m_doc": "M01", "body_available": false }
  ],
  "m16_deferred_note": "M16 — individual-earnings computation form-by-form trace. Intentionally deferred …",
  "footer_reminder": "Re-derive against primary sources before any external submission."
}
```

**`body_available: false`** until Phase 4 (mdocs glossary) lands the
HTML bodies. Consumers should treat `body_available: false` as a
parametric state, not an error.

### `GET /api/v1/panels/:id`

Returns the pre-rendered HTML body for one panel. Phase 2 contract
surfaces a parametric stub (`html: null`); Phase 4 fills the body.

**404** with the deferral note when called with `M16`.

## Error envelope

Every non-2xx response carries this shape:

```json
{
  "api_schema_version": "1.0.0",
  "error": {
    "code": "UNITID_NOT_FOUND",
    "message": "No institution loaded for UNITID 999999.",
    "details": { "unitid": "999999" }
  },
  "footer_reminder": "Re-derive against primary sources before any external submission."
}
```

| Code | Status | Meaning |
|---|---|---|
| `BAD_REQUEST` | 400 | Malformed body / parameter (e.g., non-numeric UNITID). |
| `INVALID_QUERY` | 400 | Query parameter out of range / shape. |
| `INVALID_QUERIED_CIPS` | 400 | `queried_cips` is not an array of `{cip4, credlev}` with valid credlev. |
| `UNITID_NOT_FOUND` | 404 | UNITID is not in the loaded fixture set. |
| `NOT_FOUND` | 404 | Unknown route or panel id (incl. M16 deferral). |
| `METHOD_NOT_ALLOWED` | 405 | Endpoint exists but doesn't accept this verb. |
| `INTERNAL_ERROR` | 500 | Last-resort handler — engine should never throw. |

## CORS / caching

- `Access-Control-Allow-Origin: *` (public data only; static-site UI
  served from a different origin needs to call this).
- `Cache-Control: public, max-age=60` on all 2xx responses. Verdicts
  are deterministic given the fixture set, but the fixture set
  refreshes on PPD release; 60s gives clients quick refresh.

## Forward-compatibility notes

| Field | Currently | Will be (after) |
|---|---|---|
| `program.in_state_share` (engine input) | Not surfaced — R07 fires PAR. | DET when amber Phase 1 (b) lands FA-part-1 join. |
| `hidden_programs.programs` | `[]` with `available: false`. | Populated when amber Phase 1 (c) lands IPEDS Completions join. |
| `panel.body_available` | `false`, `html: null`. | `true` with HTML body when Phase 4 lands mdocs. |
| `not_measured_reason: "b16_invisible_to_ppd"` | Returned on the queried-CIPs path only. | Stays on queried-CIPs path; auto-pull never produces this. |

These are all additive. No consumer using `api_schema_version: 1.0.0`
will break when they flip; the field types and required-ness do not
change.

## Acceptance — CSULB UNITID 110583 reproduces dean memo v10 §1

| Program | Path | verdict | gap | n | annotations |
|---|---|---|---|---|---|
| Music MM (5009/Master's) | GET | FAIL | -32.65% | 28 | R17 elevation |
| Art MFA (5007/Master's) | GET | FAIL | -20.40% | 23 | R17 elevation |
| Theatre BA (5005/Bachelor) | GET | PASS | +6.06% | 81 | R19 noise band |
| Cinematic Arts BA (5006/Bachelor) | POST queried | NOT MEASURED | — | — | b16_invisible_to_ppd |

These are pinned by `tests/api/handlers.test.ts` and
`tests/api/server.test.ts`. Any contract change that breaks them
fails CI.

## JSON Schema artifact

`docs/api/contract.schema.json` is the wire-level JSON Schema (draft
2020-12). Generated from `src/api/schema.ts`. Schema-parity is
verified by `tests/api/schema-parity.test.ts` — every enum value the
engine emits is present in the schema. Regenerate with:

```bash
npx tsx scripts/export-schema.ts
```
