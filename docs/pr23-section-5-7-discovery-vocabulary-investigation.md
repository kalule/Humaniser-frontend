# PR-23 — Section 5.7 ("Study Variables") Discovery/Vocabulary Investigation

Investigation only, no code changes, no live provider/Claude calls. Continues
`pr13-22-full-chain-verification-report.md` §5, which found section 5.7's pad-to-quota fallback
(`ResearchService.cs:1330-1362`) returned only 6 candidates for the nanocarriers project even at
`MinFallbackRelevanceScore = 1`, the lowest bar in the codebase. This pass asks *why* — is it a
query/vocabulary phrasing problem (same-day fix) or a genuine content gap in the discovery pool
(needs new live fetches)?

## 0. Method note

Read-only, pure-recomputation harness (`Pr23Harness`), standalone console app in the session
scratchpad, `AssemblyName=HumaniseAI.IntegrationTests` so the existing
`InternalsVisibleTo(HumaniseAI.IntegrationTests)` grant on `HumaniseAI.Infrastructure.csproj`
applied, `ProjectReference`-ing `HumaniseAI.Infrastructure.csproj` directly. Same NU1605 fix as
prior sessions (explicit `Microsoft.EntityFrameworkCore.Relational` `8.0.29` reference). Unlike the
PR-13→22 harness, this one needed **no DI graph at all** — every function used
(`EvidenceThemesForSection`, `TokenizeForRanking`, `ScoreClaimRelevance`, `MatchEvidenceToClaims`,
`SelectLiteratureForSection`, `IsTopicBearingSection`, `UsesClaimLevelEvidenceRetrieval`,
`QueryTermExtractor.ExtractSignificantTerms`) is `internal static` and pure, so the harness called
them directly against a plain `AppDbContext` (`UseNpgsql`, real `humaniseaidb`, read-only queries)
with no Hangfire, no `AddInfrastructure`, no HTTP client. No provider/Claude call was possible from
this harness even in principle — it never touches `LiteratureOrchestrator` or any Claude client.
Deleted immediately after use; `git status --short` in the backend repo before and after is
byte-identical (the same three pre-existing modified files PR-13→22 already documented:
`HumaniseAI.API/logs/sectiongen-20260805.json`, `HumaniseAI.Infrastructure/Services/ResearchService.cs`,
`HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs`) — no new files, no staged
changes.

**Baseline sanity check**: `SelectLiteratureForSection(pool, "5.7", "Study Variables",
projectTopicTerms)` against the live nanocarriers pool (still 1,042 rows, unchanged since
PR-13→22) returned **6** — identical to PR-13→22's reported number, confirming the pool genuinely
hasn't changed and the harness reproduces production logic correctly before any variant testing
began.

## 1. 5.7's exact current theme vocabulary

Pulled verbatim from `EvidenceThemesForSection("5.7", "Study Variables")`
(`ResearchService.cs:1200`):

```
["construct definition", "variable operationalisation", "measurement validity", "conceptual relationships"]
```

Each phrase tokenizes (via `TokenizeForRanking`) to exactly 2 significant words, and
`ScoreClaimRelevance`'s gate (`ResearchService.cs:1613`, `matchedTerms.Count < Math.Min(2,
terms.Count)`) requires **both** words to appear somewhere across a candidate's title, abstract, or
key findings before it scores above zero at all — this is a strict 2-word AND, not a bag-of-words
OR. Confirmed directly from the harness's tokenization dump:

| Theme | Tokens | Overlap required |
|---|---|---|
| `construct definition` | construct, definition | 2 |
| `variable operationalisation` | variable, operationalisation | 2 |
| `measurement validity` | measurement, validity | 2 |
| `conceptual relationships` | conceptual, relationships | 2 |

Compared against what "Study Variables" actually needs (construct definition, operationalisation,
measurement validity/reliability) — the vocabulary is **not mismatched in subject**, it genuinely
names the right concepts. The problem, established in §3 below, is that the exact word pairings
chosen are narrower than how methods literature actually phrases these ideas, and the strict
2-word-AND structure compounds that narrowness.

## 2. Does 5.7 get any theme-specific discovery query today?

**Two different mechanisms exist in the current code, and they answer this question differently —
both were checked directly, not assumed from PR-16.**

### 2a. `BuildSubThemeQueriesAsync` (the mechanism PR-16 Stage 1 analyzed) — confirmed still gated
out for 5.7, by design, not by the dormant raw-pool-size trigger

`ResearchService.cs:2262`: `var sectionQualifiesForDiscovery = IsTopicBearingSection(sectionCode);`
— confirmed live: `IsTopicBearingSection("5.7") == false` (5.7 is not in the 7-section
topic-bearing set `1.0/1.2/2.0/3.1/3.2/5.1/5.3`; it's one of the 11 claim-level sections via
`UsesClaimLevelEvidenceRetrieval("5.7") == true`). The code comment at `ResearchService.cs:2259-2261`
confirms this restriction is deliberate and post-dates PR-16 Stage 1's own recommendation
(§1b: "these 11 sections don't need project-core-term combination... forcing it on would work
against the design"). **This is the second of the task's two possible findings, confirmed
directly: 5.7 was always out of scope for `BuildSubThemeQueriesAsync`-style discovery by design,
not blocked by the dormant `literature.Count < sectionTarget` trigger bug PR-16 found for the
topic-bearing sections.** `fetchDecision` for 5.7 through this path reads
`"fetchSkipped=notTopicBearingSection"`, not the trigger-bug's `fetchSkipped=...AboveTarget`.

### 2b. A separate, always-on "claim evidence gap-fill" mechanism (`ResearchService.cs:2384-2408`)
— NOT characterized by PR-16, and it DOES fire theme-specific queries for 5.7 today

This block runs unconditionally for every claim-level section (`if
(UsesClaimLevelEvidenceRetrieval(sectionCode))`, no pool-size gate beyond the per-theme check
itself):

```csharp
var uncoveredClaimQueries = MatchEvidenceToClaims(
        literature, sectionCode, section.SectionTitle, desiredSourcesPerClaim: 2)
    .Where(m => m.Sources.Count < desiredSourcesPerClaim)
    .Select(m => new EvidenceSearchQuery(m.Claim, EvidenceType.MethodologicalTheoretical))
    .ToList();
