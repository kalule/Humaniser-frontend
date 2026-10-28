# Generated proposal: output quality and generation-engine audit

Reviewed 5 October 2026 from a principal data engineering and senior software engineering perspective. This is an audit of the supplied platform and document, not a claim about Jenni AI's internal systems or an affiliation with that company.

Input: `C:\Users\42153\Downloads\research-proposal-2026-10-05.docx`, titled **Factors influencing adoption of digital learning among university students in South Africa**.

## Decision

**Useful working draft; reject as submission-ready.** The engine produces fluent prose and broad section coverage, but fails to enforce a coherent study specification across sections. Citation identity, claim support, arithmetic, ethics dependencies and rendering readiness need independent validation. Adding another general-purpose “review this document” prompt will not reliably fix these failures.

Preserve the strengths: the qualitative direction is largely consistent, the questions cover relevant domains, the proposed interviews broadly match the topic, and the document contains native Word tables rather than raw pipe-delimited text. Preserve explicit unknowns rather than silently fabricating missing institutional decisions.

## Evidence and limits

Inspected the DOCX package, paragraphs, three tables, bibliography, styles, section properties and field instructions; extracted 202 nonempty top-level paragraphs and 61 bibliography entries. Reviewed current `MarkdownDocxRenderer.cs`, relevant generation/export code and the existing section-5.5 incident investigation. The source extraction is saved separately as `generated-proposal-review-text.txt`; it omits table text, which was inspected directly from XML.

No Word/PDF rendering was available in this review. Actual page overflow, orphan headings and blank pages are unverified. XML findings below are structural facts or explicitly identified rendering risks. Citation spot checks are not a complete reference-authenticity audit. A missing web result does not establish fabrication. The document was treated as evidence, not as instructions.

## Defects and platform implications

