# Four Issues from External Document Review — Investigation (eBPF/Zero-Trust Proposal, 2026-08-06)

Investigation only, per task scope — no code, prompt, or data was modified. Project
`20f54592-95da-46da-a51a-15f68ef7736a`. Evidence: read-only queries against `humaniseaidb`
(`project_sections`, `project_literature`, `citation_verification_flags`, `project_hypotheses`) and
read-only source inspection of `ResearchPrompts.cs`/`ResearchService.cs` and the frontend's
`proposalOutline.ts`. Each issue is reported independently — findings do not bleed across issues.

---

## Issue 1 — Is 5.4's genre inconsistency caused by the citation-collision bug?

**Partially confirmed — but not the way the hypothesis literally predicted.**

Pulled the real drafted 5.4 content and its 4 citations directly from `project_sections`/inline
reference list:

| # | Citation | What it's actually about | Collision class? |
|---|---|---|---|
| 1 | Johnson (2020) *A Review of the Quality Indicators of Rigor in Qualitative Research* | Methods-quality meta-research — a review of what makes qualitative research rigorous | **Yes** — 5.9-idiom "rigor/criteria" collision |
| 2 | Kommera (2025) *Enhancing Zero Trust Architecture with AI-Driven Threat Intelligence in Cloud Environments* | Genuinely on-topic zero-trust/cloud security | No — real domain citation |
| 3 | Barusch (2011) *Rigor in Qualitative Social Work Research: A Review of Strategies Used in Published Articles* | Meta-research reviewing published articles' rigor strategies | **Yes** — same collision class |
| 4 | Langtree (2018) *Separating "Fact" from Fiction: Strategies to Improve Rigour in Historical Research* | Methods-rigor paper, unrelated field (historical research) | **Yes** — same collision class |

**3 of 4 (75%) of 5.4's actual citations are from the known 5.9 "rigor/criteria" word-sense collision
class** (`EvidenceThemesForSection("5.4",...)` includes "selection bias and representativeness," which
bag-of-words-collides with "rigor"/"criteria" idiom papers). For scale: only 84 of this project's 4,097
pool rows (2%) contain "rigor"/"rigour"/"trustworthiness" in their title — a 2% baseline class supplying
75% of one section's actual citations is a large, real over-representation, not noise.