```

`m.Claim` is the **literal, unmodified theme phrase** — not combined with project-subject terms
(correctly, per PR-16's cross-disciplinary-methodology reasoning), not rewritten, not expanded.
Reconstructed live against the current nanocarriers pool:

| Theme | `MatchEvidenceToClaims` sources found (top-2) | Uncovered (`< 2`)? |
|---|---:|---|
| `construct definition` | 0 | **yes** |
| `variable operationalisation` | 0 | **yes** |
| `measurement validity` | 2 ("Social Research Methods: Qualitative and Quantitative Approaches"; "TWO CRITERIA FOR GOOD MEASUREMENTS IN RESEARCH: VALIDITY AND RELIABILITY") | no |
| `conceptual relationships` | 2 ("Understanding the Phenomenon of Political Maneuvering of Managers of Public Organizations"; "art 8 vol V is 1.rtf") | no |

**So today's code would send exactly two live queries for 5.7, verbatim:**

```
"construct definition"
"variable operationalisation"
```

sent as `EvidenceSearchQuery.Query` with `EvidenceType.MethodologicalTheoretical` to
`_literatureOrchestrator.FetchAsync`, i.e. the same OpenAlex/CORE/Scopus/DOAJ/Semantic Scholar
fan-out `pr16-stage1-section-aware-discovery-scoping.md` and
`discovery-pool-quality-audit-report.md` §3 already characterized as Elasticsearch-family,
default-OR, bag-of-words backends for 3 of those providers.

**Is that phrasing realistic for a bag-of-words provider?** No, and for a specific, checkable
reason: both phrases are exactly 2 generic academic words with no domain anchor at all —
"construct definition" and "variable operationalisation" read identically whether the underlying
study is about nanocarriers, corruption, or classroom pedagogy. Per the same
`GenericAcademicTerms`-style reasoning `pr16-stage1-section-aware-discovery-scoping.md` §1b applied
to the topic-bearing sections, a 2-word, fully generic phrase sent to a relevance-ranked free-text
backend will surface whatever is most-cited/most-generic across the *entire* index for those two
words, not anything connected to this specific study — the same failure mode already documented for
5.1's theme phrases, just with methodology vocabulary instead of topic vocabulary. This is a live,
active query path (not dormant like §2a), and it is already sending exactly the kind of phrase this
investigation has repeatedly found doesn't work.

## 3. Pure recomputation — does broader phrasing surface more of the existing pool?

Re-scored the same unchanged 1,042-row nanocarriers pool against the original themes plus 3
rephrased variants, using `ScoreClaimRelevance` directly (uncapped — not limited to a
top-2-per-theme quota, so this reflects the true qualifying-candidate count, not what a small quota
would show).

| Variant | Themes | Per-theme qualifying rows | Union (distinct rows, any theme) |
|---|---|---|---:|
| **ORIGINAL** | construct definition / variable operationalisation / measurement validity / conceptual relationships | 0 / 0 / 2 / 3 | **5** |
| **A — US spelling swap only** | construct definition / variable **operationalization** / measurement validity / conceptual relationships | 0 / 0 / 2 / 3 | **5** (no change) |
| **B — broader synonyms, same 2-word-AND structure** | variable definition / operational definition / **validity reliability** / **conceptual framework** | 0 / 0 / **22** / **20** | **42** |
| **C — single-keyword broadest (1-word overlap only)** | variables / validity / reliability / instrument | 11 / 38 / 41 / 7 | **63** |

**This is not a clean "phrasing problem, case closed" result — it splits in a specific, load-bearing
way that changes what the fix should be:**

- **Variant A rules out spelling as the bottleneck.** Swapping UK "operationalisation" for US
  "operationalization" changed nothing — 0 qualifying rows either way. Not worth pursuing as a fix.
- **Variant B's 5→42 jump is real but is mostly the wrong content, not new 5.7 content.** Inspecting
  the actual 42 titles: the great majority are generic qualitative-**trustworthiness/rigor** papers
  — Lincoln & Guba-style "Rigor in Qualitative Research," "Trustworthiness as Inferential
  Accountability," "The Tetra Pillars of Trustworthiness in Qualitative Research," "Rigour in
  qualitative and quantitative studies... Reliability, validity, credibility, transferability,
  dependability" — which is **5.9's theme** (qualitative trustworthiness/credibility/dependability),
  not 5.7's (construct definition/variable operationalisation/measurement validity as applied to
  *this study's variables*). This is the identical word-sense collision
  `pr13-22-full-chain-verification-report.md` §4 already documented for 5.4 vs. 5.9 ("criteria"):
  qualitative researchers use "validity and reliability" idiomatically as a synonym for
  trustworthiness/rigor, not literally about instrument or construct validity — so broadening
  "measurement validity" to "validity reliability" mostly just re-imports 5.9's already-documented
  contamination into 5.7, rather than finding genuine new 5.7 content. Of the 42, only a handful
  read as genuinely on-topic for 5.7's actual sense: "TWO CRITERIA FOR GOOD MEASUREMENTS IN
  RESEARCH: VALIDITY AND RELIABILITY" (already in the original 5), "Establishing validity and
  reliability in case study research projects," "Reliability and Validity of Qualitative and
  Operational Research Paradigm" — roughly 3-5 out of 42, not a proportional 8x increase in usable
  material.
- **Variant C's 5→63 jump is the same effect, worse.** Dropping the 2-word-AND requirement down to
  a bare 1-word match (via single-keyword themes) reintroduces the exact bag-of-words false-positive
  pattern this codebase has fought all along (PR-14b's "Institutional Context" false match, PR-21's
  1-word-overlap fix) — "variables" alone matches a fatty-acid-ester-catalyst chemistry paper and a
  dental-antibiotic-prescribing paper purely on the word "variables" appearing incidentally; "reliability"
  matches an unrelated AI-safety survey and a muscular-dystrophy dog-model paper. Precision drops
  further even as the raw count climbs.
- **The two most theme-precise original phrases — "construct definition" and "variable
  operationalisation" — stayed at exactly 0 qualifying rows under every variant tested, including
  the single-keyword broadest one** ("variables" → 11 rows, none of which are genuinely about
  operationalizing or defining variables as a methods construct). This is the actual finding: it
  is not that the pool has 0 rows about validity/reliability in any sense (it has plenty, just the
  wrong sense) — it's that the pool has close to nothing about the *specific* methods concept of
  defining and operationalizing variables/constructs for measurement purposes. That reads as a
  genuine content gap for that specific sub-theme, not a phrasing artifact, since no rephrasing
  tried (including deliberately loosening the matching rule itself) surfaced anything for it.

**Bottom line for the task's key question**: this is **both**, split by sub-theme, not a single
verdict for all of 5.7. "measurement validity" / "conceptual relationships" are a same-day
vocabulary problem, but naively broadening them (as tested) mostly imports 5.9's contamination
rather than fixing precision — any real fix needs to avoid the "validity/reliability as
trustworthiness idiom" collision, not just add synonyms. "construct definition" / "variable
operationalisation" look like a genuine retrieval gap — the pool has ~0 rows for that specific
methods concept under any phrasing or matching-strictness tried here.

## 4. Cross-project structural check

Ran the identical `SelectLiteratureForSection`/`MatchEvidenceToClaims`/uncapped-union checks
against **Lived Experiences of Homebound Seniors Receiving Remote Clinical Consultations**
(id `ec896d6f-2cca-405d-acf5-d587f01c691e`), chosen because it has the largest pool of the 4
remaining audited projects (1,648 rows vs. 1,313 for AI-traffic, 1,496 for ICT-rural-clinics, 972
for proxy-re-encryption) and — per `pr13-22-full-chain-verification-report.md` §8's own
recommendation — is a real-classifier project like nanocarriers rather than one of the two
empty-`FieldInterest`/no-gate cases, making it the closer structural comparison.

| Metric | Nanocarriers (1,042-row pool) | Homebound Seniors (1,648-row pool) |
|---|---:|---:|
| `SelectLiteratureForSection("5.7")` final count | **6** (below its own 8-item floor) | **14** (above its 8-item floor) |
| `construct definition` uncapped qualifying rows | 0 | **0** |
| `variable operationalisation` uncapped qualifying rows | 0 | **0** |
| `measurement validity` uncapped qualifying rows | 2 | 5 |
| `conceptual relationships` uncapped qualifying rows | 3 | 4 |
| Union (uncapped, original themes) | 5 | 9 |

**Plain statement of what this shows**: the specific, sharpest part of the finding — "construct
definition" and "variable operationalisation" returning exactly 0 qualifying rows — is **identical
across two pools from unrelated fields** (pharmacology/nanocarrier delivery vs. remote-clinical
telehealth for seniors), which reads as structural, not nanocarriers-specific. That specific
methods sub-theme (defining/operationalizing variables/constructs) appears to be close to absent
from the kind of literature these discovery fetches are pulling in generally, regardless of the
study's field.

The *overall* severity differs, though, and for a plain, non-coincidental reason: Homebound
Seniors' `measurement validity`/`conceptual relationships` hits are more genuinely on-theme than
nanocarriers' — "Designing and Psychometric Properties Evaluation of the Tool for Measuring
Professional Engagement," "When Assessment Data Are Words: Validity Evidence for Qualitative
Educational Assessments," "Development of a Digital Health Literacy Assessment Framework for Older
Adults" are all genuinely about instrument/assessment validity, versus nanocarriers' hits which
include a generic methods textbook and an unrelated public-sector-corruption paper. This tracks
with Homebound Seniors' own field (health assessment, clinical instruments, telehealth) naturally
overlapping with "validity"/"instrument"/"assessment" vocabulary in a way nanocarriers'
pharmacology/drug-delivery field does not — not because the discovery or matching mechanism behaves
any differently between the two projects. **Net read: the narrow-vocabulary gap for
construct-definition/operationalisation is structural across projects; whether a project's overall
5.7 selection clears its own floor depends on how close that project's field happens to sit to
measurement/assessment vocabulary generally, which is closer to luck than to anything the discovery
layer is doing intentionally.**

## 5. Proposed reformulated queries — PROPOSED ONLY, NOT TESTED, NEEDS SEPARATE LIVE-FETCH AUTHORIZATION

For the genuine-gap sub-theme only (`construct definition` / `variable operationalisation`), three
candidate reformulations, kept deliberately still cross-disciplinary/methodology-flavored (not
combined with nanocarriers-specific terms), per PR-16 §1b's design rule that claim-level sections
should stay field-agnostic:

1. `"operational definition of variables in research"`
2. `"construct validity measurement instrument development"`
3. `"variable operationalization methodology"`

These are proposed as directionally more specific than the current 2-word phrases without
reintroducing the "validity/reliability as trustworthiness idiom" collision documented in §3 — but
they are unverified guesses about provider behavior, not confirmed to actually work. **Do not run
these against any live provider without separate explicit authorization** — this task's scope was
recomputation against the existing pool only.

## 6. Scope confirmation

- **No code, query, config, or data was modified.** Only `Read`/`Grep` against source files and
  read-only SQL (`AsNoTracking()`, `SELECT`-only via EF) against `humaniseaidb` were performed.
- **No live calls were made** to any external literature provider (OpenAlex/CORE/Scopus/DOAJ/Semantic
  Scholar/Google Scholar) or to Claude. The harness never referenced `LiteratureOrchestrator`, any
  provider HTTP client, or any Claude client — it called only pure `internal static` scoring/query-
  construction functions and read `project_literature`/`research_projects` rows directly.
- **The harness left no trace.** `git status --short` in the backend repo before and after this
  task is identical: the same three pre-existing modified files
  (`HumaniseAI.API/logs/sectiongen-20260805.json`, `HumaniseAI.Infrastructure/Services/ResearchService.cs`,
  `HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs`) already flagged as
  pre-existing at the start of this task, untouched. The harness project and all scratch files were
  built and deleted entirely within the session scratchpad directory, outside the backend repo, and
  no other project besides nanocarriers and the one cross-project comparison (Homebound Seniors,
  read-only) was queried.
- No real API key values appear anywhere in this report.
