# Research Design Agent ? Phase 8 implementation

Date: 2026-10-06. Scope: Proposal Studio integration and canonical design enforcement. Both repositories contained substantial pre-existing changes; this report describes Phase 8 additions, not every working-tree modification. No Academic Reviewer implementation, deployment, development database modification or live provider invocation.

## A. Phase 7 verification

The existing authenticated Research Design route, Phase 6 API client, server-owned allowed actions, query infrastructure and shared controls remain in use. The full frontend suite passes 321 tests (309 previous plus 12 Phase 8). The Phase 7 mocked browser journey was rerun: 41 assertions, zero errors/failures/skips. Phase 7's advanced structured editing limitations remain documented; they were not replaced by another methodology editor.

## B. Proposal Studio architecture audit

Inspected the existing app shell, navigation, Proposal Studio entry points, research dashboard, Research & Review workspace, document editing surface, strict workflow, autonomous generation and finalization. Reused the current sidebar, authenticated layout, Button/Card/Modal, toast and account-scoped Query patterns. CodeGraph was consulted first: frontend exploration worked; backend exploration failed to open its database, so backend findings use live source.

## C. Existing generation pipelines discovered

`ResearchService.GenerateSectionAsync` and autonomous generation expose compatibility paths; `ProposalWorkflowService` provides canonical generation, exact claim evidence, section acceptance, semantic/examiner review and finalization. Older section/citation fix endpoints can otherwise bypass canonical writer contracts. Manual section editing is a distinct draft operation and remains available.

## D. Methodology authority audit

For typed Research Design projects the owned accepted `CanonicalResearchPlan.SpecificationJson` is authoritative. The bound immutable MethodologyProfile must agree with it; it is a compatibility binding, not a second prompt authority. Frontend selections, legacy project labels and model guesses cannot redefine the accepted design. Acceptance continues through the existing atomic profile/specification transaction.

## E. Legacy path findings

Projects participating in Research Design without an accepted plan cannot fall back to the legacy writer. Typed accepted designs cannot be downgraded through legacy acceptance. Old automatic section/citation fix commands reject accepted proposals and direct users to versioned reconciliation; manual draft edits remain permitted. No accepted plan and no design run is explicitly labelled legacy compatibility. This is a participation-based boundary, not a fabricated creation-date cutover.

## F. Files changed

Backend paths below are relative to `../Humaniser`.

New production files:

- `HumaniseAI.Application/DTOs/Research/ProposalDesignIntegrationDtos.cs`
- `HumaniseAI.Infrastructure/Services/ProposalSectionContextCompiler.cs`
- `HumaniseAI.Infrastructure/Services/ProposalDesignDriftValidator.cs`
- `HumaniseAI.Infrastructure/Services/ProposalWorkflowDesignIntegration.cs`

Existing backend changes:

- `HumaniseAI.Application/DTOs/Research/ProposalWorkflowDtos.cs`: optional revision/overwrite/reconciliation command fields.
- `HumaniseAI.Infrastructure/Services/ProposalWorkflowService.cs`: readiness, bounded contexts, generation proofs, drift gates, selective staleness and reconciliation.
- `HumaniseAI.Infrastructure/Services/ResearchService.cs`: canonical/legacy boundaries and protection against older repair commands.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignAcceptance.cs`: remove redundant blanket staleness after the canonical transaction.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignLifecycleService.cs` and `ResearchDesignEvidenceContext.cs`: share the existing verified evidence loader.
- `HumaniseAI.API/Controllers/ProposalWorkflowController.cs`: thin readiness/binding/repair commands and specific conflict codes.

Frontend production changes:

- New `src/components/research-design/ProposalDesignReadinessPanel.tsx`.
- `src/api/proposalWorkflow.ts`, `src/types/proposalWorkflow.ts`.
- `src/pages/app/ProposalWorkflowPage.tsx`, `ResearchDashboardPage.tsx`, `ResearchDesignPage.tsx`.

Tests: four new backend files (`ProposalDesignIntegrationTests`, `ResearchDesignProposalPostgresTests`, `ResearchDesignProposalGenerationTests`, `ResearchDesignProposalGoldenTests`); new panel tests and extended API tests; `scripts/research-design-phase8-smoke.mjs`. No shared visual component, navigation source, global theme, entity, EF configuration or migration changed in this phase.

## G. CanonicalResearchPlan integration

The accepted project pointer selects one owned immutable revision. Section contracts use its typed family, and generation compiles its relevant facts. Existing snapshot-only/legacy accepted plans remain readable. Historical hashes and original section generation revision IDs are preserved.

