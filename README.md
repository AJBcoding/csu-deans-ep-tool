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
| 5 | One-page PDF export + Cloudflare Pages/Workers deployment | **complete (cp-0on.7)** |

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

For Cloudflare Pages deployment, see [Deploying to Cloudflare Pages](#deploying-to-cloudflare-pages) below.

## PDF export (Phase 5)

Every result page (Persona A and Persona B) gets a **Save as PDF** button at
the top of the result region once a verdict has rendered. Clicking it invokes
`window.print()` against the page's `@media print` stylesheet
(`web/css/main.css`), which compresses the result into a one-page deterministic
artifact preserving:

- Verdict colorbands (FAIL red / PASS green / NOT MEASURED grey / noise-band amber)
- Program identifier, cohort count, median earnings, benchmark, and gap
- The full rules-fired list (auto-expanded — citations are load-bearing per spec §0)
- Snapshot metadata block (build date, federal-data release, noise-band count)
- Cross-validation banner if disagreements exist
- Both reminders: `footer_reminder` and `primary_source_reminder`
- A print-only footer identifying the tool, institution, and data provenance

Mobile Safari supports this via Share → Save to Files (PDF). Print engines
across modern browsers honor `print-color-adjust: exact` so verdict colorbands
survive the print pipeline.

**Determinism note (spec §0):** `window.print()` rasterizes the existing DOM
through the browser's deterministic layout + print engine. There is no LLM,
no async inference, no random source. Same input record + same stylesheet
produces the same PDF. This is the same code path Puppeteer / headless
Chromium uses on the server side; we run it client-side because every dean
already has a browser, and it preserves the no-server-cost posture.

## Deploying to Cloudflare Pages

The deployment is **Cloudflare Pages + Pages Functions** — single project,
single domain, single deploy step:

- **Static UI** ships from `dist-pages/` (built by `npm run build:pages`,
  which copies `web/` + `content/` into the output directory).
- **API endpoint** ships from `functions/api/v1/[[path]].ts` — a Pages
  Function that wraps the Web Standards router in `src/api/web-router.ts`.
  Same handlers as the local Node `http` server; different transport.
- **Bundled fixtures**: `functions/_lib/bundled-fixtures.ts` imports the
  per-institution JSON files that ship with the Worker. Phase 5 ships
  CSULB (UNITID 110583); add records to that file as the build pipeline
  produces additional institution fixtures.

### Local preview

```bash
npm run build:pages          # builds dist-pages/
npm run dev:pages            # wrangler pages dev — runs the Functions runtime locally
```

`wrangler pages dev` boots the Pages Functions runtime against `dist-pages/`
on `http://127.0.0.1:8788/`. Functions log to stderr.

### Deploy

```bash
# One-time: install wrangler globally if not already installed via npm devDeps
npm install

# Authenticate (opens a browser):
npx wrangler login

# Push a deploy from the local checkout:
npm run build:pages
npm run deploy
```

CI deploys are wired up in `.github/workflows/deploy.yml`:

- Push to `main` → production deploy on the Pages project.
- Push a PR → preview deploy on a `*.pages.dev` branch URL.
- Manual: GitHub Actions → "Build & Deploy to Cloudflare Pages" → Run workflow.

### Required GitHub Secrets

Set these in **Repo Settings → Secrets and variables → Actions → Repository secrets**:

| Secret | Value | How to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | API token with Pages:Edit permission | Cloudflare dash → My Profile → API Tokens → Create Token → "Edit Cloudflare Pages" template |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID | Cloudflare dash → right sidebar of any zone → "Account ID" |

The deploy step is gated on `CLOUDFLARE_API_TOKEN` — if the secret is unset,
the workflow runs all quality gates and prints a notice but skips the deploy
step. This lets the repo's CI pass on forks / branches without Pages access.

### Custom domain

Phase 5 deploys to a Cloudflare-managed `*.pages.dev` preview URL. To bind a
custom domain (chair-deferred decision):

1. Cloudflare dash → Pages → `csu-deans-ep-tool` project → Custom domains → Set up a custom domain.
2. Cloudflare auto-provisions DNS + TLS (no manual cert work). For a domain
   already on Cloudflare DNS, this is a one-click bind. For an external
   registrar, follow the CNAME instructions Cloudflare surfaces.
3. Update `package.json` deploy script to use `--branch=main` for the
   production environment if you want pushes to main to land directly on the
   custom domain (already wired in `.github/workflows/deploy.yml`).

### Cloudflare Workers bundle limits

The Pages Function runs as a Worker. Free-tier limit: 1 MB compressed bundle.
The bundled CSULB fixture is ~98 KB; the engine + handlers + router compile
to roughly 50 KB. Plenty of headroom for additional institution fixtures
(each ~30-100 KB depending on program count). For institution counts > ~10,
move from bundled fixtures to Workers KV or R2 storage.

### Smoke-testing the live deployment

```bash
# Replace <DOMAIN> with the deployed *.pages.dev URL or your custom domain.
curl -s https://<DOMAIN>/api/v1/health | jq .
curl -s https://<DOMAIN>/api/v1/analysis/110583 | jq '.programs[] | {cip4, credlev, verdict}'
```

The first call should return `status: ok` with `institutions_loaded >= 1`.
The second should include CSULB's four dean-memo verdicts (Music MM FAIL,
Art MFA FAIL, Theatre BA PASS, Cinematic Arts BA absent → POST a queried
CIP request to surface NOT MEASURED + b16_invisible).

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
