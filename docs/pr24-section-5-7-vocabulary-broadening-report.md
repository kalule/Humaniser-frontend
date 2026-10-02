# PR-24 Part 1 — Section 5.7 Vocabulary Broadening + Collision Guard

Code change + live recomputation (no live provider/Claude calls). Continues
`pr13-22-full-chain-verification-report.md` §5 and `pr23-section-5-7-discovery-vocabulary-
investigation.md`, which isolated section 5.7's ("Study Variables") candidate-recall problem to its
4 theme phrases in `EvidenceThemesForSection` and found it splits by sub-theme: "construct
definition"/"variable operationalisation" have ~0 qualifying candidates under any rephrasing tried
(genuine content gap, Part 2 below), while "measurement validity"/"conceptual relationships" have
real candidates once broadened, but broadening mostly re-imports section 5.9's "validity/reliability
as a trustworthiness idiom" word-sense collision rather than genuine 5.7 content. This PR broadens
the latter two theme strings and adds a per-theme anchor guard scoped narrowly enough to keep that
collision out, based on live recomputation against the real nanocarriers pool (1,042 rows, project
`b2448ab0-a178-4e93-853f-812c840e174a`), not on judgment alone.

## 0. Method note

Same harness pattern as PR-13→22/PR-23: standalone console app (`Pr24Harness`), `AssemblyName`
set to `HumaniseAI.IntegrationTests` so the `InternalsVisibleTo` grant on
`HumaniseAI.Infrastructure.csproj` applies, `ProjectReference`-ing `HumaniseAI.Infrastructure.csproj`
directly, no DI graph (every function used — `EvidenceThemesForSection`, `TokenizeForRanking`,
`ScoreClaimRelevance`, `SelectLiteratureForSection`, `QueryTermExtractor.ExtractSignificantTerms` —
is `internal static` and pure), `UseNpgsql` against the real `humaniseaidb` with read-only queries.
Same NU1605 fix (explicit `Microsoft.EntityFrameworkCore.Relational` `8.0.29` reference). Built and
run twice: once before the code change (to validate candidate vocabulary/anchor combinations against
the real pool before committing to them), once after (to get the real post-change
`SelectLiteratureForSection` count). Deleted immediately after use — confirmed via `git status
--short`, see §6.

No live provider or Claude calls were made at any point — every step here is either a code change, a
new unit test, `dotnet build`/`dotnet test`, or in-process recomputation against literature rows
already in the database.

## 1. Vocabulary chosen, and why (empirical, not judgment-only)

**Final theme strings** (`ResearchService.cs:1216-1217`):

```
"5.7" => ["construct definition", "variable operationalisation",
          "measurement validity instrument reliability", "conceptual relationships variable construct"],
```

First two entries byte-identical to before — pinned by a new test
(`EvidenceThemesForSection_57_ReturnsFourThemes_FirstTwoUnchanged`). Both were re-confirmed at 0
uncapped qualifying rows against the nanocarriers pool under the broadened themes too — no
rephrasing found in this or the PR-23 investigation surfaces anything for them; treated as a genuine
content gap, not touched by this PR (Part 2 below).

**"measurement validity" → "measurement validity instrument reliability"** — added "instrument" and
"reliability". Recomputation:

| Variant | Unguarded qualifying rows | Guarded (anchor = {measurement, instrument}) |
|---|---:|---:|
| Original ("measurement validity") | 2 | n/a (no guard on old theme) |
| + instrument, reliability | 26 | **6** |
| + instrument, reliability, scale, error | 28 | **6** (identical) |

**"scale" and "error" were tested and dropped.** Adding them raised the unguarded count from 26 to
28, but the anchor-guarded count was identical (6) either way — the 2 extra unguarded rows they
pulled in never had "measurement" or "instrument" in them, so the guard filtered them regardless.
Zero marginal benefit for the risk the plan flagged (both are generic enough to start their own
collision class), so they were left out.

**"conceptual relationships" → "conceptual relationships variable construct"** — added "variable"
and "construct" (dropping the earlier "interrelation" candidate — `TokenizeForRanking` does no
stemming, so a singular-only token silently fails to match "interrelationships"). Recomputation:

| Variant | Unguarded qualifying rows | Guarded (anchor = {variable, construct}) |
|---|---:|---:|
| Original ("conceptual relationships") | 3 | n/a |
| + variable, construct | 5 | **3** |

**"framework" was tested and explicitly excluded**, per the plan's cross-section-collision concern
about section 3.3 ("Theoretical Framework"). Confirmed empirically, not just asserted: adding
"framework" to the conceptual-relationships theme jumped unguarded rows from 5 to 29, and inspecting
them found the same Lincoln & Guba / trustworthiness-framework / generic-conceptual-framework
literature that clutters 3.3's own theme vocabulary — directly comparable to running 3.3's own theme
("theoretical framework definition") against the same pool, which independently returns 22 rows of
near-identical character. Even with the anchor guard applied, framework's two marginal additions
("Navigating Professional Identity and Cultural Expectations... Saudi Nurses" and a bacteriophage-
therapy modeling paper) were not clean wins — one reads as generic qualitative-framework boilerplate,
the other as an unrelated pharmacology paper matched incidentally on "framework"+"construct". Dropped.

