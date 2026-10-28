# Research Design Agent — Phase 2 implementation

Date: 2026-10-05. Scope: deterministic methodological safeguards. Accepted `CanonicalResearchPlan.SpecificationJson` remains the sole design authority. This phase adds no migrations, providers, prompts, API/controller, UI, durable agent lifecycle, automatic evidence handoff or proposal-generation integration.

## A. Phase 1 verification

Inspected both dirty working trees, the Phase 1 report, contracts, validators, alignment, impact and authority safeguards. CodeGraph was consulted first; backend exploration failed to open its database, so live source was used. Verified 59 existing rule IDs and no TODO markers in the design implementation. Before changes, the foundation/workflow/compiler selection passed **106 tests, zero skipped**. Identified shape-only gaps in analysis, dependence, evidence provenance and sample adequacy. Preserved unrelated work.

## B. Files changed

Paths below are relative to sibling `../Humaniser`.

- Added `HumaniseAI.Application/DTOs/Research/MethodologicalContracts.cs`: typed observation, measurement, missingness, adjustment, feasibility, ethics, evidence-context, calculation and readiness contracts.
- Extended `ProposalWorkflowDtos.cs`, `StudySpecification.cs` and `ResearchDesignContracts.cs` with optional canonical metadata, closed methods and discriminated safeguards. Null extensions stay absent from legacy JSON; historical revisions are not rewritten.
- Added `HumaniseAI.Infrastructure/Services/ResearchDesign/SampleAdequacyCalculator.cs`, `SampleAdequacyRules.cs`, `AnalysisCompatibilityRules.cs`, `QualitativeMixedRules.cs`, `PopulationMeasurementRules.cs`, `FeasibilityEthicsRules.cs` and `EvidenceReadiness.cs`.
- Updated `DesignMethodRules.cs`, `DesignStudyRules.cs` and `ResearchDesignImpactAnalyzer.cs` to compose new calculations, provenance and impact categories.
- Added `HumaniseAI.IntegrationTests/ResearchDesignMethodologyTests.cs` and `Fixtures/research-design-methodology-golden.json`.

Existing workflow calculation logic, immutable authority and acceptance guards remain in place. Repository-wide diffs contain preceding work and must not be attributed to this phase.

## C. Rules added/modified

The Research Design source now contains **120 distinct rule IDs**, preserving all 59 foundation IDs and adding 61. New families cover analysis (`RD-AN-101`–`112`, `114`), hypotheses, causal support, sample adequacy, qualitative/mixed coherence, population/eligibility, measurement/instruments, framework ordering, adjustment/missingness, feasibility, ethics, evidence scope and malformed inputs. `RD-AN-113` is unused. Findings retain stable ID, severity, component IDs, observed/expected values and repair guidance. Existing confounder provenance permits explicit theory-based rationale; unsupported calculations stay unresolved.

## D. Analysis compatibility engine

Composable rules traverse canonical question/objective/analysis links and structured intents. They detect descriptive-only inference, unsupported prediction, qualitative/inferential mismatch, repeated/paired/clustered data treated independently, longitudinal questions against cross-sectional sources, incompatible outcomes, group comparisons, missing interactions and mediation ordering. Hypotheses require a corresponding linked inferential method covering their constructs. Observational causal claims remain unresolved even when a justification string exists; a string is not validated identification.

## E. Sample adequacy support

Preserved proportion precision, independent two-means approximation and qualitative rationale. Added narrowly bounded calculations:

| Method | Support boundary |
|---|---|
| Correlation | Uncorrected two-sided Fisher-z normal approximation against zero correlation; independent bivariate-normal pairs. |
| Two proportions | Equal allocation, pooled-null/unpooled-alternative normal approximation; sparse expected counts rejected. |
| Paired means | Normal approximation with explicitly known difference variance and standardized paired difference. Unknown-variance t power remains unresolved. |
| Multiple regression and complex models | Typed calculation requirement; no substituted precision formula or guessed count. |

