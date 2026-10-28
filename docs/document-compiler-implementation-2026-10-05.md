# Proposal Document Compiler implementation

The accepted `CanonicalResearchPlan.SpecificationJson` remains the authority. Its new schema-2 `StudySpecification` carries study facts; the drafting model receives those facts and cannot authorize missing decisions. Existing schema-1 proposals remain drafts until reconciled through the specification editor.

New workflow artifacts use `proposal-policy.v2`; readiness fingerprints include `document-compiler.v2`. Publication date/article-number repairs change the corpus fingerprint and invalidate earlier evidence bindings and reviews.

## Implemented boundaries

| Rule | Enforcement |
|---|---|
| SPEC-01 | Versioned typed study input, immutable accepted revisions, specification IDs on sections, stale-section finalization gate. |
| FACT-01 | Explicit unresolved decisions, immutable-fact drafting instruction, deterministic checks for audited declaration/software failures, existing semantic consistency and examiner gates. |
| SAMPLE-01 | Canonical minimum, maximum, initial target and stopping rule; checks range disagreement in prose. |
| ELIG-01 | Typed inclusion/exclusion predicates with field, operator, value and unit; contradictory scalar predicates and audited enrolment/exposure differences fail. |
| MAP-01 | Questions must map to instrument items and resolved analysis IDs; existing objective/construct/data-source/analysis checks remain in force. |
| NUM-01 | Checked decimal budget arithmetic, transcript coverage calculation, compiler-owned budget tables, exact table comparison at finalization. |
| TIME-01 | Resolved acyclic task dependencies, positive durations, approval ancestry and prerequisite completion before participant contact; compiler-owned schedule table. |
| DATA-01 | Asset storage, access, retention trigger/months, identity state and withdrawal policy must be explicit. |
| CITE-01 | Existing exact claim/passage bindings and immutable source IDs, registry-rendered citations, missing bibliography and unresolved-marker gates. |
| CITE-02 | Evidence reviewer checks rhetorical role and compatibility with the accepted analytic tradition; topical resemblance cannot authorize a method. This remains a semantic review, not a keyword proof. |
| META-01 | Verified publication date and article number retained in project literature; missing years stay unknown; duplicate first/last pages collapse to one page. Future metadata fails the cutoff check. |
| PROMPT-01 | Drafting receives accepted typed facts and compiled tables. Budget/schedule prose cannot repeat numerical values or supply a competing table. Missing decisions remain explicit. |
| RUN-01 | Durable project/job token, owner and expiry. PostgreSQL row locking fences checkpoint saves; every physical LLM attempt, including provider retries, checks authority. All save overloads are covered. |
| RUN-02 | Existing bounded proposal continuations plus renewable leases and ten-minute budgets for ten retrieval/drafting/verification job types. Saved source extracts and revision-bound generation artifacts retain existing skip/idempotency behavior. |
| COST-01 | Existing retrieval caps, deadlines, OpenAlex concurrency/rate limits, DOI identity and caches retained; jobs now also have bounded execution authority. This does not add a universal spend ledger or a cluster-wide LLM concurrency limiter. |
| UI-01 | Typed study editor, unresolved-decision editor, structured finding details, persisted run/phase timestamps, phase activity and explicit unknown-ETA text. |
| FINAL-01 | Strict finalization merges compiler checks with evidence, provenance, semantic and examiner review. Legacy partial exports carry a draft label. |
| DOCX-01 | Shared renderer, chapter/section/subsection hierarchy, intact Markdown tables, repeating table headers, compact-row split protection, table grids, shading and schema-ordered XML properties. Damaged Unicode text fails validation. |
| DOCX-02 | Cached heading list and update-on-open field policy. Cached entries do not invent page numbers; pagination-aware TOC refresh is performed by Word. |

## Source locations

Backend: `HumaniseAI.Application/DTOs/Research/StudySpecification.cs`, `HumaniseAI.Infrastructure/Services/DocumentCompilerValidator.cs`, `CompilerTables.cs`, `GenerationAuthority.cs`, `FencedProjectJob.cs`, `ProposalWorkflowService.cs`, `MarkdownDocxRenderer.cs`, and `HumaniseAI.Infrastructure/Data/AppDbContext.cs`.

Frontend: `src/components/research-agent/StudyParametersEditor.tsx`, `ResearchSpecificationEditor.tsx`, `src/components/app/GenerationProgressDialog.tsx`, `AutonomousProposalTools.tsx`, and the research/workflow API types.

Fenced job entry points: proposal generation, section generation, source extraction, identity extraction, literature analysis/distillation, research discovery/screening, methodology anchor fetching, facts consistency and claim-support verification. Unrelated review, reference-manager and other product jobs retain their existing execution mechanisms.

## Validation and rollout

Completed checks: 66 compiler/workflow tests, 15 extraction-job integration tests, 39 targeted frontend tests, and TypeScript project compilation passed. Backend builds retain existing nullable, test-analyzer and EF package-version warnings. The PostgreSQL integration tests applied migrations only to disposable test databases, which their fixture removes after testing.

`DocumentCompilerTests` includes the actual user-provided DOCX as a golden fixture, the audited sample/citation/declaration failures, arithmetic and schedule checks, stale specification and null-input checks, source cutoff checks, authority revocation through save/provider boundaries, and OpenXML structural validation. The existing strict workflow tests cover clean finalization in Harvard, APA, IEEE and MLA, immutable downloads and stale readiness after edits. Existing extraction tests exercise the fenced jobs against disposable PostgreSQL databases with mocked providers.

Two migrations must precede deployment of the new API/worker binary:

1. `20261005110315_AddDocumentCompilerGenerationAuthority`: creates `generation_runs`.
2. `20261005113049_AddCompilerPublicationMetadata`: adds nullable `PublicationDate` and `ArticleNumber` to `project_literature`.

Neither migration was applied to the development database during implementation. Drain workers, apply the migrations through the normal deployment process, then restart API and workers together. An old schema cannot run this binary. No existing section content is rewritten by either migration.

Older accepted specifications need schema-2 reconciliation before clean final export. Historical sources without exact dates retain a conservative end-of-year cutoff bound; current-year sources may require verified date metadata. No automatic metadata guess or publication-year backfill is performed.

Deterministic checks cover typed structure and specific audited prose failures. Arbitrary natural-language contradictions still require the semantic/examiner gates; a passing compiler check alone does not establish research validity. Word's final pagination and TOC appearance still require visual verification after field refresh. Existing retrieval cache TTLs are reused; this change does not introduce a new prompt-result cache or claim that unrelated background products are fenced.
