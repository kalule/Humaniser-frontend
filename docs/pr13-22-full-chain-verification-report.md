# PR-13→22 Full-Chain Verification — Nanocarriers Project Only

One live re-fetch executed against real external providers, for the nanocarriers project only, as
authorized. No other project touched. No backend code committed — the temporary harness
(`Pr1322Harness`, built in the scratchpad directory, `ProjectReference`-ing
`HumaniseAI.Infrastructure.csproj` directly, same pattern as the deleted `Pr15LiveVerification.cs`
harness described in `pr15-live-verification-report.md`) was deleted immediately after use; `git
status` in the backend repo confirms it left no trace (see Scope Confirmation below).

**Headline finding, stated plainly per this investigation's own established norm of not rounding
up**: the ONE authorized live re-fetch added **zero net-new rows** to the nanocarriers pool (1,042 →
1,042 — identical to the pool PR-15's live verification already fetched). Every measured difference
between this report's numbers and PR-15's numbers is therefore attributable **entirely to selection-
logic changes made since PR-15** (the squashed PR-16 through ~PR-20 commit, plus the current
uncommitted PR-21 state), not to any new candidate content. That turns out to be good news for
section 5.1 specifically — see below — but it also means this run cannot speak at all to whether the
PR-15c query-scoping fix's CORE/DOAJ recall-collapse problem (documented in
`pr15-live-verification-report.md` Step 1) has been addressed, since no new provider results arrived
to test it against.

## 0. Method note

- **Project**: `b2448ab0-a178-4e93-853f-812c840e174a` — "Development of a Clinically Integrated,
  Non-Animal Translational PK–PD Model for Nose-to-Brain Delivery of Levodopa Fatty Acid Ester-Loaded
  Lipid Nanocarriers" (`humaniseaidb`, confirmed by direct query — the same project PR-15 verified).
- **Section codes/titles confirmed live from `project_sections`** (not assumed): 5.1 = "Study Area",
  5.4 = "Inclusion/Exclusion Criteria", 5.7 = "Study Variables", 5.9 = "Quality Assurance" — all four
  match the task's assumed titles exactly. Full 25-section list matches PR-16's own confirmed count.
- **Harness**: standalone console app, `AssemblyName` set to `HumaniseAI.IntegrationTests` so the
  `InternalsVisibleTo` grant on `HumaniseAI.Infrastructure.csproj` applies, letting it call
  `ResearchService.SelectLiteratureForSection` / `PromptCandidateLimitForSection` /
  `MinUniqueSourcesForSection` / `UsesClaimLevelEvidenceRetrieval` / `IsTopicBearingSection` /
  `QueryTermExtractor.ExtractSignificantTerms` directly, wired through the real `AddInfrastructure` DI
  graph (real `humaniseaidb`, real API keys from `HumaniseAI.API/appsettings.json` +
  `appsettings.Development.json`, real HTTP calls) — not a mocked test factory. `Hangfire.AspNetCore`
  + `Hangfire.PostgreSql` were registered (required for `IBackgroundJobClient` DI resolution inside
  `ResearchService`) but no `AddHangfireServer` was started, so the two fire-and-forget jobs
  `FetchRealLiteratureAsync` enqueues on a successful add (`LiteratureDistillationJob`,
  `LiteratureAnalysisJob`) were never picked up/executed by this process — no Claude calls happened as
  a side effect of this harness beyond the one authorized fetch.
- **NU1605 fix**: hit the same `Microsoft.EntityFrameworkCore.Relational` version-skew NU1605 the task
  flagged as previously-documented (this harness's own restore independently floated to 8.0.11 while
  `HumaniseAI.Infrastructure`'s own resolved lock uses 8.0.29 — two separate restores disagreeing, not
  a real incompatibility). Fixed by an explicit `Microsoft.EntityFrameworkCore.Relational` `8.0.29`
  reference in the harness csproj to force agreement, rather than pinning downward.
- **`projectTopicTerms`** reproduced exactly as `GenerateSectionAsync` computes it (`ResearchService.cs`
  ~2215-2246): `QueryTermExtractor.ExtractSignificantTerms($"{topicTitle} {FieldInterest}", maxTerms:
  20)`, lowercased. Confirmed live: `non-animal, pk–pd, nose-to-brain, delivery, levodopa, fatty, acid,
  ester-loaded, lipid, nanocarriers`.
