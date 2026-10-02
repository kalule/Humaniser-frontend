# Feasibility: Connecting Document Reviewer to Editor-Based AI Fixes

Investigation only, per scope — no code changed. Files: `HumaniseAI.Application/DTOs/Reviewer/ReviewerDtos.cs`,
`HumaniseAI.Domain/Entities/DocumentReview.cs`, `HumaniseAI.Infrastructure/Services/ReviewerService.cs`,
`HumaniseAI.Infrastructure/Services/ReviewerPrompts.cs`, `HumaniseAI.Infrastructure/Services/ResearchService.cs`
(`ApplySectionFixAsync` region), `HumaniseAI.Application/DTOs/Research/ResearchDtos.cs` (`AlignmentIssue`),
`src/components/app/WriteWithAiModal.tsx`, `src/pages/app/DocumentEditorPage.tsx`. Evidence drawn from the
real, persisted eBPF project review (`document_reviews.Id = 4bdf7996-...`, 22 findings) plus all 45 reviews
currently in `humaniseaidb` for the aggregate statistics.

**Headline: the premise is wrong as stated, but not for the reason you'd guess.** The "editor half" — a
working, section-aware, preview/confirm "apply a targeted fix" mechanism — genuinely already exists. But
it's built for a *different, already-structured* issue type from a separate, older feature, not for
Document Reviewer's own findings, which are the unstructured half. Reusing it needs new location-inference
and adapter work; it is not a bare connector.

---

## Task 1 — What does a reviewer finding actually contain, structurally?

`ReviewFindingDto` (`ReviewerDtos.cs:3-9`):

```csharp
public record ReviewFindingDto(
    string  Category,       // a rubric dimension, e.g. "Ethics & Permissions" — NOT a section pointer
    string  Severity,       // "Critical" | "Warning" | "Info" | "Positive"
    string  Text,
    string  Suggestion,
    string? PageReference
);
```

**No structured location field exists.** The closest candidate, `PageReference`, is documented in
`ReviewerPrompts.cs:85` itself: *"a short string like 'p. 12' when you can attribute a finding to a page,
otherwise null — most input has no page markers, so usually null."* Checked against real data, not the
prompt's own claim: across all 860 findings currently in the database, 386 (45%) have a non-null
`PageReference` — higher than the prompt's own "usually null" framing suggests, and for `PastedText`/
`UploadedFile` sources the model does sometimes write real section references there too ("Section 5.11",
"Sections 5.5 and 5.6"). **But for the specific real example this task cites — the eBPF project's most
recent review, `ResearchProject`-sourced, 22 findings — every single one has `PageReference: null`.**
`Category` is not a substitute either: it's a rubric dimension ("Methodology Feasibility", "Alignment
Logic") that legitimately spans multiple document sections or none, never a 1:1 section pointer.

**The real signal is buried in free prose.** Every one of the 22 real eBPF findings' `Text` field
naturally references specific sections inline — *"the ethics section (5.11) does not address..."*,
*"the timeline (Section 6.1) compresses..."* — because that's how a human reviewer writes, not because
the schema requires or structures it. This is genuinely extractable with a regex (`Section (\d+\.\d+)`
style), but:
- It's unenforced — nothing in the JSON schema or prompt rules requires this phrasing; it's an emergent
  pattern in this sample, not a contract.
- Several findings reference **two or more sections** (finding 0: "Section 5.2" and "Section 5.4" together,
  for a cross-section genre-consistency issue — which one would "Fix this" open?).
- Several findings reference **no section at all** because the issue isn't section-scoped: the reference-
  list integrity findings (duplicate/mismatched entries) concern the compiled bibliography, which isn't a
  `ProjectSection` at all — it's assembled at export time from every section's citations combined.

**Persistence**: reviews are stored (`DocumentReview` entity, `document_reviews` table — not
generate-and-discard), but `FindingsJson`/`CategoryScoresJson`/`StandardsAppliedJson` are raw JSON-blob
columns (`DocumentReview.cs:43-45`), not a child table — individual findings have no database identity of
their own (no row, no ID) beyond their position in the array. Confirmed via the entity's own doc comment:
*"stored as JSON blobs... since they're rendered once on one results page and never queried/joined
independently."*

## Task 2 — Can the editor's AI-writing flow be pre-populated and scoped to a location?

**Two separate, unrelated mechanisms exist — the task's premise conflates them.**

