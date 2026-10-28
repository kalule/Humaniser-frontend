# Research Design Agent — Phase 1 implementation

Phase 1 implements the deterministic domain foundation approved in the two attachments. The new validator produces **foundation consistency**, not scientific certification or permission to accept/generate. Phase 2 and later phases remain outside this implementation.

## A. Files changed

Backend paths are relative to `../Humaniser`.

Modified existing files:

- `HumaniseAI.Application/DTOs/Research/ProposalWorkflowDtos.cs`: optional design metadata on existing question, objective, construct, data-source, analysis and sampling contracts.
- `HumaniseAI.Application/DTOs/Research/StudySpecification.cs`: optional discriminated study design and instrument-item metadata.
- `HumaniseAI.Infrastructure/Data/AppDbContext.cs`: small call to the authority guard in the existing save choke point, covering synchronous and asynchronous saves.
- `HumaniseAI.Infrastructure/Services/ProposalWorkflowService.cs`: synchronize legacy methodology labels when accepting an existing specification; explicitly prevent typed design acceptance through the legacy endpoint during Phase 1.

New files:

- `HumaniseAI.Application/DTOs/Research/ResearchDesignContracts.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/DesignConsistencyValidator.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/DesignMethodRules.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/DesignStudyRules.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/DesignAlignment.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignImpactAnalyzer.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignAuthority.cs`.
- `HumaniseAI.IntegrationTests/ResearchDesignFoundationTests.cs`.
- `HumaniseAI.IntegrationTests/Fixtures/research-design-foundation-golden.json`.

Frontend application code is unchanged. This report is the frontend repository deliverable. Existing unrelated work was preserved. No migration, provider call, Research Design prompt, production agent lifecycle, new API, UI redesign or generation integration was introduced.

## B. Existing components reused

The existing immutable `CanonicalResearchPlan` remains the owner of accepted JSON. Contracts retain the existing RQ/objective/construct/source/analysis IDs and constructors. Graph validation reuses existing `ProposalWorkflowPolicy.Validate` reference/type findings; sample arithmetic delegates to its existing `Calculate` method. Serialization uses existing policy options, and methodology enforcement uses the existing `AppDbContext` save choke point. Tests reuse the existing canonical specification fixture and test project, including its automatic JSON fixture-copy configuration.

## C. New contracts and taxonomies

Closed string enums reject numeric values, unknown labels and undefined enum values when serialized. Required taxonomy fields cannot be omitted from typed JSON and silently become enum defaults. There are controlled taxonomies for intent, supported quantitative/qualitative/mixed designs, question priority, concept kind, variable role, measurement scale, analysis method, sampling strategy, sample-size method, evidence need/state, finding severity, validation state and dependency component.

`StudyDesignContract` has explicit `$family` discrimination for quantitative, qualitative, mixed and unsupported designs. Quantitative/qualitative subtype properties are separate; mixed designs have explicit constituent designs and integration point/method/relationship. Unsupported designs can retain their requested label without being forced into empirical validation.

Existing records receive optional metadata:

- Questions: intent, primary/secondary priority, data required, expected output, population, unit and geography.
- Objectives: instrument edges, expected output and instrument applicability.
- Constructs: variable versus phenomenon/experience/process/meaning/context; typed role and scale only for variables; operationalisation/exploration, justification and evidence references.
- Sources: answerable questions, population/unit/geography and access rationale.
- Analyses: typed method, canonical input IDs, missingness justification and primary-analysis flag.
- Instruments: claimed validation, evidence IDs, version and context.

The original textual fields remain compatibility representations. The new typed metadata is required by foundation validation when a typed design is supplied; legacy specifications are not silently treated as fully validated designs.

## D. Canonical authority handling

There is no new authoritative entity or table. Before acceptance, methodology inputs remain editable. A methodology profile referenced by an accepted specification cannot be mutated/deleted through tracked saves. Independent changes to accepted project methodology labels or profile binding are rejected. Both save variants run the same guard.

Existing specification acceptance now synchronizes project methodology labels to its bound profile/plan, so compatibility representations agree. Typed design acceptance is explicitly blocked at the existing endpoint until the later atomic acceptance implementation is approved; adding metadata cannot accidentally enable an incomplete acceptance flow.

The full concurrency-safe acceptance transaction and durable run lifecycle are deferred. The save guard enforces tracked application edits; it is not a database trigger, raw-SQL security boundary, or substitute for transactional concurrency fencing. Future atomic acceptance must acquire the existing project lock and bind profile/revision/projections in one transaction.

## E–F. Deterministic rules and stable IDs

The implementation has 59 stable rule IDs, grouped into graph, methodological and study policies through `IResearchDesignRule`. Every finding contains rule ID, typed severity, component IDs, observed/expected values and repair guidance. Severity names are `BLOCKER`, `MAJOR`, `MINOR`, `WARNING`, `PASS`; the current policies emit blockers, unresolved-evidence majors and a legacy-input warning. They do not fabricate PASS findings for unsupported decisions.

