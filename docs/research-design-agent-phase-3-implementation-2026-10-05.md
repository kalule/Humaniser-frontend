# Research Design Agent — Phase 3 implementation

Date: 2026-10-05. Scope: bounded AI reasoning behind an internal application service. Phase 1/2 deterministic policy remains authoritative. No live/paid provider calls were made during implementation or tests. Phase 4 has not begun.

## A. Phase 2 verification

Inspected both dirty working trees and the Phase 2 report, canonical contracts, deterministic validators, authority, alignment, impact and evidence handling. Backend CodeGraph was attempted before source exploration and failed with `unable to open database file`; subsequent findings use live source. Verified **120 deterministic rule IDs** remain in the Research Design implementation.

Before implementation, reran the approved affected baseline: **343 passed, zero failed, zero skipped**, duration **4 minutes 31 seconds**. Inspected `IAiModelRouter`/`AiPolicy`, `IClaudeService`, atomic `IUserRepository` credit reservations, `ProposalAiCallContext`, `IAiUsageRecorder`, physical `LlmAttemptHandler`, prompt versions, `LlmJsonParser` and verified Deep Research package contracts. Preserved unrelated modifications.

## B. Files changed

Backend paths are relative to sibling `../Humaniser`.

| File | Change |
|---|---|
| `HumaniseAI.Application/DTOs/Research/ResearchDesignReasoningContracts.cs` | New versioned advisory output, comparison, clarification, proposal, usage and configurable budget contracts. |
| `HumaniseAI.Application/Services/BoundedCompletion.cs` | Shared physical-attempt budget and bounded request, including optional measured token count. |
| `HumaniseAI.Application/Services/IClaudeService.cs` | Explicit bounded completion/counting entry points; unsupported implementations fail closed. Existing signatures preserved. |
| `HumaniseAI.Infrastructure/Services/BoundedCompletionScope.cs` | Scoped execution control and HTTP request budget keys. |
| `HumaniseAI.Infrastructure/Services/ClaudeService.cs` | Existing client gains bounded completion/counting, route ceilings, cancellation, truncation/byte rejection and sanitized diagnostics. Legacy calls retain their existing behavior. |
| `HumaniseAI.Infrastructure/Services/LlmAttemptHandler.cs` | Enforces the shared budget before physical HTTP retries; initial sends are reserved before entering the HTTP pipeline. |
| `HumaniseAI.Infrastructure/Services/LlmJsonParser.cs` | Shared strict-object parsing entry point; existing lenient parsing unchanged. |
| `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignContextBuilder.cs` | Compact, bounded context and project/authority/version/route/budget fingerprints. |
| `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignPrompts.cs` | Versioned application instructions and narrowly scoped adjudication instructions. |
| `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignOutputBoundary.cs` | Closed schema, reference, fact-preservation and claim checks; canonical proposal merge. |
| `HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignReasoningService.cs` | Owned-project preflight, routed/metered reasoning, optional adjudication/fallback and deterministic post-validation. |
| `HumaniseAI.Infrastructure/DependencyInjection.cs` | Registers the internal service and `ResearchDesign:Reasoning` options. |
| `HumaniseAI.IntegrationTests/ResearchDesignReasoningTests.cs` | Fake-provider boundary, budget, currentness, routing, privacy, cancellation and readiness tests. |

No new canonical aggregate, EF entity, migration, public controller, UI, durable checkpoint, automatic Deep Research handoff or proposal writer integration was introduced. Existing accepted revisions and methodology authority guards are unchanged.

## C. Context builder

Includes problem/title, field/level, applicable geography/population/unit/time, scope/framework/institutional requirements, primary/secondary questions, objectives, constructs, analysis/source/instrument requirements, current typed design, constraints, relevant verified evidence and unresolved deterministic findings/needs. It excludes proposal chapters, project history, raw provider responses/logs and full literature corpora.

Hard component limits: 20 questions, 30 objectives, 30 constructs and 20 analyses. Relevant evidence is sorted deterministically, limited to 10 scoped sources and five hash-matched summaries of at most 600 characters. The context byte ceiling defaults to 48,000. Oversized structured context is rejected, not silently truncated into a different research question. Excerpt shortening is limited to advisory evidence summaries; full evidence dependencies participate in the fingerprint.

## D. Intent classification

Uses the existing structured primary-question intent when unambiguous. No keyword classifier or extra classification call is introduced. When structured intent is unresolved, the single primary reasoning call includes tentative intent classification. The output supports primary/secondary intent, confidence, ambiguity, assumptions and clarification. Resolved intent cannot be silently replaced in the classification envelope. Ambiguity requires a specific question; history/synthesis cannot be forced into supported empirical candidates.