Inputs retain primary analysis, alpha/power, effect and provenance, allocation, separate attrition/nonresponse, assumptions, acknowledgement and sensitivity scenarios. New normal calculators restrict supported alpha/power levels, equal allocation and independent units. Formula versions and approximation flags accompany results. Group counts and invitation rounding are guarded against overflow. Tests reproduce correlation 85 completed/95 invited, 119 invited with 20% attrition, two-proportion 164 total and known-variance paired 32 pairs under their recorded inputs.

These formulas are explicitly approximations: established packages also offer distinct implementations, so equality with exact t power or bias-corrected correlation routines is not claimed. See [R two-proportion documentation](https://www.stat.ethz.ch/R-manual/R-devel/library/stats/html/power.prop.test.html), [R t-test documentation](https://www.stat.ethz.ch/R-manual/R-devel/library/stats/html/power.t.test.html), [WebPower correlation documentation](https://search.r-project.org/CRAN/refmans/WebPower/html/wp.correlation.html) and [pwr regression power documentation](https://search.r-project.org/CRAN/refmans/pwr/html/pwr.f2.test.html).

## F. Qualitative safeguards

Preserved phenomenon semantics and prohibition of forced hypotheses/numeric measurement. Added lived-experience and phenomenological collection coherence, grounded-theory process/theory-development and recruitment requirements, case boundaries, justified quality practices and rejection of universal checklists. Thematic analysis is an analysis method, not a design enum. No universal sample threshold is introduced; adequacy/stopping rationale remains required.

## G. Mixed-method safeguards

Convergent, explanatory sequential and exploratory sequential contracts require actual quantitative/qualitative questions, sources and analyses, strand sampling, consistent timing/priority, integration and joint interpretation. A survey/interview label does not establish integration.

## H. Population/sampling validation

Structured inference scope, accessible sampling frame, participant characteristics and longitudinal requirements are checked alongside existing population/unit/geography rules. Equality-based inclusion/exclusion contradictions are detected. Unsupported dependence triggers reviewed calculation requirements. Population wording comparisons remain conservative rather than semantic inference.

## I. Instrument/operationalisation validation

Quantitative measurement links instruments, scoring, scale and canonical outcome identity. Rules detect unused constructs, incompatible scoring, missing instrument connections, unavailable instruments, unresolved adaptation or permissions. Validation/reliability claims require scoped non-retracted evidence; absent provenance produces typed needs. Qualitative phenomena are not forced into this numeric measurement chain.

## J. Confounding/mediation/moderation safeguards

Adjustment variables need explicit selection rationale/provenance. Structured mediator and post-treatment adjustment are flagged; p-value screening requires explicit policy permission and justification. Moderation requires a linked moderator and interaction strategy; mediation requires temporal and theoretical justification and reviewed adequacy. No claim of DAG correctness is made.

## K. Missing-data validation

Typed plans distinguish item missingness, unit nonresponse, mechanism uncertainty, assessment, handling rationale and sensitivity. Blanket multiple imputation without defensible assumptions/sensitivity is blocked. Qualitative material is not assigned numeric imputation. No automatic MICE recommendation occurs.

## L. Feasibility engine

Checks explicit access, data/instrument availability, permissions, recruitment capacity against calculated completed requirements, timeline, tools/skills and permitted academic levels. Ideal/feasible alternatives require tradeoff explanation; changing the RQ is visible rather than silently accepted. Capability restrictions are supplied constraints, not stereotypes about academic level.

## M. Ethics-by-design

Structured characteristics classify consent/withdrawal, assent/guardian consent, vulnerability, sensitive/health/identifiable data, secondary-data rights, recordings, institutional access, cross-border transfers and retention decisions. Missing required plans create findings. No committee names or approvals are generated.

## N. Evidence-state handling

Supported, contradicted, insufficient, required, unavailable and not-applicable states remain distinct. Failed providers and insufficiency cannot establish a gap. Instrument, effect, confounding and unresolved design decisions emit typed needs. Evidence support requires matching project, purpose, component scope, immutable package hash and non-retraction. Draft `VerifiedSupport` labels alone are insufficient. The context adapter is a read-only application contract, not a new search stack; downstream callers must load it from authorized verified records.

## O. Revision-impact behavior

Existing dependency traversal remains, with explicit evidence, ethics and feasibility change categories. Canonical fields, current authority, evidence snapshot and policy version participate in validation fingerprints. Instrument, operationalisation, question, analysis and evidence changes invalidate currentness. Conservative broader invalidation is retained when precision is uncertain. Validation does not mutate accepted revisions or sections.

## P. Readiness gate

`MethodologicalValidator` returns status, severity counts, alignment coverage, unsupported calculations, evidence needs, unresolved rule IDs, affected components, findings, matrix and fingerprint. `ReadyForReview` requires no blockers/majors, complete primary structural coverage and no unresolved evidence needs. Confidence cannot bypass findings. Malformed containers and nonfinite canonical JSON return findings; failed fingerprints cannot be current. This is a domain readiness result, not automatic acceptance or an endpoint integration.

## Q. Golden fixtures

Added **51 versioned scenarios**: 14 realistic design-family cases and 37 contradictions. Families include descriptive, correlation, regression, group comparison, cohort, case-control, quasi-experimental, four qualitative traditions and three mixed designs. Contradictions additionally cover repeated observations, mediation/moderation, sampling allocation, ethics, outcome naming, framework ordering, adjustment selection, MICE, broken intent alignment and inaccessible frames. Assertions check stable rule ID, severity and affected component, not generated prose. Unsupported cases are expected to remain unresolved.

## R. Test results

Before changes: **106 passed, zero skipped**. An intermediate run passed all 104 Research Design checks. Final regression selection: **343 passed, zero failed, zero skipped**, test duration **4 minutes 49 seconds**. This includes **111 Research Design checks**, of which **70 execute the new Phase 2 test class**. Added calculator, serialization, malformed-input, hypothesis, evidence-scope/retraction, currentness and failure-state tests in addition to golden cases.

Final command: `dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter 'FullyQualifiedName~ResearchDesign|FullyQualifiedName~ProposalWorkflowArchitectureTests|FullyQualifiedName~Methodology|FullyQualifiedName~ObjectivesAndResearchQuestionsCrudTests|FullyQualifiedName~ObjectiveAndResearchQuestion|FullyQualifiedName~AnalysisPlan|FullyQualifiedName~DocumentCompiler' --verbosity quiet -p:WarningLevel=0 -p:NoWarn=MSB3277 --logger 'trx;LogFileName=research-design-phase2-final.trx'`. Evidence: backend `HumaniseAI.IntegrationTests/TestResults/research-design-phase2-before.trx` and `research-design-phase2-final.trx`. This is the affected regression selection, not a claim that every repository test ran.

Compile failures during development exposed misplaced canonical metadata and a shadowed local variable. Metadata was moved onto its owning canonical records and the variable renamed; overflow and malformed-number handling were tightened. Assertions were not weakened. No paid models were used. Pre-existing EF assembly-version warnings were suppressed in command output without changing dependencies.

## S. Unsupported methodological cases

Multiple-regression noncentral-F adequacy; mediation/moderation power; clustered/repeated/multilevel power; survival and SEM; unknown-variance paired t power; unequal-allocation new normal calculations; sparse two-proportion counts; unsupported alpha/power values; observational causal identification; synthesis/history outside existing supported contracts. These return findings/requirements, not fabricated support.

## T. Known limitations

Rules establish structured consistency, not universal methodological correctness. They cannot prove recruitment rates, psychometrics, causal identification, evidence sufficiency or semantic equivalence from prose. Evidence contexts require trusted application construction. Structural alignment coverage is separate from methodological validity. Phenomenology collection support is intentionally narrow. Missing design metadata pauses legacy proposals rather than silently upgrading immutable revisions. No database/runtime/UI rollout was performed in this phase.

## U. Recommended Phase 3 scope

Only after explicit approval: compact canonical context, existing model routing and credit accounting, bounded candidate reasoning and typed failure outcomes; count retries against caps; use golden methodological evaluations and deterministic revalidation. Model suggestions must remain drafts and cannot calculate authoritative samples, certify evidence, bypass readiness or accept themselves. Durable lifecycle and atomic acceptance remain later work. Phase 3 has not begun.
