# PR-27: Reference Integrity Fixes — Export Gate, DOI Dedup, Conditional 5.4 Guard

Project `20f54592-95da-46da-a51a-15f68ef7736a` throughout. All code changes left uncommitted in the
working tree, per instruction.

## Step 0 — Disputed facts, resolved

**0a — Duvvur fabrications: still open, unresolved, ungated. Confirmed, no change since the original
finding.** `citation_verification_flags` still has 11 Open `UnresolvedCitation` flags for this project,
2 of them the fabricated `(Duvvur, 2023)` citations. Cross-referenced against the live drafted text in
`project_sections`: sections 4.2 and 4.3 still contain the fabricated DOIs
(`10.1234/jiscr.2023.001`, `10.1016/j.jcloudsec.2023.02.004`) verbatim; both sections are `Status=4`
(Approved), generated 2026-08-06, untouched since. Sections 3.2/6.3 still carry the one *genuine* Duvvur
citation. This is a live, currently-exported defect, not something already resolved by other means —
Step 2 addresses a real problem.

**0b — 5.4 citation texture: still present, unchanged.** Re-pulled 5.4's content for this project
(`GeneratedAt` unchanged since the original review) — identical 4 references: Johnson (2020), Kommera
(2025), Barusch (2011), Langtree (2018). 3 of 4 are still the collision-class citations. **Gate
confirmed open — Step 3 proceeds.**

## Step 1 — DOI dedup: root cause corrected before implementing

**The task's framing ("no DOI normalization exists") does not hold — checked, not assumed.** Every one
of the 5 `ProjectLiterature` insertion sites in `ResearchService.cs` already runs some form of
DOI-aware, in-memory dedup before insert (`FetchRealLiteratureAsync`, the `FetchAndMergeMultiQueryAsync`
local function inside `GenerateSectionAsync`, CSV import, citation-gap-fill, and methodology-anchor
resolution — the last two even have explicit code comments already acknowledging "a rare race").

**Real root cause, found by checking `AddedAt` timestamps on sampled duplicate pairs**: not a missing
capability, but staleness. Every sampled pair's two rows landed in two distinct bulk-insert batches
~50 seconds apart (not a millisecond-scale simultaneous race) — consistent with
`GenerateSectionAsync`'s own comment: *"the background job fired at first-section-generation
(FetchRealLiteratureAsync, above) is fire-and-forget and may not have completed yet."* `literature` in
`GenerateSectionAsync` is a local variable, snapshotted once at request start and only ever appended to
in-memory afterward — it never re-queries the DB mid-request. So the background job (which loads its own
independent snapshot and dedupes against *that*) and the foreground request's own widening-fetch pass
(deduping against its *own*, separately-stale snapshot) can each independently decide the same real paper
is new and insert it — producing an exact-DOI duplicate, with each individual dedup check having behaved
"correctly" against the (stale) data it could see.

**Implementation, scoped to what the evidence actually implicates:**
- `NormalizeDoiForDedup`/`NormalizeTitleForDedup` (pure, `internal static`) — strips `https://doi.org/`,
  `http://doi.org/`, `https://dx.doi.org/`, `http://dx.doi.org/`, `doi:` prefixes, trims, lowercases,
  strips trailing `/`. Closes the literal normalization gap the task named, on top of the
  already-existing per-site checks.
- `DedupAndMergeAgainstPersistedAsync` (`internal`, instance) — a **live** re-check against the DB
  immediately before insert, not just the caller's in-memory snapshot. Matches by normalized DOI first,
  normalized title as the empty-DOI fallback. On a match, merges into the existing row (fills empty
  `Doi`/`Abstract`/`Journal`/`Volume`/`Issue`/`Pages`/`KeyFindings` fields, never overwrites a non-empty
  one) instead of discarding the incoming candidate's unique data. Defensive against the pool already
  containing pre-existing duplicate titles (confirmed present — `GroupBy().First()`, not `ToDictionary`
  directly, which would throw).