**`WriteWithAiModal`** (`src/components/app/WriteWithAiModal.tsx`), used only in
`src/pages/app/DocumentEditorPage.tsx` (the general Workbench document editor): topic (required, free
text, user-typed — no prop/API path to pre-seed it from outside), target word count, and a Web/MyFiles/
Hybrid citation-source toggle. This is the flow Image 1 shows. **It is structurally irrelevant to this
feature**: `DocumentReview.SourceType` is `ResearchProject | SystematicReview | PastedText | UploadedFile`
— Workbench documents are never a review source at all, so a review finding could never point back to a
document this modal edits.

**`ApplySectionFixAsync`/`ConfirmSectionFixAsync`/`DiscardSectionFixAsync`** (`ResearchService.cs:6076-6169`,
wired live in `ResearchAgentPage.tsx`/`researchStore.ts`/`api/research.ts` — confirmed in active frontend
use, not dead backend code) is the actually-relevant mechanism: given a `sectionCode` and a
`List<AlignmentIssue>`, it drafts a corrected version of *that section's existing content* addressing
those issues, returns a diff for the student to review (preview step, credits reserved but not committed),
then either persists through the full post-generation pipeline (citation verification, facts-consistency —
same as a normal generation) or discards and releases the reservation. This already *is* "editor opens
pre-populated to draft a grounded fix at a specific location" — for a different issue type.

**The gate that matters** (`EnsureApplyFixEligible`, `ResearchService.cs:6057-6074`):

```csharp
if (issues.Any(i => i.Source != IssueSource.LlmJudged))
    throw new InvalidOperationException(
        "Apply fix is only available for issues identified by the alignment/quality checker itself — " +
        "citation, fact-conflict, and reference-count issues have their own dedicated review flow.");
```

`AlignmentIssue` (`ResearchDtos.cs:195-199`) requires a first-class `string SectionCode` — populated by
the *Proposal Studio's own alignment/quality checker* (`ValidateAlignmentAsync`, a separate, older,
already-structured feature), not by Document Reviewer. `ReviewFindingDto` cannot be passed to
`ApplySectionFixAsync` as-is: it isn't an `AlignmentIssue`, it has no `SectionCode`, and its `Source`
would need to be a value this enum doesn't have. Citation-grounding for a fix is not separately
selectable in this flow at all — `GetApplySectionFixPrompt` grounds the correction against the section's
*existing* content plus cross-section memory context (`RequiredMemoryFields`), not a fresh Web/MyFiles/
Hybrid choice — which actually already matches what this task's own Task 2 suggested defaulting to
("consistency with the rest of the document" rather than a fresh Web search), just via a different
existing path than assumed.

## Task 3 — Do reviewer findings map onto "things AI writing can fix"?

