# Research Design Agent — Phase 6 implementation

Date: 2026-10-06. Scope: application facade and versioned HTTP API over Phases 1–5. No frontend UX, Proposal Studio integration, new intelligence, methodology rules, evidence rules, provider clients, or migrations.

## A. Phase 5 verification

Inspected both dirty working trees and the Phase 5 report. CodeGraph was attempted first and failed to open its database; investigation used current source thereafter. Re-ran the affected Phase 5 baseline: **869 passed, zero failures, zero skips**, in 8 minutes 38 seconds (`research-design-phase6-before.trx`). Existing unrelated work was preserved.

## B. Infrastructure reused

| Existing component | Phase 6 responsibility | Treatment |
|---|---|---|
| Research Design lifecycle/project lock | Durable commands, version checks, cancellation, acceptance | Reuse; add API guards inside its existing transaction |
| Canonical plan/workflow | Server-loaded specification and accepted revision | Narrow read adapter; no second design authority |
| Immutable result/workflow artifacts | View findings/candidates and durable command provenance | Reuse |
| Phase 5 handoffs/source eligibility | Evidence summaries and current support | Reuse; batch database reads without changing rules |
| ASP.NET API versioning/BaseController/JWT | Versioned authenticated routes and success envelopes | Reuse |
| Existing exception/billing conventions | Safe typed errors, 402 where applicable | Adapt without a second billing policy |
| Plan-based limiter | Per-user mutation limits | Extend; leave read endpoints unmetered by this limiter |
| Hangfire/jobs/sweeps | Short HTTP commands and durable recovery | Reuse |
| Swagger/request logging | Contracts and categorical telemetry | Extend existing registration |

## C. Files changed

Backend paths are relative to `../Humaniser`.

New:

- `HumaniseAI.Application/DTOs/Research/ResearchDesignApiContracts.cs`.
- `HumaniseAI.Application/Services/IResearchDesignApplicationService.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignApplicationService.cs`.
- `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignApiGuards.cs`.
- `HumaniseAI.API/Controllers/ResearchDesignController.cs`.
- `HumaniseAI.IntegrationTests/ResearchDesignApiTests.cs`.

Extended existing lifecycle commands/acceptance, canonical draft reads, evidence-context reads, dependency injection, plan rate limiting, and the PostgreSQL test harness. Frontend repository changes are documentation only: this report and [API reference](research-design-api-v1.md).

## D. Application service architecture

`IResearchDesignApplicationService` owns the HTTP-independent command/query facade. It authorizes project/run access, loads server-owned state, maps explicit DTOs, and invokes the runtime. The controller binds requests, calls the facade, translates errors/statuses, and records categorical metadata. Reasoning, validation, source sufficiency, credit settlement, evidence orchestration, and canonical acceptance stay in the existing runtime.

## E. Contracts

Explicit view, candidate, question/value, finding, readiness, evidence, progress, budget, history, and command-result contracts. Mutating request types disallow unknown properties. No EF entities are serialized. Existing canonical value contracts are reused where they contain product-relevant structured research data, not operational state.

## F. ResearchDesignView

One project query returns the latest relevant run or canonical/imported setup, its structured design and alternatives, alignment, methodological components, evidence, findings, questions, readiness, logical version, and actions. Historical superseded or authority-mismatched terminal runs remain available through run/history queries. Irrelevant nullable methodological sections are omitted. Provider responses, search queries, leases, checkpoints, fingerprints, and pricing are absent.

## G. AllowedActions

Backend policy derives actions from existing lifecycle semantics and current gates. Created is already queued, so it offers Cancel. RequiresInput offers ProvideInput only when an active clarification has a supported schema; unsupported clarification remains visible. ReadyForReview offers Accept only when current deterministic readiness/evidence/fences permit it. Accepted supports View/Revise; eligible stopped runs support Restart through the revision command. Stale unfinished runs retain Cancel; historical terminal runs offer View. Locked commands independently revalidate permission and concurrency.

## H. Progress

Durable stage, phase, start time, parent execution elapsed time, and an explicit revalidation flag. No invented percentage or ETA. Evidence summaries have their own current research status and update time; parent paused execution time is not presented as a provider completion estimate.

## I. Start endpoint

`POST /api/v1/research/projects/{projectId}/design/runs` accepts only an idempotency key and expected canonical revision. It loads canonical/imported state server-side, persists work, queues the existing job, and returns. A compatible current active run can be returned without another run or charge; a durable alias in existing artifacts protects retries with the second key. Incompatible active work conflicts. Existing current accepted/stopped runs use revision/restart rather than an unlinked new start.

## J. Current-design endpoint

