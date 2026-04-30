# SPEC-DELTA — published PPD:2026 vs design.v6 §2-§3 assumptions

**Status:** Phase 0 deliverable. Decides whether Phase 1 proceeds against design.v6 as written or requires a v7 spec patch.

**Reader:** chair / mayor reviewing whether to greenlight Phase 1.

**Bottom line:** Phase 1 can proceed against design.v6 as written. The published PPD:2026 grain matches §3's expectation. The deltas listed below are scoped at the build pipeline (clarifications, not rule rewrites). No R01–R20 precondition breaks. **Recommend: greenlight Phase 1.**

---

## 1. The load-bearing question (epic body)

> Does PPD:2026 publish at the grain spec §3 assumes (institution × CIP4 × CREDLEV with cohort size, ep_gap_pct, suppression flag per cell)?

### Empirical answer

Source: `ahead-session-2-program-performance-data-debt-earnings-and-earnings-test-metrics-112908.xlsx` (PPD:2026, ED-published, 209,321 rows, single sheet `Sheet1`).

| Spec §3 assumption | Published reality | Match? |
|---|---|---|
| Grain = institution × CIP4 × CREDLEV | Grain = `opeid6` × `cip4` × `credlev`, with **zero duplicates on the composite key** across all 209,321 rows (verified) | **Yes**, modulo institution-id idiom (see §2.1) |
| Per-cell cohort size | `count_wne_p4` (working-not-enrolled, 4-year horizon) | Yes |
| Per-cell `ep_gap_pct` | **Not published.** Tool must derive from `(md_earn_wne_p4, earn_bnchmrk_cip2_wageb)` | **Derived, not read** — clarification, not a break |
| Per-cell suppression flag | Multi-layer: `missing_test_cip2_wageb` (privacy), `which_test_cip2_wageb='Not Listed in Section 84001'` (scope-exclusion), `count_wne_p4 IS NULL` (cohort floor), `md_earn_wne_p4 IS NULL` (earnings floor) | **Four-layer**, not one — clarification, not a break |
| Pre-computed pass/fail (R20 cross-check) | `fail_obbb_cip2_wageb`, plus credlev-specific `mstr_obbb_fail_cip2_wageb` | Yes |

CREDLEV distinct values (eight, all string-typed): `Associate`, `Bachelor`, `Doctoral`, `First Professional Degree`, `Graduate Certificate`, `Master's`, `Post-Bacc Certificate`, `Undergrad Certificate`.

---

## 2. Deltas — what the build pipeline absorbs

### 2.1 Institution ID is OPEID6, not UNITID

**Spec §3 says:** "institution × CIP4 × CREDLEV". The §2 manifest correctly lists IPEDS HD as the source for institution lookup; spec §13's success-criteria forbidden-string list explicitly bans `OPEID6` from Dean-facing UI strings.

**Published reality:** PPD's institution key is `opeid6` (6-char). UNITID is not in PPD.

**Pipeline absorbs:** `data/build/build_fixtures.py` builds an OPEID6 ↔ UNITID crosswalk from IPEDS HD (joining on the first 6 characters of `OPEID`) and writes the JSON keyed on UNITID. Persona A's UI input is UNITID; the build does the map at fixture-build time.

**Coverage:** 208,251 of 209,321 PPD rows joined to IPEDS HD — 99.49%. The 1,070 unjoined rows are likely closed institutions or branch campuses with synthetic OPEIDs; Phase 1 should surface those as "institution not in IPEDS directory" if a Dean enters their UNITID and gets no match (a gap-coverage flag, not a rule break).

**Effect on rules:** none. R01–R20 read the joined record by UNITID; the OPEID6 round-trip is a pipeline concern.

---

### 2.2 `ep_gap_pct` is derived, not published

**Spec §3.1:** "A `PASS` verdict where `abs(ep_gap_pct) <= 0.15` carries the R19 noise-band annotation". Spec implies `ep_gap_pct` is read from the published cell.

**Published reality:** PPD does not publish a percentage gap. It publishes:
- `md_earn_wne_p4` (median earnings, USD)
- `earn_bnchmrk_cip2_wageb` (benchmark, USD)
- `fail_obbb_cip2_wageb` (binary pass/fail; 0/1/null)