- Wired into the two sites the timing evidence implicates: `FetchRealLiteratureAsync` and
  `GenerateSectionAsync`'s `FetchAndMergeMultiQueryAsync`. The other 3 sites (CSV import, citation-gap-fill,
  methodology-anchor resolution) already have narrower, lower-volume, already race-aware checks of their
  own — left untouched; available as a trivial follow-up if the shared helper proves worth consolidating
  onto everywhere, not required by what actually produced the observed duplicates.

**Verification (read-only recomputation, before any write ran against this project):**
- 119 groups now caught sharing a normalized DOI (vs. 101 under raw string-equality in the earlier
  investigation — the extra 18 are exactly the URL-prefix/whitespace-variant cases normalization adds).
- Islam pair (`10.63125/8ycz7671`) confirmed caught.
- Cicek/Diva-portal pair (empty DOI both sides) confirmed caught via the title fallback.
- False-merge spot-check: 5 same-author, genuinely-different-DOI groups sampled — none collapsed
  (e.g. Bhawuk's two distinct papers on different constructs, correctly kept as two rows).

## Step 2 — `UnresolvedCitation` gated at export

Added `CitationMismatchType.UnresolvedCitation` to the same `Open`-status blocking check
`EnsureNoUnresolvedCitationGapsAsync` already ran for `ClaimContentMismatch`/`ImplausibleYear` — one
line, same pattern, same exception (`CitationIntegrityBlockedException`, message updated to mention
unresolved citations). The existing query already filters to `Status == Open`, so a flag that was raised
and later auto-corrected/dismissed/superseded does not block — verified with a dedicated test rather than
assumed from reading the filter.

**Verification**: a project with an Open `UnresolvedCitation` flag now throws
`CitationIntegrityBlockedException` on `ExportPartialDocxAsync`; a project with the same flag type but
`Status = Dismissed` exports cleanly; a project with no flags exports cleanly. Given Step 0a confirmed
this project's fabrications are still Open, this project's own export would now correctly block until
the fabricated citations are fixed or dismissed.

## Step 3 — 5.4 anchor guard, gated open per Step 0b

**Corrected the task's own hypothesis before implementing, per its own "verify before assuming"
instruction.** Pulled the real abstracts for Johnson, Barusch, and Langtree and tokenized them against
5.4's four theme phrases by hand:

- **Johnson** matched `"selection bias and representativeness"` on `selection`+`bias` — from *"...
  contribute to the **selection** of appropriate research methods that enhance trustworthiness and
  minimize researcher **bias**..."* — confirms the task's own guess.
- **Barusch** and **Langtree** did *not* match that theme at all — both instead matched
  `"eligibility criteria rationale"` on `criteria`+`rationale` — Barusch: *"...use of a sampling
  **rationale**... Of eight key **criteria**, researchers used an average of 2.0..."*; Langtree:
  *"...four **criteria** for determining rigour... understand the researcher's **rationale** for the
  methods used..."*. Two different theme phrases are responsible, not one.

**Implementation**: added both theme strings to `ThemeAnchorTerms`, anchored on a shared
`Section54EligibilityAnchors` set (`eligibility`, `participant(s)`, `system(s)`, `environment(s)`,
`deployment(s)`, `dataset(s)`) — deliberately excluding `criteria`/`rationale`/`selection`/`bias`
themselves, the exact idiom words responsible for the collision, same discipline as PR-24's 5.7 guards.
`"selection bias and representativeness"`'s anchor set additionally includes `representativeness` itself.

**Verification against the real project (read-only harness, deleted after use, same convention as
PR-23/24):**
- Direct `ScoreClaimRelevance` check on the three real pool rows: all three now score 0.
- `SelectLiteratureForSection("5.4")`: still selects 24 (hits the same ceiling as before — pool depth
  wasn't the constraint), and none of the three named collision papers are in the selected set anymore.
- `MatchEvidenceToClaims("5.4")`: the `"selection bias and representativeness"` claim slot now returns
  0 sources (previously served Johnson) rather than a wrong-genre one; `"eligibility criteria
  rationale"`'s slot now returns 3 different sources (clinical-trial/RCT inclusion-guideline content —
  still generic cross-project methods material, not eBPF-specific, but genuinely about primary-study
  inclusion criteria rather than literature-review-of-other-papers framing) — confirms the fix, doesn't
  overclaim it as a domain-topicality fix, which it isn't and wasn't meant to be.
- Reviewer-regression fixture (both reports' recommendation, task item 6): a synthetic paper about
  defining eligibility criteria for "systems, deployments, and datasets... distinct from participant
  eligibility in human-subjects research" scores > 0 under the guarded theme — confirms the guard
  excludes the collision class without excluding genuine primary-study eligibility content.

## Full test run

New tests: 18 (Step 1 dedup + Step 2 export gate, `PR27_ReferenceIntegrityTests.cs`) + 6 (Step 3 anchor
guard, appended to `LiteratureSelectionScoringTests.cs`) = 24, all passing. One pre-existing test
(`ThemeAnchorTerms_KeysMatchBroadened57ThemeStringsVerbatim`) had a stale `Count == 2` assertion that
correctly needed updating now that the same dictionary holds 5.4's two new entries alongside 5.7's two —
fixed to assert only what it's actually responsible for (5.7's own key-sync), with the total-count
assertion moved to the new PR-27 test that owns it.

Full suite: **397 passed, 16 failed, 413 total** — the 16 failures are identical, by name, to the
pre-PR-27 baseline (`Priority1_MethodologySetupTests`, `Priority2_ChapterTemplateTests`,
`Priority5_FactsRegistryTests`, `Priority7_TopicBearingSectionRestrictionTests`,
`Priority9_SectionDraftStreamingTests`), all sharing one unrelated error ("Section generation ended
before the required References block") traced via `git diff` to a separate, pre-existing, uncommitted
change to `ResearchPrompts.cs`/`ResearchServiceContentHelperTests.cs` — not touched by this PR, not
caused by it. **No regressions.**

## Migration/backfill

None required — every change in this PR is code-level (in-memory scoring, a live pre-insert DB
re-check, an export-time flag check). No schema change, no new migration.

## Files changed

- `HumaniseAI.Infrastructure/Services/ResearchService.cs` — dedup/merge helpers + wiring (Step 1),
  `UnresolvedCitation` added to the export gate (Step 2), `Section54EligibilityAnchors` +
  `ThemeAnchorTerms` additions (Step 3).
- `HumaniseAI.Infrastructure/Services/AuthService.cs` — `CitationIntegrityBlockedException` message
  updated to mention unresolved citations.
- `HumaniseAI.IntegrationTests/PR27_ReferenceIntegrityTests.cs` — new (Step 1 + Step 2 tests).
- `HumaniseAI.IntegrationTests/LiteratureSelectionScoringTests.cs` — Step 3 tests appended; one stale
  assertion fixed.

## Not touched, and why

- The 3 other `ProjectLiterature` insertion sites (CSV import, citation-gap-fill, methodology-anchor
  resolution) — already race-aware, not implicated by the timing evidence.
- `ApproveSectionAsync`'s own, separate integrity-flag check (a different gate, at section-approval time
  rather than export time) — not named in the task's Step 2 scope; noted but not modified, to avoid
  bundling an unrequested change into this PR.
- Author-year suffix disambiguation (2023a/2023b) — explicitly deferred per the task.

## Confirmations

- Nothing committed — `git status` shows only working-tree modifications, matching every prior PR in
  this series' convention.
- The verification harness (`Pr27Harness`) was deleted after use.
- Pre-existing, unrelated uncommitted work found in the repo (`ReviewerPrompts.cs`/`ReviewerService.cs`/
  `ReviewerParityTests.cs`) was not touched, read, or altered.
