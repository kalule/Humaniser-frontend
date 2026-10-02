# Consolidated Fix Pass 2 — All Remaining Open Items

Each item kept its own investigate → implement → verify gate, per instruction. Two items (3 and 4)
surfaced something that changed the plan — reported plainly below rather than pushed through.

---

## Item 1 — SafeFetch error handling: half-confirmed, fixed

The third-party claim ("silently swallows 429/timeout") was **half right**. `SafeFetch` already had a
structured `ProviderHealth` log line distinguishing `timedOut=true`/`rateLimited=true` from a generic
failure — not actually silent. But every path hardcoded `retryCount=0` and never retried: a single
transient 429/timeout/5xx permanently zeroed out that provider for the rest of the request, identical to
a genuine empty result from the caller's point of view.

**Implemented**: bounded retry (2 retries, fixed 500ms/2s backoff) for transient failures only —
timeout, 429, and 5xx. A genuine successful-empty response and non-transient 4xx errors are still
returned immediately, unretried. 6 new tests (`PR28_SafeFetchRetryTests.cs`), all passing: retry-then-
succeed for each transient class, bounded-retry-then-give-up, genuine-empty-not-retried, non-transient-
not-retried.

---

## Item 2 — PR-25's net-new rows: audited, pruning proposed, not executed

**A real discrepancy found before auditing anything**: the documented "787 net-new rows" doesn't match
the current pool. Nanocarriers' pool is 1,456 rows, not the expected 1,042 + 787 = 1,829. The actual
current batch (all inserted in one event, 09:54:22–29 on 2026-08-06) is **414 rows**, not 787 — confirmed
via `AddedAt` clustering, and confirmed the batch is real (specific example titles from the original
report, e.g. "Corporate reputation: A discussion on construct definition...", are present). Cause of the
discrepancy not established — flagged, not chased further within this item's scope.

**Audited what's actually there** (414 rows, row-by-row keyword classification since there's no stored
per-query provenance to bulk-tag by):
- 217/414 (52%) contain a construct/operationalization/measurement/definition/variable/instrument
  signal — plausibly relevant to 5.7's targeted sub-theme.
- 197/414 lack any such signal; of those, ~55 are unmistakably the clinical-prediction/prognostic-model
  noise class ("Predictors of Complicated Grief," "NIH Stroke Scale as an Outcome," etc.) PR-25's own
  report already characterized for its query 3, and the remainder are generic cross-disciplinary
  business/psychology/health topics unrelated to either 5.7's sub-theme or this project's actual domain.

**Proposed, not executed**: the ~182 no-signal rows are the candidate deletion list. Deletion against
real accumulated pool data is destructive and not reversible without a backup — consistent with this
investigation's standing practice for anything touching real data destructively (e.g. PR-24 Part 2's
live-fetch queries were proposed, not run), this is left for explicit review/authorization rather than
executed autonomously in this pass.

---

## Item 3 — Extend 5.7's collision guard: STOPPED — the fix as planned would not work

**Verified via direct `ScoreClaimRelevance` calls against the real pool rows, not assumed.** Of PR-25's
3 named "collision-suspect" rows, only **1** (Burnout Assessment Tool BAT-23) actually passes via an
unguarded theme (`variable operationalisation`, score=6). The other 2 pass via the theme PR-24 **already
guarded** — with their anchors legitimately satisfied (temporal-muscle-thickness matches
`measurement validity instrument reliability` on `reliability+validity+measurement`, anchor="measurement"
present; Self-reported Cognitive Scales matches `conceptual relationships variable construct` on
`relationships+construct`, anchor="construct" present).

**Consequence, checked not assumed**: even a perfect guard on the 2 remaining unguarded themes would
leave all 3 rows in 5.7's selected output unchanged — Burnout BAT-23 would still qualify via its other,
legitimate, already-guarded match (score=15). Guarding the 2 unguarded themes as planned would not
achieve the stated goal at all.

**A candidate anchor was tested and rejected before implementing anything**: hypothesized
"conceptualization/conceptualisation co-occurrence" as an anchor — tested against a confirmed genuine
strict hit ("Corporate reputation: A discussion on construct definition and measurement...") and it would
have **incorrectly excluded it** (`hasConceptual*=False` for that genuine hit). No safe, evidence-tested
anchor was found for these two themes in this pass.

**Not implemented.** Fixing the 2 rows that matter would require tightening the anchors on the
*already-guarded* themes — a different, riskier change than what was planned, and exactly the class of
mistake PR-22's own history (see Item 7) already warns against: a blanket-feeling change validated against
one case starving genuine content elsewhere. Left for its own dedicated investigation with fresh evidence,
not forced through here.