**Pipeline absorbs:** the build computes `ep_gap_pct = (md_earn_wne_p4 - earn_bnchmrk_cip2_wageb) / earn_bnchmrk_cip2_wageb` and stores it on each program record. Returns `null` if either input is missing.

**Effect on rules:**

- **R11 (gap calculation)** — the rule's primary computation runs as designed; the published verdict (`fail_obbb_cip2_wageb`) is the cross-check, not the input.
- **R19 (noise-band advisory)** — fires on `abs(ep_gap_pct) <= 0.15` over the **tool-derived** value. **Provenance annotation in the verdict card should make this explicit:** "noise-band threshold computed from PPD-published earnings and benchmark; the percentage gap is not itself published." The drill-in already shows the underlying values per spec §7.3, so this is an annotation refinement rather than a rule change.
- **R19 cells where earnings are suppressed** — when `md_earn_wne_p4 IS NULL` but `fail_obbb_cip2_wageb` is published, the tool **cannot** compute a noise-band annotation (no gap). The verdict still surfaces as PASS or FAIL from the published flag, but the noise-band test is structurally inapplicable. Recommend: those cells carry a separate annotation "verdict is PPD-published; underlying earnings cell suppressed under federal privacy rule." This is a new annotation case that R19 does not currently enumerate. **Phase 1 spec patch suggestion below.**

---

### 2.3 Suppression is four-layer, not one flag

**Spec §3 implies:** one suppression flag per cell.

**Published reality:** four distinct suppression mechanisms, each independent:

| Layer | PPD signal | Population (of 209,321 rows) | Meaning |
|---|---|---|---|
| Privacy noise suppression | `missing_test_cip2_wageb = 1` | 2,995 (1.4%) | data perturbation moved median earnings >9% from true value; cell suppressed under PPD privacy rule |
| Scope exclusion | `which_test_cip2_wageb = 'Not Listed in Section 84001'` | 41,818 (20.0%) | program is outside OBBBA § 84001 scope; e.g., undergrad certificates not subject to the test |
| Cohort floor | `count_wne_p4 IS NULL` | 159,461 (76.2%) | cohort below 30 after expansion, OR cell otherwise unmeasurable |
| Earnings floor | `md_earn_wne_p4 IS NULL` | 159,461 (76.2%) | IRS reporters below 16, OR cell unmeasurable |

(In PPD:2026 the cohort and earnings floors fire together — every row with `count_wne_p4 IS NULL` also has `md_earn_wne_p4 IS NULL`. Both are surfaced separately on the JSON record because the rule conceptually distinguishes them, even when in the data they always co-occur.)

**Pipeline absorbs:** the JSON `suppression` object exposes all four flags (`missing_test`, `out_of_scope`, `cohort_suppressed`, `earn_suppressed`). The rules engine consumes them individually.

**Effect on rules:**

- **R03 (Stage 3 input)** — Already designed to read the PPD cell directly (per source-notes Pass-3 finding). No change.
- **R05 (cascade exhausted → no median published)** — The PPD-published `null` on cohort/earnings IS the operationalization of cascade exhaustion. The spec rule fires from `cohort_suppressed = true` when scope inclusion is true (i.e., not `out_of_scope`). Pipeline output makes this a clean lookup.
- **R12 (NOT MEASURED branch)** — Currently spec §7.2 enumerates three reasons in the verdict card prose ("cohort below 30 after expansion to 2-digit CIP family. Or: IRS records below 16. Or: cell suppressed by federal privacy rule"). Recommend: a fourth reason "program out of OBBBA § 84001 scope (e.g., undergraduate certificate)" so undergrad-certificate programs do not surface as anomalous "not measured" verdicts. **Phase 1 spec patch suggestion below.**
- **R19** — see §2.2 above; suppressed-earnings cells need an annotation that the spec does not currently enumerate.

---

### 2.4 In-state share variable is in a different PPD file

**Spec §3 / R07:** Pass-3 finding (cited in source-notes R07) says PPD publishes the in-state share directly via `t4enrl_inst_instate_p1819`.

**Published reality:** that variable is **NOT** in the debt-earnings file (the load-bearing one). Phase 0 inferred from the AHEAD manifest that it would live in `ppd2026-financial-aid-part-1.xlsx`. **Phase 1 verified empirically: it is actually in `ppd2026-institution-characteristics-and-completions.xlsx`** (column scan across all six PPD xlsx files, 2026-04-30). The same file also publishes `pct_t4enrl_instate_p1819` (the percentage already pre-computed; 0–100 scale), which the build pipeline divides by 100 to store the canonical fraction.

