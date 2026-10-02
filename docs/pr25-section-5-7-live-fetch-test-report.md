# PR-25 — Section 5.7 ("Study Variables") Live-Fetch Test — Nanocarriers Project Only

One live-provider-fetch authorization, spent on the construct-definition/variable-operationalisation
gap PR-23/PR-24 identified and left untouched. Continues `pr13-22-full-chain-verification-report.md`
§5, `pr23-section-5-7-discovery-vocabulary-investigation.md`, and
`pr24-section-5-7-vocabulary-broadening-report.md` Part 2, whose 3 candidate queries (adjusted per
this task's Step 1 decision) were run live for the first time here. Scoped to the nanocarriers project
(`b2448ab0-a178-4e93-853f-812c840e174a`) only.

**Headline, stated plainly**: this run did **not** confirm PR-23/24's "genuine content gap, nothing
will fix it" reading. One of the three queries — `construct operationalization operationalisation
measurement` — surfaced a large, genuinely on-topic vein of construct-definition/operationalisation
methods literature that the pool had essentially none of before. Section 5.7's selected count went
from PR-24's **10** to **24** (the section's full `PromptCandidateLimitForSection` quota, not just
its 8-item floor), and the strict on-topic fraction roughly tripled (20% → ~54%, see §5). The other
two queries were mostly noise, and the run also **regenerated the exact CORE/DOAJ bag-of-words
over-matching failure mode `pr15-live-verification-report.md` Step 1 first documented** — see §2's
scope caveat and §6.

## 0. Method note

- **Harness**: standalone console app (`Pr25Harness`), same pattern as every prior live-call step in
  this investigation (PR-13→22): `AssemblyName=HumaniseAI.IntegrationTests` so the existing
  `InternalsVisibleTo(HumaniseAI.IntegrationTests)` grant on `HumaniseAI.Infrastructure.csproj`
  applies, `ProjectReference`-ing `HumaniseAI.Infrastructure.csproj` directly, wired through the real
  `AddInfrastructure` DI graph (`ILiteratureOrchestrator`, real `AppDbContext` against local
  `humaniseaidb`, real API keys from `HumaniseAI.API/appsettings.json` +
  `appsettings.Development.json`, real HTTP calls). Same NU1605 fix as every prior harness (explicit
  `Microsoft.EntityFrameworkCore.Relational` `8.0.29` reference).
- **Deliberate simplification versus the PR-13→22 harness**: this task only needed
  `ILiteratureOrchestrator.FetchAsync` (public interface) plus `AppDbContext` and the `internal static`
  scoring functions (`ResearchService.ToProjectLiterature`, `SelectLiteratureForSection`,
  `QueryTermExtractor.ExtractSignificantTerms`) — it never needed to construct `ResearchService`/
  `IResearchService` itself, so **no Hangfire registration was needed** (`IBackgroundJobClient` is
  only a `ResearchService` constructor dependency, never touched here). This is a smaller DI surface
  than PR-13→22 used, not a different call path — `ILiteratureOrchestrator` is resolved from the same
  `AddInfrastructure` graph either way.
- **One disclosed, load-bearing harness limitation**: `ResearchService.EnrichWithConceptsAsync` (the
  OpenAlex concept-tag backfill step `FetchAndMergeMultiQueryAsync` normally runs before persisting)
  is `private`, not `internal` — `InternalsVisibleTo` does not grant access to private members, so this
  harness could not call it and skipped it. Confirmed this has no bearing on this task's results:
  concept tags only feed `ClassifyFieldRelevance`/`FilterByFieldRelevanceAsync`, which
  `EvidenceType.MethodologicalTheoretical` (used for all 3 queries here, matching
  `ResearchService.cs:2388-2389`'s own branch for the same evidence type) bypasses entirely. 5.7 is a
  claim-level section (`UsesClaimLevelEvidenceRetrieval("5.7") == true`), so its own selection scoring
  (`ScoreClaimRelevance`/`SelectLiteratureForSection`) runs on title/abstract keyword tokenization only,
  never concept tags. The net-new rows persisted here simply carry no OpenAlex concept tags — a minor,
  disclosed data-completeness gap, not a correctness issue for anything measured in this report.
- **Persist path**: reproduced `ResearchService.cs:2382-2399`'s own dedup/persist logic exactly (DOI
  match OR normalized-title match against the existing pool, updated incrementally after each query so
  later queries also dedup against earlier queries' own net-new rows within this same run), then
  `ResearchService.ToProjectLiterature(citation, projectId)` (the exact same conversion
  `FetchAndMergeMultiQueryAsync` uses for `MethodologicalTheoretical` evidence) and
  `_db.ProjectLiterature.AddRange` + `SaveChangesAsync` — the same EF Core path the app's own code
  uses, not a hand-rolled insert.
- **Confirmed live, not assumed**: project title ("...Nose-to-Brain Delivery of Levodopa Fatty Acid
  Ester-Loaded Lipid Nanocarriers"), section 5.7 title ("Study Variables"), and starting pool size
  (1,042 — matching every prior report in this chain) were all read directly from `humaniseaidb`
  before the harness touched anything.
- **Working-tree note**: unlike prior reports in this chain, PR-24's Part 1 code changes (theme
  broadening + `ThemeAnchorTerms` guard) are **no longer an uncommitted diff** — they are already
  committed (`e484fba "instrument anchor tightening"`, on top of `63065ee`). `git status --short` in
  the backend repo was clean both before and after this task; see §7.
- Deleted immediately after use.

## 1. Final query set used (Step 1)

```
1. operational definition independent dependent confounding variables
2. construct operationalization operationalisation measurement
3. measurement scales variable classification predictor outcome covariate
```

Query 2 is the task's pre-approved adjustment of PR-24 Part 2's second candidate
(`construct operationalization measurement validity reliability`): **"validity reliability" dropped**,
since PR-24's own recomputation found that exact idiom pairing already matches 26-28 rows of mostly
5.9-trustworthiness-idiom contamination in the existing pool — spending the one authorized live call
re-fetching more of what the pool is already saturated with would waste it.

**Spelling normalization**: checked `QueryTermExtractor.cs` (the codebase's one existing query-term
utility, `GenericAcademicTerms`/`ExtractSignificantTerms`/`BuildAndQuery`/
`BuildRequiredPlusOptionalQuery`) — confirmed it has **no US/UK spelling-variant handling of any kind**;
it only strips generic connective words and length-filters. No shared normalization utility existed to
reuse, so per the task's fallback instruction both spellings were written directly into query 2's text
(`operationalization operationalisation`). No further adjustment was made to queries 1 or 3 — both
were judged (before running) to already avoid PR-15c's CORE/DOAJ collapse failure mode in the sense
that neither is an 8-term AND of a whole project title; in hindsight (§2, §6) this was not sufficient —
see the scope caveat below.

## 2. Execution — before/after pool size, net-new counts

| | Pool size |
|---|---:|
| **Before** | 1,042 |
| **After** | **1,829** |
| **Total net-new** | **787** |

| Query | Raw fetched | After dedup (net-new, this query) |
|---|---:|---:|
| 1. `operational definition independent dependent confounding variables` | 167 | 167 |
| 2. `construct operationalization operationalisation measurement` | 297 | 293 |
| 3. `measurement scales variable classification predictor outcome covariate` | 328 | 327 |

No fetch errors, no exceptions, no retries — one call per query, three calls total, exactly as
authorized. Every row above was persisted through `ToProjectLiterature` + `SaveChangesAsync`, the same
path the app's own claim-evidence gap-fill mechanism uses.

**Scope caveat, disclosed plainly rather than smoothed over**: 787 net-new rows is roughly an order of
magnitude larger than any prior report in this investigation's net-new count (PR-13→22's live re-fetch
found 0; PR-23/24 made no live calls at all). This is the same CORE/DOAJ-family bag-of-words
over-matching failure mode `pr15-live-verification-report.md` Step 1 first documented for full project
titles — it turns out to apply just as strongly to plain, unquoted 4-8 word methodology phrases sent
verbatim with no AND-scoping, which is exactly how `ResearchService.cs:2443`'s claim-evidence gap-fill
mechanism sends every theme phrase today (`m.Claim`, literal and unmodified, no
`QueryTermExtractor.BuildAndQuery`/`BuildRequiredPlusOptionalQuery` scoping applied to it — those
utilities are only used elsewhere, for `BuildSubThemeQueriesAsync`'s topic-bearing-section path). This
is a genuine, previously-uncharacterized finding of its own (§6), separate from the section 5.7
content-gap question this task set out to answer.

## 3. Manual classification of net-new rows against 5.7's specific theme (Step 3)

**Method, disclosed given the scale**: a full title-level read of all 787 net-new rows was completed
(no row was skipped). Query-level title patterns line up cleanly with each query's own semantics:

- **Query 1's 167 rows**: overwhelmingly generic biomedical/definitional bag-of-words noise —
  "Surviving Sepsis Campaign: International Guidelines...", "Reactive astrocyte nomenclature,
  definitions, and future directions", "A Metaverse: Taxonomy, Components, Applications...", "A
  communal catalogue reveals Earth's multiscale microbial diversity" — matched on "definition"/
  "independent"/"variables" as isolated words, not on the phrase's actual methods meaning.
- **Query 2's 293 rows**: by a wide margin the productive query. A full title-level scan found the
  large majority (title-scan estimate, not an abstract-by-abstract tally: roughly 200-250 of the 293)
  genuinely on-topic or closely adjacent to construct-definition/operationalisation as a methods
  concept — "Organizational Resilience: A Valuable Construct for Management Research?", "Digital
  orientation: Conceptualization and operationalization of a new strategic orientation", "The
  construct of language dominance, its operationalization and measurement", "Operationalization and
  Measurement of Evaluation Constructs", "The development of the Conceptual Construct Validity
  Appraisal Checklist" — a dense, real vein of exactly the sub-theme PR-23/24 found at ~0 rows in the
  existing pool.
- **Query 3's 327 rows**: overwhelmingly clinical-prediction-model/machine-learning noise — "Predicting
  Outcome after Traumatic Brain Injury...", "Deep Learning for Osteoporosis Classification...",
  "Artificial neural networks improve early outcome prediction...", hundreds of "predictor of
  outcome"/"covariate-adjusted"/"classification model" titles from clinical and ML literature. These
  use "predictor variable"/"covariate"/"classification" in the statistical-modeling sense, not the
  construct-operationalisation-as-methods-concept sense 5.7 needs. Essentially the same failure this
  section's query 1 shows, worse.

**Full title+abstract read of every row that actually reached 5.7's candidate/selected pool** (the set
that matters for Step 4's verdict — `SelectLiteratureForSection`'s bucketing+quota means only the
top-scoring rows per theme ever surface regardless of how large the raw pool got): of the 24 rows
`SelectLiteratureForSection("5.7", ...)` returned against the updated 1,829-row pool, 22 are net-new.
Classified against 5.7's SPECIFIC sub-theme (construct definition / variable operationalisation, not
measurement-validity broadly):

| Title | Classification |
|---|---|
| Corporate reputation: A discussion on construct definition and measurement... | **Strict** |
| Reconsidering the Measurement of Proficiency in Pilot/ATC Radiotelephony...: From Construct Definition to Task Design | **Strict** |
| The Operationalisation of Safety Culture for the Malaysian Construction Organisations | **Strict** |
| Technological work environment: instrument development and measurement | **Strict** |
| The development of the Conceptual Construct Validity Appraisal Checklist | **Strict** |
| Conceptualisation of Psychological Contract: Definitions, Typologies and Measurement | **Strict** |
| Development and validation of an individual entrepreneurial potential new measurement scale | **Strict** |
| Operationalising resilience in longitudinal studies: a systematic review of methodological approaches | **Strict** |
| Operationalization and measurement of compulsivity across video gaming and gambling behavioral domains | **Strict** |
| Social Capital and the Innovative Performance of Italian Provinces | Borderline (operationalisation named only in passing; paper is an empirical innovation study, not a methods paper) |
| Boosting prediction of occupational stress... (Bayesian sparse autoencoder) | Borderline (uses an existing named measurement scale, but the paper's own contribution is ML prediction, not construct operationalisation) |
| **Reliability and validity of measuring temporal muscle thickness as evaluation of sarcopenia risk...** | Off-topic for the specific sub-theme — **COLLISION-SUSPECT** (primary signal is clinical reliability/validity, not construct-definition/operationalisation language) |
| **The psychometric properties and measurement invariance of the Burnout Assessment Tool (BAT-23)...** | Borderline — mentions "operational definition"/"hierarchical operationalisation" but is dominated by validity/reliability/invariance psychometrics — **COLLISION-SUSPECT (adjacent)** |
| **Self-reported Cognitive Scales in a U.S. National Survey: Reliability, Validity, and Preliminary Evidence...** | Off-topic for the specific sub-theme — **COLLISION-SUSPECT** (primary signal is reliability/validity of a specific scale, not construct definition) |
| The Impact of Market Choice Behavior towards Purchase Decision of Organic Food... | Off-topic (garbage/placeholder abstract, no real construct-definition content) |
| Efficacy of Cognitive Empowerment Program: Embodiment Approach... | Off-topic (RCT-style intervention paper; "variable" appears only as a stats-reporting term) |
| Evaluation of prognostic models to improve prediction of metastasis... (PROSPECT trial) | Off-topic (clinical prognostic-model paper; matched on predictor/covariate bag-of-words) |
| The Preoperative Sagittal Tibial Tubercle-Trochlear Groove Distance Predicts Postoperative Outcome... | Off-topic (clinical predictor study) |
| Modeling the effects of multiple exposures with unknown group memberships: a Bayesian latent variable approach | Off-topic (pure statistical-methods paper, not about defining/operationalising a substantive construct) |
| Selected Abstracts of the 2nd Congress of joint European Neonatal Societies... | Off-topic (conference-abstract-collection junk, no real content) |
| Covariate-Adjusted Tensor Classification in High Dimensions | Off-topic (statistics/ML methodology paper) |
| Identification of vancomycin exposure target in neonates: how much is enough? | Off-topic (clinical PK/PD dosing study, matched incidentally) |

**Collision-suspect summary**: 3 of the 22 net-new selected rows have validity/reliability as their
primary or a strongly co-equal match signal rather than construct-definition/operationalisation
language, echoing the exact 5.9-idiom-collision mechanism PR-23/24 already characterized and guarded
against for the *other* two 5.7 themes. These 3 rows entered via query 2 (which contains neither
"validity" nor "reliability" as search terms) or query 1/3 — meaning this is a **new, not
previously-guarded** collision path: `ScoreClaimRelevance`'s `ThemeAnchorTerms` guard only fires for
the two broadened themes PR-24 modified (`measurement validity instrument reliability`,
`conceptual relationships variable construct`); it does **not** apply to `construct definition` /
`variable operationalisation`, which remain byte-identical, unguarded 2-word-AND themes. A candidate
whose title/abstract happens to contain both "construct" (or "definition"/"operational") and
"reliability"/"validity" incidentally can still pass. Not a blocking problem here (net effect below is
still strongly positive), but worth flagging exactly as named.

## 4. Non-selected net-new rows (Step 3, full disclosure)

The remaining 765 net-new rows sit in the pool but were **not** selected for 5.7 in this run —
`SelectLiteratureForSection`'s bucketed, quota-capped design (`PromptCandidateLimitForSection("5.7")
= 24`) means many more query-2 rows that read as genuinely on-topic by title (§3) exist in the pool
than the 24-item ceiling can surface at once. This is itself worth stating plainly: **5.7's binding
constraint against this updated pool is now the section's own 24-item quota ceiling, not recall** —
the opposite problem from PR-13→22/PR-23/24's finding of a genuine recall gap. Query 3's 327 rows and
most of query 1's 167 are, by the same title-level read, genuinely off-topic for 5.7 regardless of
quota — they would not have been selected even at a higher ceiling.

## 5. Re-run SelectLiteratureForSection — updated 5.7 count vs. PR-24 baseline (Step 4)

| | Selected count | vs. floor (8) / ceiling (24) | Composition |
|---|---:|---|---|
| **PR-24 Part 1 baseline** (before this fetch) | 10 | clears floor, well under ceiling | 2/10 (20%) strict, 5/10 (50%) borderline, 3/10 (30%) off-topic |
| **This run** (after live fetch, same broad "any of 5.7's 4 sub-themes" standard PR-24 used, for apples-to-apples comparison) | **24** | **clears both floor and ceiling** | **13/24 (54%) strict, 3/24 (12.5%) borderline, 8/24 (33%) off-topic** |

The composition table above uses the **same broad standard PR-24's own baseline used** — any of 5.7's
four sub-themes (construct definition, operationalisation, measurement validity/instrument/
reliability, conceptual relationships/variable/construct) counts as "on-topic" — for direct
comparability with the 10-selected/20%-strict number this task was asked to compare against. Under
that broad standard, the 3 collision-suspect rows named in §3 count as strict matches (they genuinely
are measurement-validity content, which is a real 5.7 sub-theme PR-24 already broadened for) but are
still flagged, not hidden, because they did not arrive via the specific construct-definition/
operationalisation sub-theme this task targeted.

**On-topic-or-borderline**: 16/24 (67%) vs. PR-24's 7/10 (70%) — essentially flat. **Strict fraction**:
54% vs. 20% — nearly tripled. The headline change is not "more padding," it is a genuine composition
shift toward strict matches, driven almost entirely by query 2.

Of the 24 selected, 22 are net-new; the 2 pre-existing carryovers from PR-24's baseline ("TWO CRITERIA
FOR GOOD MEASUREMENTS IN RESEARCH: VALIDITY AND RELIABILITY," strict; "Formulation and Optimization of
Nose to Brain targeted system for Drug Delivery," borderline) are both still present.

## 6. Plain verdict

**This closed the gap for construct-definition/variable-operationalisation content, but not cleanly —
it also reproduced a real, previously-flagged provider-query risk (PR-15c) that this task's own Step 1
review did not catch in advance.**

- PR-23/24's "genuine content gap, ~0 qualifying rows under any rephrasing" finding for `construct
  definition`/`variable operationalisation` is **no longer true against the updated pool**. Query 2
  alone found a large, genuinely on-topic vein of exactly that content. Section 5.7 now clears its full
  24-item quota with a strict-on-topic fraction nearly 3x PR-24's baseline.
- This did **not** come for free: two of the three queries (1 and especially 3) reproduced the
  CORE/DOAJ bag-of-words over-matching failure mode this investigation has repeatedly had to design
  around — 787 net-new rows persisted, of which the large majority (§3, §4) are off-topic clinical-
  prediction/generic-biomedical noise unrelated to 5.7's theme, now sitting permanently in the
  project's shared literature pool. This did not corrupt 5.7's own selection (the quota+ranking design
  worked as intended, surfacing the genuine content and leaving the noise unselected), but it is a
  real, disclosed cost: the pool grew by 76% (1,042 → 1,829) to net a 24-row gain for one section.
- A small number (3 of 22 net-new selected, §3) of the genuine gains are collision-suspect —
  validity/reliability-signal rows slipping through because `construct definition`/`variable
  operationalisation` remain unguarded by `ThemeAnchorTerms`, unlike the two themes PR-24 already
  patched. Not severe enough to erase the net gain, but a specific, named residual for anyone
  extending `ThemeAnchorTerms` next.

**Bottom line, not rounded up**: genuine gap closed for this specific run, primarily via one of the
three queries; the other two queries' contribution to the *pool* was mostly noise even though it did
not hurt 5.7's own selected output this time.

## 7. Frontend theme-vocabulary-intent observation (Step 4, flag only — not acted on here)

A one-paragraph, read-only observation for a **future** investigation, not something this task
redesigned: `c:\Users\42153\OneDrive\Desktop\IT Projects\Humaniser-frontend\src\data\proposalOutline.ts`
defines 5.7's actual prompt/intent as `'List and define the independent, dependent, and confounding
variables. Describe measurement scales.'` (line 81) — i.e., the section's real job is to define
**this specific study's own** IV/DV/confounders (nose-to-brain delivery efficacy, PK/PD parameters,
formulation variables, etc.), not to survey methods literature about what "construct definition"/
"operationalisation" mean as abstract concepts. The same file also shows 5.7 is retitled "Key Research
Constructs" for qualitative-methodology projects and "Study Variables and Research Constructs" for
Mixed Methods (lines 56-61), suggesting its citation needs may genuinely differ by methodology type in
a way the current single, methodology-agnostic theme vocabulary does not account for. Backend behavior
already found in this investigation is one plausible reading — a nanocarriers PK/PD study's 5.7 may
need very few methods-literature citations at all (construct-operationalisation citations may be more
load-bearing for the qualitative-methodology-adjacent projects this cross-disciplinary vocabulary was
originally designed around) — but this is a flag for someone to investigate deliberately, not a
conclusion this task's evidence supports on its own.

## 8. Scope confirmation

- **Only the nanocarriers project** (`b2448ab0-a178-4e93-853f-812c840e174a`) was queried, fetched, or
  modified. No other project was touched.
- **Exactly 3 live provider calls were made** — one per finalized query, no retries, no re-fetch after
  seeing results, matching the task's one-time authorization.
- **No code was changed.** `git status --short` in `C:\Users\42153\OneDrive\Desktop\IT
  Projects\Humaniser` was clean (no output) both before and after this task — PR-24's own code changes
  are already committed (`e484fba`, `63065ee`), so unlike prior reports in this chain there was no
  pre-existing uncommitted diff to preserve or disturb.
- **The harness (`Pr25Harness`) left no trace.** Built and run entirely within the session scratchpad
  directory, outside the backend repo, and deleted immediately after use.
- **The only lasting effect of this task is data**: 787 new `project_literature` rows for the
  nanocarriers project, persisted through the app's own `ToProjectLiterature` + `SaveChangesAsync`
  path (the same path `ResearchService`'s own claim-evidence gap-fill uses), not a hand-rolled insert
  and not a schema or code change.
- No real API key values appear anywhere in this report.
