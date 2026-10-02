# Discovery Pool Quality Audit — Findings Report

**Type:** Investigation only, no fixes applied. Continues the low-reference-count
investigation; re-scopes toward discovery pool quality per the nanocarriers
evidence surfaced in PR-14.

## 0. Method note

Live database (`humaniseaidb`, Postgres, `localhost:5432`) was queried directly
for `project_literature` rows belonging to the 5 known large fallback-triggering
projects, cross-referenced against the `FieldRelevance` classifier
(`ResearchService.ClassifyFieldRelevance`, `HumaniseAI.Infrastructure\Services\ResearchService.cs:782-811`)
and its `FieldConceptAllowlist` (`ResearchService.cs:674-737`).

## 1. On-topic fraction per project (Step 1 + Step 2)

| Project | Pool size | `Match` | `Ambiguous` | `Reject` | Classifier ran for real? |
|---|---:|---:|---:|---:|---|
| Lived Experiences of Homebound Seniors... | 1,648 | 1,147 (69.6%) | 501 (30.4%) | 0 (dropped pre-insert) | Yes — `FieldInterest` hits "health" bucket via "telemedicine" |
| ICT Infrastructure Integration in Rural Clinics | 1,496 | 1,496 (100%) | 0 | 0 | **No** — `FieldInterest` is empty string → auto-`Match` for every row |
| AI impact on traffic systems | 1,313 | 1,313 (100%) | 0 | 0 | **No** — `FieldInterest` is empty string → auto-`Match` for every row |
| Levodopa nose-to-brain nanocarriers (trace project) | 1,039 | 706 (67.9%) | 333 (32.1%) | 0 | Yes — `FieldInterest` hits "pharmacology" bucket via "nanocarriers" |
| Proxy Re-Encryption / IoT Blockchain | 972 | 972 (100%) | 0 | 0 | **Flagged as untrustworthy** — `FieldInterest` is non-empty and does hit the "computer science" bucket via "blockchain", yet 100% `Match` with zero `Ambiguous` is anomalous next to the other two real-classifier projects (~30% Ambiguous each). Most likely explanation per the classifier code: `ConceptTags.Count == 0` short-circuits to `Match` before the allowlist is even consulted (`ResearchService.cs:783`) — plausible if most of this pool's rows came from providers that don't populate OpenAlex concept tags. Cannot be verified after the fact because `ConceptTags` are never persisted to `project_literature`. |

**All 5 pools were confirmed to have been built via the direct single-query
fetch path** (`ResearchService.FetchRealLiteratureAsync` → `LiteratureOrchestrator.FetchWideAsync`),
**not** the corpus-approval path — verified by joining `project_literature`
against `literature_discovery_candidates.ApprovedLiteratureId` (0 matches for
all 5 projects). This matters because `ResearchScreeningService.ApproveCorpusAsync`
(`ResearchScreeningService.cs:109`) hard-codes `FieldRelevance = "Match"`
regardless of actual classification when candidates come through screening —
that bypass is **not** what's inflating these 5 pools' Match counts; the
classifier genuinely ran (or genuinely didn't run, for the two empty-`FieldInterest`
projects).

**As already known from the classifier logic, none of these numbers include
`Reject`s** — rejected candidates are filtered out before insertion
(`FilterByFieldRelevance`, `ResearchService.cs:821-838`). So even the two
"real classifier" projects' Match/Ambiguous split only tells you the
composition of what survived the gate, not what fraction of everything
*discovered* was off-topic.

### Spot-check (Step 2): nanocarriers project, 20 random `Match` rows

Only **4-5 of 20** were genuinely pharma/nanocarrier-relevant (fatty-acid-ester
chemistry, nanoemulsion drug delivery, microneedle brain-delivery systems,
brain-disease drug delivery). The remaining **15-16 of 20** were generic
qualitative-research-methodology or unrelated-domain papers with zero topical
connection to nanocarriers or drug delivery — e.g. "Reducing Confusion about
Grounded Theory and Qualitative Content Analysis," "The Trustworthiness of
Content Analysis," "About Research - Positionality and Reflexivity in
Breastfeeding Research," "From Mario to FIFA: games-based learning,"
"Educational Pursuits and Obstacles for Urban Refugee Students in Kenya."

**This means the true on-topic fraction of the nanocarriers `Match` bucket is
~20-25%, not the ~68% the raw label implies.** The classifier's "no concept
tags → auto-Match" default (`ResearchService.cs:783`) is very likely why: none
of these methodology/education papers have any real chance of carrying
Pharmacology/Medicine/Chemistry/Biology/Nanotechnology/Materials-science
concept tags, so if they were correctly concept-tagged they'd almost all have
hit `Reject`. Their presence as "Match" is far more consistent with
zero-concept-tag candidates slipping through the classifier's permissive
default than with a genuine concept overlap.

### Additional spot-checks: the two empty-`FieldInterest` projects, and the anomalous 100%-Match project