## H. Proposal readiness gate

Read-only readiness rechecks accepted JSON hash, profile binding/version, existing deterministic methodology validation and currently verified design evidence. It returns mode, accepted/bound revisions, affected sections, actionable findings and allowed actions. Required unresolved inputs/evidence and revision mismatch block writing before provider use. Section-specific evidence/prerequisite gates still apply after design readiness.

## I. ProposalGenerationContract

Every new canonical writer attempt binds specification ID/hash, context version/facts hash, evidence hash, corpus hash and readiness fingerprint. A result stores the contract plus canonical design assertions. The writer cannot supply a new authority; application-owned values must match. Failed generation is retained as a rejected artifact without replacing section content.

## J. Canonical revision/fingerprint binding

Before persistence, reload project/revision/profile/cancellation and current evidence/readiness. Changed canonical state, evidence, corpus, proposal binding or content version rejects the result. Persisted section acceptance/finalization require the relevant proof. Historical content without the new proof requires explicit reconciliation, not silent certification.

## K. SectionContextCompiler

`proposal-design-context.v1` constructs deterministic, sorted, section-specific projections and hashes. Supported section codes follow the existing outline; unknown typed sections fail closed. Context JSON is capped at 64,000 characters; the total writer input is capped at 96,000 characters. These are character limits with an estimated token measurement, not claims of exact provider token counts. No full canonical aggregate, full evidence packages, all abstracts or previous chapter bodies are injected into writer requests.

## L. Introduction context

Problem, title, scope/contribution, relevant RQs/objectives, constructs where appropriate, geography/population/unit/time and family/design guards. Sampling calculations, instruments and full analysis plans are excluded. Context projection tests enforce this boundary.

## M. Literature Review context

Scoped questions/objectives, framework/constructs and relevant exact evidence claims/quotes. Comparative descriptions of prior qualitative work are allowed in a quantitative literature review; assertions about the present study remain constrained. Literature can explain other designs without redefining this proposal.

## N. Methodology context

Approach/subtype, population/setting, design rationale, eligibility, sampling, adequacy, measurement, instruments, collection, analysis and safeguards are selected by the actual subsection. Authoritative sample calculations reuse Phase 2 code; no LLM sample arithmetic authority was introduced. Mixed/qualitative context uses the existing family contracts.

## O. Analysis context

Selected canonical analysis IDs, closed method names, inputs/assumptions, missingness, hypotheses applicability and accepted software decisions. Qualitative/mixed quality or integration fields are supplied where applicable. Unapproved regression, paired tests, thematic coding, mediation/moderation or missing-data methods can fail the deterministic catalogue.

## P. Ethics context

Actual ethics section 5.11 receives accepted risks, characteristics, ethics decisions, approval status/reference, conflicts and data lifecycle; relevant safeguards also reach applicable methods sections. Prose cannot invent completed approval or an approval reference. Supported decisions and unresolved prerequisites remain distinct.

## Q. Evidence integration

Reused the existing design evidence adapter rather than creating a parallel verifier. Package ownership, attestation/hash, scope, source eligibility, retraction and dependency binding are checked. Generation uses section-reviewed exact claim/quote bindings, including approved counterevidence. Recheck all selected evidence after the call. A failed provider is not a research gap; evidence arrival does not trigger a new design reasoning loop.

## R. Citation integration

Existing claim binder and citation registry render citations from accepted exact source bindings. IDs must belong to the owned project and relevant section/current context. Approved counterevidence may be cited; unrelated/non-passing bindings cannot. Citation prose or model assertions never upgrade source verification.

## S. Generation-time deterministic validation

Canonical assertions, methodology/population/sample/analysis/ethics rules, exact RQ/objective coverage, source bindings, existing compiler facts and word budgets are checked before saving. Revalidate persisted content in workflow state, acceptance and finalization. Schema-valid JSON alone cannot pass a drifting proposal.

## T. Methodology drift detection

`proposal-design-drift.v1` checks a finite catalogue of supported violations. Quantitative cross-sectional correlation rejects present-study thematic coding, unauthorized analyses, longitudinal follow-up, causal claims, wrong populations, invented validated scales/psychometrics, inconsistent sample counts, unsupported imputation and completed ethics approval. Negated alternatives and comparative prior-study statements are handled separately. This is a bounded deterministic guard, not a universal semantic correctness claim; existing semantic/examiner reviews remain required.

## U. Targeted repair