- **On-topic classification method**: exhaustive manual review of every selected candidate's title +
  abstract (not a sample — all four sets are small), three-tier scheme (genuinely on-topic /
  borderline-adjacent / off-topic), same as PR-15's spot-check. **One deliberate methodological
  adaptation, disclosed here rather than silently applied**: PR-15 only ever tested section 5.1, a
  *topic-bearing* section (`IsTopicBearingSection("5.1") == true`), where "on-topic" correctly means
  "about the project's actual subject" (nanocarriers/nose-to-brain/levodopa delivery). Sections 5.4,
  5.7, and 5.9 are *claim-level/methodology-bearing* sections
  (`UsesClaimLevelEvidenceRetrieval == true`), which `pr16-stage1-section-aware-discovery-scoping.md`
  §1b explicitly found are **designed** to cite cross-disciplinary qualitative-methodology literature
  rather than project-subject literature ("a nanocarriers project's methodology section citing Lincoln
  & Guba is exactly as valid as a nursing-education project's citing the same source"). Applying the
  5.1 standard ("is this about nanocarriers?") to 5.4/5.7/5.9 would misclassify correct-by-design
  citations as contamination. So for 5.4/5.7/5.9, "genuinely on-topic" below means **genuinely engages
  that section's own specific methodological theme** (5.4: participant eligibility/inclusion-exclusion/
  selection-bias criteria; 5.7: variable operationalisation/construct definition/measurement validity;
  5.9: qualitative trustworthiness/credibility/dependability/reflexivity) — not project-subject
  relevance. Both readings are reported below where they diverge, so nothing is hidden by the choice.

## 1. The live re-fetch — what actually happened

- **Pool size before**: 1,042 (PR-15's own post-fetch number, confirmed independently via direct
  `project_literature` count query before the harness touched anything).
- **Pool size after**: 1,042. **Net-new: 0.**
- **`FetchRealLiteratureAsync` return value**: 1,042 total literature rows (all pre-existing).
- **`GetFieldRelevanceAuditReportAsync` result**: `Discovered=3 Match=2 Ambiguous=1 Reject=0
  NoConceptTags=0` — this is **not** new data from today's call; it is byte-identical to PR-15's own
  reported audit numbers (`pr15-live-verification-report.md` Step 1), because
  `LiteratureClassificationAudit` rows persist across every historical `FilterByFieldRelevanceAsync`
  invocation for this project and today's fetch produced zero new candidates to classify.
- **No errors, exceptions, or rate-limit responses** appeared in the harness's captured log for this
  call — the fetch completed cleanly; it simply found nothing that wasn't already in the pool from
  PR-15's own live fetch two days earlier (per `AddedAt` timestamps on the existing rows, most recent
  addition cluster is `2026-08-03`). This is consistent with querying the same providers with the same
  scoped query against a largely-unchanged upstream index in a short window, not a fetch failure.

**Implication for everything below**: sections 5.1, 5.4, 5.7, and 5.9's selection results in this
report are computed against the **exact same 1,042-row pool** PR-15 used. Any change from PR-15's own
5.1 numbers is proof of a selection-logic change, isolated cleanly, the same way PR-15's own Step 3b
isolated pool-content effects from selection-logic effects.

## 2. Results table

| Section | Baseline (source) | Current (this run) | Delta |
|---|---|---|---|
| 5.1 Study Area | 24 selected, 0-2/24 (0-8%) genuinely on-topic — **section-specific, PR-15 live-verified** (`pr15-live-verification-report.md` Step 3/4) | 18 selected, 7/18 strictly on-topic (39%), 10/18 on-topic-or-borderline (56%) | **Selected count -6 (24→18); on-topic fraction up sharply, roughly 0-8% → 39-56%, same pool** |
| 5.4 Inclusion/Exclusion Criteria | *Not established section-specifically by any prior report.* Only pre-existing figure is corpus-level and not section-specific: original audit's nanocarriers pool spot-check found ~20-25% of a 20-row Match sample genuinely pharma/nanocarrier-relevant (`discovery-pool-quality-audit-report.md` §1) — that number describes the whole 1,039-row pool's Match bucket, not section 5.4's selected set, and should not be read as a 5.4 baseline. | 11 selected. Against 5.4's own theme (eligibility/inclusion/exclusion/selection-bias, not project subject — see Method note): 1/11 strictly on-topic (9%), 4/11 on-topic-or-borderline (36%) | **Not comparable to a real prior number — none exists for this section.** Count (11) is healthy relative to the reverted title-only-gate's 1/8 regression — see §4. |
| 5.7 Study Variables | *Not established section-specifically.* Same corpus-level-only caveat as 5.4 applies if any comparison is drawn. | 6 selected (below both its 8 `MinUniqueSourcesForSection` floor and its 24 `PromptCandidateLimitForSection` quota). Against 5.7's own theme (construct definition/variable operationalisation/measurement validity): 1/6 strictly on-topic (17%) | **Not comparable to a real prior number.** Low absolute count is itself the finding — see §5. |
| 5.9 Quality Assurance | *Not established section-specifically.* Same corpus-level-only caveat as 5.4/5.7 applies if any comparison is drawn. | 12 selected. Against 5.9's own theme (qualitative trustworthiness/credibility/dependability/reflexivity): 1/12 strictly on-topic (8%), 3/12 on-topic-or-borderline (25%) | **Not comparable to a real prior number.** Known football-fan/corruption residual confirmed still present — see §6. |

