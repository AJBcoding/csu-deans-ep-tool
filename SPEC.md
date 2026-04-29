# Public web tool for arts deans to model OBBBA earnings-premium exposure — design spec v6 (final)

**Status:** Final, post-Pass-5 (peer-respect & integrity). Source: design.v5.md.

**Pass-5 criterion.** *Two checks. (a) Peer respect — does the tool talk to a Dean as a peer, not as a student? Cut any explainer that is condescending, over-defines basic terms, or treats the Dean as naive about higher-ed regulation. (b) Integrity — every claim defensible, no false certainty. Any verdict on parametric data must show its uncertainty. Any peer-comparison must disclose its peer-set definition. Any "hidden program surfacer" must show its logic. The Dean must be able to defend any tool output to their provost.*

This is the final design spec. The architecture from v1, the concept discipline from v2, the determinism audit from v3, the data-availability findings from v4, and the plain-English UX from v5 are all carried forward. v6 adjusts the tool's *voice* — from "explainer to a novice" to "instrument used by a peer" — and tightens the *integrity envelope* on every claim the tool makes.

A developer agent reading v6 alone has the complete blueprint. v1–v5 are preserved for traceability.

---

## 0. Pass-5 outcome at a glance

What changed in v6:

1. **Voice swap.** The tool no longer "tells you what to do." It surfaces what the rule says about your programs and lets you decide. The "three conversations to have" prescription from v5 is replaced with a "what the rule does between now and AY 2028-29 for these programs" timeline.
2. **Persona B renamed.** v5's "Dean who does not know what to enter" is renamed "Dean exploring the rule's exposure surface." A Dean who hasn't enumerated their CIPs is not ignorant; they're triaging.
3. **Mechanism-panel headers tightened to non-condescending phrasing.** Headers no longer redefine basic regulatory vocabulary. M04 ("What pass and fail mean") is removed as a header; the panel now opens with the *operational* specificity ("two failures in three years; 4-year measurement window; calendar 2027 first measurement").
4. **Integrity envelope on every parametric claim.** Verdicts within the R19 noise band carry an explicit "could read the other way" disclosure. Peer-comparison views carry a "your peers may have different in-state shares, cohort sizes, and data-quality conditions" footer. The hidden-program surfacer carries its own provenance line (which dataset, what privacy rules apply).
5. **Primary-source re-derivation reminder.** Anywhere the tool's output might be used for advocacy, accreditor review, or APA record, the result page carries a one-line note: "Re-derive against primary sources before any external submission." This is the integrity guardrail the corpus's own NPRM-comment work observes.
6. **The first-failure date.** v6 anchors the calendar/AY language verbatim to NPRM RIA pp. 21099, 21163, 21169 and OBBBA § 84001. Three timing markers: (1) calendar 2027 = first performance assignment from PPD:2026; (2) calendar 2028 = second from PPD:2027; (3) AY 2028-29 = earliest loss of Title IV eligibility for a program failing both 2027 and 2028.
7. **The cross-validation conflict policy is named.** Per-program disagreement between the tool and PPD is surfaced. Institution-level disagreement above 5% of measured programs surfaces a single banner: "Your tool re-derivation differs from the Department's pre-computed verdict on N of M programs. This warrants institutional research review."

What did *not* change in v6:

- Architecture, rules engine, schema, peer-set logic, MVP scope, tech stack — all carry from v4 / v5 unchanged.
- The two-source cohort math (IPEDS Completions for 6-digit; PPD:2026 for 4-digit).
- The deterministic / parametric / advisory tagging.
- The eight auto-triggered mechanism panels (M01, M03, M04, M05, M07, M12, M13, M14).
- The print export as a one-page hand-off.

---

## 1. User journeys (v6 — peer-voice rewrite)

### 1.1 Persona A — Dean entering known CIPs

A Dean who has reviewed their institution's IPEDS Completions submissions and can supply CIP codes. Wants a verdict per program with citations.

