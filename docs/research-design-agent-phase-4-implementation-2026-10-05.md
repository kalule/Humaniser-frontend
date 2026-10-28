# Research Design Agent — Phase 4 implementation

Date: 2026-10-05. Scope: durable operational lifecycle and explicit atomic design acceptance behind internal application services. CanonicalResearchPlan remains the sole accepted academic authority. No public Research Design controller, frontend flow, automatic Deep Research handoff, proposal integration or live model evaluation was added.

## A. Phase 3 verification

Read the approved attachment and Phase 3 implementation report; inspected both dirty working trees, canonical contracts, validators, alignment, impact, authority guards, reasoning, routing, physical-attempt limits, credit repository, existing Deep Research checkpoint store, background jobs and canonical acceptance. Backend CodeGraph was attempted first and failed with `unable to open database file`; subsequent investigation used live source. Preserved unrelated work.

Before backend changes, reran the approved affected baseline: **469 passed, zero failed, zero skipped**, approximately seven minutes. Evidence: backend `HumaniseAI.IntegrationTests/TestResults/research-design-phase4-before.trx`.

## B. Existing infrastructure reused

Reuses AppDbContext, scoped IUserRepository atomic reservation/commit/release operations, IAiModelRouter, Phase 3 bounded completion and physical-attempt policy, existing usage attribution/recorder, immutable ProposalWorkflowArtifact results/audit records, Hangfire, canonical acceptance/projection code, methodology authority guards and ResearchDesignImpactAnalyzer. Verified evidence consumption reads the existing package-reuse projection; no provider/search framework was introduced.

## C. Files changed

Backend paths are relative to sibling `../Humaniser`.

| File | Purpose |
|---|---|
| `HumaniseAI.Domain/Entities/ResearchDesignRun.cs` | Operational run, lease, budget, idempotency, checkpoint and revision references. |
| `HumaniseAI.Application/DTOs/Research/ResearchDesignLifecycleContracts.cs` | Commands, closed lifecycle/failure categories, dispatch checkpoint boundary, execution snapshot and evidence attestation contract. |
| `HumaniseAI.Infrastructure/Data/Configurations/ResearchDesignRunConfiguration.cs` | Focused table, indexes, ownership/revision foreign keys and optimistic concurrency token. |
| `HumaniseAI.Infrastructure/Data/AppDbContext.cs` | Registers the run configuration. |
| `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignStateMachine.cs` | Deterministic transition validation. |
| `…/ResearchDesignLifecycleService.cs` | Owned commands, snapshots, leases, currentness/cache, resumable orchestration and recovery sweep. |
| `…/ResearchDesignExecution.cs` | Durable paid dispatch, replay and transactional credit settlement. |
| `…/ResearchDesignAcceptance.cs` | Currentness/readiness gates, bound methodology, canonical transaction and downstream invalidation. |
| `…/ResearchDesignJob.cs` | Hangfire execution and recovery; uncontrolled job retries disabled. |
| `…/ResearchDesignReasoningService.cs` | Optional lifecycle dispatch boundary; existing standalone Phase 3 behavior preserved. |
| `HumaniseAI.Infrastructure/Services/ProposalWorkflowService.cs` | Extracts existing acceptance core; typed acceptance joins the lifecycle transaction. Public legacy entry remains unable to bypass it. |
| `HumaniseAI.Infrastructure/Services/GenerationAuthority.cs` | Fence creation shares canonical acceptance’s project advisory lock. |
| `HumaniseAI.Infrastructure/DependencyInjection.cs` | Registers scoped lifecycle and job services. |
| `HumaniseAI.API/Program.cs` | Adds a bounded recovery sweep to existing recurring-job registration. |
| `HumaniseAI.Infrastructure/Migrations/20261005181131_AddResearchDesignDurableRuns.cs`, matching designer and model snapshot | One operational table; no accepted JSON schema rewrite. |
| `HumaniseAI.IntegrationTests/ResearchDesignLifecycleTests.cs` | Transition and illegal-transition categories. |
| `HumaniseAI.IntegrationTests/ResearchDesignPostgresTests.cs` | Real PostgreSQL lifecycle, billing, recovery, acceptance and migration checks with fake models. |
| `HumaniseAI.IntegrationTests/DeepResearch/EvidencePackageReuseTests.cs` | Corrects an older revision fixture to exercise the existing accepted-pointer guard and a coherent successor revision. |
| `HumaniseAI.IntegrationTests/ProposalWorkflowPostgresTests.cs` | Preserves database ownership testing and additionally asserts the earlier application authority guard. |

