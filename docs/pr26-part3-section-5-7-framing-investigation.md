# PR-26 Part 3 — Is Section 5.7's Citation Apparatus Solving the Right Problem?

Investigation only, per this task's scope — no code, prompt, config, or data was modified. Follows
`pr25-section-5-7-live-fetch-test-report.md` §7's flag: the frontend's `proposalOutline.ts` line 81
defines 5.7's blurb as `'List and define the independent, dependent, and confounding variables.
Describe measurement scales.'`, raising the question of whether PR-21→PR-25's entire theme-vocabulary/
collision-guard/live-fetch effort was tuning citation retrieval for a framing the section doesn't
actually need the way 5.1 or 5.9 need it. Scope: the nanocarriers project
(`b2448ab0-a178-4e93-853f-812c840e174a`), read-only queries against `humaniseaidb`, no writes.

**Headline, stated plainly**: the hypothesis is **half right**. Section 5.7's core content-generation
guidance is genuinely study-specific and works correctly — the real generated content is a clean,
domain-accurate variable/construct table, not a literature survey. But the **claim-level evidence
apparatus bolted onto that guidance** (the exact machinery PR-21→PR-25 tuned) is feeding the model
abstract theme-vocabulary phrases as if they were claims needing literature support, and the real
generated output shows the predictable consequence: citations attached to bare definitional/framing
sentences, including one clearly domain-mismatched source. 5.4 and 5.9 don't show this problem because
their theme vocabulary already names things the section is actually asked to write about (named
criteria, named trustworthiness dimensions) — 5.7's theme vocabulary names an abstract methods concept
("construct definition", "variable operationalisation") that the section's own guidance never asks the
model to discuss as a concept at all.

## 0. One correction to the hypothesis's premise, found before anything else

`proposalOutline.ts`'s `SECTION_PROMPTS['5.7'].prompt` string — the exact line PR-25 §7 quoted — is
**not the prompt that reaches Claude**. Traced it end to end:

- `ResearchAgentPage.tsx`/`LiteratureReviewPage.tsx` read `SECTION_PROMPTS[selectedCode]?.prompt` and
  pass it as the `prompt` argument to `researchApi.generateSection(projectId, code, prompt, ...)`.
- `src/api/research.ts:134-139` puts it in the POST body: `client.post(..., { prompt }, { params: {
  code, target_word_count } })`.
- `HumaniseAI.API/Controllers/ResearchController.cs:256-257`'s `GenerateSection` action signature is
  `(Guid projectId, [FromQuery] string code, [FromQuery] int? target_word_count, CancellationToken ct)`
  — **no body parameter at all**. The POST body's `{ prompt }` is never bound, never read, never
  reaches `_research.EnqueueSectionGenerationAsync` → `GenerateSectionAsync`. Same for `regenerate`
  (`ResearchController.cs:514-515`, `[FromQuery] string code` only).
- `ResearchService.GenerateSectionAsync`'s own signature (`ResearchService.cs:2073-2074`) is
  `(Guid projectId, Guid userId, string sectionCode, int? targetWordCount, CancellationToken ct)` — it
  has no prompt-string parameter to receive it even if the controller did bind it.

So `proposalOutline.ts` line 81 is dead frontend decoration — plausibly a leftover from an earlier
design, or just UI copy that was never wired to the generation call. It happens to closely paraphrase
the *real* server-side base guidance (§2 below), which is a coincidence of two people independently
writing a similar one-line description, not evidence about what actually generates. The investigation
below is against the real, server-side prompt-construction path only.

## 1. `proposalOutline.ts`'s full 5.7 definition (frontend, confirmed unused by generation)

```ts
// STEPS entry (line 35)
{ id: '5.7', label: '5.7 Study Variables', group: 'chapters', type: 'chapter', sectionKey: '5.7' },

// getStepLabel (lines 54-63) — display-only retitle, methodology-dependent
if (methodologyType === 'Qualitative') {
  if (step.id === '5.7') return '5.7 Key Research Constructs'
}
if (methodologyType === 'Mixed Methods' && step.id === '5.7') {
  return '5.7 Study Variables and Research Constructs'
}

// SECTION_PROMPTS['5.7'] (line 81)
{ heading: 'Study Variables', prompt: 'List and define the independent, dependent, and confounding
  variables. Describe measurement scales.' }
```