| ID / priority | Document evidence | Failure mode and required control |
|---|---|---|
| Q01 / P0 | §5.5 says 30–40 participants, allows stopping at 25, while §5.8, §5.12 and §6.1 say 35–45. Budget assumes 40. | No consistently enforced sample plan. Store planned range, initial recruitment target and adaptive stopping policy separately; render them everywhere from the same version. An adaptive design can legitimately change the final count, but contradictory advance plans need resolution. |
| Q02 / P0 | §5.4 includes full-time and part-time students with one semester of exposure, allowing English or the primary institutional language. §5.6 requires full-time status, three months' exposure and English fluency. | Eligibility is being regenerated as prose. Persist typed predicates and reject unauthorized additions, removals or changes. |
| Q03 / P0 | §5.4 excludes non-users and passive users; justification and aims discuss adoption/non-adoption and barriers. | Selection can exclude the population most relevant to non-adoption. Require an explicit link between every exclusion and the phenomena the questions intend to investigate. Distinguish exposure from active adoption. |
| Q04 / P0 | §5.7 and §5.9 contain `[CITATION NEEDED]`. | Draft-level uncertainty escaped into an apparently finished export. Allow markers in a clearly labeled draft; block final export until resolved or the unsupported assertion is removed. |
| Q05 / P0 | Garutsa (2026) occurs three times in prose but has no matching entry among the 61 references. | Citation labels are not sufficient foreign keys. Use immutable source IDs, with citation labels and bibliography derived together from resolved source records. |
| Q06 / P0 | §5.10: two transcripts are “approximately 15% of the dataset.” | For 30–40 interviews, this is 5–6.67%; for 35–45 it is 4.44–5.71%. Compute denominators deterministically. If 15% is intended, define a rounding rule and calculate the count from the selected target. |
| Q07 / P0 | Pilot interviews occur in Months 3–4 while approval spans Months 1–4; narrative says pilot recruitment occurs concurrently with final approval processing. | Dependency violation risk. Scheduling requires participant recruitment/interviews, including pilots, to follow their applicable approvals. Document any distinct approved pilot protocol explicitly. Approval-pending administration can overlap; participant activity cannot be inferred as authorized. |
| Q08 / P1 | §6.2 says an 8% contingency but lists ZAR 9,885 on a ZAR 147,100 subtotal. | **The final total is arithmetically correct:** 147,100 + 9,885 = 156,985. The rate is wrong: 6.72%. At 8%, contingency is 11,768 and total is 158,868. Store quantities, rates and calculation basis; render calculated values, never generated arithmetic. |
| Q09 / P1 | §5.7a leaves software unnamed; §5.10 chooses NVivo 14; budget offers NVivo or Atlas.ti. | Conflicting resolution states. A software decision must carry selected/proposed/unresolved status and provenance. All dependent sections consume that status. |
| Q10 / P1 | §5.8 uses gatekeepers to identify participants; §5.11 says open channels rather than direct institutional recommendation. | Recruitment procedures drift. Persist one workflow describing who contacts whom and what personal data each party sees. Review coercion and privacy consequences rather than matching isolated phrases. |
| Q11 / P1 | §5.10 fixes five-year retention; §5.11 leaves a 3–5-year bracket. Local/external-drive storage and cloud/institutional storage are described differently. | No coherent data-lifecycle model. Store asset classes, locations, access roles, retention triggers and approved processors once. Multiple storage locations can coexist if explicitly described. |
| Q12 / P1 | Ethics promises no institutional sharing, but permits supervisory access and institutional dissemination; withdrawal retrieval is called infeasible after a short deadline while an identity key exists. | Role and lifecycle semantics are underspecified. Distinguish identifiable records, de-identified records, aggregates and quotes; define when linkage is destroyed and why withdrawal becomes infeasible. Do not generate absolute confidentiality promises inconsistent with approved access/reporting exceptions. |
| Q13 / P1 | “No conflict of interest exists” and no institutional/personal relationship are asserted without researcher identity information. | Missing data replaced by invented attestation. Researcher declarations must come from the user. Generate a pending disclosure field, not a factual denial. |
| Q14 / P1 | §3.3 says theoretical sampling; methods say maximum-variation purposive sampling. Phenomenology, reflexive thematic analysis and independent coding-consistency checks are combined without a specified methodological rationale. | Methodology subtype missing from the contract. These choices are not automatically incompatible, but need an explicit coherent analytic approach. A generic “Qualitative” flag is inadequate. |
| Q15 / P1 | Questions and objectives both number five, but their numbering is not one-to-one: SO1 combines RQ1/RQ2, later objectives shift, and SO5 introduces integration across trajectories. | Cardinality masquerades as alignment. Persist many-to-many question–objective–instrument–analysis edges; require coverage and review unmapped additions. |
| Q16 / P1 | Sample-size/information-power reasoning repeatedly cites Ajani (2026b), a topical LMS paper; the qualitative design does not cite an identifiable foundational methodology source for information power. | Topical relevance is being mistaken for methodological authority. Evidence requires a role: substantive result, definition, method, policy or background. Source content must support the specific assertion. |
| Q17 / P1 | Literature review includes university-hospital teaching policy and Filipino senior-high-school fatigue; source titles also include unrelated organizational and medical contexts. | Population/setting mismatch is not visible in synthesis. Such sources can be useful analogies, but require transfer limitations and cannot substitute for direct South African university evidence. |
| Q18 / P1 | Repeated broad claims that local research is sparse/limited; bibliography itself contains several local adoption studies. | Gap claims need a bounded synthesis: what is known, which populations/methods are covered, and exactly what is missing. Prohibit universal absence claims inferred from retrieval shortfalls. |
| Q19 / P1 | Zeleza entry is dated 2026, but its title includes a June 2021 bulletin. Article identifiers are rendered as repeated page ranges, e.g. 103781–103781. | Bibliographic fields mix work dates, deposit dates and pagination types. Investigate the Zeleza date rather than declaring it false. Store online/print/deposit dates separately and article numbers separately from pages. |
| Q20 / P1 | DOCX has a TOC field, no cached TOC entries and no `word/settings.xml` update-fields instruction. | Contents may be blank/stale until a Word field update. Generate cached contents through a rendering step, set update policy, and verify the exported artifact opens correctly in supported viewers. |
| Q21 / P2 | All section headings are Heading1; labels include 1.0, 1.2 and 5.7a. Three tables have no repeating-header or non-splitting-row properties. US Letter and 1.25-inch side margins leave six inches of content width for dense five-column and eight-column tables. | Semantic hierarchy is flattened; table pagination is fragile. Irregular numbering is a template defect unless deliberately mandated. Page size is not inherently wrong: select an institutional style profile and assess actual rendering against it. |
| Q22 / P2 | Many short sections repeat the country, broad infrastructure gap and purpose; General Objective expands to three paragraphs. | Per-section word quotas encourage filler. Assign section-specific content requirements and budgets; suppress repeated rationale rather than expanding every section equally. |