Frontend repository additions are this report and the reviewable [migration SQL](research-design-phase4-migration.sql). No frontend application code changed in this phase.

## D. Persistence decision

Existing workflow artifacts are append-only and cannot safely own mutable leases, cancellation, credit settlement and worker fencing. DeepResearchSession is tied to another workflow and lacks a lease-owner token. GenerationRun fences writer jobs rather than design candidates, input pauses and explicit acceptance. A dedicated **operational** ResearchDesignRun therefore stores those concerns; structured results remain immutable workflow artifacts. Accepted truth is referenced by ID rather than duplicated in an accepted-design table.

## E. Migration details

`20261005181131_AddResearchDesignDurableRuns` creates only `research_design_runs`, its ownership/accepted-revision foreign keys and indexes. Inspected generated Up/Down and SQL; no historical migration was edited and no unrelated table changes appear in its Up. The existing dirty snapshot and historical revisions were preserved.

The disposable PostgreSQL factory applies real migrations. A round-trip test migrates back to `AddCompilerPublicationMetadata`, verifies the operational migration is removed while the project survives, then reapplies it. Down drops operational runs, so deployment rollback loses run checkpoints; canonical revisions, bound profiles and workflow artifacts remain. Quiesce design workers and settle reservations before a deployment rollback. The development/production database was not migrated by this task.

## F. Run model

Stores project/owner, command key/hash, predecessor, governing accepted revision, status/stage, structured request and effective route/budget snapshot, complete input/state/evidence fingerprints, prompt/policy/schema versions, call/adjudication counts, physical-attempt allowance, reserved/consumed credits, attempt checkpoints, usage, immutable result ID/hash, reuse metadata, accepted revision/accept command, timestamps, cancellation, failure category, lease owner/expiry and application concurrency token.

It does not approve its own design or replace canonical JSON. Request/result data is owned research content; telemetry records categorical metadata rather than those bodies.

## G. State machine

`Created → LoadingResearchState → ClassifyingIntent → GeneratingCandidates → EvaluatingCandidates → BuildingDesign → ValidatingAlignment → ValidatingAnalysis → ValidatingFeasibility → ValidatingEvidence → ReadyForReview`.

Side states: RequiresInput, RequiresEvidence, Failed, Cancelled, BudgetExhausted and Superseded. Only explicit acceptance can move ReadyForReview to Accepted. Unknown, skipped, backward, self and terminal-state transitions fail with InvalidTransition. Idempotent commands can return existing state without performing another transition. The application maps provider outcomes; model output cannot select arbitrary operational states.

## H. Checkpointing

Persists initial inputs/policies, stage transitions, pre-dispatch attempts, successful structured responses together with credit settlement, final immutable results and pure validation stages. A persisted response is replayed through the same strict output parser, protected canonical merge and current validators. A result checkpoint resumes deterministic validation without provider work. No hidden model thought or complete rendered prompts are persisted by the design lifecycle.

## I. Idempotency

Create/resume commands use an owned-project command key plus payload hash, backed by a unique index. A repeated key with different input conflicts. Repeated cancellation is a no-op after cancellation. Worker duplicates cannot obtain an active lease; completed/paused runs do not run again. Result artifacts use the run ID as their idempotency key. Acceptance stores command key/hash and revision: the exact retry returns that same revision; another conflicting command cannot create a duplicate profile/plan/artifact.

## J. Lease/concurrency handling