Three variants exist in the frontend depending on methodology type (Quantitative gets the base
"Study Variables" label and prompt shown above; Qualitative gets "Key Research Constructs"; Mixed
gets "Study Variables and Research Constructs"), but only the *label* actually varies by methodology
in this file — `SECTION_PROMPTS['5.7'].prompt` is a single fixed string regardless of methodology
type, and per §0 none of it reaches generation anyway.

## 2. The real prompt-construction path (`HumaniseAI.Infrastructure/Services/ResearchPrompts.cs` +
`ResearchService.cs`)

### 2a. Base guidance (quantitative default, `ResearchPrompts.cs:935-940`)

```csharp
"5.7" => (400, """
    SECTION — Study Variables:
    - Define all dependent, independent, and confounding variables
    - For each variable: state its operational definition, measurement level (nominal/ordinal/continuous), and measurement scale or instrument
    - Describe how confounders will be measured and controlled
    """),
```

This is entirely study-specific — it asks the model to define *this study's own* variables, not to
discuss operationalisation as a methods concept. It is what the class-level comment at
`ResearchPrompts.cs:794-801` calls a "procedural/mechanical" 5.x section, explicitly contrasted with
the literature-synthesis chapters (1.0-3.3) whose word targets were deliberately raised: *"padding
their length would force artificial citations rather than genuinely supported ones."*

### 2b. Methodology overrides (`ResearchPrompts.cs:482-518`) — Qualitative and Mixed only; no
Quantitative case exists, so quantitative studies fall through to §2a's base guidance verbatim
(confirmed via `guidance = disciplineOverride ?? guidance; ... guidance =
GetMethodologyGuidanceOverride(...) ?? guidance;`, `ResearchPrompts.cs:1047-1058`).

Qualitative override retitles the whole thing around "Key Research Dimensions & Constructs" and
explicitly forbids "independent variable"/"dependent variable"/"measurement scale" language. Mixed
override (the one that actually applied to the nanocarriers project, see §4) asks for **two separate
tables** — a standard quantitative variable table, and a qualitative constructs table — plus a
paragraph on how the two strands relate. Both are still 100% study-specific instructions: which
variables/constructs *this* study has, not what operationalisation means as a concept.

### 2c. The claim-level evidence apparatus — this is the part PR-21→PR-25 tuned

`EvidenceThemesForSection("5.7", ...)` (`ResearchService.cs:1216-1217`):

```csharp
"5.7" => ["construct definition", "variable operationalisation",
          "measurement validity instrument reliability", "conceptual relationships variable construct"],
```

`MatchEvidenceToClaims` (`ResearchService.cs:1248-1272`) treats each of those four phrases as a
`ClaimEvidenceMatch(theme, sources)` — literally the word "Claim". `BuildClaimEvidenceBlock`
(`ResearchPrompts.cs:1913-1945`) then renders them straight into the user prompt as:

```
CLAIM-LEVEL EVIDENCE MAP (use these bindings when the claim is made):
Each group is an evidence angle, not a required sentence. Cite only mapped sources that genuinely
support the wording you use.
C1: construct definition
  - <citation>
    Support summary: <abstract/key-findings excerpt>
C2: variable operationalisation
  - <citation>
    ...
C3: measurement validity instrument reliability
  - <citation> ...
C4: conceptual relationships variable construct
  - <citation> ...
```

