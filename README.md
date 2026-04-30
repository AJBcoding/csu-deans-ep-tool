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
| 0 | Data ingestion: PPD:2026 + IPEDS HD + IPEDS Completions → build-time JSON | **in review (SPEC-DELTA pending chair signoff)** |
| 1 | Rules engine R01–R20 as pure functions over the JSON | blocked on 0 |
| 2 | API contract frozen; Persona C endpoint live | blocked on 1 |
| 3 | Static UI for Personas A & B | **complete (cp-0on.6 — chair-review pending)** |
| 4 | M-doc panels pre-rendered at build time + glossary linter | parallel with 3 |
| 5 | One-page PDF export + deployment | blocked on 3, 4 |

## Phase 3 — running the UI locally

The UI is a zero-build static site under `web/`. The dev server boots both the
Phase 2 API and the static surface on a single port:

```bash
npm install
npm run dev                       # http://127.0.0.1:8787/
# or against a custom fixture directory:
npm run dev -- --fixtures data/build/output/by_unitid --port 8787
```

The dev server falls back to `tests/fixtures/sample-institution.json` (CSULB
UNITID 110583) when no built fixtures are present. Open `/persona-b.html` and
enter `110583` to see the auto-pull path; open `/persona-a.html` and add
`5006 / Bachelor` to see the b16 invisibility surfacing for Cinematic Arts BA.

### Static-site shape

```
web/
  index.html           Landing — persona picker
  persona-a.html       Queried-CIPs form
  persona-b.html       UNITID auto-pull form
  css/main.css         Mobile-first stylesheet (375px baseline)
  js/api.js            Fetch wrapper around POST /api/v1/analysis
  js/citations.js      Loads content/citations.json + case-insensitive lookup
  js/panels.js         Loads content/mdocs/M*.html on demand
  js/render.js         Pure-function HTML renderer (testable without a DOM)
  js/persona-{a,b}.js  Page controllers — fetch, render, hydrate
```

For Cloudflare Pages deployment, ship `web/` as the doc root and either copy
`content/` into `web/content/` at build time or add a redirect rule routing
`/content/*` to the bundled assets. Phase 5 closes this out.

## Refreshing the build-time data

The data plane is two public sources joined into per-institution JSON slices.

```bash
# 1. Pull PPD:2026 (debt-earnings file is the load-bearing one for Phase 0)
python3 data/build/fetch_ppd.py --only debt
# (Phase 1 will additionally need: --only fa1 for the in-state share variable)

# 2. Pull IPEDS HD (institutional directory; provides the OPEID6 ↔ UNITID crosswalk)
python3 data/build/fetch_ipeds.py

# 3. Build the JSON fixtures
python3 data/build/build_fixtures.py                # all 5,021 institutions
python3 data/build/build_fixtures.py --unitid 110583  # single institution (CSULB)
```

Output is written to `data/build/output/` (gitignored — regenerable). One sample fixture is committed at `tests/fixtures/sample-institution.json` for Phase 1 rules-engine tests.

Schema reference: `data/build/SCHEMA.md`. PPD:2026 vs design.v6 §2-§3 reconciliation: `data/build/SPEC-DELTA.md`.

### Source provenance

| Dataset | Source | Vintage | sha256 pinned in |
|---|---|---|---|
| PPD:2026 | `ed.gov/media/document/ahead-session-2-program-performance-data-*.xlsx` | 2026-04 | `data/build/fetch_ppd.py` |
| IPEDS HD | `nces.ed.gov/ipeds/datacenter/data/HD2024.zip` | 2024 (most recent fully-released vintage) | — |

## License

MIT for code; CC-BY for M-doc explainer content.