## 3. Section 5.1 — the one section with a real prior baseline

PR-15 measured 24 selected, 0-2/24 (0-8%) genuinely on-topic, against this exact same pool, using the
selection logic as it stood right after PR-15 landed. Today's run, against the **identical pool**,
using the current (post PR-16-squash, post-uncommitted-PR-21) selection logic, returns:

- **18 selected** (not 24 — see below for why this is a healthy, not a regressive, change).
- **7/18 (39%) strictly on-topic**: all seven are genuinely about nose-to-brain/nanoparticle-mediated
  CNS drug delivery — "Emerging Nose-to-Brain Drug Delivery Strategies for ALS," "Transnasal-brain
  delivery of nanomedicines for neurodegenerative diseases," "Applications of nose-to-brain delivery in
  nanodiagnosis and nanotherapy of neurodegenerative disorders," "Review on The Medication Transport
  Mechanism From Nose to Brain," "Nanotechnological advances in direct nose-to-brain drug delivery for
  neurodegenerative disorders," "Nanoparticle-Mediated Nose-to-Brain Delivery for Ischemic Stroke
  Therapy," "Intranasal Peptide Therapeutics... CNS Drug Development."
- **3/18 (17%) borderline-adjacent**: a PK/PD population model for a different drug class (potassium-
  competitive acid blockers, not levodopa — real pharmacometrics methodology, wrong drug), an
  Anle138b/Parkinson's-disease paper that names Levodopa directly but isn't about nanocarrier delivery,
  and a non-invasive/intradermal (not intranasal) brain-tumor drug-delivery paper.
- **8/18 (44%) off-topic**: the same class of generic qualitative-methodology/cross-domain contamination
  the original audit and PR-15 both documented (teachers' pedagogical love, political maneuvering of
  public-sector managers, a PhD thesis on evaluator process use, saturation in qualitative research,
  personal-leadership-development abuse recovery, dental-antibiotic prescribing patterns, a Chinese-
  schools case study, a generic social-research-methods textbook).

**This is a genuine, substantial improvement on the same pool** — 39-56% genuinely on-topic-or-adjacent
versus PR-15's 0-8%, with zero new candidate content. It is fully attributable to selection-logic
changes made since PR-15 (the squashed PR-16-20 commit and/or the current uncommitted state), not to
anything this run itself changed. I did not attempt to isolate which specific sub-change (PR-17's
`projectTopicTerms`/`TopicOverlapMultiplier` fix, PR-13c's no-pad-to-quota-floor fix visible at
`ResearchService.cs:1330-1360`, or something else in the squashed commit) is responsible — that would
require bisecting the squashed `63065ee` commit, out of scope for this task.

**Why 18, not 24**: the current code's pad-to-quota fallback (`ResearchService.cs:1330-1362`,
explicitly commented as a 2026-08/PR-13c fix) deliberately returns fewer than the section's quota
rather than padding with irrelevant filler once nothing left clears `MinFallbackRelevanceScore`. Fewer
selected here is the intended behavior of an already-shipped fix working correctly, not a new problem.

## 4. Section 5.4 — regression check (task-specified)

**Confirmed: not regressed to 1/8.** Selected count is **11**, comfortably above both the reverted
title-only-gate experiment's collapsed 1 and the 8-item `MinUniqueSourcesForSection` floor. This
matches the task's expectation that the current uncommitted state (PR-21's abstract-inclusive gate,
confirmed live at `ResearchService.cs:1601-1621`, `ScoreClaimRelevance`) is healthy — the reverted
PR-22 title-only variant (comment at `ResearchService.cs:1581-1594`) is not what's running.