## E. Candidate generation

One to three candidates, never a mandatory quota. Each contains stable candidate ID, approach, supported intents, rationale, strengths, limitations, assumptions, verified evidence references, feasibility concerns, unresolved inputs, confidence, comparison and a canonical-component proposal. Family/subtype are carried by existing `StudyDesignContract` discriminators and closed design enums, rather than a competing design representation.

## F. Candidate comparison

Requires exactly one assessment and nonempty reason for each of 14 dimensions: question fit, objective fit, evidence support, population fit, data requirements, analysis requirements, feasibility, timeline, sample access, complexity, academic level, ethical burden, unresolved evidence and methodological risk. Assessments are `Suitable`, `Conditional`, `Unsuitable` or `Unknown`. No opaque composite score is accepted.

## G. Recommendation contract

Requires a candidate ID belonging to the returned set, concise rationale, tradeoffs, assumptions, permitted evidence references, unresolved inputs and bounded confidence. Recommendation/confidence are advisory. A recommended candidate with deterministic blockers or majors returns actionable input/evidence status, never a model-conferred readiness flag.

## H. Structured design proposal

Uses existing `SpecificationQuestion`, `SpecificationObjective`, `SpecificationConstruct`, `SpecificationAnalysis` and `StudyDesignContract`. Preserves the existing node-ID sets; no additions/deletions or unknown edges are accepted. Suggestions are merged into a new in-memory draft, never written over accepted JSON.

Sampling parameters, counts, effect assumptions, instruments/source availability and study sample contracts are outside editable output. Measurement/provenance facts, resource constraints, research characteristics, existing evidence decisions/needs and applicable framework authority cannot be overwritten or cleared. Missing new nodes/instruments become typed requirements for later structured editing rather than invented records. This intentionally bounds Phase 3 to refinements of the supplied canonical graph.

## I. Model-routing integration

Resolves `AiCapability.ComplexReasoning` through the existing router using the loaded user's plan. No provider or model name is hardcoded in Research Design. Passes model, input/output ceilings, timeout, temperature, prompt-cache eligibility and fallback policy through the existing client. A null temperature uses the bounded client's explicit default of zero. Response caching remains unimplemented until Phase 4.

