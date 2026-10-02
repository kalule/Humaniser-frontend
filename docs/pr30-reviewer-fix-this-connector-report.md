# PR: Reviewer-to-Editor "Fix This" Connector — Phase 1 (Directly-Fixable Findings Only)

## Step 0 — Confirmed before writing any code

**1. Re-verified the 22-finding classification against the real eBPF review data**, not the
investigation report's table on faith. Programmatically extracted every `Section(s) N.N` mention
from the real 22 findings' `Text`/`Suggestion` (`ebpf_review.json`, the same persisted review) and
cross-checked against the report's earlier per-row bucket. Two real discrepancies surfaced:

- Findings #8 and #9 (both budget-contingency findings) were bucketed "directly fixable → 6.2" in
  the earlier report, but neither finding's text literally contains the word "Section" anywhere —
  the report's own classification had inferred "6.2" from category context ("Methodology
  Feasibility"), not from the text. A parser that only trusts explicit `Section N` mentions
  (the only safe design — see Step 1) correctly returns no match for both.
- Finding #18 (missing abstract) contains a real, valid section mention — "Section 1.0" — but only
  as a positional anchor ("...abstract... before Section 1.0"), not as the section needing
  correction. A naive single-code extractor would have wrongly offered "Fix this → 1.0."

Net effect: the real, conservative parser's precision is **lower** than the investigation's earlier
63% estimate — see Step 1's results below for the corrected number.

**2. Confirmed `ApplySectionFixAsync`'s contract directly from `ResearchService.cs:6076-6125`**:
`(Guid projectId, Guid userId, string sectionCode, List<AlignmentIssue> issues, CancellationToken)`.
`EnsureApplyFixEligible` requires every issue's `SectionCode == sectionCode` and (previously)
`Source == IssueSource.LlmJudged`. It genuinely *can* be invoked with reviewer-sourced content
without touching the pipeline itself — by constructing an `AlignmentIssue` and reusing
`IssueSource.LlmJudged` — but doing that would mislabel provenance: the gate's own exception
message specifically claims `LlmJudged` means "issues identified by the alignment/quality checker
itself." Chose instead to add a new `IssueSource.ReviewerFinding` value and extend the gate to
accept both — a 2-line change, not a pipeline change, and it keeps the two origins honestly
distinguishable. Confirmed via direct DB query that the eBPF project's `ResearchProjectId`
(`20f54592-...`) has all 9 target section codes (5.5, 5.6, 5.9, 5.10, 5.11, 6.1, 6.2) drafted at
`Status = 4` (Approved), so `ApplySectionFixAsync` would find each section, not throw "has not
been drafted yet."

**3. Confirmed no existing structured field substitutes for location.** Re-read
`DocumentReview.cs` — no per-finding ID, no location field beyond `PageReference` (already known
to be null on this sample), findings are anonymous JSON array elements. Nothing to reuse; the
parser and the new resolution-state column are both genuinely new work, as the investigation
predicted.

---

## Step 1 — Location-inference parser: implemented, real precision measured (not assumed)

**`HumaniseAI.Infrastructure/Services/ReviewFindingSectionLocator.cs`** (new, internal, pure/static
— no DB dependency, directly unit-testable via the project's existing `InternalsVisibleTo`
convention).

Design, deliberately conservative at every ambiguous point (matches this project's standing
"don't match wrong" convention — see PR-27/29's anchor-guard work for the same principle applied
elsewhere):

- Only trusts an explicit `Section(s) N.N` mention — never infers from category, never a bare
  number.
- Exactly one distinct section code in a finding's combined `Text + Suggestion` → returns that
  code. Zero → not section-scoped (refuses). Two or more → refuses rather than guess a "primary"
  (the PR spec explicitly sanctioned this option over guessing).
- Rejects any code the project hasn't actually drafted (`Status >= Draft` in `project_sections`),
  even if it's a well-formed canonical code — a code this project doesn't have is exactly as
  unusable as no code at all.
- A suggestion asking to "add a/an abstract / executive summary / new section(s)" is refused even
  when its `Text` happens to name a real drafted section — that section is a positional anchor
  ("before Section 1.0"), not the fix target. This is the concrete fix for finding #18 above.
- `Severity == "Positive"` or a suggestion starting "No action needed" → refused regardless of any
  section mention.

**Real precision, measured against all 22 real findings (not the earlier idealized estimate)**:

| | Count | % of 22 | % of 19 actionable |
|---|---|---|---|
| Button shown (single confident, drafted section) | 9 | 41% | 47% |
| No button — zero/multi-section, no-action, or new-section-needed | 13 | 59% | — |