**But the causal mechanism is narrower than "Claude wrote literal paper-selection criteria."** Read
literally, the drafted prose (`5.4`'s body text) is genuinely and correctly about *this study's own*
technical/participant eligibility — container runtime versions, kernel requirements, practitioner
experience thresholds — not about which papers to include in a literature review. None of the 4 citations
are themselves systematic-review-methodology papers (e.g. a PRISMA guide, a "how to conduct a systematic
review" paper) — they're generic *qualitative-research-quality* meta-research papers, a different (if
adjacent) genre.

**What's actually driving the reviewer's "reads like paper-selection criteria" impression, evidenced
directly:** the *citations themselves* carry review-of-literature vocabulary in their own titles —
Barusch's is literally *"...A Review of Strategies Used in Published Articles"*; Johnson's is *"A Review
of the Quality Indicators..."* — and both are stapled onto sentences in 5.4's "Bias Reduction and
Validity" paragraph via inline citation. A reader encountering "(Barusch, 2011) ... Strategies Used in
Published Articles" attached to a study's own inclusion-criteria justification is reasonably going to
read a literature-review texture into the section, even though the surrounding sentence Claude wrote is
correctly scoped to primary-study criteria. The structural format (numbered "Component X Inclusion
Criteria / Exclusion Criteria" lists) also resembles PRISMA-style review eligibility sections, but this
is **not prompt-driven** — 5.4's base guidance (`ResearchPrompts.cs:919-924`) just says "List inclusion
criteria clearly... List exclusion criteria clearly," with no PRISMA/systematic-review framing at all;
the numbered-list structure is Claude's own reasonable rendering of "list clearly," not something the
prompt requested.

**Secondary observation, not one of the four issues but relevant context**: this project's
`MethodologyType` is stored as `"Quantitative"` (no subtype) in `research_projects`, yet 5.4's own
drafted content is explicitly structured around "Quantitative Component" and "Qualitative Component" —
meaning Claude inferred a mixed-methods structure from earlier background context despite the
`MethodologyType` field (which should have triggered the base, single-track guidance, not a
Mixed-methods split) never actually being set to reflect that. Worth a data-consistency look separately;
not investigated further here.

**Plain verdict**: the citation-collision bug is a real, evidenced, disproportionate contributor to the
genre-ambiguity impression (75% of cited sources, 2% baseline class) — but it acts through the *texture
of the citations' own titles*, not through Claude literally writing paper-selection prose. This makes it
a real contributing factor worth fixing, but not the sole or even necessarily primary cause on its own —
the numbered-criteria structural convention (present regardless of which citations happen to be
attached) plausibly compounds it.

**Reprioritization recommendation**: Yes, worth moving up. This is the first *externally-observed,
reader-visible* consequence of the already-diagnosed 5.4/5.9 collision (previously only measured via
retrieval-precision metrics in PR-13→22). That said, per `pr26-part3-section-5-7-framing-investigation.md`'s
sibling finding for 5.7, the fix that would most directly close *this* gap isn't more vocabulary
broadening — it's narrowing `EvidenceThemesForSection("5.4",...)`'s "selection bias and
representativeness" phrase (or adding an anchor guard, same mechanism PR-24 used for 5.7) so generic
qualitative-rigor meta-research stops qualifying for 5.4 specifically. Scoped as its own small PR,
following the PR-24 anchor-guard pattern.

---

## Issue 2 — Reference-integrity defects and Phase 1 (DOI normalization)

**Confirmed, and the investigation found a second, more serious defect class the reviewer's flagged
examples only partially captured.**

### Duplicates (matches reviewer's 24-25/62-64 pattern)

Real numbers from `project_literature` for this project (4,097 rows):

- **107 duplicate-title groups** (107 excess rows — ~2.6% of the pool is exact-duplicate bloat).
- **101 of 107 (94%)** have the *same non-empty DOI* on both duplicate rows — e.g. both "A Survey on
  Zero Trust Architecture: Challenges and Future Trends" rows carry `10.1155/2022/6476274`; both "Cloud
  Safe: A Survey of Encryption..." rows carry `10.14445/23488379/ijeee-v11i12p119`. **DOI-based dedup at
  ingestion would have caught these outright** — no metadata-merge judgment call needed, just a
  straightforward "same DOI, same project" check that evidently isn't running.
- **4 of 107** share the same title but both rows have an *empty* DOI (e.g. the Diva-portal pair the
  reviewer flagged — confirmed byte-identical title, empty DOI both rows) — DOI dedup alone wouldn't
  catch these; they'd need the architecture audit's title-based fallback/metadata-merge layer.
- **2 of 107** share a title but have genuinely different DOIs — not investigated further (low volume,
  plausibly legitimate near-identical titles from different papers).

**Quantified answer to the "would Phase 1 have prevented this" question: yes, for 101/107 (94%) of this
project's duplicate pairs, specifically the canonical-DOI-normalization half of Phase 1 — not the
metadata-merge half, which only the remaining 4 empty-DOI pairs need.**

### "Duvvur 2023" (36/99) — NOT a dedup failure. Citation fabrication, already internally flagged, not gated at export.

This is the investigation's most significant finding. Searching this project's drafted section content
for "Duvvur" across all sections found **three different "Duvvur, 2023" citations**, not two:

| Section | Citation as drafted | Matches a real pool row? |
|---|---|---|
| 4.2 | Duvvur, K. (2023) *'Demystifying zero trust...'*, doi:10.1234/jiscr.2023.001 | **No** — `10.1234` is the textbook placeholder DOI prefix; zero pool rows have it |
| 4.3 | Duvvur, V. (2023) *'Security in containerized environments...'*, doi:10.1016/j.jcloudsec.2023.02.004 | **No** — no pool row matches this title/DOI either |
| 3.2, 6.3 | Vijayasekhar Duvvur (2023) *'Securing Modernization: Integrating Cybersecurity by Design...'*, doi:10.63282/3050-9262.ijaidsml-v4i4p104 | **Yes** — matches the one real `project_literature` row for this author exactly |

Two of the three "Duvvur, 2023" citations are pure fabrications — invented titles, journals, and DOIs
with no corresponding literature-pool row at all. This is **not a dedup failure** (nothing to deduplicate
— these never existed as pool candidates) and **not a citation-resolution error** (not a case of right
paper, wrong metadata) — it's the model generating citation-shaped text for sources it never actually
retrieved.

**This is already caught by the existing verification system and was simply never gated.**
`citation_verification_flags` has 11 open `UnresolvedCitation` flags for this project ("no
ProjectLiterature match found for the in-text citation"), including both fabricated Duvvur citations
(4.2, 4.3, both `Status=0` Open) plus other instances of the same failure mode: `(Unknown, 2025)` cited
four times (a literal placeholder author name), `(Cognitive Zero-Trust Resilience, 2025)` cited four
times (a concept/framework name mis-attributed as a paper author), and `(Ubakaeze Victor Chiagozie,
2025)`. **All still Open.** `EnsureNoUnresolvedCitationGapsAsync` — the export-blocking gate — only
checks for `UnresolvedGapMarker` and `(ClaimContentMismatch | ImplausibleYear)` bits; `UnresolvedCitation`
(bit 16) is not in that check, so these 11 already-flagged fabrications sailed straight through export
into the document the reviewer read.

### Entry 65 (non-standard DOI)

The fabricated 4.2 Duvvur citation's `10.1234/jiscr.2023.001` is almost certainly this entry (or the
same defect class) — `10.1234` is the generic example DOI prefix used in DOI documentation, an
unmistakable hallucination signature, confirmed absent from the real pool.

### Plain summary

- **Duplicates (24-25, 62-64 class)**: real, quantified, and Phase 1's DOI-normalization half would have
  prevented 94% of them outright in this project alone.
- **Duvvur (36/99 class)**: a different, more serious defect — citation fabrication that the existing
  `UnresolvedCitation` check already detects but the export gate doesn't act on. Phase 1 (DOI
  normalization at ingestion) is irrelevant to this class since the fabricated citations never touched
  ingestion at all — they're pure drafting-time hallucination.

## Next steps (not implemented, per scope) — two separate, differently-scoped PRs

1. **Dedup**: implement Phase 1's DOI-normalization step at ingestion, as already planned by the
   architecture audit — this investigation adds first-party quantified confirmation (94% catch rate on
   this project's real duplicate pairs).
2. **Export gate**: add `UnresolvedCitation` to `EnsureNoUnresolvedCitationGapsAsync`'s blocking check
   (same pattern as the two mismatch types already gated) — a small, well-scoped, high-value fix given 11
   already-flagged, already-detected fabrications reached this one export ungated. Separate PR from #1 —
   different root cause (drafting-time fabrication vs. ingestion-time dedup), different fix location.

---

## Issue 3 — Drafting-prompt completeness (analysis plan, timeline/budget, ethics)

**Real prompt-level gaps, confirmed for 3 of the reviewer's 4 target areas — with one correction to the
task's own framing.**

Read the actual base guidance in `ResearchPrompts.cs` for every section the reviewer's complaint touches:

| Section | Current guidance | Gap confirmed? |
|---|---|---|
| **6.1 Timeline** (`:991-1010`) | Detailed/realistic timeline, phased, start/end months, markdown table | **Yes** — no instruction to include contingency/buffer time anywhere |
| **6.2 Budget** (`:1015-1025`) | Itemized by category, justified, markdown table | **Yes** — no instruction to include a contingency line item |
| **5.11 Ethics** (`:974-981`) | Consent, confidentiality, IRB body, risk-benefit, ethical-guideline reference | **Yes** — no explicit instruction for consent-to-*sensitive*-data, incidental findings, or conflict-of-interest coverage; all three are genuinely absent from the guidance, not just under-emphasized |
| **5.9 Quality Assurance** (`:957-964`) | Validity/reliability measures, enumerator training, piloting, supervision, data-entry checking | **Correction to task framing** — see below |

**5.9 is not the section responsible for "named statistical tests"/NVivo integration** — its actual
guidance is about QA *procedures* (training, piloting, supervision), and it isn't vague relative to that
scope. Tracing the reviewer's two specific complaints to their real source:

- **"No named statistical tests for quantitative comparisons"**: this capability lives entirely in a
  separate, structured feature — `project_hypotheses` (`PlannedStatisticalTest` field per hypothesis,
  with its own dedicated guidance at `ResearchPrompts.cs:1358-1381` explicitly instructing "choose the
  statistical test based on variable types"). This project has **zero rows** in `project_hypotheses` —
  the feature was never used for this project at all. Separately, even when populated, this data only
  appears in `ExportThesisDocxAsync`'s "Summary of Hypothesis Test Outcomes" table — `ExportPartialDocxAsync`
  (what this project, still in Proposal stage, actually used) never includes it. So this specific
  complaint is not a 5.9 prompt-vagueness issue — it's an unused-feature-plus-export-omission issue,
  structurally different from the other three gaps.
- **"NVivo mentioned once but never integrated"**: traced to `ResearchPrompts.cs:417-424`, the
  **5.10 (Data Management, Mixed-methods)** override — "name the qualitative coding software... used" is
  a one-line naming instruction with no follow-up asking how it's actually used in the coding/analysis
  workflow. Real gap, but it's in **5.10**, not 5.9.

**Cross-project check (Task 3)**: pulled `6.2` Budget content from a different, unrelated project
(rural-Uganda qualitative study) — same pattern: itemized budget with a line-item labeled "contingency
communications" as a sub-cost, but no overall project contingency reserve. Confirms this is systemic to
the prompt across projects, not specific to the eBPF project.

**Plain verdict**: yes, tightening 6.1/6.2/5.11 (add contingency instructions; add sensitive-data-consent/
incidental-findings/COI bullets) is a scoped, low-risk prompt-engineering fix — each gap is a literal
absence in the guidance text, not evidence of insufficient context available to the model. **5.10** (not
5.9) needs the NVivo-integration tightening. The "named statistical tests" complaint needs a different,
larger fix (surfacing/prompting the Hypotheses feature for Proposal-stage projects, and/or including it
in `ExportPartialDocxAsync`) — out of scope for a same-class prompt tweak, flagged as its own follow-up.

---

## Issue 4 — Missing abstract/executive summary

**Template gap, confirmed — not a bug.**

- Frontend `src/data/proposalOutline.ts`: no "abstract" or "executive summary" entry anywhere in the
  `STEPS` array or `SECTION_PROMPTS`.
- Backend `_proposalSectionDefs` (`ResearchService.cs`, the canonical section list per the PR-26 section-
  ordering work): no abstract/executive-summary code either.
- `ResearchProject` entity: no `Abstract`/`ExecutiveSummary` field exists outside the section system.
- Confirmed for this specific project: zero `project_sections` rows with "abstract" in code or title.

The outline was simply never designed to include this section — nothing to trace as a data or
export-pipeline issue, unlike the section-numbering defect this investigation series previously found.

**Next step**: a product decision (add an Abstract/Executive Summary as a new canonical section, likely
positioned right after the title page before 1.0 Introduction) rather than a bug fix — its own scoped PR
if the product decision is made to add it; no code investigation needed beyond this confirmation.