**Pipeline absorbs (Phase 1):** `build_fixtures.py` loads the inst-characteristics file, dedupes to one row per `opeid6`, and broadcasts `pct_t4enrl_instate_p1819 / 100` as the per-program `in_state_share` field on every program record under that institution. fetch_ppd.py supports both `--only fa1` and `--only inst`; only `inst` is consumed by the build (kept fa1 entry for parity with the source-notes manifest).

**Effect on rules:** R07 fires at request time against the `in_state_share` field on the per-program JSON record. CSULB's value is `0.9918` — well above the 50% threshold, so the same-state HS median branch is in scope (consistent with PPD's `Same-State HS Median` benchmark route on UG cells).

**SPEC-DELTA reconciliation:** the bead-attached spec note allowed for "successor variable name" precisely for this kind of file-location drift; no v7 spec patch is required, but consumers reading SPEC-DELTA should know the variable is in `inst`, not `fa1`.

---

### 2.5 Benchmark-route enumeration

The published `which_test_cip2_wageb` field discloses which of the rule's branches PPD selected. Eight observed values:

```
Same-State HS Median             97,660  (UG, in-state route)
Not Listed in Section 84001      41,818  (out-of-scope)
National Same-Field BA Median    31,320  (graduate, lowest-of-three)
Same-State BA Median             15,771  (graduate, lowest-of-three)
National HS Median               14,244  (UG, national fallback when in-state share <50%)
National BA Median                4,710  (graduate, lowest-of-three)
Same-State, Same-Field BA Median  3,359  (graduate, lowest-of-three)
Tie for Lowest Test                 439  (graduate, two of three branches tie)
```

**Effect on rules:**

- **R08 / R09 / R10** — The rule's verdict comparison is fundamentally already encoded in the published benchmark value, but the published `which_test_cip2_wageb` field gives the tool authoritative provenance: when the tool's drill-in says "the rule's lowest-of-three landed on national same-field BA median", that statement is now anchored to a published cell rather than re-derived.
- **Spec §7.3 drill-in** — currently the drill-in shows "Source: PPD:2026 (CA × CIP-50 BA, lowest of three under OBBBA § 84001(c)(3)(B)(ii))" as an inferred statement. Recommend: surface the literal `benchmark_route` value alongside this prose, so the Dean sees both the rule reference and the agency's own selection label. **Annotation refinement, not rule change.**

---

## 3. Rule-by-rule precondition check

| Rule | Spec precondition | Holds? | Note |
|---|---|---|---|
| R01 | IPEDS Completions provides 6-digit cohort | yes | unchanged from Pass 3 |
| R02 | Same as R01 | yes | unchanged |
| R03 | PPD publishes 4-digit cell | **yes** | grain confirmed; this is the load-bearing answer |
| R04 | 2-digit cascade reads PPD if 4-digit absent | yes (degenerate) | empirically PPD already publishes most 4-digit cells; the 2-digit fallback is a small population |
| R05 | Cascade-exhausted cells published as null | yes | `count_wne_p4 IS NULL` ∧ scope-included is the published operationalization |
| R06 | IRS floor n≥16 → cell suppressed | yes | already applied by PPD (per Tech Appendix p. 7) |
| R07 | In-state share read from PPD `t4enrl_inst_instate_p1819` | **yes (Phase 1 wired)** | variable is in `inst-characteristics-and-completions` file (not financial-aid-part-1; see §2.4); build now broadcasts `pct_t4enrl_instate_p1819 / 100` per program as `in_state_share` |
| R08 | Lowest-of-three encoded in PPD benchmark | yes | `which_test_cip2_wageb` field discloses the rule branch |
| R09 | UG state-HS-only baseline | yes | `Same-State HS Median` is the largest published route (97,660 cells) |
| R10 | ACS n=30 cell drop already applied by PPD | yes | per Tech Appendix |
| R11 | Gap calculation derives from published earnings + benchmark | yes (tool-derived) | see §2.2 — spec implies published; reality is derived |
| R12 | NOT MEASURED branch | yes | additional reason for out-of-scope (§2.3); minor enumeration patch suggested |
| R13 | 2-of-3-year trigger | yes | "describes-but-does-not-execute" at MVP per source-notes; PPD:2027 + PPD:2028 enable when published |
| R14 | Hidden-program surfacer reads IPEDS Completions | **yes (Phase 1 wired)** | IPEDS C2024_A pulled by `fetch_ipeds.py --only c_a`; build emits `hidden_program_candidates` array per institution. CSULB Cinematic Arts BA (cip6 50.0601, AWLEVEL=5, 230 completers) verified in §4 |
| R15 | Institutional cascade advisory | yes | M06-pointer advisory only |
| R16 | Pandemic-cohort advisory | yes | static range check |
| R17 | RIA Table 3.19 elevation flag | yes | static CIP6 list |
| R18 | OBBBA § 81001 loan-cap advisory | yes | static |
| R19 | Noise-band on `abs(ep_gap_pct) <= 0.15` | **yes, with annotation patch** | see §2.2; ep_gap_pct is tool-derived; suppressed-earnings cells need a parallel annotation |
| R20 | Cross-validation against PPD pre-computed verdict | yes | `fail_obbb_cip2_wageb` direct read |