| State | Action | Screen |
|---|---|---|
| A.0 Land | Reads framer; clicks **Begin** | Framer states the tool's purpose, datasets, and primary-source-rederivation reminder in one paragraph |
| A.1 Identify | Selects institution | IPEDS HD lookup |
| A.2 Confirm | Reviews auto-pulled program list; ticks/unticks | IPEDS Completions slice |
| A.3 Run | Clicks **Run** | Rules engine executes |
| A.4 Verdict | Reads verdicts (most-failing first) | Per-CIP verdict cards |
| A.5 Drill into one | Taps a card | Drill-in with the rules that fired and the verbatim text the rule cites |
| A.6 Hidden programs | Scrolls past verdicts | Hidden-program surfacer with its own provenance line |
| A.7 Peer compare (optional) | Picks one CIP, picks peer set | Same-state same-control same-ICLEVEL view |
| A.8 Print | Taps **Print** | One-page PDF, with reminder on the footer |

### 1.2 Persona B — Dean exploring the rule's exposure surface

A Dean who is triaging the rule's effect on their institution and has not yet enumerated programs by CIP. The tool does the lookup.

| State | Action | Screen |
|---|---|---|
| B.0 Land | Reads framer; clicks **Begin** | (same as A.0) |
| B.1 Identify | Selects institution | (same as A.1) |
| B.2 Auto-pull | Clicks **Auto-pull my programs** | Tool fetches IPEDS list; offers "Arts only" / "All programs" toggle |
| B.3 Run | (same as A.3) | (same) |
| B.4 Verdict | (same as A.4) | (same) |
| B.5 What this means | Taps **What this means for [Institution]** | A timeline-shaped summary screen — see §7.5 |
| B.6 Print | (same as A.8) | (same) |

The B.5 screen replaces v5's "What does this mean for me?" prescription. It shows what the rule does on which date, given the verdict set; it does not tell the Dean what to do.

### 1.3 Persona C — IR analyst (unchanged from v4 / v5)

The API response remains technical. Persona C's success condition: every verdict the tool emits is reproducible from the JSON response and the public datasets it cites.

### 1.4 Cross-persona invariants (v6 additions)

- Every result page footer carries: "Public-data inputs as of [build date]. Re-derive against primary sources before any external submission."
- No screen prescribes an action. Screens surface what the rule does and when.
- The verdict card never displays a confidence level the underlying data does not support. Within the R19 noise band, the verdict word carries an explicit "could read the other way" annotation.

---

## 2. Data-source manifest (unchanged from v4)

| # | Dataset | Grain | Used for |
|---|---|---|---|
| D1 | IPEDS HD | UNITID | Institution lookup |
| D2 | IPEDS Completions | UNITID × CIP6 × AWLEVEL × year | 6-digit cohort sizes (Stages 1–2 upper bound); hidden-program surfacer |
| D3 | PPD:2026 (and successor releases) | OPEID6 × CIP4 × CREDLEV × pooled cohort | Verdict computation; in-state share; pre-computed pass/fail; ACS-derived benchmark cells; suppression flags |
| D4 | College Scorecard FoS | OPEID6 × CIP4 × CREDLEV | Historical context only |
| D6 | Census ACS PUMS | (panel content only after v4) | M03 explainer context |
| D7 | NEA + IPUMS USA | (panel content) | M02 explainer content |
| D8 | OBBBA + STATS NPRM | (text) | Verbatim citations in every rule fire |
| D9 | M-doc explainer markdown | (corpus) | Pre-rendered HTML at build time |

All datasets pulled at build time. No request-time external API calls.

---

## 3. Rules engine (unchanged from v4; v6 surfaces uncertainty)

R01–R20 carry unchanged. v6 changes how their outputs surface, not what they compute.

### 3.1 Verdict words

Three words: `PASS`, `FAIL`, `NOT MEASURED`.

