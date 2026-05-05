# cp-j0gw — extension to cp-0on (CSU Deans EP Tool)

Successor epic to closed `cp-0on`. Extends the public web tool for two new
audiences (legislator/staff and public commenter), folds in post-2026-04-30
analytical updates, and adds the instructive surface (Mechanism Library +
reading-depth toggle + Public Sources page) the chair specified mid-flight.

Branch: `cp-0on-ext-senate-plain-lang`. Acceptance gate (CSULB UNITID 110583
reproduces dean memo v10 §1 EXACTLY) preserved throughout.

## Sub-bead ledger

| Bead | Type | Title | Status |
|---|---|---|---|
| cp-j0gw.1 | analytical | English MA (CIP 23.01, n=29, −4.97%) — REV-2 third CSULB direct-fail | done |
| cp-j0gw.2 | engine | derivation_basis field — explicit AHEAD-published-flag-override (cp-wssr) | done |
| cp-j0gw.3 | framing | simulation_framing field — "FORWARD SIMULATION; first STATS release 2027-07-01" | done |
| cp-j0gw.4 | persona | Persona D (legislator/staff) | folded into Mechanism Library + Brief depth |
| cp-j0gw.5 | persona | Persona E — Generate Comment Outline (DRAFT) | done |
| cp-j0gw.6 | safety | "not attorneys / not legislative analysts" + per-finding verification recipe | done |
| cp-j0gw.7 | content | M-doc M18 — § 668.16(t) five-pass convergence | done |
| cp-j0gw.8 | context | 3-cut systemwide ("this CIP fails at N campuses") | deferred — needs build pipeline change |
| cp-j0gw.9 | content | Mechanism Library /learn/ standalone instructive surface | done |
| cp-j0gw.10 | ux | Reading-depth toggle (Brief / Standard / Detail) | done |
| cp-j0gw.11 | bonus | Interactive widget for one mechanism | deferred — bonus |
| cp-j0gw.12 | safety | Public-data badge + dedicated /sources page | done |

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