**However, composition still shows the exact word-sense collision the code's own comment predicts.**
Against 5.4's specific theme (participant eligibility/inclusion-exclusion/selection-bias, not "rigor"
broadly), only 1/11 is a strict match: "A Systematic Literature Review of Post-Positivism and Critical
Realism..." which explicitly states its methodology "involves explicit inclusion and exclusion
criteria." A further 3/11 are borderline (two near-duplicate copies of "Challenges of Educating
Single-Child Students... Yazd, Iran," which discusses theoretical sampling and sample-size criteria,
plus one purposive-sampling mention). The remaining 7/11 are qualitative-*rigor*-criteria papers
("Rigor in Qualitative Social Work Research," "A Review of the Quality Indicators of Rigor in
Qualitative Research," "Trustworthiness of Teacher Assessment...") — genuinely about the 5.9 sense of
"criteria," not the 5.4 sense, exactly as `ResearchService.cs:1588-1594`'s comment describes as the
still-open residual. **Count is healthy; theme-precision is not** — these are two separable findings
and only the first was what the task asked to confirm wasn't regressed.

One additional, incidental data-quality note: two of the 11 selected rows are the same paper
("Challenges of Educating Single-Child Students...") under two different DOI/metadata records (one
with a populated DOI, one blank) — a near-duplicate that survived `FetchRealLiteratureAsync`'s
DOI/title dedup, worth flagging but outside this task's scope to fix.

## 5. Section 5.7 — pad-to-quota fallback check (task-specified)

**The pad-to-quota fallback fired, and returned fewer than its own 8-item floor.** Final selected
count is **6** — below both `MinUniqueSourcesForSection("5.7") = 8` and
`PromptCandidateLimitForSection("5.7") = 24`. Since `selected.Count < limit` after the theme-bucket
fill step, the fallback block (`ResearchService.cs:1343-1360`) ran, scoring every unseen pool member
against `MinFallbackRelevanceScore = 1` (at least one real title/abstract keyword overlap with the
section title "Study Variables") — and even at that very low bar, only 6 total candidates in the whole
1,042-row pool qualified.

**Composition of the 6, against 5.7's actual theme (construct definition/variable
operationalisation/measurement validity)**: only 1/6 is a strict match — "TWO CRITERIA FOR GOOD
MEASUREMENTS IN RESEARCH: VALIDITY AND RELIABILITY," which directly discusses what an instrument
measures and validity/reliability. The other 5 are keyword-adjacent filler in the sense the task asked
about: a generic social-research-methods textbook table of contents, the same political-maneuvering-
of-public-sector-managers paper that also appears in 5.9 (see §6 — this is the same genre-boilerplate
class, not confined to 5.9), a garbled/OCR-damaged title ("art 8 vol V is 1.rtf") about workplace
cynicism, a triangulation/domain-analysis paper that is substantively a 5.9-flavored trustworthiness
paper rather than a variables/measurement paper, and — notably — a genuinely project-relevant
nose-to-brain drug-delivery formulation paper that is nonetheless off-topic *for this section
specifically* because it says nothing about variables, constructs, or measurement.

**Reading**: the "no artificial floor" design (§3's same PR-13c fix) is behaving as intended here too
— it did not force-pad to 8 or 24 with junk, it genuinely returned only what cleared even a
single-keyword-overlap bar. But that also means the pool has a **real, severe recall gap** for this
specific claim-level theme: even the lowest bar in the codebase can't find 8 genuinely-scoring
candidates in 1,042 rows. This is a different problem from the precision issues seen elsewhere in this
report and is likely a `EvidenceThemesForSection("5.7", ...)` vocabulary/pool-content gap rather than a
selection-logic bug.

## 6. Section 5.9 — known residual check (task-specified)

**Both named residuals are confirmed present in the current live selected set, unchanged.** The exact
two papers the code comment at `ResearchService.cs:1595-1596` names by class are both in the 12
selected:

- **"Qualitative Analysis of Fan Expectations from Persian Gulf Pro League Football Clubs"** — the
  football-fan-expectations residual.
- **"Developing a Multilevel Systemic Model of Public Sector Corruption: Identifying Drivers and
  Inhibitors"** — the public-sector-corruption residual.

Both titles match the comment's description closely enough (football-fan-expectations qualitative
study; public-sector-corruption systemic model) that this reads as the same specific residual class
the comment describes, not merely a structurally-similar new pattern — **this is the known, already-
documented open issue, not a new discovery.** A closely related third case appears too: the same
"political maneuvering of public-sector managers" paper flagged in §5 as 5.7 filler also clears 5.9's
gate — one more instance of the identical genre-boilerplate class (Iranian-public-sector qualitative
studies with a phenomenology/grounded-theory label but no genuine trustworthiness-methodology content)
recurring across two different sections' selected sets.

