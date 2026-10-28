# Research Design Agent — Phase 5 implementation

Date: 2026-10-06. Scope: verified evidence dependency resolution and bounded Deep Research handoff. No Phase 6 endpoints, UI, or proposal integration were added.

## A. Phase 4 verification

Before implementation, the Research Design and Proposal Workflow selection passed **278 tests, zero failures or skips**. Existing immutable specification authority, expected-revision checks, project locks, generation fences, and atomic acceptance were retained. CodeGraph was attempted first; its database could not be opened, so investigation used current source and targeted searches. Both repositories already contained substantial unrelated changes.

## B. Infrastructure reused

Reused `EvidenceNeed`, Research Design runs and workflow artifacts; existing Deep Research sessions, modes, runner, provider tools, source assessment, verified packages, sufficiency evaluator, model routing, usage recording, credit reservation, and Hangfire. The bridge is an application-controlled coordinator, not an agent conversation or another search stack.

## C. Files changed

Backend paths are relative to `../Humaniser`.

- New DTO: `HumaniseAI.Application/DTOs/Research/ResearchDesignEvidenceContracts.cs`.
- New Research Design services: `ResearchDesignEvidencePolicy`, `ResearchDesignEvidenceContext`, `ResearchDesignEvidenceHandoffService`, and partial lifecycle/revalidation implementations under `HumaniseAI.Infrastructure/Services/ResearchDesign/`.
- New Deep Research adapter and dispatch guard under `HumaniseAI.Infrastructure/Services/DeepResearch/`.
- Extended existing evidence contracts, run entity/configuration, lifecycle/state machine/impact analysis, Deep Research model/store/runner/job/LLM adapter/reuse/service, pricing lookup, dependency injection, and recurring-job registration.
- Added evidence unit, recovery, and PostgreSQL tests plus six versioned golden fixtures. The existing PostgreSQL test class became partial to reuse its harness.
- Added the checkpoint migration and EF snapshot update. Frontend changes are this report and the offline migration SQL only.

## D. Persistence

`ResearchDesignRun.EvidenceWorkflowJson` stores the operational checkpoint: frozen limits and policy fingerprint, requested needs, handoffs, allocations, outcomes, and immutable package bindings. Evidence does not become a second canonical design. Accepted JSON and historical hashes are untouched. Deep Research worker fencing and dispatch allowances use its existing persisted state JSON.

## E. Migration

Created `20261006055645_AddResearchDesignEvidenceCheckpoint`: one non-null PostgreSQL `text` column on `research_design_runs`, default `{}`. No development database migration was applied. Disposable test databases exercised migrations, rollback, and reapplication. Reviewable offline SQL: [research-design-phase5-migration.sql](research-design-phase5-migration.sql).

Rollback drops the operational checkpoint. Quiesce and settle handoffs before rollback; otherwise allocation/binding recovery information would be lost. Canonical specifications, profiles, runs, and immutable artifacts are preserved by this migration's Down operation.

## F. Evidence needs

The existing closed need taxonomy remains authoritative. Optional typed period/year/peer-review constraints were added without rewriting accepted payloads; absent constraints are omitted from serialization. Dependency construction validates component ownership, stable IDs, question/scope limits, and supported constraints.

## G. Mode mapping

Instrument and operationalisation needs use Measurement Instrument; effect/design/qualitative methodology use Methodology Evidence; population estimates use Evidence for Claim; confounding uses Relationship Investigation; framework uses Theoretical Framework. Ethics evidence is explicitly unsupported by this adapter and remains unresolved for jurisdiction-specific review. Unknown types never fall back to an arbitrary mode.

## H. Coordinator

The internal handoff service resolves owned paused runs under the existing project lock. It checks reusable evidence, creates bounded typed investigations when necessary, reconciles terminal outcomes, binds immutable packages, and selectively revalidates. Recurring recovery runs once a minute under the existing recurring-job enablement gate. No public API was introduced.

## I. Provenance

Bindings carry need, handoff, session, question, package artifact/hash, dependency key, policy version, supporting/opposing source IDs, limitations, and timestamp. Current source decisions and exclusions are checked again during evidence loading and acceptance. First-design evidence works before an accepted specification exists.

## J. Deduplication