This is **lower** than the investigation's earlier 12/19 (63%) estimate. The gap is exactly the two
classes found in Step 0: two findings (#8, #9) the earlier report attributed to 6.2 by category
inference rather than text; two findings (#1, #16) that name a primary section plus an incidental
aside, which the report's table optimistically called "fixable" but this parser correctly refuses
rather than guess which one is primary. Both are honest, deliberate recall costs, not bugs — the
alternative (guessing) risks drafting a fix into the wrong section with no warning.

**18 unit tests** (`HumaniseAI.IntegrationTests/ReviewFindingSectionLocatorTests.cs`), fixtures
copied verbatim from the real eBPF review, not synthetic: covers all 9 single-match "fixable" real
findings, the two real multi-section refusals, the real "add abstract"/"add sections" refusals, a
real reference-list finding, a real Positive finding, a differently-severity'd "No action needed"
finding, and a not-drafted-in-this-project refusal. **18/18 passing.**

---

## Step 2 — Adapter + UI wiring: implemented

**Backend**:
- `IssueSource.ReviewerFinding` added (`ResearchDtos.cs`); `EnsureApplyFixEligible` accepts
  `LlmJudged` or `ReviewerFinding`.
- `DocumentReviewDto` gained `List<FindingFixEligibilityDto> FindingFixEligibility`, index-aligned
  with `Findings` — kept off `ReviewFindingDto` itself deliberately, since that record doubles as
  the raw shape Claude's JSON is deserialized into (`ReviewLlmResponse.Findings`) and this
  server-computed metadata has no business in that contract.
- `ReviewerService.GetAsync`/`MarkFindingResolvedAsync`/`GenerateAndPersistAsync` all compute
  eligibility via a new `GetDraftedSectionCodesAsync` helper (empty set for any non-ResearchProject
  source — confirmed via the earlier investigation and re-confirmed here that `PastedText`/
  `UploadedFile`/`SystematicReview` reviews can never have a fixable finding, since there's no
  `ProjectSection` to fix at all).

**Citation grounding**: confirmed (not re-litigated) from the investigation — `GetApplySectionFixPrompt`
already grounds against the section's own existing content plus cross-section memory context, not a
fresh Web/MyFiles/Hybrid choice. No change needed; this already matches "ground against the
project's existing literature pool," the right default for a reviewer-triggered fix.

**Frontend** (`ReviewerWorkspacePage.tsx`): reused the *existing* `SectionFixDiffModal` and
`researchApi.applySectionFix`/`confirmSectionFix`/`discardSectionFix` calls directly (no new
preview/confirm/discard mechanism built — the point of Step 0's finding that this pipeline already
exists). `FindingCard` renders a "Fix this" button only when
`findingFixEligibility[i].sectionCode` is non-null and not yet resolved — i.e., only for the real
9/22, never for the other 13. Clicking it calls `applySectionFix` with a single synthesized
`AlignmentIssue { sectionCode, issue: finding.text, suggestion: finding.suggestion, source:
'ReviewerFinding' }`, shows the same diff modal the alignment-checker flow already uses, and on
Accept calls `confirmSectionFix` then the new resolve endpoint.

---

## Step 3 — Local resolution-state tracking: implemented

- New column `document_reviews.ResolvedFindingIndexesJson` (text, default `"[]"`) — migration
  `20260807120047_AddDocumentReviewResolvedFindingIndexes`, applied to the real dev DB.
- Index-based identity, not a new GUID per finding: findings are immutable in count/order once a
  review is persisted (the entity's own doc comment already states a review "is only ever written
  once, at creation"), so an array index is safe here without touching `FindingsJson`'s shape or
  the Claude-facing schema.
- `ReviewerService.MarkFindingResolvedAsync` + `POST /api/v1/reviewer/reviews/{id}/findings/{index}/resolve`
  — idempotent, no re-review call.
- UI: a resolved finding stays visible (greyed card, "Fix applied" badge) rather than disappearing
  — the report deliberately does not overclaim: this records "a fix was applied through this flow,"
  not "the issue is confirmed resolved," matching the scope explicitly set for this step.

---

## Full verification

- **Backend**: `dotnet build` clean. Full `HumaniseAI.IntegrationTests` suite: **437 total (419
  pre-existing + 18 new), 421 passed, 16 failed** — the 16 failures are the same pre-existing
  baseline from prior passes in this series (uncommitted, unrelated `ResearchPrompts.cs`/reviewer
  work elsewhere in the tree causing live-Claude-dependent test failures unrelated to anything in
  this PR). **Zero regressions**; all 18 new tests pass.
- **Frontend**: `tsc --noEmit` clean, zero errors.
- **Migration**: generated and applied to the real dev DB (`dotnet ef database update`), confirmed
  idempotent additive column with a safe default for existing rows.
- Not manually tested in a running browser session against a live UI (would need starting both dev
  servers and a live Claude call through `ApplySectionFixAsync` — out of scope without explicit
  authorization, consistent with this series' "no live provider calls without authorization"
  convention; the code path is the same, already-live `applySectionFix`/`confirmSectionFix` flow
  the alignment-checker feature already exercises in production).

## Explicitly out of scope, as specified

- The 13/22 (59%) findings needing a human decision, a numeric recalculation, a reference-list
  dedup action, or a section that doesn't exist — no "Fix this" action rendered for these; no
  "Edit manually" fallback UI built either (flagged as a possible small follow-up, not built here).
- Automatic re-verification of an applied fix via a fresh reviewer pass.
- Multi-section findings (2 real cases) — refused by design, not partially handled.

## Not committed

Left in the working tree for review, per convention.