Project-scoped PostgreSQL advisory transactions serialize operational mutations and share the canonical workflow lock domain. Each worker receives a durable random lease token with an expiry exceeding its bounded execution window; all updates check that owner. An application concurrency token additionally detects stale entity writes. Provider work occurs outside transactions. Expired leases allow recovery; an old worker cannot progress a run owned by a replacement.

GenerationAuthority fence creation now shares that advisory lock, preventing a new fence from appearing between acceptance’s fence check and commit. Existing generation fencing and verification remain intact.

## K. Cancellation

Cancellation is persisted, checked before paid work/repair, between stages, before result persistence and on acceptance. Provider output returned after cancellation is discarded; completed provider work is still settled once. Canonical state remains untouched. Cancelled workers that crash with a reservation are reconciled after their lease expires.

Hosting/worker-token cancellation is distinct from explicit user cancellation: it releases the worker lease and preserves a recoverable checkpoint. Recovery still observes the ambiguous-paid-attempt boundary described in V.

## L. Budget/credit enforcement

Does not increase Phase 3 limits: default one logical call/one physical attempt, hard maxima of two; optional adjudication/fallback remain disabled by default. Effective route/budget participates in the snapshot. Prepared attempts consume durable call, token and physical allowances before dispatch. Recovery restores those allowances, preventing a fresh in-memory counter from enlarging the run. The original run start also limits subsequent paid dispatch time.

Reservation and attempt preparation use one PostgreSQL transaction with the existing scoped credit repository. Successful provider response checkpoint, credit commit and unused-reservation release share another transaction. Failures release unused credits through the existing compensation policy. Unknown outcomes are not automatically retried. Costs/tokens remain unknown when actual provider usage or pricing is incomplete; unknown is never represented as zero. Existing AI usage recording remains the billing/usage authority.

## M. Fingerprinting

Input hash covers the full structured draft, RQ/objective/constraint graph, owning project/user/expected revision, evidence, taxonomy, prompt/schema/reasoning/deterministic policy and effective budget/router policy. Additional persisted state hash covers current canonical hash/pointer, bound methodology, project setup, compatibility questions/objectives/hypotheses, evidence artifacts and included source content/retraction state. Evidence has a separate hash. Resume, dispatch, checkpoint and acceptance recheck currentness. Changed inputs/versions supersede an old run; stale acceptance records that state and returns a typed rejection.

## N. Cache/reuse

Only current ReadyForReview runs for the same project and owner with exact input/state fingerprints can supply a result. Result artifact scope, hash and version are checked. Every candidate and selected readiness is deterministically revalidated; saved readiness/confidence is not an acceptance token. Reuse records originating run/cache status and incurs no new provider call or credit charge. Invalid fingerprints/changed drafts cannot reuse a result.

## O. RequiresInput resume

Missing inputs persist as structured result clarifications. A resume command supplies a full explicit structured draft and creates a new fingerprinted run; it atomically supersedes the paused predecessor. The old record remains available for audit. No hidden conversational memory is merged and no accepted JSON is edited in place.

## P. RequiresEvidence foundation

Typed pending needs and structured results survive pauses. Evidence context is loaded by the application, not accepted from the command body. Design-specific attestations must have owned verified package provenance, matching immutable package hash and an eligible source; detached/retracted/stale packages cannot confer support. Phase 4 introduces the read contract only: no service writes these attestations and no automatic Deep Research call exists. Phase 5 must verify design-specific purpose/component support before producing them.

## Q. Atomic acceptance

One outer transaction owns all acceptance work: project ownership and expected revision → current run/result hashes/versions → current deterministic readiness, zero blockers/majors and resolved inputs/evidence → stage new immutable MethodologyProfile → bind its version and compatibility subtype into the canonical draft → reuse canonical acceptance/projection core → update accepted pointer → compute impact and mark downstream sections stale → persist acceptance audit/run state → commit.

**The profile is never committed first as an independent operation.** The reused core may call SaveChanges within the outer transaction, but cannot commit it. A later failure rolls back its profile, plan, pointer, projections and artifacts. A PostgreSQL trigger test deliberately fails the later acceptance artifact write after those earlier saves and verifies complete rollback.

