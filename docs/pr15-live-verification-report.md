# Live Verification Report — Does PR-13/14/15 Actually Fix Reference Counts?

One live re-fetch executed against real external providers, for the nanocarriers project only, as
authorized. No other project touched. No code committed — the temporary harness
(`HumaniseAI.IntegrationTests/Pr15LiveVerification.cs`) used to drive this was deleted immediately
after use; `git status` confirms it left no trace.

**Headline finding, stated plainly per the task's instruction not to round up**: the precision
hypothesis behind 15c is directionally confirmed at the raw-candidate level, but the fix **did not
move section 5.1's actual selected list at all** — the old-pool and new-pool selections for that
section are byte-for-byte identical. The reason is a genuine, newly-discovered limitation in the
15c fix itself (explained below), not a flaw in the underlying diagnosis.

---

## Step 1 — Live re-fetch

Method actually invoked: `IResearchService.FetchRealLiteratureAsync`, in-process, wired through the
real `AddInfrastructure` DI graph (real `humaniseaidb`, real API keys from `appsettings.json`, real
HTTP calls) — not through a mocked test factory.

- **Pool size**: 1,039 → **1,042** (+3)
- **Query actually sent** (identical for all 4 target providers, confirmed live via the DOAJ request
  URL and OpenAlex's own `SearchPolicy` log line, not just computed in isolation):
  `Non-Animal AND PK-PD AND Nose-to-Brain AND Delivery AND Levodopa AND Fatty AND Ester-Loaded AND Nanocarriers`
  — exactly matching the hand-traced prediction from the unit tests.
- **Per-provider raw results** (from live `ProviderHealth` log lines):

  | Provider | Raw count | Note |
  |---|---:|---|
  | OpenAlex | 6 | Only provider that returned anything |
  | CORE | 0 | Forced 8-term AND returned nothing |
  | Scopus | 1 → 0 post-filter | Found one, filtered out downstream |
  | DOAJ | 0 | Forced 8-term AND returned nothing |
  | Semantic Scholar | 0 | HTTP 429 (rate-limited) — unrelated to 15c, not one of the 4 target providers |
  | Google Scholar | skipped | Disabled in this orchestrator config |
  | PubMed | not attempted | `IsHealthDomain` gate didn't match — predicted in the earlier investigation ("Clinically" ≠ "\bclinical\b") |

  Total fetched = 6, net-new after DOI/title dedup against the existing 1,039 = **3**.
- **Audit report** (pulled via `GetFieldRelevanceAuditReportAsync` — the 15a endpoint, not a hand
  query, per the task's instruction): `Discovered=3 Match=2 Ambiguous=1 Reject=0 NoConceptTags=0`.

**This is the first, most important finding**: forcing a hard 8-term AND across all four providers,
as 15c actually shipped it, collapsed CORE's and DOAJ's result counts to **zero**. The doc research
behind 15c was correct that CORE/DOAJ need *some* precision correction (they default to OR), but
"require all 8 significant terms simultaneously" turned out to be a far more aggressive correction
than warranted — getting a single real paper to contain "Non-Animal" AND "PK-PD" AND "Nose-to-Brain"
AND "Delivery" AND "Levodopa" AND "Fatty" AND "Ester-Loaded" AND "Nanocarriers" all at once is an
extremely narrow ask, narrower in practice than what even CORE's true OR-default query would have
required. OpenAlex (already implicit-AND by default, confirmed in the prior sub-PR) tolerated the
same 8-term list fine and returned 6 results — consistent with 15c's diagnosis being *right* for
OpenAlex specifically, while being *too strong a fix* for CORE/DOAJ. This is exactly the kind of
result unit tests (which only checked the query *string*, never its effect against a real index)
could not have caught, and is the concrete reason this live-verification step existed.

## Step 2 — Spot-check the new pool

**Only 2 new rows classified `Match`** (the audit report's `Match=2`), not 20 — there weren't 20 to
sample. Both were manually reviewed (title + abstract, same method as the original audit):

1. *(non-Latin title, rendered as `?` in console — abstract legible)* — "Neurodegenerative diseases
   such as Alzheimer's disease are marked by protein misfolding and persistent neuroinflammation...
   Nanomaterial-based interventions have emerged as a promising approach..." — **genuinely on-topic**
   (nanomaterial intervention for a neurological condition).
2. "Overcoming the blood-brain barrier for the therapy of malignant brain tumor: current status and
   prospects of drug delivery approaches" (*Journal of Nanobiotechnology*) — **genuinely on-topic**
   (blood-brain-barrier nanotechnology drug delivery — directly adjacent to nose-to-brain delivery).

**2/2 = 100%**, directly comparable in kind to the original ~20-25% (4-5/20) baseline and a large
apparent improvement — **but I want to be explicit that n=2 is not a reliable precision estimate**.
It's directionally very encouraging (every single new candidate the scoped query surfaced was
genuinely relevant, where the old unscoped query's Match-labeled output was ~75-80% noise), but two
data points cannot be reported as "100% precision" with any statistical confidence, and I'm not
rounding this up into a stronger claim than it supports.

Per the task's branching instruction: precision is *not* worse than baseline (it's much better on
this tiny sample), so I proceeded to Step 3 rather than stopping — but the reason to read Step 3
carefully is exactly this small-N caveat, not a false all-clear.

## Step 3 — Run selection for section 5.1 against the new pool

`ResearchService.SelectLiteratureForSection` invoked directly (pure function, no Claude call) against
the full current pool (1,042 rows) for section `5.1` ("Study Area").

- **Selected count**: 24 (= `PromptCandidateLimitForSection('5.1')`'s cap — the pool is large enough
  to fill the quota regardless of the 3 new rows).
- **Rahman (DOI `10.61838/kman.jayps.4640`) present in selection: `False`** — regression confirmed,
  still excluded with the new pool, consistent with PR-14.
- **Genuinely on-topic count among the 24, manually reviewed exhaustively (not sampled)**: **0
  strictly on-topic** (nothing about nanocarriers, nose-to-brain delivery, or levodopa specifically).
  2 borderline/methodologically-adjacent: a fatty-acid-ester chemistry paper (about dietary fat/
  cardiovascular risk, not nanocarrier delivery) and a PK/PD population-modeling paper (real
  pharmacometrics methodology, but for a different drug class — potassium-competitive acid
  blockers, not levodopa nanocarriers). The other 22 are the same generic
  qualitative-methodology/cross-domain contamination pattern the original audit documented:
  university-staff stress, pedagogical love in primary schools, e-learning quality, political
  corruption, EFL textbook culture, disability inclusion curricula, and so on — genuinely
  interchangeable with the titles sampled in the original nanocarriers pool audit.
- **Reading**: **0-2/24 ≈ 0-8% genuinely on-topic** for this section, using the strict/generous
  reading respectively.

### Step 3b (supplementary, zero additional live calls) — isolating why

To find out *why* the 3 new rows didn't move the needle, I re-ran the same pure
`SelectLiteratureForSection` call a second time, once against just the pre-existing 1,039 rows and
once against the full 1,042 — no new HTTP calls, no new authorization needed, just local computation
on data already in hand from Step 1.

**Result: the two selections are identical.** Same 24 IDs, same order. The 3 new PR-15c rows never
entered section 5.1's candidate competition at all. This isolates the cause precisely: it's not that
the new rows lost a close scoring contest against old contamination — they scored zero relevance to
section 5.1's specific theme buckets (`"study setting context", "population geography", "institutional
context", "access and service environment"`) because they're about drug-delivery *mechanism*
(blood-brain-barrier crossing, neurodegenerative disease pathology), which is simply a different
topic than "Study Area." A more topically-aligned section (e.g. 5.2 Study Design, or the Literature
Review) might show a different result — untested here, out of this task's authorized scope.

## Step 4 — The closing table

| | Original (pre-PR-13) | Post PR-13/14 (old pool, current logic) | Post PR-15 (new pool, current logic) |
|---|---|---:|---:|
| Section 5.1 selected count | *not established in materials available to me — no PR-13 report artifact exists in either repo; I did not fabricate a number* | 24 | 24 |
| Genuinely on-topic count/fraction | *not established* | 0-2/24 (0-8%) | 0-2/24 (0-8%) — **identical selection** to the old-pool column |

**Direct answer to the question this table exists to answer**: no, 15c's query-construction fix did
**not** measurably improve the genuinely-on-topic count for section 5.1, beyond what selection-logic
fixes alone (13a-14c, already baked into the currently-running code either way) achieved. The
improvement is not marginal — it is **zero**, for this specific section, on this specific live run.
I'm stating this directly rather than rounding toward the encouraging Step 2 number, per the task's
explicit instruction.

**This does not mean 15c's diagnosis or design intent was wrong.** The evidence is mixed and worth
separating clearly:
- The precision *direction* is strongly validated: 2/2 raw new candidates were genuinely on-topic,
  a real result from a real index, not a synthetic test case.
- The *recall* cost of implementing that precision as a hard, uniform 8-term AND across all four
  providers is severe enough (CORE=0, DOAJ=0) that only 3 net-new candidates surfaced in one fetch
  pass — nowhere near enough volume to meaningfully compete against a 1,039-row pool still dominated
  by pre-15c contamination, and this particular batch of 3 happened not to match this particular
  section's theme at all.
- **Concrete, actionable follow-up this run surfaced**: the uniform "AND all N significant terms"
  design is too aggressive for CORE/DOAJ specifically. A future iteration should probably require
  only a subset of the significant terms (e.g. any 3-4 of 8) rather than all of them for those two
  providers, while keeping the current approach for OpenAlex (which tolerated the full set fine).
  This is a real design refinement identified by live data, not a hypothetical — and per the task's
  explicit instruction, I have not gone back to adjust the threshold to make this number look better.

## Step 5 — Scope note: what this does and does not confirm

This confirms (with the caveats above — really, "partially confirms, with an important limitation
surfaced") the fix for **one project, via one mechanism**: the leaky concept-tag gate / bag-of-words
query contamination pathway (nanocarriers).

It does **not** generalize to:
- **The no-gate-at-all mechanism** (AI-traffic, empty `FieldInterest`). 15d's title-fallback fix was
  verified only via unit tests against a synthetic title (`"Machine Learning Applications in Software
  Testing"`), never against AI-traffic's real project, live. Separate authorization would be needed
  to verify that mechanism the same way this report verifies the nanocarriers one.
- **A full characterization of the CORE/DOAJ recall collapse.** This run observed it once, for one
  query, on one day, against these providers' current index state. I have not re-run it, tuned it, or
  confirmed it's stable/reproducible — per the task's explicit instruction not to spend additional
  live-provider budget without separate authorization.
- **Any section other than 5.1.** The finding that the 3 new rows didn't help is specific to 5.1's
  particular theme ("Study Area" — geography/institutional setting), which the new drug-delivery-
  mechanism-focused candidates simply aren't about. Whether they'd help a more topically-aligned
  section (Introduction, Literature Review, Study Design) is a real, open, and easy-to-test-cheaply
  (no new live fetch needed — the same Step 3b-style pure recomputation could be run against other
  section codes) follow-up question this report does not answer.

Not committed. No code changes made by this verification task itself (the temporary harness file was
deleted, never staged, never committed).