| IDs | Implemented responsibility |
|---|---|
| `RD-AUTH-001` | Supplied ownership/expected revision context consistency. |
| `RD-SHAPE-001` | Null/malformed canonical arrays and edge containers. |
| `RD-REF-001`, `RD-REF-002` | Unique/nonempty IDs and reference integrity, including added instrument/analysis/framework/evidence edges. |
| `RD-TAX-001` | Supported typed schema/enums and explicit design rationale. |
| `RD-DESIGN-000`, `001`, `002` | Legacy needs reconciliation; identifiable cross-sectional causal overclaim; unsupported family. |
| `RD-INTENT-001`, `002` | Unsupported historical/synthesis intent in empirical policy; quantitative family with qualitative intent. |
| `RD-RQ-000`–`004` | Questions exist, objective coverage, obtainable answerable data, required metadata and explicit primary priority. |
| `RD-OBJ-001`–`003` | Objective shape/output/RQ edges, data coverage and concept coverage. |
| `RD-COLLECT-001` | Source capability and collection-method shape. |
| `RD-AN-001`–`006` | Missing analysis; typed inputs/assumptions; family/strand/concept compatibility; objective/input alignment; supported scale/role pairings; mediation requires a mediator. |
| `RD-HYP-001`, `002` | Applicability/records/rationale and hypothesis reference/test/alpha shape. |
| `RD-CONSTRUCT-001`, `RD-VAR-001` | Concept definition/operationalisation and variable role/scale. |
| `RD-CONFOUND-001` | Adjustment variables require rationale and referenced support. |
| `RD-QUAL-001`–`006` | No quantitative hypotheses/variable semantics/testing in pure qualitative design; quality strategy; tradition/method pairing; qualitative adequacy. |
| `RD-POP-001`, `002`, `RD-GEO-001` | RQ/source/project scope agreement; explicit target/access population/unit; geography consistency. |
| `RD-ELIG-001` | Explicit eligibility exclusion contradicts a required concept/phenomenon. |
| `RD-SAMPLING-001` | Qualitative recruitment/sampling compatibility. |
| `RD-SAMPLE-001`–`004` | Method matches primary analysis, adequacy metadata, unsupported calculations stay unresolved, existing calculator prerequisites. |
| `RD-INST-001`–`003` | Claimed validity needs version/context/support; instrument coverage; required instrument edge. |
| `RD-MIXED-001`, `002` | Both strands and explicit integration; separate qualitative adequacy. |
| `RD-FRAME-001` | Applicable framework concepts are linked to objectives. |
| `RD-MISSING-001` | Missingness handling and justification are explicit. |
| `RD-EVID-001`–`005` | Failure/insufficiency is not a gap; support-reference shape; typed need shape; unresolved states and needs. |
| `RD-FEAS-001`, `RD-ETHICS-001` | Feasibility requirements and risk/mitigation/approval-prerequisite shape. |

These are foundation checks. They do not prove instrument validity, causal identification, realism of a budget, or scientific completeness from the presence of strings.

## G. Alignment model

`DesignAlignment.Derive` walks existing question→objective edges and emits objective-specific rows with concept IDs, required data, source IDs, collection methods, instrument IDs, analysis IDs and expected output. Uncovered questions remain visible with a null objective. No manually editable matrix or persisted duplicate alignment authority exists. Validation does not mutate the input graph.

## H. Sample-size changes

`SampleSizeDesignMetadata` records method, primary analysis, estimand, assumption provenance and qualitative adequacy. Mixed designs keep the existing top-level calculator for the quantitative strand and a separate qualitative adequacy contract; no duplicate quantitative sample-count authority is added.

`ProposalWorkflowPolicy.Calculate` is unchanged. Existing proportion precision, two-independent-means approximation and qualitative behavior remain intact. Correlation/regression/cluster/mediation/external methods are representable but return explicit unresolved findings; existing unsupported calculations retain `Unknown` and null counts. There is no fallback to Cochran.

The valid correlational golden fixture intentionally expects unresolved calculation findings only. This distinguishes a coherent correlational design from an unsupported power calculation rather than falsely declaring a numeric sample sufficient.

## I. Impact-analysis foundation

`ResearchDesignImpactAnalyzer.Compare` compares structured canonical component values, including subtype-only changes, questions, objectives, population/unit/geography/eligibility, concepts, sampling, sample parameters, instruments, sources, analyses and framework. `Analyze` traverses dependencies with a visited set, so cycles terminate. It returns dependent component categories and conservative proposal section codes without mutating any sections or artifacts. Item-specific minimal regeneration is deferred.

## J. EvidenceNeed contracts

Typed needs support design justification, instrument validation, effect size, population estimate, construct operationalisation, confounder rationale, qualitative methodology, framework and ethics evidence. Each has stable ID, required-for component IDs, question, scope and priority. Evidence decisions distinguish support, contradiction, insufficiency, provider unavailability and qualified gaps. No Deep Research invocation or automatic evidence handoff exists in Phase 1.

