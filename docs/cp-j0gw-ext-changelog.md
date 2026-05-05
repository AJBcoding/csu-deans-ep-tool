# cp-j0gw — extension to cp-0on (CSU Deans EP Tool)

Successor epic to closed `cp-0on`. Extends the public web tool for two new
audiences (legislator/staff and public commenter), folds in post-2026-04-30
analytical updates, and adds the instructive surface (Mechanism Library +
reading-depth toggle + Public Sources page) the chair specified mid-flight.

Branch: `cp-0on-ext-senate-plain-lang`. Acceptance gate (CSULB UNITID 110583
reproduces dean memo v10 §1 EXACTLY) preserved throughout.

## Stacked PR record (2026-05-05, refreshed end-of-day)

**Six PRs open** on `github.com/AJBcoding/csu-deans-ep-tool`. They stack cleanly when merged in order with one trivial conflict resolution on `web/index.html` (3 persona-cards merge in sequence — see "Smoke-stack record" below).

| PR | Branch | Bead | Author | Tests after merge |
|---|---|---|---|---|
| **#1** | `cp-0on-ext-senate-plain-lang` | cp-j0gw (epic main) | crew/anthonybyrnes | 203 |
| **#3** | `cp-j0gw-8-systemwide-context` | cp-j0gw.8 + .13 | crew/anthonybyrnes | 212 |
| **#2** | `polecat/obsidian/cp-j0gw.11` (+ cp-j0gw.17 lint follow-up) | cp-j0gw.11 + .17 | polecats/obsidian | 224 |
| **#4** | `cp-j0gw.14-r19-suppressed-earnings-annotation` | cp-j0gw.14 | polecats/topaz | 228 |
| **#5** | `cp-j0gw.15-plain-lang-explainers` | cp-j0gw.15 (M01/M03/M18) | polecats/quartz | 249 |
| **#6** | `cp-j0gw.18-plain-lang-explainers-batch2` | cp-j0gw.18 (M04/M07/M14) | polecats/quartz | **270** |

Suggested chair merge order: **#1 → #3 → #2 → #4 → #5 → #6** (matches dependency stack; tests pass at every step).

PR #2 now carries the cp-j0gw.17 lint fix (commit `38e236c`) so the broader lint scan is clean across all 6 PRs once stacked. **No remaining `OPEID6` or `cascade` literals** on dean-facing surface; the only informational lint findings are formal cite names (`STATS NPRM`, `RIA Table 3.19`) which are preserved per existing M-doc convention.

## Sub-bead ledger