`GET .../design` returns the coherent view. It is read-only: it does not create runs, advance stages, bind evidence, reserve credits, schedule work, or call providers.

## K. Run endpoint

`GET .../design/runs/{runId}` checks both owner/project access and run membership. Invisible or mismatched resources use 404 without existence details.

## L. RequiresInput endpoint

`POST .../runs/{runId}/input` accepts an active question UUID, exact logical version, idempotency key, and typed value. Stable question identities bind the question/field/reason to its run. Supported text fields are research problem, target population, geography, temporal scope, sampling frame/rationale. ResearchAccess requires three explicit boolean confirmations. Unsupported specialist/structural questions are marked unanswerable, not interpreted as arbitrary patches. Input creates a successor through existing Phase 4 resumption semantics; the old paused run is superseded atomically.

## M. Evidence representation

Need/type/reason, mandatory status, outcome, current support count, contradictions, limitations, update time, and safe research status. Pending child summaries load in one query. Resolved bindings remain visible after the engine clears pending needs. Current eligibility can mark support stale and disable acceptance. No insufficient-evidence-to-gap conversion or provider-outage-to-absence inference is added.

## N. Findings

Explicit mapping preserves canonical rule IDs, severity, affected component IDs, observed/expected values, and repair guidance. Mapping generates no findings, changes no severity, and claims no automatic resolution.

## O. Readiness

Stored methodological findings/counts are mapped; current source, revision/profile/version, readiness, and generation checks constrain `canAccept`. Confidence is not an acceptance input. Reads do not claim the complete transactional fingerprint check has already committed: acceptance repeats all runtime guards, and intervening changes can conflict.

## P. Acceptance endpoint

`POST .../runs/{runId}/accept` takes version/revision/idempotency only. The facade chooses the stored recommended candidate and invokes Phase 4 acceptance. Its new logical-version check runs under the existing lock, after exact replay detection. Methodology profile and canonical plan/projections remain staged and committed in **one transaction**; no independent profile save was introduced. Blockers, inputs, evidence, source staleness, cancellation, and generation fences still block acceptance.

## Q. Revision/reopen

`POST .../runs/{runId}/revisions` creates a linked durable successor using current canonical state for an accepted design, or the applicable stored draft for an eligible stopped/review run. Accepted runs/revisions remain immutable. Restart is an explicit student command and uses existing bounded reasoning; evidence arrival still does not rerun that reasoning automatically.

## R. Cancellation

`POST .../runs/{runId}/cancel` reuses cancellation logic, now factored into a shared runtime helper. API replay is recorded in existing workflow artifacts under the project lock. A matching repeat succeeds; accepted canonical state cannot be cancelled. Owned evidence cancellation propagation is unchanged.

## S. History

Owner-scoped newest-first run summaries, maximum 50 rows plus one lookahead, with an owned UUID cursor. No complete event/audit history or source corpus is returned.

## T. HTTP/errors

Uses existing success/error envelopes rather than introducing a parallel ProblemDetails convention. Stable Research Design codes distinguish invalid schema, not found, stale revision/input, invalid state, concurrency, unresolved validation/input/evidence, credit failure, and internal failure. 200 reads/replays/completed commands; 202 newly persisted background work; 400 schema; 401 anonymous; 404 invisible; 409 conflicts; 422 deterministic gates; existing 402/429 conventions. Messages and correlation IDs are safe; raw exception/provider bodies are not returned. Automatic DTO-validation errors are normalized for this controller only.

## U. Idempotency

Reuses run command keys/hashes, acceptance keys/hashes, project locks, and unique existing artifact keys. API start/resume/revision hashes bind the typed request rather than changing server state, so a replay remains a replay after later work. Compatible-start aliases and cancel receipts use existing artifacts; no controller idempotency store/table was added. Legacy Phase 4 hash behavior remains unchanged when API metadata is absent.

## V. Concurrency

Logical UUID `version` is the run's existing concurrency token, not an EF byte-array RowVersion or a client-derived fingerprint. Input/revision/cancel/accept check it in the runtime transaction. Expected canonical revision is independently enforced. Tests cover same/different-key simultaneous acceptance producing one new canonical revision.

## W. Authorization/security

Owner-only proposal project access matches the existing runtime. Anonymous, other users, missing runs, and an existing run placed under another owned project are tested. No collaborator policy is invented. Unknown properties, readiness/blocker overrides, arbitrary patches, malformed GUIDs/enums, stale questions, and oversized answers are rejected. Requests are capped at 16 KB; answer text has narrower field limits.

## X. Background execution

HTTP does not call the reasoning job, providers, or evidence runner. It queues existing durable processing. The persisted Created row is the existing sweep/outbox fallback if enqueue fails. Readiness and acceptance use deterministic checks, not provider execution. Polling is the v1 contract; no realtime stack was added.