Typed methodological acceptance uses the Phase 2 rules rather than legacy unconditional framework/scale/unit and writer-publication requirements. Institution/source/ownership/projection checks remain. Document compiler and submission gates remain separate; accepting a design does not claim that a document is ready for publication.

## R. Acceptance concurrency

Expected canonical revision is mandatory and compared again under the project transaction lock. Simultaneous conflicting accept commands based on the same revision have exactly one winner. The loser receives StaleRevision. Exact accepted-command retries return the existing immutable revision even after an interrupted response. Cancellation, superseded state, active generation fences and unresolved findings block acceptance.

## S. Downstream invalidation

ResearchDesignImpactAnalyzer compares the prior canonical design (or the initial structured draft) against the new bound specification. Its component/section impact is recorded. As a conservative fallback, all populated sections are flagged for methodology staleness/re-review and previously approved sections become Edited. Old canonical JSON is untouched. Writer integration and more precise artifact dependency handling belong to Phase 8.

## T. Auditability

Immutable workflow records capture creation, transitions, lease recovery, dispatch allowance, settlement/discard, usage/reuse, worker interruption and accepted revision/impact. Include run/project/actor, input hash, versions, route and timestamps. Failure summaries are fixed categories. No raw provider error bodies, research content or complete prompts enter operational audit records. Owned request/result/response checkpoints are separate research data, not telemetry.

## U. Failure model

Closed failure categories include InvalidTransition, StaleInput, StaleRevision, ConcurrencyConflict, LeaseUnavailable, ProviderUnavailable, ProviderTimeout, InvalidModelOutput, BudgetExhausted, Cancelled, ValidationBlocked, EvidenceRequired, InputRequired, UnsupportedDesign, CreditReservationFailed, InternalFailure and AmbiguousProviderOutcome. Missing ownership returns the existing not-found convention. Currentness/readiness failures do not become acceptance; privacy-safe summaries do not include exception content.

## V. Recovery behavior

| Interruption point | Recovery |
|---|---|
| Before paid dispatch | Expired/interrupted lease can resume the run. |
| Dispatch prepared, no response checkpoint | Record AmbiguousProviderOutcome, release outstanding reservation and stop; do not pay for another attempt automatically. |
| Response and credits checkpointed | Replay structured response through the strict parser/validators without another charge. |
| Final result persisted / during validation | Repeat pure checks and continue from the persisted stage. |
| Explicit cancellation | Discard late output; reconcile an abandoned reservation after lease expiry. |
| Acceptance failure | Roll back everything; the same review result remains retryable unless it is stale. |
| Commit succeeded but response lost | The same command returns the previously accepted revision. |
| Queue outage or deployment | Persisted runnable rows act as an outbox; bounded recurring sweep re-enqueues them. |

Exactly-once external provider execution cannot be guaranteed without provider-supported idempotency/retrieval. The conservative unknown-outcome stop is intentional and visible; a lost response is not proof that the provider did no work.

## W. Tests added

**62 new checks** (20 lifecycle/transition checks and 42 disposable-PostgreSQL checks) cover legal/illegal lifecycle, duplicate commands/payload conflict, duplicate workers, active/expired leases, response/result/validation recovery, ambiguous paid operations, worker shutdown, cancellation before/during work and stranded reservations, budget/credit failure, provider compensation, exact reuse and changed drafts, RQ/evidence/policy/prompt/schema/route invalidation, structured input resume, evidence pause, acceptance freshness/blockers/input/evidence/fences, simultaneous/duplicate acceptance, complete rollback, profile/canonical coherence, conservative section invalidation, ownership, result tampering and migration rollback/reapply.

All providers are fake; PostgreSQL schema/transaction/constraint tests are real. Existing Deep Research and workflow fixture changes add authority assertions rather than weakening their original retraction, stale-result and database-isolation checks.

## X. Final test results

