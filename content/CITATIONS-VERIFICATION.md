# content/citations.json — verification report

Spot-check verification of `primary_citation.verbatim` strings against the corpus's primary-source raw text. Per-rule cross-checks recorded below; passes (✓) and notes inline.

## Method

For each rule selected for spot-check, the `primary_citation.verbatim` and `corpus_anchor` line range from `citations.json` were compared character-for-character against the file at the cited path.

The spot-check pulled four rules at structurally distinct positions in the rule list: R03 (NPRM cohort-expansion preamble), R08 (IRC OBBBA statute), R10 (NPRM benchmark-cell-drop preamble), and R17 (NPRM RIA Table 3.19). These four exercise the three primary citation sources (`nprm`, `irc`, `ria`) and the two longest-quoted regulatory passages.

## R03 — Cohort expansion Stage 3

`citations.json → rules.R03.primary_citation.corpus_anchor`:
`research/primary-sources/STATS_NPRM_FR_2026-07666.raw.txt:2301-2320`

Verbatim string in `citations.json`:

> If the expanded cohort group still does not reach the minimum number of completers, the cohort would continue to include the completers from all five years (fourth through eighth award years prior to the earnings year) at that six-digit CIP code and credential level. Then, completers from programs at the same credential level sharing the first four CIP code digits would be added one at a time, starting with the fourth award year prior to the earnings year.

Source raw text, lines 2301–2312:

> If the expanded cohort group still does not reach the minimum number of completers, the cohort would continue to include the completers from all five years (fourth through eighth award years prior to the earnings year) at that six-digit CIP code and credential level. Then, completers from programs at the same credential level sharing the first four CIP code digits would be added one at a time, starting with the fourth award year prior to the earnings year.

Result: ✓ verbatim match. The full cited range (2301–2320) continues with the worked example (`Continuing with the same example…`), which was elided from the JSON entry; only the first two sentences quoted. The corpus anchor still points at the full passage so a reader can verify the omitted continuation.

## R08 — Graduate benchmark, lowest of three

`citations.json → rules.R08.primary_citation.corpus_anchor`:
`research/primary-sources/PLAW-119publ21.raw.txt:16513-16524`

Verbatim string in `citations.json`:

> with respect to an educational program that is a graduate or professional program — for the lowest median earnings of — (aa) a working adult in the State in which the institution is located; (bb) a working adult in the same field of study (as determined by the Secretary, such as by using the 2-digit CIP code) in the State in which the institution is located; and (cc) a working adult in the same field of study (as so determined) in the entire United States

Source raw text, lines 16513–16524:

> ‘‘(ii) with respect to an educational program that
> is a graduate or professional program—
> ‘‘(I) for the lowest median earnings of—
> ‘‘(aa) a working adult in the State in which
> the institution is located;
> ‘‘(bb) a working adult in the same field
> of study (as determined by the Secretary, such
> as by using the 2-digit CIP code) in the State
> in which the institution is located; and
> ‘‘(cc) a working adult in the same field
> of study (as so determined) in the entire
> United States;

Result: ✓ verbatim match. Smart-quote artifacts (`‘‘`, `’`) and Roman-numeral subsection markers (`(ii)`, `(I)`) from the FR/USC typesetting are normalized in the JSON `verbatim` field for engine consumption — a separate `corpus_anchor` preserves the unedited source for verification. This convention matches the v6 §6 peer-voice principle: the dean reads natural prose, the engine carries normalized strings, the verifier re-reads the raw source.

## R10 — Benchmark cell drop, ACS n=30

`citations.json → rules.R10.primary_citation.corpus_anchor`:
`research/primary-sources/STATS_NPRM_FR_2026-07666.raw.txt:2793-2834`

Verbatim string in `citations.json` (excerpted from the cited range):

> if statistically significant data (n-size of at least 30) for working adults aged 25–34 in the same field of study in the same State is unavailable, the Department proposes that the program will be evaluated against the lower of median income for working adults with a baccalaureate degree aged 25–34 in the same State and median income for working adults aged 25–34 with a baccalaureate degree in the same field of study nationally. The Department is concerned that calculating an earnings threshold using less than 30 individuals could produce arbitrary and non-representative values in which programs are judged against.