Normalized exact dependency keys include type, sorted component IDs, subject, question/scope, population, geography, linked questions, eligibility, constraints, and policy. Equivalent distinct need IDs can share a handoff. Population or scope changes invalidate reuse. Reuse scans the latest 100 owned project sessions; this intentionally conservative bound may miss older reusable evidence.

## K. Compact request

The adapter sends a typed subject/scope, population/geography/date constraints, and one seeded question. It does not send a whole proposal, conversation, arbitrary agent instruction, or unrestricted provider query. Application code derives ownership and correlation identifiers.

## L. Verified package

The existing `VerifiedEvidencePackageDto` is preserved in an immutable workflow artifact. Binding checks schema, recomputed content hash, owned session/question identity, dependency scope, and terminal outcome. A package completion flag alone is insufficient.

## M. Source verification

Eligible sources must currently be verified, accepted, assessed, and relevant to the required topic/population/geography; required year and peer-review filters apply. Source identity, question provenance, and supporting quotation in the supplied abstract are checked. This is abstract-grounded verification using the existing assessment stack, not a claim of full-text or methodological certification.

## N. Outcomes

Supported, Contradicted, InsufficientEvidence, ProviderUnavailable, Failed, Cancelled, BudgetExhausted, UnsupportedEvidenceNeed, and Stale are distinct typed outcomes. Provider failure does not establish absence of evidence. Neither insufficient evidence nor package gap suggestions are converted into a design research gap.

## O. Contradictions

Qualifying opposing/null findings remain visible even when their support grade differs from affirmative evidence. Bindings preserve both sides. Contradictions conservatively keep the dependency unresolved; the bridge does not adjudicate away inconvenient evidence.

## P. Sufficiency

The existing mode/type sufficiency evaluator runs on eligible current sources. Instrument evidence attaches provenance references; effect evidence does not automatically select, pool, or overwrite numeric assumptions. A supported dependency does not certify a chosen effect parameter, instrument adaptation, or entire study.

## Q. Resumption

Persisted checkpoints resume handoffs after restart without creating another investigation or repeating credit reservation. Parent input/policy changes supersede stale work. Evidence arrival does not enqueue the methodological reasoning job. A run without a usable candidate remains RequiresInput.

## R. Selective revalidation

Dependency impact traverses the existing component graph while avoiding generic evidence-to-whole-design feedback. Unaffected findings can be carried only from a current fingerprinted readiness result. Impacted measurement, analysis, sample adequacy, feasibility/ethics, and evidence rules rerun deterministically. A new immutable result artifact records the revised evidence references, findings, fingerprints, and readiness.

## S. AI boundary

There are **zero automatic Research Design reasoning calls after evidence arrives**. Deep Research still uses its existing assessment/synthesis capability, through an opt-in bounded dispatch guard. An unresolved methodological judgment remains actionable input rather than triggering an unrestricted AI rerun.

## T. Loop limits

Defaults: at most eight needs, one concurrent child, and one automatic evidence cycle. Hard configuration bounds cap expansion. Newly discovered needs do not recursively spawn design-to-research-to-design loops. Recovery retries scheduling/checkpoints, not an ambiguous completed external action.

## U. Budgets

Default run allowances are eight minutes, estimated USD 0.50, and total parent/child reserved-plus-consumed credits capped at 100. Each investigation is capped at six search queries, four LLM calls, and 24,000 tokens. Limits are snapshotted and constrained by existing Deep Research policy. Credit reservation and settlement use the existing ledger transactionally.

LLM calls reserve conservative token/cost allowance before dispatch and allow one physical completion attempt, without implicit fallback. Unknown pricing fails closed. Observed cost remains nullable when unavailable; external provider fees are not presented as zero. These allowances are deliberately conservative and are not an actual-cost guarantee.

## V. Cancellation

Parent cancellation persists cancellation requests for owned children in the parent transaction. Active workers settle when they terminate; recovery handles expired workers. Late evidence cannot advance a cancelled or superseded parent. Reusing another parent's active session does not grant cancellation ownership over that session.

## W. Leases and idempotence

Bridge workers acquire an atomic persisted token. Saves and lease release reject an obsolete token. Duplicate scheduling, dispatch, binding, and settlement are tested. A persisted pending external action after a crash produces an explicit ambiguous-outcome failure instead of redispatching potentially paid work. Provider-side exactly-once execution is not claimed.