So the model receives, verbatim, four bare internal theme-vocabulary strings as if they were claims
the section needs to make — "construct definition", "variable operationalisation" — sitting directly
alongside a SECTION guidance block (§2a/2b) that never once asks it to write about construct definition
or operationalisation *as concepts*. It only asks it to define this study's own particle size, zeta
potential, brain dopamine concentration, etc. Nothing in the guidance corresponds to "C1" or "C2" as
stated; the model is left to reconcile a citation map about an abstract methods idea with a writing task
about concrete study variables. The `CITATION MANDATE` (`ResearchPrompts.cs:1193-1213`, "EVERY factual
claim must be supported by an inline citation") and `distinctSourceLine` (`ResearchPrompts.cs:1164-1172`,
"aim to draw on at least {min(target, N)} distinct sources... spread across the section") apply uniformly
regardless of whether the section's actual content has 8 genuinely citable claims in it — `citationTarget
= MinUniqueSourcesForSection("5.7") = 8`, same flat value as every other 5.x section
(`ResearchService.cs:1027-1031`, itself flagged in-code as "kept at the prior default pending the
subsection-by-subsection review... a separate follow-up task" — i.e., never actually reviewed
per-section).

## 3. Comparison against 5.4 and 5.9 — same claim-level mechanism, different fit

### 5.4 (Inclusion/Exclusion Criteria)

- Base guidance (`ResearchPrompts.cs:912-917`): "List inclusion criteria clearly — who or what will be
  included and why... Explain how these criteria reduce bias and improve internal validity."
- Themes (`ResearchService.cs:1197`): `["eligibility criteria rationale", "inclusion criteria",
  "exclusion criteria", "selection bias and representativeness"]`.
- These theme strings **are** what the guidance asks the model to write about — inclusion/exclusion
  criteria and their bias/representativeness rationale. Citing a paper about selection-bias rationale
  to justify a stated inclusion criterion is a normal, natural academic move that doesn't need to
  reference this study's own numbers at all.

### 5.9 (Quality Assurance)

- Qualitative override (`ResearchPrompts.cs:520-529`) explicitly instructs: "use the qualitative
  trustworthiness criteria (Lincoln & Guba): credibility, transferability, dependability,
  confirmability... For each criterion, describe a concrete strategy."
- Themes (`ResearchService.cs:1219`): `["qualitative trustworthiness", "credibility transferability",
  "dependability confirmability", "reflexivity triangulation"]`.
- Near-exact match to what the guidance names outright. Citing the methods literature that defines
  these named criteria is directly on-topic — the guidance is *asking* the model to name and describe
  established constructs, so grounding them in citable sources is exactly right.

### 5.7, by contrast

- Guidance (§2a/2b) never asks the model to name or discuss "construct definition"/"operationalisation"
  as constructs in their own right — it asks for a concrete variable/construct table specific to this
  study.
- Themes (§2c) are the abstract methods-concept phrasing anyway — a mismatch between what the guidance
  instructs and what the claim-evidence map hands the model as "claims" to support.

This is a structural difference, not a tuning difference: 5.4 and 5.9's theme vocabulary describes the
section's actual writing target; 5.7's describes a meta-concept the section's writing target doesn't
reference. No amount of vocabulary broadening, collision-guarding, or additional live-fetch pool growth
(PR-21 through PR-25's actual work) changes that structural mismatch — it only changes how many
generically-on-topic-but-still-meta-level sources are available to paper over it.

## 4. Real generated content — nanocarriers project, section 5.7

Confirmed via direct query against `humaniseaidb` (read-only, `project_sections` table):

Project `MethodologyType` = **Mixed Methods**, `MethodologySubType` = **Exploratory Sequential** — so
the *Mixed* override (§2b) is the one that actually applied, not the base quantitative-only guidance.

| SectionCode | Status | WordCount | ResolvedCitationCount | CitationTarget |
|---|---:|---:|---:|---:|
| 5.4 | 4 (Approved) | 466 | 3 | 8 |
| 5.7 | 4 (Approved) | 902 | 6 | 8 |
| 5.9 | 4 (Approved) | 404 | 6 | 8 |

Section 5.7 has real, approved content — not a placeholder. It genuinely follows the Mixed-override
shape: a "Quantitative Strand" section with a real variable table, a "Qualitative Strand" section with
a real constructs table, and an "Integration" section. **The core content is exactly what §2's guidance
asked for and is domain-accurate**:

```
| Variable Name | Type | Operational Definition | Measurement Scale |
| Particle size | Independent | Hydrodynamic diameter of nanocarriers measured by dynamic light
  scattering; reported in nanometres | Ratio (nm) |
| Encapsulation efficiency | Independent | Proportion of levodopa fatty acid ester retained within
  nanocarrier matrix... | Ratio (%) |