Source raw text, lines 2796–2812:

> if statistically significant data (n-size of at least 30) for working adults aged 25–34 in the same field of study in the same State is unavailable, the Department proposes that the program will be evaluated against the lower of median income for working adults with a baccalaureate degree aged 25–34 in the same State and median income for working adults aged 25–34 with a baccalaureate degree in the same field of study nationally. The Department is concerned that calculating an earnings threshold using less than 30 individuals could produce arbitrary and non-representative values in which programs are judged against.

Result: ✓ verbatim match. Cited range (2793–2834) extends through the Department's directed-question solicitation; the verbatim quote captures the operative rule.

## R17 — RIA Table 3.19 named CIP families

`citations.json → rules.R17.primary_citation.corpus_anchor`:
`research/primary-sources/STATS_NPRM_FR_2026-07666.raw.txt:8952-8970`

Verbatim string in `citations.json`:

> Mental and Social Health & Allied Professions master's degree programs (CIP=51.15), Teacher Education and Professional Development associate's degree programs (CIP=13.12), and Drama/Theater Arts bachelor's degree programs (CIPs=50.05, 50.07, and 50.09) are anticipated to be most impacted by the proposed regulations. These programs are often between 10 and 20 times more likely to fail the accountability framework under the proposed regulation relative to the current regulations.

Source raw text, lines 8952–8965:

> Mental and Social Health & Allied Professions master's degree programs
> (CIP=51.15), Teacher Education and Professional Development associate's
> degree programs (CIP=13.12), and Drama/Theater Arts bachelor's
> degree programs (CIPs=50.05, 50.07, and 50.09)
> are anticipated to be most impacted by the proposed regulations. These
> programs are often between 10 and 20 times more likely to fail the
> accountability framework under the proposed regulation relative to the
> current regulations.

Result: ✓ verbatim match (line breaks normalized to space). The cited range (8952–8970) extends through the explanation that public/non-profit institutions are no longer exempted under the proposed rule; the JSON entry quotes the structurally load-bearing CIP-family identification.

## Anomalies / spec patches considered

None of the four spot-checks surfaced a citation that could not be anchored to a primary source. No spec patches recommended for design.v7 from this verification round.

Two minor cataloging notes (not spec patches):

1. **R09** — `OBBBA § 84001(c)(3)(B)(i)(I)` plus `(c)(3)(A)(iii)(I)` together describe both the route (state baccalaureate cell) and the comparison group (high-school-only earner). The verbatim phrase "high-school-only earner" appears as a paraphrase of the IRC's `(A)(iii)(I)` "has only a high school diploma or its recognized equivalent." Both subsection cites are carried in the JSON; the verbatim `(c)(3)(A)(iii)(I)` quote is in `supporting_citations`.
2. **R19, R20** — `primary_citation.kind = "ria"` points at the PPD:2026 Technical Data Appendix PDF, which lives in the corpus as a binary PDF (`ahead-session-2-program-performance-data-technical-appendix-112901.pdf`) — there is no parallel `.raw.txt` to cite by line number. The `corpus_anchor` carries `p. 7` for R19 and document-level only for R20 (the Jan 2 2026 erratum is not paginated in the PDF as separately citable).

## Cross-namespace alignment with cp-0on.2

`mdoc_anchors` IDs in this file follow `M##[#kebab-section]` form. They have not been validated against the panel anchors that cp-0on.2 will emit when its M-doc renderer ships. Per the bead's coordination note: if cp-0on.3 ships first (this file), the namespace defines the contract and cp-0on.2 hydrates against it. If cp-0on.2 ships first, this file updates to its anchor IDs.

The current anchor IDs are derived from the M-doc draft heading structure (verified by `grep -nE "^##" analyses/mechanisms/M01-cohort-visibility-cascade.draft.md` and parallel calls). The kebab portion encodes a stable section concept, not a literal heading slug — section headings in `.draft.md` may rephrase between drafts.