The current route's 8,000-token ceiling is enforced during preflight. A conservative UTF-8 bound plus framing allowance establishes fit when possible; otherwise the existing token-count endpoint is used through a bounded single-attempt wrapper. The provider's returned count is passed to completion. Count requests are non-generating auxiliary requests, tracked separately from reasoning calls, under the same overall deadline. Counting failure never bypasses the ceiling. The provider documents token counting as an estimate that can differ slightly from actual generation usage; it supports the same structured system input, including cache-control blocks, without generating a message. The reserved input allowance is therefore preflight metadata, distinct from actual recorded tokens. [Official token-count documentation](https://platform.claude.com/docs/en/build-with-claude/token-counting).

## J. Reasoning budget

Defaults: **one logical reasoning call, one physical generation attempt**, 24,000 total input-token allowance, 12,000 output-token allowance, 100,000 response bytes and 120-second overall limit, further restricted by route policy. Both logical calls and physical generation attempts have hard configuration bounds of at most two. Adjudication and fallback are disabled by default.

One primary call plus one optional adjudication **or** fallback is possible when explicitly enabled and budget remains. Transport retries consume physical allowance before sending; they cannot become invisible extra generation calls. Token allowances reserve for remaining physical attempts. Each required count operation has its own one-attempt cap and cannot recursively retry/fallback.

Uses the existing atomic credit reservation/commit/release ledger and existing relational-review credit cost per physical generation attempt. Reserves the worst remaining credit envelope, commits successful used attempts and releases unused reservation. Successful provider output is charged even if schema validation later fails. Provider failure follows existing reservation-compensation behavior.

An optional USD cap uses the existing configured `ModelPriceRates`, reserving a worst output/input envelope including higher cache-write/read rates where relevant. Missing/incomplete pricing is unknown; a configured cap fails closed. Existing `AiUsageRecorder` remains the actual usage/cost ledger. Result `ActualCostUsd` stays null where a complete billing figure is unavailable.

## K. Targeted adjudication

Only one eligible intent/causal finding may trigger a second call. Its context contains the affected question, linked objectives, selected design, finding and permitted repair contract, rather than the original research corpus. Outcomes: narrow RQ wording, select a supported different design, require input/evidence or cannot resolve. Repairs cannot alter unrelated components or factual population/unit/geography scope. Every repair is schema/reference checked and deterministically revalidated. No generic malformed-output repair or open-ended LLM/validator loop exists.

## L. RequiresInput handling

Missing critical problem/population/questions or known unavailable access/permissions pauses before a paid reasoning call. Model clarification is explicit, specific and limited to three questions per clarification collection; the main clarification envelope also has a combined three-question cap. Ambiguous intent and unresolved selected-candidate/recommendation inputs remain visible. The model is instructed not to ask students questions the system can determine itself.

## M. RequiresEvidence handling

Reuses existing typed `EvidenceNeed` records and closed purposes. Needs require valid stable ID, existing affected component IDs, scope/question and closed priority. Existing unresolved needs cannot be removed by the model. Needs are attached to proposed drafts and validated; no search or automatic Deep Research invocation occurs. Evidence insufficiency/provider unavailability cannot become a research-gap claim.

## N. Hallucination safeguards

Application-owned facts are protected structurally; proposed output cannot contain sample results or new authoritative numeric assumptions. Evidence references must exist in the supplied owned, non-retracted, hashed context. No model assertion upgrades evidence status. Instructions prohibit invented citations, statistics, psychometrics, approvals, requirements and resource availability. A conservative prose screen rejects new citation identifiers/URLs, selected statistical claims, approval assertions and unsupported validation claims. This screen supplements structural guards; it is not proof that every possible natural-language claim is true.

Evidence excerpts and all research strings are explicitly untrusted data. Embedded commands cannot add `Accepted`, `Validated` or `ReadyForReview` fields to the closed output. Tests exercise an injected acceptance instruction and confirm rejection without authority writes.

## O. Structured-output/schema handling

Shared strict-object parsing rejects markdown fences, trailing prose, malformed/truncated JSON, wrong root type, duplicate JSON properties, unknown members, case/enum errors, missing/null required fields, oversized arrays/strings/bytes, unknown/duplicate/removed IDs, unsupported designs/intents, unknown safeguard edges, inconsistent approach and incomplete comparison/recommendation records. No extraction of decisions from prose or coercion to default methodology values occurs.

Schema failure is a typed `Invalid` reasoning result. Operational outcomes also include provider failure, timeout, cancellation, budget exhaustion and stale input. The client rejects provider truncation rather than attempting to finish a partial design.

## P. Prompt/schema/policy versioning

- Prompt: `research-design.reasoning.v1`.
- Output schema: `research-design.reasoning.schema.v1`.
- Reasoning policy: `research-design.reasoning-policy.v1`.
- Deterministic policy: `research-design.methodology.v2`.
- Supported taxonomy: `research-design.taxonomy.v1`.

Output envelopes must echo current prompt/schema/deterministic-policy versions and input fingerprint. Candidate rationale, assumptions, unresolved issues, evidence references and usage metadata are returned; hidden chain-of-thought is neither requested nor persisted. No Research Design result persistence was added in this phase.

## Q. Fingerprinting

Hash covers project/user/authority and expected accepted revision, full supplied canonical draft, questions/objectives/constraints, evidence sources/hashes/excerpts, prompt/schema/reasoning/deterministic/taxonomy versions and effective execution budget/router policy. Changes to temperature, budget, evidence or input invalidate the fingerprint. No cross-project response cache exists. Ownership/revision is rechecked before paid dispatch and before return; changed input during the call returns `StaleInput` with no usable candidates/recommendation.

## R. Deterministic post-AI validation

Sequence: owned snapshot → deterministic preflight → bounded compact context → routed reasoning → strict schema and canonical references/fact guards → in-memory canonical draft → existing alignment and methodological/evidence/readiness validation. Each returned candidate includes deterministic readiness and findings; every adjudication runs the same validation again. The application, not the model, owns readiness. `Candidates` means advisory proposals were returned, not acceptance or approval.

## S. Telemetry

Reuses `ProposalAiCallContext`, `LlmAttemptHandler` and `IAiUsageRecorder`; records project/user/correlation, operation stage, model, prompt version, physical attempts, retries/fallback and actual provider usage when available. Result metadata includes input allowance/measured counts, output allowance, estimated-cost completeness, latency and categorical failure reason. Auxiliary count requests are reported separately. Unobserved retry token usage is unknown rather than falsely complete.

Bounded-path logs contain categories, IDs, versions, latency and counts. Raw HTTP error bodies and exception content that may echo research data are excluded from bounded diagnostics; SSE errors are sanitized. Legacy logging behavior is not globally changed. No research text, raw model response or hidden reasoning is persisted by this service.

## T. Tests added

New `ResearchDesignReasoningTests` adds **60 passing checks** using fake/stub providers only. Coverage includes one/three candidates, ambiguous intent, input/evidence requirements, malformed/fenced/extraneous output, unknown enum, missing/null fields, duplicate IDs/properties, unsupported designs, sample/approval claims, invented references, unknown auxiliary edges, blockers at high confidence, successful/unresolved adjudication, exhausted call budget, provider failure/actual timeout/cancellation, fallback, oversized response, fingerprint/version mismatch, changed inputs/ownership, cross-project attempts, prompt injection, route/token/cost constraints, cache pricing, physical retry/concurrency limits, protected evidence needs, attribution and privacy-safe errors. Existing router/client/credit tests run alongside design/workflow/compiler regressions.

## U. Final test results

Final source verification: **469 passed, zero failed, zero skipped**, duration **6 minutes 6 seconds**. Includes **171 Research Design checks**, of which **60 are new Phase 3 checks**. Earlier checkpoints: 172 combined design/router/usage checks passed; expanded boundary/provider checks passed; the broader affected selection passed 468 tests before the final auxiliary-reference/shared-parser refinement.

Final command: `dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter 'FullyQualifiedName~ResearchDesign|FullyQualifiedName~ProposalWorkflowArchitectureTests|FullyQualifiedName~Methodology|FullyQualifiedName~ObjectivesAndResearchQuestionsCrudTests|FullyQualifiedName~ObjectiveAndResearchQuestion|FullyQualifiedName~AnalysisPlan|FullyQualifiedName~DocumentCompiler|FullyQualifiedName~ClaudeService|FullyQualifiedName~AiModelRouterTests|FullyQualifiedName~CreditReservationTests|FullyQualifiedName~PipelineFailureCreditReleaseTests|FullyQualifiedName~ToolCreditWalletTests' --verbosity quiet -p:WarningLevel=0 -p:NoWarn=MSB3277 --logger 'trx;LogFileName=research-design-phase3-verified.trx'`.

Development failures: one evidence-need equality assertion compared deserialized array references rather than complete values; fixed by comparing the full serialized contract, with no field assertions removed. One build command used the frontend directory's project path and returned `MSB1009`; corrected to the backend project. No application compile error or weakened assertion was needed. Existing EF assembly-version warnings were suppressed in command output without changing dependencies.

TRX evidence lives in backend `HumaniseAI.IntegrationTests/TestResults`: `research-design-phase3-before.trx`, `research-design-phase3-unit.trx`, `research-design-phase3-boundary-counting.trx`, `research-design-phase3-final.trx` and final `research-design-phase3-verified.trx`. These are affected selections, not a claim that the entire repository suite ran.

## V. Known limitations

This is an internal service, not a user-facing Research Design flow. No live model quality, runtime latency or golden paid-model evaluation is claimed. Curated fake outputs prove boundary behavior, not the methodological quality of a live model's reasoning. Prompt/model changes require reviewed golden evaluations before rollout.

Evidence contexts/excerpts are trusted application inputs whose project/hash/reference scope is checked; later API/handoff code must load them from authorized verified artifacts rather than deserialize arbitrary client assertions into trusted evidence. Acting user identity must come from the authenticated principal, not an arbitrary client-supplied user ID. Phase 3 does not add that public boundary or new evidence verification stack.

Canonical graph additions/removals and sample assumptions require structured editing outside model output. Unsupported Phase 2 calculations and causal/specialist support remain unresolved. Natural-language factual screens cannot certify arbitrary prose. Provider-estimated counts are used when conservative fit cannot be established; preflight token/cost reservations are not exact billing guarantees. Costs remain explicitly incomplete without trustworthy pricing/usage. No durability, leases, restart recovery, acceptance transaction or response cache is implemented yet.

## W. Recommended Phase 4 scope

After explicit approval: persisted run/checkpoint state, idempotency, bounded leases/cancellation, restart recovery, authorization-aware fingerprint cache and atomic accepted profile/specification revision binding. Persist structured decisions and usage references, not hidden reasoning. Recheck input/evidence/policy/current authority on resume and acceptance; supersede stale runs. Keep current deterministic readiness and generation fences intact. Automatic Deep Research, public API/UI and proposal integration remain later phases.