Repair preview is read-only, revision/content-version fenced and uses deterministic sentence-level replacement only when safe. It preserves surrounding student paragraphs and revalidates the suggestion. Unsafe cases require manual resolution. Using a suggestion loads the editor; only an explicit reconciliation command writes it. No paid repair call, automatic full rewrite or automatic acceptance.

## V. Cross-section consistency

All sections use the same accepted authority. Current facts/assertions and existing document compiler validate section/proposal consistency; finalization retains semantic/examiner and section acceptance gates. Compatible sections from an older revision remain usable only after semantic context equivalence and existing stale flags are checked. The displayed logical compatibility does not rewrite historical provenance.

## W. Research Design revision handling

Existing Research Design lifecycle creates and accepts the next immutable revision atomically. Proposal content is not rewritten. When the proposal remains bound to an earlier version, users review affected sections and explicitly choose the updated design; stale sections then require reconciliation.

## X. Dependency/staleness propagation

Compile old/new relevant contexts and compare their semantic hashes, backed by existing impact diagnostics. Mark affected sections for re-review/methodology staleness; approved status becomes edited. Unchanged contexts retain content/version/original provenance and existing unresolved flags. Population changes affect scoped chapters but do not automatically invalidate unrelated timeline/budget sections. Broad conservative method-level context can mark more sections than a future finer projection.

## Y. User-edit protection

Acceptance/binding/repair preview never overwrite saved paragraphs. Generation refuses a nonempty typed section unless the caller explicitly authorizes replacement with its current content version. A concurrent manual edit during a provider call wins: the generated result is rejected. Manual edits invalidate prior proofs until explicit reconciliation. Browser repair checks retain the student's opening and ending paragraphs.

## Z. Proposal Studio UX integration

Readiness appears in the existing proposal dashboard and Research & Review page. Accepted typed designs hide the competing legacy specification editor and link to Research Design. Backend allowed actions govern generation/adoption; failed readiness disables writing. Existing modal patterns confirm adoption/regeneration and preview repairs. Project changes clear previews/dialogs/readiness and guard late responses. No new shell/sidebar/dashboard/navigation definition or global visual redesign.

## AA. Legacy compatibility

Snapshot-only and non-typed accepted specifications remain readable and retain compatibility behavior. Legacy no-design projects retain existing writer behavior and are explicitly labelled; strict canonical workflow generation still requires acceptance. Typed/design-participating projects cannot silently fall back. Accepted proposals' old unversioned repair commands are intentionally blocked to protect authority and edits. No automatic historical backfill or informed-acceptance inference.

## AB. Concurrency/generation fences

Reuse existing project lock/transaction and generation fences. Binding checks expected current/prior revision and active generation. Provider completion checks current canonical/evidence/content state before persistence. Requests cannot accept a result against a different population/design or overwrite intervening student edits.

## AC. Idempotency

Binding, writer attempts and typed reconciliation carry command keys and fingerprints. Repeated accepted commands return the previous result without another provider charge; changed payloads conflict. Reconciliation replays reject superseded content. UI generation/adoption use stable retry keys; reconciliation retains an in-memory payload-specific key across ambiguous failures, clearing it only on success. Research content is not persisted into browser storage for this key.

## AD. Credits/budget behaviour

Existing atomic reservation, provider usage recording and commit/release paths remain the ledger. A completed paid call is accounted for even if its generated prose fails validation. Rejected pre-call readiness/ownership/overwrite requests incur no writer call. Idempotent replay and deterministic repair/reconciliation incur no additional provider call. No separate credit ledger or new unbounded retry loop.

## AE. Token/context efficiency

Only relevant canonical facts and reviewed exact evidence quotes enter a writer request. Prerequisite proofs use hashes rather than whole prior chapters. Full proposal text remains necessary for existing whole-document review, once per review, with section contexts; this is separate from writer input. Tests check omitted aggregate/corpus/package fields. No live token/cost benchmark or percent-savings claim.

## AF. Telemetry/provenance

Existing immutable workflow artifacts retain initial/bound design, impact, generation contract, facts/evidence/readiness hashes, rejected results and explicit reconciliation. Context version/byte count/token estimate are available without logging raw canonical research text as diagnostics. Artifact payloads remain owned research records under existing access controls, not public logs.

## AG. Security/authorization

Owned project/revision/section/evidence/source checks precede commands and reads. Current account/project keys scope frontend queries and adoption retries. New strict controller actions return specific conflict codes; older middleware routes retain their existing generic workflow conflict envelope with an actionable message. PostgreSQL/API tests cover cross-user access and expected-version conflicts. No secrets were needed or exposed.

## AH. Database/migration impact