| Prodrug activation rate | Confounding | First-order kinetic constant for levodopa ester hydrolysis
  in human tissue compartments... | Ratio (h⁻¹) |
| Brain dopamine concentration | Dependent | Steady-state concentration of dopamine in brain tissue
  derived from population PK–PD model... | Ratio (nmol/L) |
```

...and the qualitative-strand table names real study-specific constructs ("Formulation optimization
strategy", "Tissue model representativeness", "Regulatory evidence quality standards") with real
data sources ("Semi-structured interviews (n=18–22 experts)"). No fabrication, no generic filler —
this is a genuinely good, study-specific variable/construct table.

**Where the mismatch actually shows up is the citations attached to it**, all 6 of the References (6)
block:

| # | Source | What it's cited to support |
|---|---|---|
| 1 | Neuman (1991) *Social Research Methods: Qualitative and Quantitative Approaches* | Bare framing sentence: "Variables... are operationalized as measurable properties... (Neuman, 1991)" |
| 2 | Mohajan (2017) *TWO CRITERIA FOR GOOD MEASUREMENTS IN RESEARCH: VALIDITY AND RELIABILITY* | "measurement validity ensured through standardized analytical techniques (Mohajan, 2017)" |
| 3 | Yanti (2025) *Integration of Validity, Reliability, Trustworthiness, and Authenticity Concepts...* | Used twice: "validity maintained through comparison against... clinical reference ranges (Yanti, 2025)" and "ensure credibility and authenticity... (Yanti, 2025)" |
| 4 | Swinkels (2020) *How ideas matter in public policy: a review of concepts, mechanisms, and methods* | "Constructs operationalized in the qualitative strand represent key research dimensions that bridge mechanistic understanding to clinical decision-making (Swinkels, 2020)" |
| 5 | Naeem (2023) *A Step-by-Step Process of Thematic Analysis...* | "analyzed inductively to develop conceptual relationships... (Naeem, 2023)" |
| 6 | Brown (2019) *A Medical Science Educator's Guide to Selecting a Research Paradigm* | "explanatory sequential design... (Brown, 2019)" |

Reading these against the study: #5 (thematic analysis process) and #6 (paradigm/design selection) are
genuinely on-topic for the specific claims they support. #1, #2, and #3 are generic
operationalisation/validity/trustworthiness meta-citations bolted onto sentences that are really just
the model describing its own approach — not claims that need literature support at all, but the
`CITATION MANDATE`'s "every factual claim must be supported" pressure plus the `distinctSourceLine`'s
"aim to draw on at least N sources" pressure produced one anyway. #4 is a clear domain mismatch: a
public-policy paper about "how ideas matter in policy... concepts, mechanisms, and methods" cited to
support a nanomedicine construct-framing claim — almost certainly selected because its title matches
`EvidenceThemesForSection`'s "conceptual relationships variable construct" theme on bare word overlap
("concepts", "mechanisms"), exactly the CORE/DOAJ-style bag-of-words collision `pr15-live-verification-
report.md` and PR-25 §3/§6 already characterized for the *retrieval* side. Note #2 (Mohajan) is the
exact same paper PR-25 §3 already flagged as a 5.9-idiom collision risk for 5.7's "measurement validity
instrument reliability" theme — it shows up here as a real, live instance of that flagged risk, not a
hypothetical one.

**Contrast with 5.4 and 5.9's real citations for the same project** — all directly on-topic, no
meta-citation bolt-ons, no domain mismatches:

- 5.4's 3 references: Cena (2024) *Quality Criteria... for Qualitative Approaches in Psychology*,
  Estman (2026) *The DORR Framework: Reframing Trustworthiness Criteria for Hermeneutic Research*,
  Johnson (2020) *A Review of the Quality Indicators of Rigor in Qualitative Research* — each cited
  directly against a stated inclusion/exclusion rationale claim ("aligns with established quality
  guidance for qualitative research design (Johnson, 2020)").
- 5.9's 6 references: Christou (2025) on reliability/validity/credibility/dependability, Janis (2022)
  on reflexive thematic analysis and dependability, Lemon (2020) on triangulation for trustworthiness,
  Dinour (2025) and Kaur (2025) on reflexivity/positionality, Rashid (2026) on trustworthiness as
  inferential accountability — every one directly supports the exact named criterion (credibility,
  dependability, confirmability, reflexivity) the guidance explicitly asked the model to address.

## 5. Plain judgment

**Partially right, not fully mismatched, but the citation-tuning effort (PR-21→PR-25) has been aimed
at the wrong layer of the problem.**

- The section's *content*-generation guidance (§2a/2b) is correct and produces genuinely good,
  study-specific output — confirmed against real approved content (§4). This part was never broken and
  PR-21→PR-25 never touched it.
- The section's *citation* apparatus (theme vocabulary, `ThemeAnchorTerms` collision guards, the live
  fetch that added 787 rows) is optimizing retrieval for four abstract methods-concept phrases
  (`EvidenceThemesForSection("5.7", ...)`) that the section's own guidance never asks the model to
  discuss. That apparatus works as designed — PR-25 confirmed it can surface a large, genuinely
  on-topic pool of construct-operationalisation methods literature — but "on-topic for the theme
  phrase" and "actually needed by this section's real writing task" are different things, and this
  report's real-content check (§4) shows the gap in practice: 3 of 6 citations in the real 5.7 output
  are meta-level bolt-ons or (one case) a domain mismatch, versus 0 such cases across the same
  project's 5.4 and 5.9 output.
- This is not "5.7 needs zero citations" — #5 (thematic analysis process) and #6 (paradigm selection)
  in the real output show there ARE genuine, narrow citation needs in 5.7: the *analytic/methodological
  approach* the study uses to derive its variables (e.g., citing a thematic-analysis methodology paper
  to support how qualitative constructs are coded, or a paradigm-selection paper to support choosing an
  explanatory sequential design) is legitimately citable. What's not legitimately citable at the same
  density is the act of naming and defining the variables themselves — that's this study's own
  designed content, not a literature claim.

**Is continuing to tune 5.7's citation apparatus (PR-26 Part 2 and beyond) worth it as currently
scoped?** Not as a continuation of the same vocabulary-broadening/collision-guard work PR-21→PR-25 did.
That work optimizes recall and precision against theme phrases that don't correspond to what the
section is asked to write. Two different fixes would actually address what §4 found, neither of which
this task implements (investigation only):

1. **Narrow the theme vocabulary to what 5.7 is actually asked to produce**, not what "operationalisation"
   as a field means. Realistic candidate themes: something like `"quantitative measurement instrument
   validation"` (to support #2/#3-style claims about *how* a measurement will be validated, if the
   guidance is edited to actually ask for that) or `"qualitative construct coding analytic approach"`
   (to support #5-style thematic-analysis citations) or `"mixed methods design justification"` (to
   support #6-style paradigm citations) — i.e., citations for the *methodological approach* the section
   takes, not for the *concept* of having variables at all. This would likely shrink 5.7's genuine
   citation need well below the flat 8-source `MinUniqueSourcesForSection` target every other 5.x
   section shares (already flagged in-code, `ResearchService.cs:1027-1031`, as unreviewed per-section).
2. **Alternatively/additionally, tighten the `CITATION MANDATE`'s "every factual claim" language for
   this specific section** so the model isn't pressured to attach a citation to a definitional framing
   sentence ("variables are operationalized as measurable properties") that is really just describing
   its own analytical choices, not asserting something from the literature. This is a prompt-framing
   fix, not a retrieval fix — and it's the one PR-21→PR-25 never touched because their whole scope was
   the retrieval/vocabulary layer.

Either fix is a `ResearchPrompts.cs`/`ResearchService.cs` change (guidance text and/or
`EvidenceThemesForSection("5.7", ...)`), not a frontend change — `proposalOutline.ts` plays no role in
this at all (§0).

## 6. Scope confirmation

- Read-only throughout. No file in either repo was edited. `git status` in both repos untouched by this
  task.
- One set of read-only SQL queries against `humaniseaidb` (`project_sections`, `research_projects` for
  project `b2448ab0-a178-4e93-853f-812c840e174a` only) — no writes, no schema changes.
- No live provider/API calls were made — this task drew entirely on already-generated, already-approved
  content and existing source code.