**Secondary finding, unprompted but real**: "Operationalization and Measurement of Evaluation Constructs"
— a PR-25-reported *strict* hit — now scores 0 on all four 5.7 themes. Cause: no stemming ("Constructs"
plural ≠ "construct") and no US/UK spelling normalization ("Operationalization" ≠ "operationalisation").
A genuine recall gap, separate from this item's collision-precision scope — flagged for its own follow-up.

---

## Item 4 — Section-numbering defect: already fixed, freshly re-verified

This is the exact defect a prior pass (canonical `_proposalSectionDefs` model + data migration) already
fixed and which is already committed (confirmed via `git log`, under a differently-worded commit message
that doesn't name it explicitly — the fix itself is present in the current codebase). Rather than assume
that from the commit history alone, re-verified independently and freshly:
- Queried **every** project in the database with 5.10/5.11/5.12 sections (67 total) — `5.10 < 5.11 < 5.12`
  holds for all 67, zero exceptions, zero regressions since the fix landed.
- Confirmed zero `SectionCode = '1.1'` rows exist anywhere in the database, and the frontend's
  `proposalOutline.ts` still has no `1.1` entry — "no 1.1" remains confirmed intentional, unchanged.

**No action needed. This item is closed.**

---

## Item 5 — 5.4 domain-thinness residual: confirmed genuine content gap, not a vocabulary fix

Checked the eBPF project's pool (4,097+ rows) directly, no live calls:
- Zero rows co-occur "eligib*" with any of container/kubernetes.
- 23 rows co-occur "inclusion criteria"/"exclusion criteria" with system/deployment/environment — all 23
  inspected, and every one is an incidental match (health system, educational system, learning systems),
  none genuinely about technical/systems study-eligibility content.

**Plain verdict**: this is not a same-day vocabulary fix — there is no genuine eBPF/container-security-
specific "how to write eligibility criteria" literature in this pool under any phrasing tried, because
that specific cross-disciplinary methods genre (like 5.7's construct-operationalisation gap) simply isn't
well-represented for this technical domain. A live-fetch authorization request (candidate query, e.g.
`"inclusion exclusion criteria technical systems evaluation study design"`) would be the next step if this
is judged worth pursuing — **proposed only, not executed**, per the same discipline as PR-24 Part 2's
proposal for 5.7.

---

## Item 6 — Prompt completeness gaps: implemented

Four targeted additions to `ResearchPrompts.cs`, each a required *category* to address rather than
prescriptive boilerplate text, preserving model discretion to tailor specifics to the actual project:

- **6.1 Timeline**: phase dependencies + institutional-approval/recruitment lead time; a contingency
  allowance for the study's own most delay-prone phase, with the buffer derived from the study's actual
  risk profile, not a fixed rule.
- **6.2 Budget**: a contingency line item in the table, justified the same way every other line item is
  justified, not an unexplained flat percentage.
- **5.11 Ethics**: explicit consent-to-sensitive-data (conditional on the study actually collecting
  sensitive categories), incidental-findings handling (or an explicit "none anticipated" statement), and
  conflict-of-interest disclosure (or an explicit "none exists" statement).
- **5.10 Data Management** (both Qualitative and Mixed overrides): tightened the NVivo/coding-software
  instruction from "name it" to explain how it's actually used — coding scheme origin, which specific
  software features support that scheme, and how coding consistency is checked.

**Verification**: confirmed compiled and wired into the same `GetSectionPrompt` guidance-dictionary
mechanism already traced earlier in this investigation. Did **not** make a live Claude call to observe
generated output — consistent with this whole investigation's standing "no live provider calls without
explicit authorization" discipline, applied the same way here as everywhere else in this pass. Flagged
plainly rather than silently skipped.

---

## Item 7 — Document the PR-22 reframing: done, no code behavior change

Added a comment in `ResearchService.cs`, directly beside the PR-27 5.4-guard entry it documents, tying
it back explicitly to the PR-22 comment two blocks above (`ResearchService.cs:1798-1815`) that first
diagnosed this exact word-sense-collision class and predicted its correct fix shape. States plainly: this
is PR-22's own prediction materializing a second time (first as a side effect discovered while fixing
5.9, now as its own externally-flagged 5.4 case), confirming the collision is a structural property of
`ScoreClaimRelevance`'s bag-of-words matching across any claim-level section — not a 5.9-specific quirk —
and confirmed absent from Gather/Workbench, which don't use this matching mechanism at all.

---

## Full test run

419 total (405 pre-existing + 6 new `PR28_SafeFetchRetryTests`, plus the untouched PR-26/PR-27 suites):
**403 passed, 16 failed** — the 16 failures are identical, by name, to the pre-existing baseline
established in the prior two passes (unrelated `ResearchPrompts.cs`/reviewer-feature work still
uncommitted elsewhere in the tree). **No regressions** from anything implemented in this pass.

## Not committed

Left in the working tree, per instruction. Temporary verification harnesses (`Pr27Harness`,
`Pr28Harness`) were deleted after use, same convention as every prior pass in this series.