## X. Staleness

Input, population, geography, revision, policy, package hash, source rejection/retraction/exclusion, and scope changes invalidate dependent support. The accepted specification remains immutable. Currentness checks run during recovery, evidence loading, revalidation, and acceptance.

## Y. Readiness and acceptance

Deep Research can return evidence outcomes only. Application-owned deterministic revalidation may transition RequiresEvidence through ValidatingEvidence to ReadyForReview only when all current readiness gates pass. Explicit acceptance additionally requires settled supported handoffs and the existing full validation, ownership, concurrency, and generation fences. Methodology profile and canonical revision remain in the same acceptance transaction.

## Z. Providers

Existing search/provider tools are reused. Deadline cancellation covers the bridge runner; partial provider failure stays distinct from insufficient evidence. A provider that ignores cancellation can leave an uncertain external outcome, which recovery treats conservatively. No live model or literature-provider calls were made during implementation.

## AA. Security

Project/user/session/artifact ownership and correlation are checked server-side. Cross-project references and tampered package bindings fail closed. Untrusted source text remains evidence data, never an orchestration command. Existing credit and accepted-authority boundaries are preserved.

## AB. Telemetry

Immutable audit artifacts record categorical outcomes, correlation IDs, dependency/package hashes, allocation/settlement, known-cost status, impacted rules, and zero design-reasoning calls during revalidation. Bridge failure logs use identifiers and exception categories rather than source text or raw provider response bodies. This does not claim a repository-wide logging cleanup.

## AC. Added tests

Added **83 Phase 5 checks**: 45 policy checks, 15 recovery/guard/golden checks, and 23 PostgreSQL lifecycle checks. Coverage includes typed mapping, scope-sensitive deduplication, verification/hash failures, contradictions, outages, no-gap behavior, selective impact, protected numeric assumptions, restart, fencing, cancellation, deadlines, shared credits, ownership, concurrent dispatch/binding, source retraction, and migration roundtrip.

## AD. Golden cases

Six versioned deterministic fixtures cover instrument evidence, heterogeneous effects, insufficient evidence, provider outage, changed population, and contradiction. They assert methodological outcomes and no gap promotion. They are not paid-model quality evaluations.

## AE. PostgreSQL

Tests use disposable PostgreSQL databases and real migrations/transactions, including atomic acceptance before any prior accepted design, idempotent settlement, concurrent workers, rollback/default restoration, and stale source rejection. No development database state was changed.

## AF. Verification results

The final expanded regression selection passed **869 tests, zero failures, zero skips**, in 9 minutes 9 seconds (`research-design-phase5-complete.trx`). It covers Research Design, Proposal Workflow, methodology, RQ/objective CRUD/concurrency, analysis plans, compiler, Claude/model routing, credit reservation/release/wallet, Deep Research, source extraction, and citation claim support. This is the affected regression selection, not a claim that every repository test ran.

Earlier checks passed: baseline 278; intermediate core 564; recovery selection 121. The first expanded run had 868 passes and one new-test failure: an expected charge of 5 was incorrect for the existing policy, which correctly charged 7. The assertion was corrected; billing behavior was unchanged. EF's offline `has-pending-model-changes --no-build` check also passed: the model matches the latest migration snapshot.

## AG. Limits

No API/UI or production load evaluation was performed. Exact matching can miss semantically reusable evidence. Recovery and reuse scans are bounded at 100 rows; high-volume scheduling/index tuning remains future work. Ethics mapping and unsupported specialist judgments remain explicit unresolved boundaries. Source support is not automatic numerical parameter extraction or permission approval. Conservative dispatch reservations may exhaust allowances early. Rollback requires settled work. No development migration, API restart, or live provider/model execution occurred.

## AH. Recommended Phase 6

Expose the existing internal lifecycle through versioned authenticated endpoints with ownership, idempotency, expected-revision conflicts, read-only status, actionable evidence outcomes, cancellation, and explicit acceptance. Keep package provenance and unresolved findings visible. Do not bypass readiness or duplicate canonical authority. Stop implementation here until Phase 6 is requested.