A `PASS` verdict where `abs(ep_gap_pct) <= 0.15` carries the R19 noise-band annotation:
> "This PASS is within the data's noise band. With the same input, the rule could publish a FAIL on this program. See drill-in for the underlying values."

A `FAIL` within the same band carries the symmetric annotation. A `NOT MEASURED` verdict always carries its provenance (which threshold could not be cleared, which dataset cell was unavailable).

### 3.2 The cross-validation policy (Q13 from v4 closed)

Per-program disagreement between the tool's re-derivation and PPD's pre-computed verdict surfaces inline (§7.2). Institution-level disagreement above 5% of the institution's measured programs surfaces a single banner above the verdict list:

> "On this institution, the tool's re-derivation differs from the Department's pre-computed verdict on N of M measured programs ([X%]). This is above the 5% systemic-flag threshold and warrants institutional-research review of the rule's application to your CIP slate."

The banner does not alter individual verdicts; each verdict still carries its own per-program agree/disagree flag.

### 3.3 The first-failure timing (Q15 from v5 closed)

Per OBBBA § 84001 and NPRM RIA pp. 21099, 21163, 21169:

- **Calendar 2027** — First Department performance assignment using PPD:2026 (cohort: pooled AY 2017-18 + AY 2018-19; earnings: pooled calendar 2022 + 2023). First-failure disclosure under proposed § 668.43(d)(1) attaches on this release date for any program named as failing.
- **Calendar 2028** — Second annual assignment using PPD:2027 (single-year base AY 2020-21; earnings calendar 2025 under the rule's earnings-construction mechanic at FR 21099).
- **AY 2028-29** — Earliest Title IV Direct Loan eligibility loss for a program failing both 2027 and 2028.

The verdict card displays calendar 2027 / AY 2028-29 as the two dates the Dean cares about. Calendar 2028 surfaces in the drill-in as the next-measurement date but does not need to be on the headline card.

---

## 4. Request / response shapes (unchanged from v5; one v6 addition)

The response carries a top-level `integrity_envelope` block:

```json
"integrity_envelope": {
  "build_date": "2026-04-28",
  "ppd_release": "2026",
  "noise_band_advisories_count": 2,
  "cross_validation_disagreements": 0,
  "data_status_summary": {
    "fully_measured": 9,
    "ppd_suppressed": 3,
    "irs_below_floor": 1,
    "cohort_below_floor": 1
  },
  "primary_source_reminder": "Re-derive against primary sources before any external submission."
}
```

This block surfaces in the print export footer and in the API consumer's view.

Schema bump: 1.4.0 → 1.5.0 (additive `integrity_envelope`).

---

## 5. Mechanism-trigger logic — Pass-5 header rewrite (v6 final)

Pass-5 finds three of v5's eight headers condescending. Replacement headers, ≤ 35 words, peer-voice:

| Panel | v6 header (final) |
|---|---|
| M01 | "The rule's cohort-expansion logic. A program with fewer than 30 qualifying graduates pulls in graduates from related programs (same 4-digit CIP family, then same 2-digit family) until 30 is reached or expansion exhausts." |
| M03 | "How the benchmark is selected. Graduate programs are compared against the lowest of three figures (state bachelor's, state field-of-study bachelor's, national field-of-study bachelor's). Undergraduate programs against the state's high-school-only earners aged 25–34." |
| M04 | "Operational specificity. Two annual failures within three measurement years triggers Title IV Direct Loan ineligibility. Disclosure obligations attach on first failure." |
| M05 | "Title IV Direct Loan ineligibility scope. Students cannot take new federal loans to enroll in an ineligible program; existing borrowers are unaffected for prior disbursements." |
| M07 | "Disclosure obligations under proposed § 668.43(d)(1). First-failure release date triggers a written notice on admissions materials; pre-existing 2023 GE-rule language is the procedural model." |
| M12 | "Programs without a published measure. The 'no measure' state is operationally distinct from passing — there is no procedural anchor for appeal under the proposed § 668.603 calc-error-only scope." |
| M13 | "Calendar dates that matter. First measurement: calendar 2027 (PPD:2026). Second: calendar 2028 (PPD:2027). Earliest Title IV Direct Loan eligibility loss: AY 2028-29." |
| M14 | "RIA Table 3.19 named populations. The Department's own analysis flags some CIP families as 10–20× more likely to fail; per-CIP elevation factors recomputed against PPD data run higher than the prose." |

These headers presume the reader knows what Title IV is, what 4-digit CIP means, what "cohort" means in a regulatory context, and what an APA record is. The reader is the Dean, not a student.

The "Learn more" panels (M02, M06, M08, M09, M10, M11, M15, M17) are similarly rewritten in their pre-rendered HTML; v6 does not enumerate each but constrains all to the same voice rule.

---

## 6. Peer-group definitions — v6 integrity addition

In MVP, one peer set: same state × same control × same ICLEVEL.

Comparison view carries a footer disclosure:

> "Peer institutions may have different in-state shares, different cohort sizes, different cascade-stage outcomes, and different data-quality conditions for the same CIP. A peer's PASS does not imply your program is structurally similar; the rule applies the same logic to dissimilar inputs."

Custom UNITID peer lists (deferred from v2) carry the same disclosure when they ship.

---

## 7. UI / UX (v6 — peer-voice + integrity disclosures)

### 7.1 Layout principles (carried from v5)

- One bolded number per screen on mobile.
- Verdict word and gap percentage above the fold.
- Print button sticky bottom-right.
- Vertical list of verdicts ordered by severity.

### 7.2 Verdict card (v6 final)

```
+----------------------------------------------------+
| Music — Performance, Master's degree               |
+----------------------------------------------------+
| FAIL                                               |
| 32.6% below the benchmark                          |
|                                                    |
| First measurement: calendar 2027                   |
| Earliest Title IV Direct Loan ineligibility:       |
| AY 2028-29                                         |
|                                                    |
| Tool re-derivation: agrees with the Department's   |
| pre-computed verdict.                              |
|                                                    |
| > See the rules that fired                         |
| > See related programs the rule may pool in        |
+----------------------------------------------------+
```

If the verdict is in the noise band:

```
| FAIL (within the data's noise band)                |
| 8.4% below the benchmark                           |
|                                                    |
| With the rule's privacy noise, this could read as  |
| PASS on the same data. See drill-in for the        |
| underlying values.                                  |
```

If the verdict is `NOT MEASURED`:

```
| NOT MEASURED                                       |
|                                                    |
| The Department's data does not produce a verdict   |
| for this program in PPD:2026.                      |
|                                                    |
| Reason: cohort below 30 after expansion to 2-digit |
| CIP family. (Or: IRS records below 16. Or: cell    |
| suppressed by federal privacy rule.)               |
|                                                    |
| Operationally distinct from PASS.                  |
```

### 7.3 Drill-in (v6 — peer-voice)

The drill-in shows the rules that fired with their verbatim source rule text inline. No "Why this benchmark?" subhead (Pass-5 finds that condescending — a Dean does not need to be asked rhetorical questions). Replace with section headings:

```
+----------------------------------------------------+
| Music — Performance, Master's degree               |
| FAIL — 32.6% below benchmark                       |
+----------------------------------------------------+
|                                                    |
| Inputs                                             |
|   Median earnings (4 yrs post):     $32,534        |
|   Benchmark:                        $48,304        |
|     Source: PPD:2026 (CA × CIP-50 BA, lowest of    |
|     three under OBBBA § 84001(c)(3)(B)(ii))        |
|   Cohort:                           28 graduates   |
|     Source: PPD:2026 4-digit cell, working-not-    |
|     enrolled subset; expanded over AY 2017-18 +    |
|     2018-19 + 2016-17                              |
|   IRS records returned:             22 of 28       |
|     Floor: 16; cleared.                            |
|   In-state share:                   93%            |
|     Source: PPD field t4enrl_inst_instate_p1819    |
|                                                    |
| Rules that fired                                   |
|   R03 (Stage 3 — 4-digit CIP cell at PPD)          |
|   R08 (graduate lowest-of-three benchmark)         |
|   R11 (gap calculation)                            |
|   R17 (RIA Table 3.19 elevation flag)              |
|                                                    |
| Verbatim text the rule cites                       |
|   OBBBA § 84001(c)(3)(B)(ii)                       |
|   "the median earnings of a working adult, as      |
|   described in subparagraph (A), shall be based    |
|   on data from the Bureau of the Census— with      |
|   respect to an educational program that is a      |
|   graduate or professional program—for the lowest  |
|   median earnings of [three options]."             |
|                                                    |
|   NPRM raw.txt 2272-2300 [cohort expansion]        |
|                                                    |
| Cross-validation                                   |
|   Tool: FAIL — 32.6%                               |
|   PPD pre-computed: FAIL                           |
|   Status: agree                                    |
|                                                    |
| Re-derive against primary sources before any       |
| external submission.                                |
+----------------------------------------------------+
```

### 7.4 Hidden-program surfacer (v6 — provenance line)

```
+----------------------------------------------------+
| Programs the rule may pool with your CIP family    |
+----------------------------------------------------+
| When a program has fewer than 30 graduates over    |
| 5 years at 6-digit CIP, the rule's expansion       |
| pulls in graduates from related programs (same     |
| 4-digit, then same 2-digit family) until 30 is     |
| reached.                                            |
|                                                    |
| At this institution, programs below 30 graduates   |
| over 5 years (IPEDS Completions; categorical where |
| federal privacy rule applies a 10–19 midpoint):    |
|                                                    |
|   • Dance MA (50.0301)                             |
|     between 10 and 19 graduates over 5 years       |
|                                                    |
|   • Dance MFA (50.0301)                            |
|     between 10 and 19 graduates over 5 years       |
|                                                    |
|   • Theatre Mgmt MFA (50.1004)                     |
|     between 10 and 19 graduates over 5 years       |
|                                                    |
|   • Art History MA (50.0703)                       |
|     between 10 and 19 graduates over 5 years       |
|                                                    |
| Source: IPEDS Completions C-survey 2019-2024.      |
| The federal privacy rule replaces cell sizes 10-19 |
| with the midpoint value 15; ranges shown above     |
| reflect the substitution policy.                    |
+----------------------------------------------------+
```

### 7.5 The "What this means" screen (Persona B — v6 rewrite)

Pass-5 strips the prescriptive "three conversations" frame from v5 and replaces it with a **timeline of what the rule does** — not what the Dean should do.

```
+----------------------------------------------------+
| What the rule does for [Institution]               |
+----------------------------------------------------+
|                                                    |
| Calendar 2027 — first measurement release          |
|   PPD:2026 publishes Department-attributed         |
|   verdicts on these programs:                      |
|                                                    |
|     Music MM           FAIL (-32.6%)               |
|     Art MA + MFA       FAIL (-20.4%)               |
|     Theatre BA         PASS  (+6.1%, noise band)   |
|     Cinematic Arts BA  NOT MEASURED                |
|     [other programs]   PASS                        |
|                                                    |
|   First-failure disclosure under proposed          |
|   § 668.43(d)(1) attaches on this date for any     |
|   program named as failing.                        |
|                                                    |
| Calendar 2028 — second measurement release         |
|   PPD:2027 publishes second annual verdicts        |
|   using a single-year cohort (AY 2020-21).         |
|                                                    |
| AY 2028-29 — earliest Title IV Direct Loan         |
|   ineligibility for any program failing both       |
|   the 2027 and 2028 measurements.                  |
|                                                    |
| The rule continues annually thereafter.            |
|                                                    |
| Re-derive against primary sources before any       |
| external submission.                                |
+----------------------------------------------------+
```

What the screen does *not* contain in v6:
- No "conversations to have" prescription.
- No "review your admissions materials" instruction.
- No "decide whether to file an NPRM comment" instruction.

The Dean reads what the rule does and decides what they do about it.

### 7.6 The print export (v6)

One page. Same content as v5, with two v6 changes:
- Footer carries the integrity-envelope block: build date, PPD release, noise-band count, cross-validation disagreement count.
- Footer carries the primary-source reminder verbatim.

---

## 8. MVP scope (unchanged from v4)

In MVP:
- Persona A and Persona B end-to-end.
- Persona C API endpoint, public.
- One peer set: same state × same control × same ICLEVEL.
- PPD:2026 only.
- Eight auto-triggered mechanism panels (M01, M03, M04, M05, M07, M12, M13, M14) with v6 headers.
- Nine "Learn more" panels (M02, M06, M08, M09, M10, M11, M15, M17 — recall M16 is intentionally deferred per the M-series index).
- One-page PDF export.
- Hidden-program surfacer with v6 provenance line.
- R19 noise-band annotations.
- R20 cross-validation flags.

Out of MVP (carried from v2/v3/v4): custom UNITID peer list; Carnegie peers; AAUDE peers; CSU-sister preset; multi-PPD historical comparison; SVG cascade diagrams; Spanish-language UI; bulk dataset export.

Explicitly out of scope: accounts, dashboards, multi-user workspaces; LLM in request path; institutional non-public data; uncited verdicts; advocacy framing in tool voice.

---

## 9. Tech stack (unchanged from v5)

Static site + thin API server reading pre-built JSON. Build pipeline lints Dean-facing strings against the v5 §17 glossary. Deployed on commodity static hosting (Cloudflare Pages or GitHub Pages) + a single small API server (Cloudflare Workers, Fly.io, or Hetzner shared). Whole tool MIT- or CC-BY-licensed; M-doc content CC-BY.

---

## 10. Non-goals (unchanged)

The tool is not a coalition platform, not a litigation pipeline, not real-time, not a substitute for institutional analysis. It surfaces public-data findings and cites the rule.

---

## 11. Open questions — final disposition

Every open question is now closed or explicitly carried forward as post-MVP work.

| # | Question | Final disposition |
|---|---|---|
| 1 | STATS dataset publication status | Closed at Pass 3 — collapsed into D3 |
| 2 | PPD:2026 grain | Closed at Pass 3 — 4-digit CIP confirmed |
| 3 | ACS PUMS FOD1P mapping | Closed at Pass 3 — handled inside PPD's pre-computed benchmarks |
| 4 | PPD suppression cells | Closed at Pass 3 — four-layer suppression schema documented |
| 5 | Bubble-band threshold | Closed at Pass 2 — converted to display-helper |
| 6 | Institutional cascade verdict | Closed at Pass 2 — converted to advisory |
| 7 | AAUDE peer set | Closed at Pass 1 — out of MVP |
| 8 | First-failure disclosure timing | Closed at Pass 5 — calendar 2027 anchored to NPRM RIA pp. 21099, 21163, 21169 (§3.3) |
| 9 | Mechanism panel translations | Closed at Pass 4 / refined at Pass 5 |
| 10 | "Defensible to your provost" check | Closed at Pass 5 — every verdict carries its rules-fired list with verbatim source text; integrity envelope and primary-source reminder make external defensibility the user's call, not the tool's claim |
| 11 | In-state-share derivation | Closed at Pass 3 — PPD provides directly |
| 12 | Noise-band threshold | Set at ±15% of benchmark in Pass 4; Pass 5 confirmed |
| 13 | Cross-validation conflict policy | Closed at Pass 5 — per-program inline + 5%-systemic banner |
| 14 | IPEDS Title-IV filter | Closed at Pass 3 — IPEDS Completions used for upper-bound only; PPD provides Title-IV-filtered subset |
| 15 | Calendar 2027 operational meaning | Closed at Pass 5 — anchored verbatim to NPRM RIA + OBBBA § 84001 |
| 16 | Print export institution logo | Closed — no, privacy and brand-control concerns; institution name only |
| 17 (new) | Localization of date / number formats | Carried — US English / US locale for MVP; Spanish + bilingual UIs deferred |

---

## 12. Build sequence (final)

| Week | Deliverable |
|---|---|
| 1 | Pipeline ingest D1, D2, D3, D4, D6 (panel only), D8, D9. Joined per-(UNITID, CIP4, CREDLEV) record set; CIP6 IPEDS-Completions roll-ups; `ui_strings` generation with Pass-4 lint. |
| 2 | Rules engine R01–R20 with §16 fallbacks. Cross-validation against PPD pre-computed verdicts. Noise-band annotations. |
| 3 | API: `POST /api/v1/analysis`, `GET /api/v1/institutions?q=`, `integrity_envelope`. |
| 4 | UI: Persona A end-to-end. Verdict cards (v6 §7.2). Drill-in (v6 §7.3). |
| 5 | Persona B end-to-end. "What the rule does" screen (v6 §7.5). Hidden-program surfacer (v6 §7.4). Eight auto-triggered mechanism panels with v6 headers. |
| 6 | Peer compare (same-state). PDF print export with integrity-envelope footer. Mobile polish. |
| 7 | Public beta. Feedback solicited from 5 deans across CSU campuses + 1–2 non-CSU peers. |
| 8 | Beta-feedback hardening. Re-run Pass-5 integrity check after any beta-driven changes. |

---

## 13. Success criteria (final, measurable)

A tool ships if and only if:

- A Dean lands cold and completes Persona-A flow in under 11 minutes (timed; target n=5).
- The verdict card on mobile shows exactly one bolded number above the fold.
- No UI string contains "cascade," "supergroup," "STATS," "subpart Q," "subpart R," "PrivacySuppressed," "OPEID6," "PAR-data," or "PAR-derived."
- Tool's re-derivation agrees with PPD's pre-computed pass/fail on ≥ 99% of (UNITID, CIP4, CREDLEV) cells where both are present and unsuppressed.
- Every verdict card carries either (a) verbatim source-rule text in its drill-in, or (b) explicit annotation that the input was parametric / unavailable.
- Identical input on day 1 and day 30 yields byte-identical verdicts (modulo `request_id` and `timestamp`).
- One Dean reads the "What the rule does" screen and can name the calendar 2027 / AY 2028-29 dates without re-reading.
- The print export fits on one printed page.
- The integrity envelope is present on every result page and the print export.
- The primary-source-reminder is present in framer, verdict-page footer, drill-in footer, and print-export footer.

---

## 14. Risks accepted in MVP scope

Carried from v2 §14 with one addition.

| Cut | Risk | Mitigation |
|---|---|---|
| Carnegie / AAUDE / CSU-sister peers | Dean cannot reach the peer comparison they actually use | Custom UNITID peer list scheduled post-MVP; same-state default is a reasonable proxy for many Deans |
| Multi-PPD historical view | Dean sees only the latest snapshot | First-cycle Deans need the snapshot; trajectory view scheduled for v2 of the tool |
| Bubble-band as separate verdict | A program at +6% gets a green PASS that may underweight risk | R19 noise band annotation makes risk visible inline |
| Institutional cascade verdict suppressed | Dean does not see institution-level risk story | M06 advisory + cross-validation banner cover this |
| SVG cascade diagrams | Drill-in is text-heavy | Tight prose + structured headings; diagrams scheduled post-MVP |
| Bulk download | IR analyst's reproduction work is harder | Per-rule citation in API response; analyst hits underlying datasets directly |
| Spanish UI | Spanish-dominant Deans excluded | Highest post-MVP accessibility priority |
| (NEW v6) Tool's voice may still feel American-academic-administrator-coded | Limits use outside that audience | Documented; not a barrier to MVP for the named user (CSU + similar deans) |

---

## 15. Diff log: v5 → v6

| Section | Change |
|---|---|
| §0 | Pass-5 outcome at a glance — voice swap, integrity envelope, primary-source reminder, first-failure timing anchored, cross-validation policy named |
| §1 | Persona B renamed; cross-persona invariants gain primary-source-reminder rule and "no prescription" rule |
| §3 | Verdict words list affirmed (PASS / FAIL / NOT MEASURED); noise-band annotation rules; cross-validation policy stated; first-failure timing closed against verbatim citations |
| §4 | New `integrity_envelope` block; schema bump 1.4.0 → 1.5.0 |
| §5 | Mechanism-panel headers rewritten in peer voice; M04 header restructured |
| §6 | Peer-comparison view gains integrity disclosure footer |
| §7 | Verdict card and drill-in rewritten without rhetorical-question subheads; "What the rule does" screen replaces the v5 prescriptive variant; print export gains integrity-envelope footer |
| §11 | All open questions either closed or explicitly carried as post-MVP |
| §13 | Success criteria become measurable across all five passes |
| §14 | Risks list carried with one v6-specific addition (voice still American-academic-administrator-coded) |
| §15 | This diff log |

---

## 16. Fallback paths (unchanged from v4 / v5)

R01–R02 upper-bound from IPEDS Completions; R06 IRS suppression → NOT MEASURED with data-quality flag; R07 in-state share primary path PPD direct; R13 single-year-only; R08 ACS cell drop handled inside PPD; R19 noise band advisory; R20 cross-validation disagreement → both verdicts surfaced with provenance.

General principle: every parametric path either surfaces a more-conservative outcome with explanation, or carries citable provenance, or annotates the input as derived. No silent substitution; no hidden judgment.

---

## 17. Glossary (carried from v5; v6 additions)

The internal-vs-Dean-facing vocabulary glossary from v5 §17 carries unchanged. v6 adds two entries:

| Internal term | Dean-facing equivalent |
|---|---|
| Integrity envelope | Snapshot metadata (build date, PPD release, noise-band count, cross-validation status) |
| Primary-source reminder | "Re-derive against primary sources before any external submission" |

---

## 18. Provenance — what each design pass changed

| Pass | Source criterion | Net effect on the tool |
|---|---|---|
| v1 (baseline) | — | Architecture, rules engine, response shape, tech stack |
| v2 (Pass 1 — concept discipline) | Did this change the Dean's calendar next Tuesday? | Cut Carnegie / AAUDE / CSU-sister / custom-UNITID peers; cut bulk download; cut multi-PPD; cut SVG diagrams; cut Spanish UI; reduced auto-triggered mechanism panels from 17 to 7 |
| v3 (Pass 2 — determinism audit) | Every output tagged DET / PAR / judgment | R12 converted to display helper; R15 converted to advisory; per-rule `data_status` added; fallback paths defined for every parametric rule |
| v4 (Pass 3 — data availability) | Verify access at required granularity | Six findings reshape the rule wiring: PPD is 4-digit not 6-digit; pooled cohort 2017-18+2018-19; four-layer suppression; in-state share read directly from PPD; pre-computed pass/fail enables R20 cross-validation; STATS dataset is PPD operationally |
| v5 (Pass 4 — anti-data-dump) | Skimmable, non-jargon, one headline per screen | Vocabulary swap glossary; verdict-word tightening; "What this means" screen; lint rule on Dean-facing strings |
| v6 (Pass 5 — peer respect & integrity) | Talk to a Dean as a peer; every claim defensible | Voice swap from instructional to peer; integrity envelope on every output; primary-source reminder; first-failure timing anchored verbatim; cross-validation conflict policy; "what the rule does" replaces "what to do" |

---

— end design.v6.md (final) —