Sorted all 22 real findings from the eBPF review (the task's own cited example):

| # | Category | Severity | Section(s) named in text | Bucket |
|---|---|---|---|---|
| 0 | Alignment Logic | Critical | 5.2, 5.4 | **Needs human decision** — which genre is this study? |
| 1 | Analysis Plan | Critical | 5.8/5.9 | Directly fixable by drafting |
| 2 | Analysis Plan | Critical | 5.9 | Directly fixable by drafting |
| 3 | Analysis Plan | Critical | 5.10 | Directly fixable by drafting |
| 4 | Analysis Plan | Warning | 5.5 | Directly fixable by grounded drafting (needs a real citation) |
| 5 | Literature Foundation | Critical | *(reference list — no section)* | **Not section-scoped** — dedup/verify action, not drafting |
| 6 | Literature Foundation | Warning | *(reference list — no section)* | **Not section-scoped** — same as above |
| 7 | Methodology Feasibility | Critical | 6.1 | Directly fixable by drafting |
| 8 | Methodology Feasibility | Warning | 6.2 | Fixable, but needs a real $ recalculation, not grounded prose |
| 9 | Methodology Feasibility | Warning | 6.2 | Directly fixable by drafting (arbitrary $ figure caveat) |
| 10 | Ethics & Permissions | Critical | 5.11 | Directly fixable by drafting |
| 11 | Ethics & Permissions | Critical | 5.10 | Directly fixable by drafting |
| 12 | Ethics & Permissions | Warning | *(none — new sections)* | **Needs new sections that don't exist in the canonical outline** |
| 13 | Protocol Readiness | Warning | 6.1 | Directly fixable by drafting |
| 14 | Protocol Readiness | Warning | 6.2 | Directly fixable by drafting |
| 15 | Protocol Readiness | Info | 5.6 | Directly fixable by drafting |
| 16 | Alignment Logic | Warning | 4.1, 4.3 | Fixable by drafting, spans 2 sections |
| 17 | Alignment Logic | Warning | 5.1, 5.4 | **Needs human decision** — suggestion literally says "Either (a)... or (b)... Justify the choice" |
| 18 | Writing & Structure | Warning | *(none — abstract doesn't exist as a section)* | **Needs new section** — same template gap a prior investigation in this project already confirmed for Abstract/Executive Summary |
| 19 | Writing & Structure | Info | — | No action needed |
| 20 | Contribution & Gap | Positive | — | No action needed |
| 21 | Contribution & Gap | Positive | — | No action needed |

**Distribution**: 3/22 (14%) need no action at all. Of the remaining 19: **12/19 (63%)** are directly
fixable by grounded drafting into one or two *existing* sections — genuinely the flow this feature
proposes. **3/19 (16%)** target the reference list, which isn't a section at all, or need a real numeric
recalculation rather than prose. **2/19 (11%)** explicitly require a human decision before any drafting
could start — the suggestion text itself is phrased as a choice, not an instruction. **2/19 (11%)** need
a section that doesn't exist yet in the canonical outline (data-availability/funding/COI statements, an
abstract) — a template change, not a content fix.

So even in the *best* real case (12/19, 63%), a meaningful minority of findings would need either new
editor capability (create-a-section) or a different resolution path (a decision UI, a reference-list
tool) that "open the editor and draft a fix" cannot serve regardless of how well the location-inference
and adapter work described in Tasks 1-2 is built.

## Task 4 — What happens to the reviewer's own state after a fix is applied?

**Nothing currently tracks resolution.** No field on `DocumentReview` or within a finding marks it
addressed — findings are anonymous JSON array elements with no stable ID, confirmed above. This is new
state to design and build regardless of how the rest of the feature lands.

**"Just re-review after each fix" is not simple/cheap enough to substitute for that state.**
`CreateReviewAsync` → `GenerateAndPersistAsync` is one single Claude call over the *entire* document text,
producing up to 6 findings per category across 6-9 categories per `ReviewType` — a substantial,
non-trivial-latency, single-shot generation, not a cheap per-section check. Unlike `GenerateSectionAsync`/
`ApplySectionFixAsync`, `ReviewerService.cs` has no `ReserveCreditsAsync`/`CreditCosts` call at all
currently — review generation isn't credit-gated the way section generation is, which is a separate,
unrelated asymmetry worth noting but not the point here: cost aside, a full-document re-review is not
fast enough to fire after every single "click fix this," and finding-level resolution tracking would
need to be real, new, purpose-built state — not a byproduct of something already close to free.

## Task 5 — Corrected scope estimate

**The "both halves already exist, this is a connector" premise does not hold up — but the corrected
picture is more specific and more promising in one respect than "everything is missing."**

What genuinely already exists and works, confirmed live in the frontend: a section-aware, preview/
confirm/discard "apply a targeted fix" pipeline with full citation/facts post-processing reuse
(`ApplySectionFixAsync` et al.). That is the expensive, hard part of "editor opens pre-populated to draft
a grounded fix" — and it's done.

What's actually missing, concretely, not hypothetically:

1. **Location inference** — a real, tested parser (not assumed to exist) that extracts a canonical
   `SectionCode` from a finding's free-text `Text`/`Suggestion`, handles zero-section findings
   (reference-list, whole-document) and multi-section findings (pick one, or refuse), and validates
   against the real canonical section list (`ResearchService.CanonicalSectionDisplayOrder`, already built
   in this project — reusable here) rather than trusting the model's prose verbatim.
2. **An adapter or a gate extension** — either map a located `ReviewFindingDto` into an `AlignmentIssue`
   (new `IssueSource` value, `EnsureApplyFixEligible` updated to accept it) or build a parallel call path;
   either way, real code in `ResearchService.cs`, not configuration.
3. **A different resolution path for the ~1/3 to ~40% of findings** (this sample: 37%) that
   `ApplySectionFixAsync` cannot serve at all regardless of 1-2's quality — reference-list issues, human-
   decision issues, missing-section issues. "Fix this" for these needs either a distinct UI (a decision
   prompt, a dedup tool) or an honest "not automatable" label — not a drafting call.
4. **New finding-resolution state** — a stable ID per finding and a resolved/dismissed flag, since
   nothing tracks this today and full-document re-review is too slow/costly to substitute for it.

None of this is a from-scratch build — the expensive generation/verification machinery is real and
reusable — but it is genuinely new work in three separate places (location parsing, an adapter layer, new
persisted state), plus a product decision about the ~37% of findings the core mechanism can never serve.
"Just a connector" is an understatement; "a moderate, well-scoped feature building on a real existing
foundation" is the accurate framing.