New migrations created: 0. Phase 8 migrations applied: 0. Development database changes: none. Existing artifacts and fields store bindings/contracts/impact; no duplicate canonical entity. Integration fixtures apply existing migrations only to disposable PostgreSQL test databases. Existing acceptance transactions still include coherent profile, canonical revision, projections and impacts; there is no independent profile-then-plan save.

## AI. Tests added

54 new backend checks: 41 deterministic catalogue/context/repair cases and 13 PostgreSQL/API/generation/golden cases. 12 new frontend tests: 7 readiness panel cases and 5 API contract cases. Full frontend: 321 passed, zero failed/pending. Phase 8 browser: 26 assertions, zero page errors; Phase 7 regression: 41 assertions, zero errors/failures/skips. Combined browser assertions: 67.

Backend full regression result: **1,393 passed, zero failed/skipped**, including all 932 tests from the Phase 6 final regression and 54 new Phase 8 cases. The name-based class filter also includes additional existing related cases in this checkout; this is a selected affected-suite run, not a claim that every repository test was executed. Result: `research-design-phase8-regression.trx` (12m28s)..

Focused backend workflow/design/compiler checks passed 110/110; the complete golden plus then-current pure catalogue passed 31/31 before the final eleven catalogue cases were added. Final combined regression includes those additions. One initial new backend assertion compared records containing different array instances; it was corrected to assert the independent expected sample count. Five initial new frontend SSR cases exposed an always-mounted browser-only modal; it now mounts only when open. A browser mock returned an invalid empty feedback object; corrected the fixture to `null`. Final results, rather than intermediate failures, determine the release recommendation.

Production frontend TypeScript/Vite build passes; backend API build passes (build warning suppression does not imply repository-wide warning absence). Existing Vite chunk/dynamic import warnings remain. Lint remains unavailable because the existing script references an uninstalled ESLint executable; lint findings are unknown. No unrelated lint dependencies changed.

## AJ. LMS golden fixture results

Quantitative, correlational, cross-sectional LMS design drives actual canonical projection/calculation and rejection cases. Present-study qualitative coding fails; comparative/negated literature statements pass. Population/sample, analysis methods, instrument validity, missingness and ethics contradictions are exercised. Exact assertion mismatch fails independently of plausible prose. Fixture data is test-only.

## AK. End-to-end golden scenario

Real lifecycle start ? validated readiness ? atomic acceptance ? canonical generation with controlled providers and exact claim bindings ? section acceptance ? deliberate analysis drift rejection ? corrected generation ? real manual student edit ? read-only targeted preview ? explicit reconciliation ? population revision ? selective staleness ? explicit design adoption ? current-evidence rebinding and reconciliation. Older canonical JSON/hash and unaffected timeline text/provenance remain unchanged. This exercises real services and disposable PostgreSQL, with fake provider responses; it does not claim a live paid-model evaluation or a fully finalized proposal with every outline section.

## AL. Performance/query findings

Historical owned revisions needed by section/evidence references are fetched with one batched union query and cached per service request instead of loading a historical plan per section. Evidence results are batched. Readiness performs fresh evidence validation where required, including after provider completion. No production load test, measured latency guarantee or removal of all prior EF warnings is claimed.

## AM. Known limitations

Deterministic prose detection is a finite catalogue and can miss unsupported paraphrases; semantic/examiner review remains mandatory. Existing Phase 7 advanced structured design editing limitations remain. Compatibility for projects without any design participation is explicit rather than a dated rollout. Character ceilings and estimated tokens do not replace actual provider usage. No live providers, production-scale load, formal accessibility audit or successful lint run. Older typed proposal drafts without new generation assertions require explicit reconciliation. No historical immutable payloads are rewritten.

## AN. Research Design v1 completion recommendation

**RESEARCH DESIGN AGENT V1: READY TO FREEZE**. Freeze the Research Design architecture after final verification; maintenance should address demonstrated bugs, security defects and measured improvements. This implementation is not deployed and does not imply unperformed production validation.

## AO. Recommended next agent

Academic Reviewer Agent, as a separately authorized task. It should consume accepted canonical design, current section proofs and verified evidence to assess academic quality, while preserving the same ownership, budget, provenance and explicit acceptance boundaries. No reviewer work started during Phase 8.

Verification artifacts: `research-design-phase8-tests.json`, `research-design-phase8-build.txt`, `research-design-phase8/browser-results.json`, `research-design-phase8/phase7-regression/browser-results.json`; backend TRX files in `../Humaniser/HumaniseAI.IntegrationTests/TestResults/`. Desktop/mobile screenshots are in `research-design-phase8/`.