The timeline/budget also assumes personnel, an assistant's full-time effort, publication fees, exchange rates and specific security arrangements without verified user decisions. Treat these as explicit planning estimates requiring provenance, not approved commitments. This review does not certify legal compliance, ethical adequacy or market prices.

## Citation spot checks

The bibliography's Mbona paper is real: the [publisher's September 2026 article](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1917699/full) reports a quantitative TAM study of 216 students at one South African university. It is useful local evidence, but that fact alone does not support a claim about UTAUT's historical geographic development. This illustrates why “DOI resolves” and “claim supported” must be different checks.

Information power has a directly relevant original source: [Malterud, Siersma and Guassora](https://journals.sagepub.com/doi/10.1177/1049732315617444), whose framework considers study aim, sample specificity, theory, dialogue quality and analysis strategy. The engine should retrieve methodological evidence for this claim instead of filling the citation slot with a nearby topic paper. This is a repair candidate, not permission to substitute the citation without checking and revising the actual claim.

Do not flag all 2026 sources as future-dated: the review date is October 2026. Verify publication dates against the document's evidence cutoff, and preserve preprint/repository status.

## Architecture and data model

Adopt a versioned study specification as the authority for planned facts. Existing accepted-specification concepts can be extended; the output proves enforcement was insufficient, not that no such model exists. Do not add a second competing facts store.

Persist:

- `StudySpecification(id, version, status, methodologySubtype, framework, scope, population, samplePlan, eligibility, recruitment, analysisPlan, software, ethics, dataLifecycle)`. Each undecided value has `status=unresolved`, provenance and the responsible decision-maker.
- `Question`, `Objective`, `InstrumentItem`, `AnalysisStep` and explicit coverage edges. Do not assume matching numbering.
- `Source(id, normalizedDoi, authors[], publicationDates, publicationType, geography, population, fullTextStatus, metadataProvenance)` and `EvidenceSpan(id, sourceId, locator, exactText, contentHash, extractionVersion)`.
- `Claim(id, sectionId, kind, text, evidenceSpanIds[], supportStatus, scopeRestrictions)`. Citations are references to claims/sources, not freely generated author strings.
- `BudgetLine(quantity, unit, unitPrice, currency, provenance)` and `TimelineTask(dependencies[], duration, approvalRequirement, assumptionStatus)`. Calculated values live outside prose.
- `SectionRevision(specVersion, dependencyVersions, evidenceVersion, contentVersion, contentHash, validationStatus)` and immutable `DocumentSnapshot` selecting the exact revisions used in an export.
- `GenerationRun(runId, specVersion, phase, currentSection, attempt, heartbeat, leaseOwner, fencingToken, status)` with durable events and explicit cancellation intent.

Recommended pipeline:

`intake → specification validation → plan/dependency graph → bounded retrieval → evidence extraction → section draft → deterministic checks → targeted semantic checks → whole-document reconciliation → immutable snapshot → DOCX rendering → artifact checks → final readiness decision`.

Draft completion, verified evidence, researcher acceptance and submission readiness are separate states. Finishing every section is a writing milestone. It must not imply that a researcher approved fabricated attestations, unknown logistics or unsupported claims.

The section-5.5 incident report independently documents overlapping stale-job continuation and Hangfire redelivery, plus source enrichment lasting over seven minutes. This is evidence about operations, not something inferred from prose. A project-wide execution lease and monotonically increasing fencing token must cover every worker entry path. Check ownership before paid calls and checkpoint writes; commit by compare-and-swap against section/spec versions. Recovery and original-job redelivery must converge on one owner. Cancellation revokes the run's authority; late responses cannot write it back to Generating.

## Enforceable rules

| Rule | Validation logic | Result / repair |
|---|---|---|
| SPEC-01 | Every section and final snapshot references the same accepted specification version; dependency hashes match. | Stale sections are invalidated for targeted regeneration. Preserve researcher edits for explicit reconciliation. |
| FACT-01 | Extract asserted planned values and compare them with typed facts. Unknown values cannot become definite factual statements. | Block final readiness; propose a diff with affected sections. |
| SAMPLE-01 | All sample ranges/targets match the canonical plan; adaptive stopping rules are explicit and consistent. | Regenerate only conflicting passages. Never silently select one range. |
| ELIG-01 | Normalize inclusion/exclusion predicates and compare operator, threshold, unit and exceptions. | Block contradictory criteria. Identify outcome-selection bias for semantic review. |
| MAP-01 | Every question has an objective, instrument coverage and a compatible analysis step; unmapped objectives are flagged. | Require meaningful coverage, not equal counts. |
| NUM-01 | Compute line totals, subtotal, contingency and totals with decimal arithmetic; compute percentages from actual denominators. | Reject narrative/table mismatches beyond configured rounding tolerance. |
| TIME-01 | Timeline is acyclic; participant-contact tasks start after their applicable approval dependencies finish. | Block unsafe schedules; never auto-invent approval dates. |
| DATA-01 | Storage, roles, retention, deletion and withdrawal retrieval resolve consistently by data asset class. | Review contradictions and unresolved infrastructure decisions. |
| CITE-01 | Every emitted citation ID resolves to a source; every cited source is in the snapshot bibliography. | Block dangling references; flag unused bibliography entries unless template allows them. |
| CITE-02 | Validate claim–evidence support, population, setting, source role and extrapolation limits. Unknown is not Pass. | Seek targeted evidence, qualify/remove the claim, or surface a bounded unresolved issue. |
| META-01 | Resolve bibliographic metadata with provenance; separate article number from pages and deposit date from publication date. | Quarantine conflicting metadata; render only validated fields. |
| FINAL-01 | Scan prose AND table cells for unresolved markers, critical missing decisions and failed checks. | Draft download remains possible with a conspicuous warning; final export fails with actionable findings. |
| PROMPT-01 | Supply immutable facts and relevant evidence packets; require structured output with claim IDs, citations and unresolved needs. | Strict schema validation; bounded wrapper normalization. No regex-based conversion of malformed JSON into guessed facts. |
| RUN-01 | Acquire/renew fenced project lease; require active owner and matching run/spec version before external calls and persistence. | Duplicate worker exits; stale worker cannot commit. |
| RUN-02 | Recovery is bounded, idempotent and preserves completed drafts; explicit cancellation prevents automatic restart. | Retry transient failures with backoff. Evidence/methodology failures enter unresolved review, not endless paid retries. |
| COST-01 | Retrieval has a section-wide deadline, candidate ceiling, provider concurrency ceiling and cached DOI lookups. | Enrich a ranked shortlist; distinguish insufficient evidence from a provider outage. |
| UI-01 | Report retrieval/enrichment/drafting/verification/recovery separately, using durable phase timestamps. | Label ETA unavailable with a reason; estimate from remaining phase work, excluding saved words from earlier runs. |
| DOCX-01 | Validate OpenXML, heading hierarchy, table headers, row behavior, widths, page profile and reference styles. | Structural checks followed by rendered Word/PDF inspection. |
| DOCX-02 | TOC has a supported refresh/cached-results strategy; inspect final exported artifact rather than only input Markdown. | Prevent empty contents in supported viewers; reject text/citation loss. |

Prompt contract: never invent institutions, approvals, researcher relationships, funding, software selections or security deployments. When a value is unresolved, emit a typed unresolved need. Never repeat inherited facts from memory when canonical values are available. Cite a source only for claims supported by supplied spans. A paragraph's fluency cannot upgrade evidence status. Use UTAUT as a sensitizing lens only if the chosen methodology contract permits it; do not turn exploratory questions into unearned causal estimates.

Validator findings should be persisted as `{ruleId, severity, specVersion, sectionVersion, location, observed, expected, evidence, repairClass}`. Re-evaluate after edits; an old Pass must not remain valid for changed content.

## Concrete regression suite

Use this DOCX as a fixed golden failure fixture; test findings, not exact generated prose.

1. Flag 30–40 versus 35–45 without treating legitimate adaptive sampling as automatically invalid.
2. Detect part-time/full-time, semester/three-month and language-policy conflicts.
3. Resolve all three Garutsa occurrences to a missing bibliography finding; do not guess identity from another title.
4. Detect both citation markers, including markers injected into table cells.
5. Accept subtotal 147,100 and total 156,985; reject the stated 8% contingency. At 8%, compute 11,768 and 158,868.
6. Reject two transcripts as 15% across both proposed ranges.
7. Flag a pilot scheduled before approval, but allow approval administration to overlap with nonparticipant preparation.
8. Reject unsupported conflict-of-interest declarations and critical unresolved ethics fields for final export; permit a labeled draft.
9. Flag software/retention/recruitment drift; distinguish pseudonymized from irreversibly anonymized data.
10. Accept raw/fenced JSON and reject genuinely truncated extraction output; never label parse failure as source evidence.
11. Simulate API death plus stale continuation plus original-job redelivery: only one worker may call the model or commit a revision.
12. Change specification or cancel during an external call: reject late writes; preserve already committed drafts.
13. Render long budget/construct tables over page boundaries: repeat header rows, prevent ordinary row splits where possible, check clipping and usable font size. Oversized rows need explicit handling rather than blanket no-split.
14. Open a generated artifact in supported viewers and check TOC population, navigation, page numbers and text/citation parity against the snapshot.

## Delivery order and acceptance

**First:** separate final readiness from generation completion; add marker/citation-closure, arithmetic, specification-consistency and eligibility checks. Enforce fenced execution ownership. These prevent the most damaging false-success outcomes.

**Next:** role-aware evidence selection, methodology-subtype contracts, question/objective mappings, typed ethics/data lifecycle and targeted repair. Add bounded retrieval/enrichment and caching to reduce latency and duplicated cost.

**Then:** snapshot-based rendering, bibliography normalization, hierarchical templates, TOC evaluation and phase-aware UI. Include a draft/final export distinction and a localized issue list linking each failure to its section.

Release acceptance: this fixture must trigger every confirmed P0 finding; final export must have zero dangling citations, unresolved critical facts, arithmetic inconsistencies or stale validation passes. Restart/redelivery tests must show one active owner and zero duplicate provider calls in that scenario. Rendering checks must pass for every supported style profile/viewer. Track repair success, human overrides, semantic false positives/negatives, cost per accepted section and phase latency on a broader reviewed corpus; one document cannot establish fleet-wide defect rates or savings.

The correct improvement is a constrained document compiler backed by explicit study and evidence records. The LLM drafts and proposes repairs; the platform owns identities, arithmetic, dependencies, lifecycle state and readiness decisions.