**No rule fundamentally breaks. Two annotation refinements suggested for Phase 1:**

1. R19 — verdict provenance string clarifies that `ep_gap_pct` is tool-derived from PPD-published earnings and benchmark; suppressed-earnings cells (where the published verdict exists but the underlying earnings are privacy-suppressed) need a fourth annotation case.
2. R12 — NOT MEASURED enumeration adds an `out_of_scope` reason ("program is outside OBBBA § 84001 scope, e.g., undergraduate certificate").

Both are Phase 1 implementation choices, not v7 spec rewrites.

---

## 4. Validation against known CSULB numbers

The Phase 0 fixture (`tests/fixtures/sample-institution.json`, UNITID 110583, CSULB) reproduces every numeric claim in the dean memo (`briefs/2026-04-23-dean-royce-OBBBA-EP-synthesis.v10.md` §1 bottom-line) directly from PPD:

| Program | cip4 | credlev | cohort | median | benchmark | gap | PPD fail | Memo claim |
|---|---|---|---|---|---|---|---|---|
| Music MM | 5009 | Master's | 28 | $32,534 | $48,304 | −32.65% | 1 | "FAIL at $32,534 (−32.6%, n=28)" ✓ |
| Art MFA | 5007 | Master's | 23 | $38,452 | $48,304 | −20.40% | 1 | "FAIL at $38,452 (−20.4%, n=23)" ✓ |
| Theatre BA | 5005 | Bachelor | 81 | $38,270 | $36,082 | +6.06% | 0 | "PASS at $38,270 (+6.1%, n=81)" ✓ — within R19 noise band |
| Cinematic Arts BA | 5006 | Bachelor | — | — | — | — | (null) | "invisible, zero rows at CIP 50.06" ✓ — confirmed: no 5006 BA row in PPD for CSULB |

Cinematic Arts BA's invisibility is the v9/v10 dean memo's signature finding (B16). The Phase 0 fixture confirms it: CSULB has zero rows at `cip4=5006, credlev=Bachelor` in PPD:2026.

**Phase 1 surfacer verified.** The `hidden_program_candidates` array on CSULB's record (UNITID 110583) now contains `{ cip6: "50.0601", credlev: "Bachelor", completers_total: 230, vintage: "2024" }` — the IPEDS C2024_A row for CIPCODE 50.0601 / AWLEVEL=5 / MAJORNUM=1 confers 230 awards, while PPD reports zero rows at the corresponding (cip4=5006, Bachelor) cell. The B16 invisibility test passes both halves: invisible in PPD AND surfaced by R14.

---

## 5. Phase 1 readiness recommendation

**Greenlight Phase 1 against design.v6 as written.** Two annotation enumerations (§2.2, §2.3) belong inside the rules engine, not in a v7 spec patch. The build pipeline owes Phase 1 one additional deliverable: financial-aid-part-1 join for R07 in-state share (§2.4).

Where the spec already correctly anticipates the deltas (OPEID6 → UNITID crosswalk in §2 manifest, four-layer suppression in §3 fallback paths, in-state share read from PPD per Pass 3), Phase 0 has wired up the pipeline plumbing and confirms the data shape matches.

— end SPEC-DELTA.md (Phase 0, 2026-04-29) —