Expanded affected regression selection: **755 passed, zero failed, zero skipped**, duration **7 minutes 1 second**. Evidence: backend `HumaniseAI.IntegrationTests/TestResults/research-design-phase4-complete.trx`. Includes **233 Research Design checks** and **223 Deep Research checks**, plus ProposalWorkflow, methodology, RQ/objective/concurrency, analysis-plan, compiler, router/client and affected credit/wallet tests. This is an affected selection, not a claim that the entire repository suite ran.

After the last compatibility-subtype binding change/assertion, focused **latest-source verification passed 278 tests, zero failed, zero skipped**, duration **1 minute 40 seconds**. Includes all Research Design and ProposalWorkflow tests, including the real PostgreSQL acceptance, rollback, migration and concurrency checks. Evidence: backend `HumaniseAI.IntegrationTests/TestResults/research-design-phase4-latest-source.trx`.

Latest-source command: `dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter 'FullyQualifiedName~ResearchDesign|FullyQualifiedName~ProposalWorkflow' --verbosity quiet -p:WarningLevel=0 -p:NoWarn=MSB3277 --logger 'trx;LogFileName=research-design-phase4-latest-source.trx'`.

Expanded command: `dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter 'FullyQualifiedName~ResearchDesign|FullyQualifiedName~ProposalWorkflow|FullyQualifiedName~Methodology|FullyQualifiedName~ObjectivesAndResearchQuestionsCrudTests|FullyQualifiedName~ObjectiveAndResearchQuestion|FullyQualifiedName~AnalysisPlan|FullyQualifiedName~DocumentCompiler|FullyQualifiedName~ClaudeService|FullyQualifiedName~AiModelRouterTests|FullyQualifiedName~CreditReservationTests|FullyQualifiedName~PipelineFailureCreditReleaseTests|FullyQualifiedName~ToolCreditWalletTests|FullyQualifiedName~DeepResearch' --verbosity quiet -p:WarningLevel=0 -p:NoWarn=MSB3277 --logger 'trx;LogFileName=research-design-phase4-complete.trx'`.

Development findings: initial PostgreSQL run exposed duplicate EF profile tracking; corrected to reload the tracked profile. A subsequent build found an artifact initializer accidentally referencing an audit-only variable; corrected. The expanded regression selection found two older fixtures that conflicted with existing Phase 1 authority guards; they now assert those guards and retain direct database/new-revision coverage. No production guard or methodological assertion was relaxed.

## Y. Known limitations

Internal services only: no public API/UX or authenticated command boundary beyond trusted application callers yet. CI proves persistence/boundary behavior, not live methodological model quality. No live provider calls or production latency claim.

An ambiguous external outcome cannot be recovered into an invented result or automatically retried for free. Actual provider cost/usage may be incomplete after transport failure; reconciliation metadata preserves uncertainty. Recovery’s pure checks are repeatable; resumed paid calls remain within the original allowances and time limit. Large-source fingerprint computation is conservative and can be optimized with trusted versioned content hashes later.

The attestation-producing evidence adapter is deliberately absent until Phase 5. The current reader requires a current attached verified package; Phase 5 must also support evidence required before a first canonical acceptance, bound to the draft run fingerprint rather than assuming an accepted pointer already exists. Unsupported families/academic representations remain fail-closed. Accepted methodology is bound to canonical truth; downstream prose still requires the existing compiler/reviewer/generation gates. Conservative whole-document invalidation remains until finer dependency mappings are proven. Operational rollback drops checkpoints, so settle/quiesce before deployment rollback. No development database migration or running-API restart was performed.

## Z. Recommended Phase 5 scope

After explicit approval: connect persisted EvidenceNeeds to one bounded Deep Research handoff with owned run/need IDs, fixed attempts/calls/tokens/time/cost and no recursive agent loop. Validate methodological purpose/component scope and verified source/package provenance before creating attestations. Include first-design bootstrap evidence against the current draft fingerprint, avoiding a circular requirement for an already accepted design. Recompute fingerprints, supersede the paused run and revalidate the new structured input; never auto-accept a design. Keep public API, simple UX and writer integration as subsequent phases.

**Stop after Phase 4.**