## 2. The anchor guard

`ResearchService.cs:1601-1626` — `ThemeAnchorTerms`, keyed by the exact broadened theme string,
checked in `ScoreClaimRelevance` immediately after the existing `matchedTerms.Count <
Math.Min(2, terms.Count)` gate:

```csharp
if (ThemeAnchorTerms.TryGetValue(theme, out var anchors) && !matchedTerms.Overlaps(anchors))
    return 0;
```

```
["measurement validity instrument reliability"] = { "measurement", "instrument" }
["conceptual relationships variable construct"]  = { "variable", "construct" }
```

Deliberately excludes "validity"/"reliability" and "conceptual"/"relationships" themselves from their
own anchor sets — those are precisely the idiom words responsible for the collisions being closed.
**Direct confirmation the guard closes the specific, previously-named residual**: the "political
maneuvering of public sector managers" paper (`pr13-22-full-chain-verification-report.md` §5's named
5.7 filler example) scores >0 under the old "conceptual relationships" theme and **0** under the new
broadened+guarded theme — it matches only "conceptual"+"relationships", no variable/construct anchor.
Pinned as a contrast test
(`ScoreClaimRelevance_PoliticalManeuveringStylePaper_PassesOldTheme_ButZeroUnderNewGuardedTheme`).
Scoped per-theme by dictionary lookup, not a change to `ScoreClaimRelevance`'s general gate — a
blanket version of a structurally similar fix (PR-22, `ResearchService.cs:1581-1600`'s own comment)
fixed 5.9 but starved 5.4 elsewhere; this guard only fires for the two exact theme strings in the
dictionary, everything else (including 5.4/5.9/5.11's own themes) is unaffected by construction. A
key-sync test (`ThemeAnchorTerms_KeysMatchBroadened57ThemeStringsVerbatim`) pins the dictionary's
keys against `EvidenceThemesForSection("5.7", ...)[2]`/`[3]` verbatim, so a future edit to either
theme string that forgets to update the dictionary fails a test instead of silently degrading to
unguarded behavior.

## 3. Before / after — real numbers, not rounded up

`SelectLiteratureForSection(pool, "5.7", "Study Variables", projectTopicTerms)` against the unchanged
1,042-row nanocarriers pool:

| | Selected count | vs. floor (8) | Composition (3-tier spot-check) |
|---|---:|---|---|
| **Before** (PR-13→22 baseline) | 6 | below | 1/6 strict (17%), 2/6 borderline (33%), 3/6 off-topic (50%) |
| **After** (this PR) | **10** | **clears it** | 2/10 strict (20%), 5/10 borderline (50%), 3/10 off-topic (30%) |

Strict-only fraction is essentially flat (17% → 20% — not a precision win, reported plainly rather
than rounded up). What actually moved: the selected count nearly doubled and, for the first time,
clears `MinUniqueSourcesForSection("5.7") = 8`; on-topic-or-borderline count went from 3/6 to 7/10 —
more than doubled in absolute terms even though the ratio only moved from 50% to 70%. The specific
named residual (political-maneuvering paper) and a second filler item ("Triangulasi dan Analisis
Domain") are both gone from the selected set, replaced by two genuine finds: "Social enterprises in
the Indian context: conceptualizing through qualitative lens" (abstract explicitly "researches the
meaning of the 'social enterprise' construct... and develops a conceptual framework that represents
the construct" — a strict construct-definition hit) and "Formulation and Optimization of Nose to
Brain targeted system for Drug Delivery" (genuinely project-subject-relevant, entered via the
unrelated title-fallback stage on the literal word "variables" — "formulation variables (e.g.,
viscosity, osmolarity)" — but classified borderline rather than strict here because it's using
"variables" in a pharma-process sense, not 5.7's construct-operationalization sense; flagged, not
hidden, per this investigation's own established norm).

**New disclosed residuals, not fully closed by the guard**: "instrument" pulled in one genuine false
positive from an unrelated field ("Feasibility of Vibroacoustic Sensing for Detection of Peritoneal
Entry During Laparoscopic Access" — a surgical-device paper matched on "instrument"+"reliability"
purely incidentally) and one 5.9-idiom-collision residual that still slips past the anchor
("Scientific rigor in qualitative research" mentions "instrument" once, in passing, among a list of
qualitative-rigor topics — the anchor guard isn't proof against a single incidental word). Both are
counted "off-topic" in the after-tally above rather than smoothed over. There is also a pre-existing
near-duplicate pair (two records of the same Effutu Municipality creative-arts study) among the
selected 10, an existing data-quality issue (same class `pr13-22-full-chain-verification-report.md`
§4 flagged for a different pair) — out of scope to fix here.

**Honest bottom line**: partially helps, does not fully close the gap. It clears the 8-item floor for
the first time and roughly doubles usable (on-topic-or-borderline) material, while leaving the strict-
precision fraction essentially unchanged and introducing two small, disclosed new residuals from the
broadened vocabulary. It does not touch "construct definition"/"variable operationalisation" at all —
those remain at 0 qualifying rows, which is most of why 10 is still well under the 24-item quota.

## 4. Regression tests

`HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs` — 7 new tests added, following the
file's existing `MakeLiterature` + `ScoreClaimRelevance`/`TokenizeForRanking` pattern:

- `EvidenceThemesForSection_57_ReturnsFourThemes_FirstTwoUnchanged` — pins the scope boundary.
- `ThemeAnchorTerms_KeysMatchBroadened57ThemeStringsVerbatim` — key-sync pin.
- `ScoreClaimRelevance_MeasurementValidityIdiomOnly_NoMeasurementOrInstrumentAnchor_ScoresZero`
- `ScoreClaimRelevance_GenuineMeasurementInstrumentPaper_PassesBroadenedTheme`
- `ScoreClaimRelevance_PoliticalManeuveringStylePaper_PassesOldTheme_ButZeroUnderNewGuardedTheme` —
  contrast test against the real, previously-named filler pattern.
- `ScoreClaimRelevance_GenuineVariableConstructPaper_PassesBroadenedConceptualRelationshipsTheme`
- `ScoreClaimRelevance_Genuine59TrustworthinessPaper_StillScoresZeroForBroadened57Themes` — reverse-
  leakage check against the existing genuine 5.9 fixture.

## 5. Build/test result

`dotnet build` on `HumaniseAI.API.csproj` (pulls in `Infrastructure`/`Application`/`Domain` — no
solution file exists in this repo to build directly): **clean, 0 errors** (one pre-existing nullable-
warning at `ResearchService.cs:6848`, unrelated to this PR's edit region ~1200-1650, confirmed via
`git diff --stat` showing all changes localized there).

`dotnet test HumaniseAI.IntegrationTests.csproj --filter LiteratureSelectionScoringTests`: **52/52
passed** (all pre-existing 5.4/5.9/5.11/5.7/etc. tests in the file stayed green, unchanged, plus the
7 new ones). The full multi-hundred-test `HumaniseAI.IntegrationTests` project (which includes
`CustomWebApplicationFactory`-based e2e tests requiring a running web host) was not run in full — out
of scope for a pure scoring-logic change, and the file-level 52/52 plus a clean full-project `dotnet
build` (which would fail to compile if this change broke anything referenced elsewhere) together cover
the realistic regression surface.

## 6. Scope confirmation

- No project other than the nanocarriers project was queried, fetched, or modified.
- No live provider or Claude call was made at any point.
- Code changes are limited to `HumaniseAI.Infrastructure/Services/ResearchService.cs` (theme strings
  + `ThemeAnchorTerms` + guard line, ~116 net new lines including comments) and
  `HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs` (7 new tests). Nothing committed —
  left in the working tree per instruction.
- The harness (`Pr24Harness`, built twice — pre- and post-code-change — in the session scratchpad)
  was deleted after use. `git status --short` in the backend repo after this task shows exactly the
  same three pre-existing modified files as PR-13→22/PR-23 documented
  (`HumaniseAI.API/logs/sectiongen-20260805.json`, `HumaniseAI.Infrastructure/Services/
  ResearchService.cs`, `HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs`), now
  additionally carrying this PR's own edits on top of the pre-existing diff — no new files, no
  staged changes, no commits.
- No real API key or credential values appear anywhere in this report (the DB connection string used
  is the plain local-dev default already visible in `appsettings.json`, not a secret).

## Part 2 — Refined live-fetch queries for the genuine content gap: PROPOSED ONLY, NOT AUTHORIZED

For "construct definition"/"variable operationalisation" — confirmed again in this PR's own
recomputation (§1) to sit at 0 qualifying rows under every rephrasing or matching-strictness tried
across two investigations now — a genuine retrieval gap, not a same-day vocabulary fix. Evaluating
PR-23's 3 candidate reformulated queries against this PR's own collision learnings:

1. `operational definition independent dependent confounding variables` — no idiom-collision words
   (no "validity"/"reliability"/"conceptual"/"relationships"). **Lower-risk.**
2. `construct operationalization measurement validity reliability` — contains the exact "validity
   reliability" idiom pairing this PR just spent its whole guard-design effort keeping out. Any
   live-fetched content from this specific query would need the same anchor-style downstream
   filtering (or manual review) before being trusted for 5.7 — not automatic inclusion into the pool.
3. `measurement scales variable classification predictor outcome covariate` — no idiom-collision
   words. **Lower-risk.**

These remain unverified guesses about live provider behavior — no live call was made to test them.
This PR is not requesting authorization to run them; that is a separate decision for whoever reviews
Part 2.