## K. Backward compatibility

All existing positional constructors remain intact. New metadata properties are nullable and omitted from JSON when null. No schema-version default was raised, no existing accepted payload was rewritten, and no historical revision was backfilled or accepted. Legacy JSON round-trip and discriminated-family round-trip tests exercise this boundary. Untyped legacy input returns `RequiresInput` with `RD-DESIGN-000`, rather than being silently upgraded.

## L–M. Tests added and results

The versioned golden manifest contains all 22 requested examples and stable expected rule IDs. Deterministic tests exercise the manifest, serialization, closed taxonomy, unsupported families, malformed/duplicate records, derived alignment, graph impacts, explicit instrument applicability, measurement pairing and methodology authority before/after acceptance. Tests assert rule IDs/severity rather than prose.

Results:

- Initial foundation run: 34 passed, 0 failed.
- Requested regression selection: 266 passed, 0 failed, 0 skipped. Includes foundation, workflow architecture/policy, methodology, objective/RQ CRUD and concurrency, analysis-plan and compiler tests. Existing database-backed suites use disposable Postgres test databases and provider mocks.
- Final verification after the taxonomy/impact/instrument refinements: 106 passed, 0 failed, 0 skipped — 40 new foundation cases, 43 existing workflow architecture/policy cases, and 23 compiler cases.

Commands:

```powershell
dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter 'FullyQualifiedName~ResearchDesignFoundationTests|FullyQualifiedName~ProposalWorkflowArchitectureTests|FullyQualifiedName~Methodology|FullyQualifiedName~ObjectivesAndResearchQuestionsCrudTests|FullyQualifiedName~ObjectiveAndResearchQuestion|FullyQualifiedName~AnalysisPlan|FullyQualifiedName~DocumentCompiler' --verbosity quiet -p:WarningLevel=0 --logger 'trx;LogFileName=research-design-phase1.trx'
dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter 'FullyQualifiedName~ResearchDesignFoundationTests|FullyQualifiedName~ProposalWorkflowArchitectureTests|FullyQualifiedName~DocumentCompilerTests' --verbosity quiet -p:WarningLevel=0 -p:NoWarn=MSB3277 --logger 'trx;LogFileName=research-design-phase1-final.trx'
```

TRX evidence is under backend `HumaniseAI.IntegrationTests/TestResults`. Existing compiler nullable warnings and an EF Relational 8.0.11/8.0.31 assembly-version warning appeared in the initial/regression builds; the final command suppresses those warning displays and does not change dependencies. No migration was generated or applied to the application database.

## N. Unsupported methodology boundaries

Typed families cover descriptive/cross-sectional/correlational/comparative/cohort/case-control/experimental/quasi-experimental; qualitative descriptive/phenomenology/grounded theory/case study; and convergent/explanatory-sequential/exploratory-sequential mixed methods. Each receives applicable foundation rules, not a claim that all advanced family-specific safeguards are complete.

Historical/humanities/synthesis/other designs remain representable through the unsupported contract and return `UnsupportedForAutomatedValidation`. Unsupported numeric formulas remain unresolved. No empirical outline is assigned to unsupported designs by this implementation.

## O. Known limitations

- Validation is pure and does not load authenticated database state. Supplied authority context must come from a trusted future service; it cannot establish real ownership on its own.
- Evidence support checks validate supplied decision/reference relationships, not real source retrieval, retraction status, immutable package hashes or instrument psychometrics. Those require later authoritative evidence validation.
- Population/geography matching is exact and conservative; synonyms or intentionally different target/access scopes require explicit reconciliation.
- Causal overclaim detection uses typed assertions/intent, not unrestricted natural-language analysis. Cohort/experimental identification assumptions require deeper policy in Phase 2.
- Feasibility, ethics, missingness and confounder checks establish minimum structured requirements; substantive judgments remain future safeguards.
- Advanced method variants, effect provenance verification, sensitivity calculations, primary-estimand power calculations and precise mixed-strand sample relationships need further deterministic policy.
- Component impacts are conservative, with IDs reserved for later precision; no automatic stale marking or regeneration is enabled.
- Save-time authority checks use synchronous reads for actual authority edits, even on the async save path. A later atomic service should consolidate these reads and enforce transactional concurrency.
- No new runtime agent API/UX is available. Typed acceptance deliberately remains disabled until the approved atomic acceptance phase.

## P. Recommended Phase 2 scope

Add rigorous supported-family compatibility matrices and primary-estimand adequacy, causal assumption contracts, explicit temporal/dependence structures, qualitative quality/sampling policies, mixed integration/timing and strand sample relationships, substantive feasibility/ethics checks, authoritative evidence provenance validation and more precise dependency impacts. Expand contradiction fixtures before adding new calculators. Phase 2 requires explicit approval; no LLM, agent lifecycle, API or UI work should be bundled into it.
