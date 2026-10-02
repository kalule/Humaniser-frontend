# PR-16 Stage 1 — Scoping Section-Aware Discovery

Investigation only, no code changes, no live provider calls. Per the task's instruction, this stops
here for review before any Stage 2 implementation.

## Headline finding before the cost model: a per-section discovery mechanism already exists and is
## currently dormant for exactly the projects this investigation cares about

Before costing out *new* per-section discovery, I checked whether the existing codebase already
attempts something like it — it does. `GenerateSectionAsync` already has a per-section fetch path
(`BuildSubThemeQueriesAsync` → Claude-generated section-specific search phrases →
`FetchAndMergeMultiQueryAsync` → the real orchestrator fan-out), gated behind:

```csharp
var included   = project.Literature.Where(l => l.IncludedByStudent).ToList();
var literature = included.Count > 0 ? included : project.Literature.ToList();
sectionRelevantCandidates = literature.Count;   // <-- misnamed: this is the WHOLE project pool
fetchDecision = literature.Count < sectionTarget
    ? "fetchRan=sectionRelevantCandidatesBelowTarget"
    : "fetchSkipped=projectPoolAboveTarget";
```

`literature` here is the **entire project-wide pool** (or the student-included subset), not anything
scored or filtered for relevance to *this* section. For the nanocarriers project (1,042 rows after
PR-15's live verification) against section 5.1's target of 8, `1042 < 8` is always false — this
mechanism has **never fired for this project**, and structurally can't fire for any project once its
pool exceeds the largest section target (20, for 1.0/1.2/2.0). This is the same class of project
PR-13-15 have been investigating throughout: exactly the ones with large, low-precision pools.

This directly explains PR-15's live-verification result (0-2/24 on-topic, unmoved by the new pool) —
not just "no section-aware discovery exists," but "section-aware discovery exists, and a raw-count
trigger bug has been silently preventing it from ever running once a pool gets big, regardless of
whether the pool's content is actually relevant." Fixing that trigger condition is a much cheaper,
more surgical starting point than building new infrastructure from scratch, and I've folded it into
the volume-reduction proposal below rather than treating PR-16 as a green-field build.

I also checked whether the existing scoring already discounts irrelevant candidates enough to make
this moot: `ScoreForEvidenceTheme` does multiply by `FieldRelevanceMultiplier × TopicOverlapMultiplier`,
so an off-topic candidate is already discounted (0.5x for Ambiguous, 0.1x for no topic overlap,
0x only for a hard Reject). But `NoTopicOverlapMultiplier = 0.1`, not 0 — a discounted score can
still beat "nothing," and with 1,000+ candidates competing for a 24-slot quota across 4 theme
buckets, enough discounted-but-nonzero off-topic candidates exist to fill the quota anyway. Better
discounting alone (already tried, via 15b/PR-14) is not sufficient; the pool genuinely needs better
candidates, confirming PR-16's core premise even though the trigger-bug finding changes *how* to get
there most cheaply.

---

## 1a — Cost model

**Section count** (confirmed from the nanocarriers project's real, persisted section list — 25
sections, standard doctoral proposal structure):

| Bucket | Sections | Count | Needs section-aware subject-specific discovery? |
|---|---|---:|---|
| Non-literature-bearing (`MinUniqueSourcesForSection` = 0) | 4.1-4.4 | 4 | No — already correctly skips all fetching, existing and new |
| Methodology/claim-level (`UsesClaimLevelEvidenceRetrieval`) | 3.3, 5.2, 5.4-5.12 | 11 | No — see 1b, themes are intentionally cross-disciplinary |
| Topic-bearing, subject-specific | 1.0, 1.2, 2.0, 3.1, 3.2, 5.1, 5.3 | 7 | **Yes — this is the actual target set** |
| Admin/logistics | 6.1-6.3 | 3 | Unlikely — timeline/budget/dissemination rarely cite fresh empirical literature |

**Current call volume** (confirmed live, from PR-15's verification run): 1 `FetchRealLiteratureAsync`
call → 5 providers attempted (Semantic Scholar, OpenAlex, CORE, Scopus, DOAJ; Google Scholar disabled
in this config; PubMed conditionally gated by `IsHealthDomain`, didn't fire for this project) = **5
live calls per manual fetch**. Because of the trigger bug above, this is *also* the effective
steady-state total for a mature project — the per-section path never adds to it in practice today.

**Projected volume, computed with real numbers, three scenarios**:

| Scope | Sections × providers | Multiplier over today's 5 |
|---|---:|---:|
| Naive: every literature-bearing section (21) | 21 × 5 = 105 | **21x** |
| Scoped to topic-bearing sections only (7, per the table above) | 7 × 5 = 35 | **7x** |
| Scoped + 15a-threshold-gated (only sections whose pool coverage is genuinely thin) | fewer than 35, magnitude not quantifiable without real usage data | **<7x, exact figure needs live instrumentation before committing to a number** |

**Rate limit / cost reality check per provider**:

- **Semantic Scholar**: a real, observed data point, not hypothetical — PR-15's single live call
  already hit a 429 despite the existing app-wide `SemanticScholarRateLimiter` (1 req/1.1s singleton
  throttle, confirmed wired into `LiteratureService.ValidateLiteratureAsync` before every call). The
  throttle only prevents *this app* from exceeding 1 req/s; it says nothing about whether the shared
  API key is already near its own ceiling from other traffic. At 7-21x volume this queue serializes
  (doesn't necessarily fail outright) but adds real wall-clock delay per project, and the fact that
  it's already fragile at 1x load is a genuine yellow flag, not a hypothetical one. Semantic Scholar
  isn't one of 15c's 4 fixed providers, so it inherits none of that work's query-scoping benefit either.
- **OpenAlex**: "usage-based billing" per the existing `DependencyInjection.cs` comment — real dollar
  cost scales directly with call count. Self-imposed 100ms proactive throttle exists but is explicitly
  flagged in its own doc comment as *"a conservative placeholder, not a confirmed number from
  OpenAlex's current published limits"* — i.e., nobody has verified what the real ceiling is.
- **CORE, Scopus**: real, paid API keys (confirmed present in `appsettings.json`). Scopus specifically
  has a hard `MaxCountPerRequest = 25` tied to *this key's specific subscription tier* (code comment:
  "this key's actual entitlement is 25" vs. higher tiers existing). Nothing in the code enforces or
  even surfaces a monthly/daily quota ceiling for either — if one exists upstream (likely, for paid
  keys), it's invisible to this codebase and worth confirming out-of-band before committing to a 7-21x
  volume increase, not something I can verify from code alone.
- **DOAJ**: free, anonymous, no cost concern.

**Volume-reduction proposal — three options, one recommended as primary, one explicitly ruled out**:

1. **(Recommended, primary) Fix the existing dormant trigger + scope to the 7 topic-bearing
   sections.** This is mostly a bug fix, not new infrastructure: change `fetchDecision`'s condition
   from raw pool size to a count that's actually meaningful — e.g., candidates in the pool that are
   both `FieldRelevance != Reject` (or better, `== Match`, using 15a's now-persisted classification
   directly rather than re-deriving it) **and** score positively for this section's theme via the
   already-existing `ScoreForEvidenceTheme`. Reuses `BuildSubThemeQueriesAsync`'s proven Claude-based
   sub-theme generation and `FetchAndMergeMultiQueryAsync`'s existing fetch/dedupe/filter/persist
   pipeline almost as-is — the main change is the gate, plus the term-combination logic in 1b/2 below
   for how the query itself gets built. Restricting to 7 sections (not 21) is justified directly by
   the EvidenceThemesForSection content itself (1b), not an arbitrary cut.
2. **Threshold-gate via 15a's audit data**, layered on top of (1): before firing a fresh per-section
   fetch, check `GetFieldRelevanceAuditReportAsync`'s (or a themed variant of it) existing
   Match/Ambiguous counts for this project — if a section's target is already comfortably met by
   genuinely-classified-relevant candidates, skip the fetch even within the 7-section scope. I'm not
   proposing this as a separate mechanism from (1) — it's the same gate, just explicit that the
   threshold should be informed by 15a's real classification data rather than a new ad-hoc count.
3. **Cross-project cache/reuse — explicitly ruled out, not silently skipped.** Checked: the 5 audited
   projects' `FieldInterest`/title strings are highly idiosyncratic (nanocarrier PK/PD delivery,
   proxy re-encryption IoT blockchain, rural ICT health infrastructure, AI traffic systems, homebound
   telemedicine) — realistic overlap between two different users' section-level queries is low, and
   the correctness risk of serving one project's fetched literature into another's pool (wrong
   provenance, wrong field-relevance classification context, stale content) outweighs the modest
   volume savings this would realistically produce. Not recommended.

---

## 1b — Is `EvidenceThemesForSection` good enough to drive search queries?

Pulled real output for two representative sections:

- **5.1 (Study Area, topic-bearing)**: `["study setting context", "population geography",
  "institutional context", "access and service environment"]`. Run through `QueryTermExtractor`'s
  existing generic-term filter by hand: `"study"` and `"context"` (appears twice) are already in
  `GenericAcademicTerms` and get stripped; what survives is **`setting, population, geography,
  institutional, access, service, environment`** — zero subject-specific vocabulary. These exact
  words would apply identically to a study about corruption in Iran, e-learning quality, or
  antenatal care delivery — and, not coincidentally, PR-15's live verification found the actual 24
  selected candidates for this section were dominated by papers on precisely those unrelated topics,
  each with superficial "service"/"access"/"institutional" word overlap. **Confirmed: too generic to
  drive a query alone**, for this and the other topic-bearing sections (1.0, 1.2, 2.0, 3.1, 3.2, 5.3
  show the same pattern on inspection — phrases like "population impact," "documented consequences,"
  "knowledge contribution" carry the same kind of domain-agnostic genericness).
- **5.2 (Study Design, claim-level/methodology)**: `["research design justification phenomenology
  qualitative", "epistemological stance interpretivism constructivism", "sampling strategy purposive
  maximum variation", ...]`. This is real, substantive **methodology** vocabulary
  (phenomenology, interpretivism, constructivism, purposive sampling, trustworthiness/credibility/
  dependability, thematic analysis) — genuinely specific, just not specific to the *study's subject*.
  This is correct and intentional: `GenerateSectionAsync` already exempts
  `EvidenceType.MethodologicalTheoretical` queries from the field-relevance filter specifically
  because foundational methodology evidence should be cross-disciplinary (a nanocarriers project's
  methodology section citing Lincoln & Guba is exactly as valid as a nursing-education project's
  citing the same source). **These 11 sections should keep their current theme vocabulary
  essentially unchanged** — they don't need project-core-term combination, and forcing it on would
  work against the design.

**Conclusion**: the 21 literature-bearing sections split cleanly into two groups with opposite needs,
already distinguishable via the existing `UsesClaimLevelEvidenceRetrieval` flag: the 11
methodology-bearing sections' themes are fine as-is; the 7 topic-bearing sections' themes need
combining with the project's own subject vocabulary before they're usable as a search query.

### Proposed combination logic (topic-bearing sections only)

**This has a direct, load-bearing dependency on the still-open CORE/DOAJ recall-collapse finding
from PR-15's live verification** (forcing a hard AND of all 8 project-core significant terms already
zeroed out CORE and DOAJ entirely for a single project-level query). Naively ANDing *more* terms —
project-core terms AND section-theme terms, all required — would make that failure mode strictly
worse, not better, and would do so across 7x-21x more calls. I'm flagging this as a hard dependency,
not just a nice-to-have: **the CORE/DOAJ subset-match fix should land before or alongside Stage 2,
not after**, or Stage 2 will be verified against a query-construction mechanism already known to be
broken for 2 of the 4 target providers.

Proposed shape, assuming that fix lands first: extract significant terms from the project's own
title/FieldInterest (the existing `QueryTermExtractor.ExtractSignificantTerms`, unchanged) and,
separately, significant terms from this section's `EvidenceThemesForSection` phrases (same
extractor, applied fresh). Combine as **"require at least one project-core term AND at least one
section-theme term"** rather than a flat AND of everything — always anchored to the study's actual
subject (preventing drift into an unrelated field, the original PR-13 problem) while only requiring
one theme term (not all four-to-six), so the query stays achievable rather than repeating the
8-term-AND overcorrection. Exact required-subset sizes should be tuned together with the CORE/DOAJ
fix, since both are instances of the same "how many required terms is too many" question — I'd
rather that be solved once than have PR-16 invent a second, inconsistent answer to it.