Since the classifier is a no-op for ICT-rural-clinics and AI-traffic (empty
`FieldInterest`), their `Match`=100% figures carry no information either way,
so these were spot-checked directly by sampling titles:

- **ICT Infrastructure Rural Clinics** — spot-checked as **genuinely good**
  quality (≈10-11/12 sampled titles on-topic: health informatics, e-health,
  telemedicine adoption, ICT-in-healthcare systematic reviews). This project's
  large pool size is likely *not* a quality problem, even though its
  `FieldInterest` gap means it got there by luck rather than by the classifier
  working correctly.
- **AI impact on traffic systems** — spot-checked as **contaminated**, ≈3/12
  genuinely on-topic (ITS/Mamdani fuzzy traffic control, VANET+IoT traffic
  management, UAV+AI traffic/safety analysis); the rest were generic AI/IoT/ML
  application papers sharing only the words "AI"/"IoT"/"smart"/"network"
  (smart irrigation, cherry-leaf disease classification, 6G MIMO, intrusion
  detection systems) — same class of problem as nanocarriers, just via a
  different mechanism (empty `FieldInterest` means there was never any gate at
  all, not a leaky gate).
- **Proxy Re-Encryption / IoT Blockchain** — spot-checked as **heavily
  contaminated**, ≈4/12 on-topic (green/edge IoT security, IoT authentication,
  blockchain cloud storage); the rest were wildly unrelated qualitative-methods
  and unrelated health/social-science papers ("International and comparative
  librarianship," "A smoking cessation smartphone app... feasibility RCT,"
  "Program evaluation of a wilderness experience for adolescents facing
  cancer"). This **confirms the Step-1 flag** — the 100% Match figure for this
  project is not trustworthy as a relevance signal.

## 2. Widespread or field-specific? — and a new finding: cross-project contamination

This is **not specific to nanocarriers/pharmacology**. 4 of 5 projects show
material off-topic contamination by direct title inspection; only
ICT-rural-clinics looks clean. So the pool-quality problem is general, not a
niche-field-only issue — though the *mechanism* differs by project (leaky
concept-tag gate for nanocarriers/proxy-re-encryption vs. no gate at all for
the two empty-`FieldInterest` projects vs. bag-of-words query matching for
AI-traffic).

**Unplanned but significant finding**: pairwise title-overlap analysis across
the 5 pools shows **203 identical titles shared between the nanocarriers pool
and the proxy-re-encryption pool** — two topically unrelated fields
(pharmacology vs. IoT/cryptography). That's 22.7% of the nanocarriers pool and
24.5% of the proxy-re-encryption pool being the *exact same rows*. Smaller but
still nontrivial overlaps exist between the other pairs (49, 35, 34, 20, 9, 5,
2, 1 shared titles respectively across the remaining pairs — see table in
investigation notes).

Every one of the 203 shared titles inspected was a generic, highly-cited,
domain-agnostic qualitative-methodology/social-science/education paper (e.g.
"A Step-by-Step Process of Thematic Analysis to Develop a Conceptual Model in
Qualitative Research," "A NEW PLURALISTIC PARADIGM FOR RESEARCH," "A Medical
Science Educator's Guide to Selecting a Research Paradigm") — never a
pharma/nanocarrier or IoT/blockchain paper. Each project's copies were
inserted in their own tight timestamp cluster (nanocarriers: 2026-08-03
17:19:27, proxy-re-encryption: 2026-08-02 11:16:33 — different runs,
same content), ruling out a literal shared-cache bug; these are two
*independent* search calls converging on the same content.

**Most likely explanation, consistent with the code evidence in §3 below**:
these are extremely highly-cited, generic-academic-vocabulary papers that
rank near the top of *any* sufficiently broad, un-scoped, bag-of-words search
across large citation databases (CORE, DOAJ, Scopus, Google Scholar), simply
because "qualitative research," "methodology," "conceptual model," and
"paradigm" are common words that appear in almost every long, technical
project title fed to `FetchWideAsync` verbatim. They are "evergreen" false
positives that any two sufficiently generic queries will both surface,
independent of the specific field. This is a distinct failure mode from
(and compounds) the concept-tag classifier gap.

## 3. Discovery query construction (Step 3)

There are two separate query-building pipelines in this codebase, and a key
finding is **which one actually produced these 5 pools**.

- **The sophisticated multi-dimension AI-generated Discovery tab pipeline**
  (`ResearchLiteratureDiscoveryService` → `LiteratureSearchQuery` rows →
  `ResearchLiteratureDiscoveryJob.RunSearchStageAsync`, which builds 3-5
  boolean query blocks ANDing "Core concepts" with other themed dimensions)
  was **never run** for any of the 5 projects — confirmed via
  `research_projects.DiscoveryStatus = 'NotStarted'` and
  `DiscoveryResultCount = 0` for all 5.
- **All 5 pools came from the simple single-query path**:
  `ResearchService.FetchRealLiteratureAsync` (`ResearchService.cs:612-628`)
  builds one search string — `ChosenTitle` ?? `FieldInterest` ?? `Title` — and
  passes it verbatim to `LiteratureOrchestrator.FetchWideAsync`
  (`LiteratureOrchestrator.cs:150-197`), which fans that **identical, un-decomposed
  string** out to Google Scholar, Semantic Scholar, OpenAlex, CORE, Scopus,
  and DOAJ simultaneously, with no query decomposition, keyword extraction,
  or per-provider tailoring.
- For the nanocarriers project this string was a ~20-word technical title
  ("Development of a Clinically Integrated, Non-Animal Translational PK–PD
  Model for Nose-to-Brain Delivery of Levodopa Fatty Acid Ester-Loaded Lipid
  Nanocarriers"). Provider-by-provider:
  - **OpenAlex, CORE, Scopus, DOAJ**: the full title is interpolated into an
    unquoted free-text query clause with only a year filter appended (e.g.
    CORE: `q = "{query} AND yearPublished>={yearFrom}"`) — no phrase
    quoting, no AND-forcing. These are Elasticsearch-family backends whose
    default query-string parser is OR/relevance-scored, i.e. bag-of-words —
    documents matching *any subset* of common words ("model," "clinical,"
    "delivery," "integrated") score and surface.
  - **Google Scholar** (via SerpApi): whole title URL-encoded and sent
    verbatim; relies entirely on Google's own ranking.
  - **PubMed** has the *only* truncation/keyword-reduction logic in the
    codebase (`PubMedProvider.cs:28-44,189-195`, `TruncateForPubMed`, capped
    at 8 words) — added because the team had already empirically verified
    that sending a full 15-25 word title to PubMed reliably returns **0
    results**. That fix was scoped only to PubMed; it was never generalized
    to CORE/Scopus/DOAJ/OpenAlex. PubMed didn't even run for the nanocarriers
    query because its `IsHealthDomain` gate requires an exact word match
    ("clinically" ≠ "clinical").
  - Two evidence points converge on the same conclusion from opposite
    directions: PubMed proves an *unturncated* long title fails via
    over-strict AND/phrase matching; the nanocarriers spot-check proves the
    *other* providers fail via under-strict OR/bag-of-words matching on the
    same long title. Neither failure mode was addressed except for PubMed's.

**Conclusion for Step 3**: yes, the query is too broad/generic for niche
technical fields, but the fix is not really "OpenAlex concept-mapping" (there
is no separate query-side concept-mapping layer to fix) — it is a
**query-construction problem specific to `FetchWideAsync`'s single-string,
un-decomposed fan-out**: sending one long, un-scoped title verbatim to 4-5
Elasticsearch/relevance-ranked free-text search backends with no phrase
quoting or keyword extraction. This is the same class of gap as the
`FieldConceptAllowlist` gaps closed in prior work, but sits one stage
upstream, on the query side rather than the classification side.

## 4. Relationship to the rate-limit/timeout hypothesis

**Not what's driving the low-reference-count pattern for these 5 projects,**
and can be deprioritized further. All 5 pools are large (972-1,648 rows) —
there is no evidence of truncation, rate-limiting, or premature termination.
The problem is precision, not recall: these projects have plenty of rows but
a large, code-evidenced fraction of them (roughly 65-80% for 4 of the 5
projects, by direct or classifier-assisted inspection) are off-topic, so
downstream section generation is drawing from a mostly-irrelevant candidate
pool even though the pool itself is far from empty. The rate-limit hypothesis
should be considered ruled out as the primary explanation for this project
set; it may still be worth a narrow, separate check for other,
smaller-pool projects that never make it past a few dozen rows (a genuinely
different symptom), but that's a different investigation than this one.

## Summary for whoever picks this up next

1. Root cause is two-layered: (a) `FetchWideAsync` sends one long, un-scoped
   title string verbatim to 4-5 free-text/bag-of-words search backends with
   no phrase quoting or keyword decomposition (only PubMed was ever fixed for
   this), and (b) `ClassifyFieldRelevance`'s "no concept tags → auto-Match"
   default and per-project `FieldInterest`-keyword-bucket gaps let a large
   fraction of the resulting off-topic candidates straight through as
   "Match," with zero visibility into it because `Reject`s are silently
   dropped pre-insert and `ConceptTags` are never persisted for post-hoc
   audit.
2. This produces a secondary, unplanned finding: highly-cited generic
   methodology/education papers are common false positives that surface
   for essentially any long, generic academic query — independent of field —
   and were found duplicated near-verbatim across unrelated projects'
   pools (up to ~24% of two projects' pools was the identical set of such
   papers).
3. No fixes were implemented per the task scope. Recommend a follow-up
   planning pass covering: query decomposition/keyword extraction for
   `FetchWideAsync` generalized beyond PubMed; persisting `ConceptTags` (or at
   minimum a `Reject` count) on `ProjectLiterature`/at fetch time so this kind
   of audit doesn't require manual spot-checking next time; and deciding
   whether a `FieldInterest`-required guard should block `FetchRealLiteratureAsync`
   from running with an empty field (since it silently disables the only
   relevance gate that exists).
