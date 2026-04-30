# content/citations.json — schema

Single source of truth for R01–R20 citations and M-doc anchors used across the tool. The TypeScript rules engine and pre-rendered M-doc panels reference citation IDs; the citation strings hydrate at render time. Editing this file does not require touching engine code.

## Top-level shape

```jsonc
{
  "schema_version": "1.0.0",          // bump on contract changes
  "build_date": "YYYY-MM-DD",         // when this file was last built
  "spec_version": "design.v6",        // spec the rule list was extracted from
  "sources": { "nprm": {...}, "irc": {...} },
  "rules":         { "R01": { ... }, ..., "R20": { ... } },
  "mdoc_anchors":  { "M01#stage-1-rule": { ... }, ... }
}
```

## `rules.R##`

```jsonc
{
  "rule_id": "R01",                       // canonical, matches design spec
  "name":    "<short engine label>",      // not dean-facing; for engine logs
  "tag":     "DET" | "PAR-data" | "ADV" | "DISP",
  "primary_citation": {
    "kind":           "nprm" | "irc" | "ria" | "design",
    "section":        "<§ + subsection>",      // e.g. "OBBBA § 84001(c)(3)(B)(ii)(I)"
    "fr_page":        21099,                    // null for IRC / RIA appendix
    "verbatim":       "<≤ 800 chars verbatim quote>",
    "corpus_anchor":  "<repo path>:<line range>" // for verifiability
  },
  "supporting_citations": [
    { "kind": ..., "section": ..., "verbatim": ..., "corpus_anchor": ... }
  ],
  "mdoc_anchors":      ["M01#stage-1-rule", "M01#3-verbatim-language"],
  "dean_facing_string": "<peer voice; no jargon; no forbidden strings from design.v6 §13>"
}
```

### Tag values (carried from design.v3 → design.v4)

| Tag | Meaning |
|---|---|
| `DET`      | Deterministic; logical conclusion from inputs. |
| `PAR-data` | Parametric; depends on the published dataset (PPD, IPEDS, ACS) supplying a value. Carries a fallback path. |
| `ADV`      | Advisory; surfaces context, does not emit a verdict word. |
| `DISP`     | Display helper; UI-only, not a regulatory state. |

### `dean_facing_string` constraints

Per design.v6 §13:

- No `cascade`, `supergroup`, `STATS`, `subpart Q`, `subpart R`, `PrivacySuppressed`, `OPEID6`, `PAR-data`, `PAR-derived`.
- Peer voice: do not redefine `Title IV`, `CIP`, `cohort`, or `APA record` for the reader.
- No `complex`, `easy`, `intuitive`, `simply`, `just`.
- Operationally specific: name the rule, the date, or the threshold; not "various rules" or "the framework."

The TypeScript rules engine should glossary-lint these strings at build time against the §13 list. The lint table belongs in the engine repo, not here — this file holds the strings, the engine enforces the constraint.

## `mdoc_anchors.{anchor_id}`

```jsonc
{
  "mdoc":           "M01",
  "title":          "<descriptive>",
  "section_heading": "## 3. Verbatim language",
  "file":           "analyses/mechanisms/M01-cohort-visibility-cascade.draft.md"
}
```

Anchor IDs follow `M##[#kebab-section]` form. The `#section` portion is engine-stable; the underlying M-doc draft files may rename headings. When the M-series promotes from `.draft.md` to release, the `file:` field updates here, not in the engine.

## `sources`

`sources.nprm` and `sources.irc` carry document-level metadata once so per-rule citation entries do not repeat it. Each rule's `corpus_anchor` is a path relative to the analytical repo (`gt/CIPcodes/crew/anthonybyrnes/`), not the deans-tool repo — these citations were extracted from the analytical corpus and cross-checked against the primary sources living there.

## Consumer contract

| Consumer | Reads | Writes |
|---|---|---|
| TS rules engine (Phase 1) | `rules.R##.primary_citation`, `rules.R##.supporting_citations`, `rules.R##.dean_facing_string` | — |
| M-doc panel renderer (Phase 4, cp-0on.2) | `mdoc_anchors.*` for cross-link resolution | — |
| Drill-in UI (Phase 3) | full `rules.R##` block per rule that fires | — |
| Verification harness | `corpus_anchor` for spot-checks against primary sources | — |

The engine should not embed citation strings inline. A citation update is a JSON edit; a rule-logic update is an engine code change. The two surfaces stay separated.

## Versioning

`schema_version` follows semver:

- **Patch** — typo fixes, `corpus_anchor` line-number shifts, additive `supporting_citations` entries.
- **Minor** — additive new top-level keys; new rule additions; new anchor entries.
- **Major** — renamed fields, reshaped per-rule structure, removed rule IDs.

Engine pins against major; loaders accept any minor ≥ pinned.

## Build provenance

Citations were extracted from `briefs/2026-04-28-csu-deans-ep-tool/design.v1.md` §3.1 (R01–R18), `design.v4.md` §3.3–3.4 (R19, R20), and verified verbatim against:

- `research/primary-sources/STATS_NPRM_FR_2026-07666.raw.txt`
- `research/primary-sources/PLAW-119publ21.raw.txt`
- `research/primary-sources/ahead-session-2-program-performance-data-technical-appendix-112901.pdf` (R19, R20)

Spot-check verification recorded in `content/CITATIONS-VERIFICATION.md`.