## Y. OpenAPI

Existing ASP.NET API versioning and Swagger register the v1 controller, explicit success-envelope schemas, request/view/error contracts, and statuses under Research Design. Registration is checked through the real Swagger HTTP document. Examples and command semantics are in the [API reference](research-design-api-v1.md).

## Z. Telemetry

Existing request logging/correlation plus categorical ResearchDesignApi operation, result type, HTTP status, latency, idempotency indication, run/project IDs, stage, and status. No complete research text, prompts, source bodies, or model output is logged by the adapter. Existing immutable runtime audits still capture command/acceptance/evidence provenance.

## AA. Query behavior

Narrow projections omit `SectionContentJson` and paid `AttemptsJson` from the main view path. Result loading uses its exact owned artifact ID; candidate/finding/alignment mapping adds no per-item queries. Current evidence reads batch sessions/artifacts and load exclusion metadata once; legacy package reads are reused across attestations. Tests instrument real EF commands, cap both supported-evidence and ordinary ready views at 18 queries, and reject source-body/proposal/checkpoint-body column fetches. This is a query-shape safeguard, not a production load/latency benchmark.

## AB. Tests added

New Phase 6 checks cover all major action states, start/replay/compatible aliases, stale/incompatible starts, owner/run isolation, typed input, stale questions/versions/schema, duplicate/different input, acceptance and blockers, evidence/input gates, cancellation/restart, immutable revisions, concurrent acceptance, asynchronous credit failure, source retraction, bounded history, actual HTTP auth/binding/errors/mass assignment/oversized requests, Swagger, shared rate limits, and bounded read-only SQL.

## AC. Golden HTTP scenario

The real HTTP/controller/application/runtime path starts a durable run, polls RequiresInput/actions, submits a typed answer, resumes to RequiresEvidence, resolves a fake verified investigation, selectively revalidates with no extra design AI call, polls ReadyForReview, and explicitly accepts/replays acceptance. Assertions cover two linked runs, one evidence session, one new canonical revision/acceptance audit, correct credits with zero outstanding reservation, versioned state, and visible verified provenance. Provider calls and job dispatch are fakes; PostgreSQL transactions and application services are real. The starting canonical specification is fixture input, not an acceptance bypass exposed by the API.

## AD. Final verification

Final affected regression selection: **932 passed, 0 failed, 0 skipped**, including **63 new Phase 6 checks** (baseline: 869). Final result: `HumaniseAI.IntegrationTests/TestResults/research-design-phase6-final.trx`, duration 11 minutes 10 seconds. This includes the final case-insensitive and `v1.0` rate-limit route checks. Offline EF model verification reported no pending model changes. Migrations created: **0**; development migrations applied: **0**; development database changes: **0**; live provider calls: **0**.

Completed intermediate selections: 56 API/application checks passed; 121 API/evidence/query checks passed; then 122 policy/API/evidence checks passed. The expanded API run exposed a genuine nested-record length-validation defect, which was corrected. Other development failures were fixture login IP rate limits, an unset mock reset time, and diagnostic instrumentation that did not capture commands; tests now use the existing randomized IP convention, realistic limiter results, and EF command interception. Production rate limiting was not disabled.

## AE. Known limitations and operational discipline

- Phase 6 adds **no migration** and applies **no development migration**. The Phase 5 migration remains a deployment prerequisite on databases missing its checkpoint column. The development database was not changed or the API restarted.
- No live model or literature-provider calls were made. Existing regression factories and new scenarios use fakes; disposable PostgreSQL databases run migrations normally.
- The API exposes supported typed clarification schemas; it does not accept arbitrary structural design edits or manufacture schemas for unknown model fields. Unsupported questions remain visible and need the canonical specification workflow or a future explicit typed adapter.
- Existing engine setup requirements remain: confirmed methodology and suitable structured specification input. Legacy imported data is not silently certified or promoted into an accepted design.
- Read actions are a current application view, not a transactional acceptance guarantee. Complete fingerprint checks still occur in commands. Poll/reload on conflicts.
- Restart/revision is a new explicit bounded run and may spend credits through existing policy. It is not automatic evidence-driven reasoning.
- Only the affected regression selection is claimed, not every repository test. No production load test or paid-model methodological evaluation was performed.

## AF. Recommended Phase 7

Build a simple React client around this one view and its advertised actions: stage/status, typed questions, candidate comparison, deterministic issues, evidence progress/provenance, and explicit acceptance. Use the returned version/revision on commands and show safe conflicts. Keep lifecycle/readiness rules on the backend. Do not introduce Proposal Studio integration until the separate Phase 8 request. Implementation stops at Phase 6.