**Whether they reached the final cited list**: **not verified by this run.** This report only exercises
`SelectLiteratureForSection` — the candidate pool that would be handed to `GenerateSectionAsync`'s
prompt-construction/Claude-drafting step — not the actual drafting call itself (out of this task's
scope and would have spent additional live Claude budget beyond the one authorized fetch). Confirmed:
they reached the candidate pool. Not confirmed: whether Claude's drafting step actually chose to cite
either one in generated prose.

**Rest of the 12, against 5.9's own theme (trustworthiness/credibility/dependability/reflexivity)**:
only 1/12 strictly matches — "Rethinking Qualitative Methodology Through the Lens of AI Literacy:
Navigating Trustworthiness, Reflexivity, and Human-AI Collaboration," whose title directly names both
"Trustworthiness" and "Reflexivity." A further 2/12 are borderline (two near-duplicate "Single-Child
Students... Yazd" records again, which touch theoretical saturation, a trustworthiness-adjacent
concept). The remaining 9/12, including the two named residuals, show no genuine trustworthiness-
methodology content on inspection.

## 7. Scope confirmation

- **No project other than the nanocarriers project (`b2448ab0-a178-4e93-853f-812c840e174a`) was
  queried, fetched, or modified.** Every SQL query and every harness call in this task was scoped to
  that project ID.
- **Exactly one live provider call was made**: `FetchRealLiteratureAsync`, invoked once. Two earlier
  harness build/DI-resolution failures (NU1605 restore error, then a `FileNotFoundException` during
  `IResearchService` construction) both happened *before* the fetch call was ever reached in `Main` —
  neither made any HTTP request to any provider. No retry-on-empty or second fetch was performed after
  the successful run returned 0 net-new rows, per the task's explicit instruction not to re-fetch "to
  get a better number."
- **The harness left no trace.** `git status --short` in the backend repo before and after this task
  shows the identical three pre-existing modified files (`HumaniseAI.API/logs/sectiongen-20260805.json`,
  `HumaniseAI.Infrastructure/Services/ResearchService.cs`,
  `HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs`) with an identical diff stat
  (+71/-9 and +194/-21 respectively) — no new files, no staged changes, no commits. The harness project
  and all SQL scratch files were built and deleted entirely within the session scratchpad directory,
  outside the backend repo.
- No real API key values appear anywhere in this report.

## 8. Is it worth re-running this same check against the other 4 audited projects?

**Recommendation: not as a blanket re-run of this exact procedure — but a cheap, partial version is
worth doing for one project, and the honest answer for the rest is "probably not yet."**

`discovery-pool-quality-audit-report.md` §2 established that the four other audited projects don't
share nanocarriers' failure mechanism:

- **ICT Infrastructure Rural Clinics** — spot-checked as already genuinely good quality (~10-11/12
  on-topic) *despite* the classifier being a complete no-op for it. There is no known problem here to
  re-verify a fix against; spending budget on this project is unlikely to produce an interesting
  finding.
- **AI impact on traffic systems** and **Proxy Re-Encryption/IoT Blockchain** — both empty-
  `FieldInterest` (no-gate-at-all) cases, a *different* mechanism than nanocarriers' leaky concept-tag
  gate. PR-15d's title-fallback fix for this mechanism was only ever verified against a synthetic test
  title, never live, for either project — `pr15-live-verification-report.md` §5 flags this explicitly
  as requiring separate authorization. This is the one case where a live check would answer a real
  open question rather than re-confirming something already known, and would be the natural next
  target if further budget is approved — one live fetch each, same harness pattern, same one-call
  discipline.
- **Lived Experiences of Homebound Seniors** — real-classifier project like nanocarriers (not a no-gate
  case), but not characterized in the same depth as nanocarriers or AI-traffic in the available
  reports; a targeted spot-check here would be closer to new investigation than fix-verification.

**The core reason not to generalize this specific report's finding**: this run's improvement for
section 5.1 came from selection-logic changes that are project-agnostic (they operate on whatever pool
exists), so there's real reason to expect *some* positive effect elsewhere too — but this run also
found that section 5.7's problem (severe candidate-recall gap, not a precision/contamination problem)
and 5.9's problem (a specific, named, still-unfixed residual class) are structurally different from
5.1's problem and from each other, all within the *same* project. Given that much variance within one
project's four sections, extrapolating a "PR-21 fixed it" conclusion to four other projects with three
further distinct failure mechanisms would be exactly the kind of rounding-up this investigation has
consistently avoided. If budget allows one more live call, spend it on AI-traffic or Proxy-Re-
Encryption (the no-gate mechanism, genuinely unverified live) rather than re-confirming nanocarriers'
already-well-characterized leaky-gate mechanism a second time.
