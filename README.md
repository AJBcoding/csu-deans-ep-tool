# CSU Deans EP Tool

Public, deterministic web tool that lets arts deans model their institution's exposure to the OBBBA Earnings-Premium (EP) test.

A dean enters their IPEDS UNITID and CIP codes (or auto-pulls from IPEDS Completions); the tool returns per-program **PASS / FAIL / NOT MEASURED** verdicts with cited rules, surfaces "hidden" programs that would be rolled up under the cohort cascade, and shows what the rule does on which date.

## Status

Pre-implementation. The design spec is final (Pass 5, peer-respect & integrity). Build sequence is in flight under the Gas Town Mayor.

## Spec

The canonical design spec is `briefs/2026-04-28-csu-deans-ep-tool/design.v6.md` in the [CIPcodes](https://github.com/) regulatory-analysis rig. v1–v5 are preserved for traceability. `source-notes.md` tracks which M-doc / corpus passage anchored which rule.

## Hard constraints (from spec §0, §9)

- **Public data only** in the request path. No institutional/IR data.
- **No LLM at request time.** Determinism is the point. Pre-rendered explainers are static assets.
- **Mobile-readable.** Single-column responsive. Deans read on phones between meetings.
- **No accounts, no auth.** UNITID + CIP list is the entire input. Stateless.
- **Cite every rule.** Every deterministic output traces to an NPRM §, IRC §, or M-doc.
- **Re-derive against primary sources before any external submission.** Footer reminder on every result page.

## Architecture (spec §9)

Static site + thin API server reading pre-built JSON. Build pipeline lints dean-facing strings against the v5 §17 glossary. Target hosting: Cloudflare Pages + Workers (or GitHub Pages + Fly.io / Hetzner).

## Build sequence

| Phase | What | Status |
|---|---|---|
| 0 | Data ingestion: PPD:2026 + IPEDS HD + IPEDS Completions → build-time JSON | not started |
| 1 | Rules engine R01–R20 as pure functions over the JSON | blocked on 0 |
| 2 | API contract frozen; Persona C endpoint live | blocked on 1 |
| 3 | Static UI for Personas A & B | blocked on 2 |
| 4 | M-doc panels pre-rendered at build time + glossary linter | parallel with 3 |
| 5 | One-page PDF export + deployment | blocked on 3, 4 |

## License

MIT for code; CC-BY for M-doc explainer content.
