# M-doc panels — HTML contract

Per design.v6 §16: "Templating, not authoring." Each panel is **pre-rendered at build time** as semantic HTML. No LLM at request time; no runtime substitutions beyond pure DOM injection.

## File layout

```
content/mdocs/
  M01.html        auto-triggered
  M02.html        learn-more
  M03.html        auto-triggered
  M04.html        auto-triggered
  M05.html        auto-triggered
  M06.html        learn-more
  M07.html        auto-triggered
  M08.html        learn-more
  M09.html        learn-more
  M10.html        learn-more
  M11.html        learn-more
  M12.html        auto-triggered
  M13.html        auto-triggered
  M14.html        auto-triggered
  M15.html        learn-more
  M17.html        learn-more
  SCHEMA.md       (this file)
```

M16 is intentionally deferred per v6 / M-series index.

## Panel contract

Each `MNN.html` is a single `<article>` element with this shape:

```html
<article class="mdoc-panel" data-panel-id="M01" data-trigger="auto">
  <header class="mdoc-header">
    <span class="mdoc-id">M01</span>
    <h2 class="mdoc-title">{v6 §5 header — peer voice, ≤ 35 words}</h2>
  </header>

  <section class="mdoc-summary">
    <p>{1–3 sentences: what the rule does, in operational terms.}</p>
  </section>

  <section class="mdoc-mechanism">
    <h3>How it works</h3>
    <p>{1–2 paragraphs: rule wiring at the level a Dean needs.}</p>
    <ul class="mdoc-steps">
      <li>{step or condition, with citation anchor}</li>
    </ul>
  </section>

  <section class="mdoc-citations">
    <h3>Sources</h3>
    <ul>
      <li><a class="cite" data-cite="obbba:84001(c)(4)" href="#">OBBBA § 84001(c)(4)</a> — {paraphrase or short verbatim slice}</li>
      <li><a class="cite" data-cite="nprm:668.402(c)(3)" href="#">Proposed § 668.402(c)(3)</a> — {…}</li>
    </ul>
  </section>
</article>
```

### Required attributes

| Attribute | On | Values | Purpose |
|---|---|---|---|
| `data-panel-id` | `<article>` | `M01`, `M02`, …, `M17` (no M16) | Engine pairs verdict trigger codes to panels |
| `data-trigger` | `<article>` | `auto` \| `learn-more` | Runtime decides whether to surface inline or under a "Learn more" affordance |
| `data-cite` | `<a class="cite">` | citation key (see below) | Hydrated from `citations.json` (cp-0on.3) at build or runtime |

### Citation key namespace

Format: `{source}:{loc}` or `{m-id}#{anchor}`.

| Prefix | Form | Example | Source |
|---|---|---|---|
| `obbba` | `obbba:{section}` | `obbba:84001(c)(4)` | Public Law 119-21, § 84001 |
| `nprm` | `nprm:{section}` | `nprm:668.402(c)(3)` | STATS NPRM (FR 2026-07666), proposed CFR text |
| `cfr` | `cfr:{section}` | `cfr:668.408(a)` | 34 CFR Part 668 (current rule, pre-NPRM) |
| `irc` | `irc:{section}` | `irc:6103(d)(5)` | Internal Revenue Code |
| `m` | `m{NN}#{anchor}` | `m01#cascade-stage-1` | M-doc internal anchor |
| `r` | `r{NN}#{anchor}` | `r19#noise-band` | R-rule (rules engine) anchor |

`citations.json` (delivered by cp-0on.3) is a flat map:

```json
{
  "obbba:84001(c)(4)": {
    "label": "OBBBA § 84001(c)(4)",
    "verbatim": "For any year for which the programmatic cohort…",
    "url": "https://www.congress.gov/119/plaws/publ21/PLAW-119publ21.pdf#page=…"
  },
  "nprm:668.402(c)(3)": { … }
}
```

Runtime hydration: `<a data-cite="obbba:84001(c)(4)">` gets `href` set to the URL and `title` set to the verbatim slice. Until `citations.json` lands, hrefs render as `#` and the panel is still complete in semantic terms.

### Voice constraints (enforced by `scripts/lint-glossary.ts`)

- Forbidden literals (§13 success criteria): `cascade`, `supergroup`, `STATS`, `subpart Q`, `subpart R`, `PrivacySuppressed`, `OPEID6`, `PAR-data`, `PAR-derived`.
- Forbidden internal vocabulary (v5 §17 glossary, Dean-facing surface): `t4enrl_inst_instate_p1819`, `irs_match_count`, `ep_gap_pct` literal, `n_size`, `cohort cascade`, `Stage 1`/`Stage 2`/etc as labels, `Working-not-enrolled subset` as label.
- Headers state the operational specificity, not basic vocabulary (v6 §3-§5).
- No condescending phrasing (`complex`, `intuitive`, `easy`, `simply`).
- Reader is a Dean, not a student. No glossing of Title IV, CIP, cohort, APA.

### Panel sizing

Soft target per panel: ≤ 350 words of body text, ≤ 6 citation list items. Drill-in views (UI) may show one panel at a time; print export concatenates with page breaks.

### Trigger codes (for engine consumption)

The rules engine (cp-0on Phase 1, obsidian) emits panel-trigger codes on each verdict:

```json
{ "verdict": "FAIL", "panels_auto": ["M01", "M04", "M05"], "panels_learn_more": ["M07", "M11"] }
```

Runtime injects the corresponding `MNN.html` content. Auto panels render inline below the verdict card; learn-more panels render behind a `<details>` affordance.