| Bead | Type | Title | Status |
|---|---|---|---|
| cp-j0gw.1 | analytical | English MA (CIP 23.01, n=29, −4.97%) — REV-2 third CSULB direct-fail | ✅ done (PR #1) |
| cp-j0gw.2 | engine | derivation_basis field — explicit AHEAD-published-flag-override (cp-wssr) | ✅ done (PR #1) |
| cp-j0gw.3 | framing | simulation_framing field — "FORWARD SIMULATION; first STATS release 2027-07-01" | ✅ done (PR #1) |
| cp-j0gw.4 | persona | Persona D (legislator/staff) | folded into Mechanism Library + Brief depth |
| cp-j0gw.5 | persona | Persona E — Generate Comment Outline (DRAFT) | ✅ done (PR #1) |
| cp-j0gw.6 | safety | "not attorneys / not legislative analysts" + per-finding verification recipe | ✅ done (PR #1) |
| cp-j0gw.7 | content | M-doc M18 — § 668.16(t) five-pass convergence | ✅ done (PR #1) |
| cp-j0gw.8 | context | 3-cut systemwide ("this CIP fails at N campuses") | ✅ done (PR #3) |
| cp-j0gw.9 | content | Mechanism Library /learn/ standalone instructive surface | ✅ done (PR #1) |
| cp-j0gw.10 | ux | Reading-depth toggle (Brief / Standard / Detail) | ✅ done (PR #1) |
| cp-j0gw.11 | interactive | Interactive M01 cohort-floor demo widget | ✅ done (PR #2 — obsidian polecat) |
| cp-j0gw.12 | safety | Public-data badge + dedicated /sources page | ✅ done (PR #1) |
| cp-j0gw.13 | content | Tool README v1.1 status block + routes table | ✅ done (PR #3) |
| cp-j0gw.14 | engine | R19 suppressed-earnings annotation — 4th provenance value | ✅ done (PR #4 — topaz polecat) |
| cp-j0gw.15 | content | Plain-language standalone explainers M01/M03/M18 | ✅ done (PR #5 — quartz polecat) |
| cp-j0gw.16 | qa | Lighthouse + axe-core audit | deferred — runs against preview URL after PR #1 merges |
| cp-j0gw.17 | lint | Replace `cascade` literal in widget link text | ✅ done (PR #2 commit `38e236c` — obsidian polecat) |
| cp-j0gw.18 | content | Plain-language standalone explainers M04/M07/M14 (batch 2) | ✅ done (PR #6 — quartz polecat) |

## Chair-review track applied (this evening)

Before the polecat PR returns landed, the chair-review track was iterated inline:

- **Review #1 — disclaimer wording** (envelope + top-aside): approved as-is.
- **Review #2 — systemwide context one-liner**: refined — empty-title bug fixed (whitespace collapse + omit parenthetical when missing), single-campus suppress gate added (`n_unique_campuses >= 2`), source line hyperlinked to `/sources.html` instead of monospace path. Landed in PR #3 commit `6f8d526`.
- **Review #3 — Mechanism Library topic groupings**: applied — M07 duplication fixed (was in 2 groups), M02 promoted to "How the rule works", group 3 renamed "Edge cases, timing, and who's hit hardest", group 4 renamed "Process, appeals, and authority". Landed in PR #1 commit `7f6dfe7`.
- **Review #4 — M18 panel prose**: skipped (chair direction); BUG FIX shipped regardless — 5 doubled fragments `"institution-level institution-level escalation pathway"` stripped (glossary-substitution artifact). Landed in PR #1 commit `9c68b91`.
- **Review #5 — sample comment outline**: not yet run.

## Smoke-stack record (2026-05-05 evening)

All 5 PRs were stacked on top of `origin/main` in temporary branch `smoke-stack` to verify mergeability:

```
main → +PR#1 (203 tests)
     → +PR#3 (212 tests)
     → +PR#2 (212 tests, 1 trivial conflict on web/index.html — both branches added persona-cards at same insertion point; resolution = keep both, in sequence)
     → +PR#4 (228 tests)
     → +PR#5 (249 tests)
```

Production lint scan (`npx tsx scripts/lint-glossary.ts content web`) caught 3 dean-facing literal violations on the cp-j0gw extension surface (separate from the regression test, which only lints `content/mdocs/`):

- `src/engine.ts` verification_recipe: 4 uses of forbidden literal "OPEID6" — fixed in PR #1 commit `0993045`
- `web/sources.html` PPD source-card: 2 uses of "OPEID6" — fixed in PR #1 commit `0993045`
- `web/js/comment-draft.js` outline scaffold: 1 use of "cascade" — fixed in PR #1 commit `0993045`

PR #2 (obsidian widget) carries one similar lint violation (link text "M01 — Cohort visibility cascade" uses forbidden literal "cascade"). Surfacing as a follow-up note rather than amending obsidian's PR unilaterally; can be patched in a 1-line follow-up commit if the chair wants the broader-scope lint clean before merge.

Formal NPRM/RIA/citation names like "STATS NPRM 2026-07666" and "RIA Table 3.19" are retained on the Sources page even though they trip the broader lint — these are primary-source titles, not prose; the existing M-doc panels follow the same convention.

## What changed in this branch

### New pages
- `web/learn.html` — Mechanism Library (all 17 panels organized into 4 topic groups; depth toggle)
- `web/sources.html` — every primary source the tool reads or cites
- `web/comment-draft.html` — DRAFT comment outline generator

### New panels
- `content/mdocs/M18.html` — § 668.16(t) institution-level pathway, five legal frames

### Engine extensions
- `src/types.ts` — `DerivationBasis`, `VerificationRecipe` types; envelope adds `simulation_framing` + `expertise_disclaimer`
- `src/engine.ts` — `deriveDerivationBasis()` + `buildVerificationRecipe()`
- `src/citations.ts` — `SIMULATION_FRAMING`, `EXPERTISE_DISCLAIMER` constants; `M_DOCS.M18`
- `src/api/contract.ts` — `PANEL_IDS` (17), `AUTO_TRIGGERED_PANELS` (9, adds M18)
- `src/api/schema.ts` — required fields for new envelope and verdict additions

### UI affordances
- Top-disclaimer aside on every page: "not attorneys, not legislative analysts; forward simulation"
- Public-data badge in every page header
- Header nav: Mechanism Library / Sources / Comment outline (DRAFT)
- Reading-depth toggle (Brief / Standard / Detail) — localStorage-persisted
- Per-verdict collapsible verification recipe with engine reference and step list

### Tests
- 11 → 16 acceptance test cases (English MA, derivation_basis, recipes, M18 auto-trigger, simulation_framing, expertise_disclaimer)
- All other test sites updated for 17-panel manifest
- 203 / 203 passing (was 197 baseline)

## 5-pass Ralph review (this branch)

The chair instruction was to "pass the existing design through several 5-pass
ralph loops to help iterate the integration." This branch was iterated through
one full 5-pass cycle. Snapshots were committed per substantive change rather
than per critique pass, on the rationale that pass-per-commit would clutter
the ledger. The five passes:

| Pass | Dimension | Critique → action |
|---|---|---|
| 1 | analytical accuracy | English MA missing from acceptance test (D1); AHEAD-flag-override behavior not documented (D2); cp-dw65 simulation framing absent (D3). Fixed in commits aa3f850, 6d9a478, f8b9767. |
| 2 | plain-language clarity | Tool was dean-only; Mechanism Library + Brief reading depth open the surface to senate staff and the public. Fixed in commit 79cf924 + Mechanism Library commit. |
| 3 | disclaimers & verification | Single-string footer reminder insufficient for new audiences. Added 3-layer disclaimer (top aside + envelope expertise_disclaimer + per-finding verification recipe). Fixed in commits 6d9a478 + f8b9767. |
| 4 | comment-basis extension | No outline generator; commenters had no scaffold. Added /comment-draft/ that emits structured markdown with bracketed [you-fill-in] prompts, never pre-written legal arguments. Commit 79cf924. |
| 5 | integration / regression | All 17 panels in manifest; M18 auto-triggers on FAIL; 203/203 tests; vitest + lint-glossary clean; smoke test confirms API includes new envelope fields and routes resolve. |

## Deferred items

- `cp-j0gw.4` — Persona D as a separate page. The Mechanism Library + Brief
  depth covers most of the use case; revisit after stakeholder review.
- `cp-j0gw.8` — 3-cut systemwide context ("this CIP fails at N campuses").
  Requires the CSU systemwide-exposure CSVs (`analyses/csu-systemwide-exposure/output/3cut-2026-05-04/`)
  to be ingested by the Python build pipeline as a static `systemwide-cip-context.json`
  bundle. New sub-bead recommended.
- `cp-j0gw.11` — Interactive widget for one mechanism. Bonus item; defer.

## Acceptance gate verification

The CSULB UNITID 110583 acceptance test (dean memo v10 §1) PRESERVED:

```
✓ Music MM (5009/Master's)        FAIL @ -32.65%, n=28
✓ Art MFA (5007/Master's)         FAIL @ -20.40%, n=23
✓ English MA (2301/Master's)      FAIL @ -4.97%, n=29   [NEW — REV-2 cp-j0gw.1]
✓ Theatre BA (5005/Bachelor)      PASS @ +6.06%, n=81 — within R19 noise band
✓ Cinematic Arts BA (5006/Bach)   NOT MEASURED  (B16 invisibility)
```

## Deploy gate

This branch DOES NOT trigger Cloudflare Pages production deploy. Branch was
pushed and PR opened for chair review. After chair greenlight, merging to
`main` triggers the Pages production build via `.github/workflows/deploy.yml`.