---

## 1c — Fallback for weak/generic section themes

**Recommendation: fall back to the shared project-level pool, unchanged — do not force a section
query regardless.** Two cases:

1. **The 4 already-zero-target sections (4.1-4.4)** — no change needed, the existing
   `MinUniqueSourcesForSection` = 0 mechanism already correctly skips fetching for these; PR-16
   doesn't need to touch them.
2. **A topic-bearing section whose combined project-core + section-theme term set, after
   `QueryTermExtractor` filtering, doesn't meaningfully differ from the plain project-level query**
   (e.g. yields fewer than ~2 genuinely new significant terms beyond what the project-level fetch
   already used) — firing a near-duplicate query here would spend real provider budget for a result
   statistically indistinguishable from what's already in the pool. Reuse the shared pool instead.

Chose the simpler "reuse shared pool" over "force a query regardless" because the latter has no
upside once a query can't meaningfully differentiate itself, and the cost model above already shows
every additional call has a real, non-trivial dollar/quota cost — spending it on a query that can't
do better than what's already been tried isn't a defensible default.

---

## Summary for review

- **A dormant, already-built per-section discovery mechanism exists and should be repaired (trigger
  condition) rather than replaced** — this changes Stage 2's likely shape from "build new
  infrastructure" to "fix a bug + adjust query construction for the subset of sections that need it."
- **Real multiplier**: 21x naive, 7x with the topic-bearing-sections scope I'm recommending, further
  reducible via 15a-informed threshold-gating by an amount I can't respons­ibly quantify without live
  instrumentation on a few real projects first.
- **Cost/rate-limit risk is real, not hypothetical** for Semantic Scholar (already 429'd at 1x in
  PR-15's own live run) and financially real for OpenAlex/CORE/Scopus regardless of whether rate
  limits are survivable — recommend confirming actual account-level quota ceilings out-of-band before
  committing to any multiplier, since nothing in the code surfaces them.
- **`EvidenceThemesForSection` needs no changes for the 11 methodology-bearing sections; it needs
  combination with project-core terms for the 7 topic-bearing sections** — proposed combination logic
  above, but it has a **hard dependency on the CORE/DOAJ recall-collapse fix landing first**, since
  the same "how many required terms" question underlies both and I don't want two inconsistent
  answers to it in the codebase.
- **Fallback rule**: reuse the shared pool when a section query wouldn't meaningfully differentiate,
  rather than forcing a near-duplicate fetch.

**Stopping here per the task's instruction — no Stage 2 implementation until this is reviewed.**
