# Research Design run 97ec7dd6 — forensic audit and correction proposal

Audit only. No application changes, migrations, development database writes, provider calls, limit increases or Academic Reviewer work in this turn. Development PostgreSQL was accessed through a read-only transaction; Seq was queried read-only. CodeGraph was consulted first; backend exploration failed to open its database, so live source reads supplied code evidence.

## Finding

This is a confirmed **output truncation**, not a provider outage, input-budget exhaustion or a stale display. The v5 request already included the one-candidate instruction and compact graph representation from the preceding fixes. Those fixes did not demonstrate adequate live output sizing. Mocked contract/dispatch tests were insufficient to establish that.

The bootstrap asks an LLM to instantiate a broad, deeply nested canonical research specification before the application has established what kind of study is being designed. A computing-systems experiment is routed through population/sampling terminology without typed separation of subjects, units, treatments and observations. Increasing MaxTokens would conceal both defects.

## Verified run facts

| Fact | Recorded value |
|---|---|
| Run | `97ec7dd6-5eef-44c7-afbf-f68a4c019941` |
| Project | `20c76b01-c2c2-15af-4756-dd7fc14a8fc2` |
| Previous attempt | `647389a9-6cd1-4991-b9a4-91a24d990b0a` |
| Prompt / output schema | `research-design.reasoning.v5` / `research-design.reasoning.schema.v1` |
| Methodological policy | `research-design.methodology.v2` |
| Route | `claude-haiku-4-5-20251001`, capability route prompt `complex-reasoning.v1` |
| Route input/output ceilings | 8,000 / 8,192 tokens |
| Run input/output ceilings | 24,000 / 12,000 tokens |
| Calls / physical attempts | maximum 1 / 1; observed 1 / 1 |
| Deadline | route and run: 120 seconds |
| Fallback / adjudication | disabled; no fallback model |
| Cost ceiling | null; not the failure cause |
| Requested candidate output allowance | 8,192 tokens, persisted in the paid attempt |
| Actual input / output | 6,613 / 8,192 tokens |
| Stop reason | `max_tokens` |
| Counting / fallback / retries | one token-count request, zero fallback, zero retries |
| Provider / run duration | 78,061 ms / approximately 79,047 ms |
| Usage failure / terminal failure | `OutputTruncated` / `InvalidModelOutput` |
| Paid attempt failure label | incorrectly `ProviderUnavailable` |
| Credits | 4 reserved before dispatch; 0 consumed, 0 still reserved after failure |
| Cost | estimated $0.047573; actual cost not recorded in run usage |
| Canonical acceptance | none; no valid candidate persisted |

Database evidence: [saved checkpoint](research-design-run-97ec7dd6-audit-data.json) and [run history](research-design-run-97ec7dd6-history.json). These artifacts contain project research inputs and operational identifiers; do not publish them as general telemetry.

Seq events: `event-a698c05823d908dfb9221e0000000000` records run-attributed usage; `event-a66c641d23d908dfb6221e0000000000` records `stop_reason=max_tokens`; `event-a66cf8c323d908dfb7221e0000000000` records truncation rejection. Times in records are UTC: provider completion 18:43:01 UTC, **20:43:01 Africa/Johannesburg on 6 October 2026**. The provider completion/truncation events are correlated by the narrow time interval, model and operation; the aggregate usage event explicitly identifies this run.

## Exact request construction and evidence limits

`ResearchDesignReasoningService` computes output allowance as the minimum of route output ceiling and remaining run output budget, then divides by remaining physical attempts. Here that is `min(8192,12000)/1 = 8192`. `ClaudeService.CompleteBoundedAsync` serializes the resulting policy as `max_tokens=8192`, disables fallback within this call, sets temperature to zero when the policy temperature is null, and enables truncation rejection.

The system instruction is `ResearchDesignPrompts.System` v5. The user payload is the serialized object containing:

1. `InitialDraftInstructions`: one candidate, minimal graph, preserve supplied facts, no invented operational/evidence facts; empty outer question/objective/construct/analysis arrays, repeat only design.
2. `InitialDraftContract`: reflection-derived vocabulary rooted in **all** `ResearchSpecificationInput` types plus quantitative, qualitative and mixed derived designs. It includes their enum values and property types.
3. `UntrustedResearchData`: fingerprint, policy/schema/taxonomy versions, supplied scope, initial facts, empty existing graph, current design/instruments, selected evidence, up to 40 preflight findings and taxonomies.
4. `OutputContract`: full strict reasoning envelope, candidate and recommendation, every comparison dimension, proposal, required inputs and evidence needs.
5. `EvidenceNeedContract`: another description of evidence IDs/types/scope.

The checkpoint stores the request specification, policy and version, **not the serialized wire prompt**. The sources match the recorded v5 construction, but there is no retained byte-for-byte dispatched body or prompt-body hash to prove exact historical payload bytes. Do not mislabel the saved `RequestJson` as the provider prompt. Likewise, truncation discards the response and `AttemptsJson.response` is null: the actual fragment, number of candidates emitted and exact point of cutoff are unavailable. A claim that the model definitely produced three candidates, duplicated graph arrays, or ignored a particular instruction in this run would be unsupported.

The observed input fits the configured route. The failure is the required/generated response size, not the previous verbose input-schema issue. The Haiku selection is confirmed; whether it was an intended deployment override versus an accidental setting is not proved by the route snapshot. Do not silently hardcode another model as the correction.

## Why bootstrap remains too large

- `proposal.initialDraft` is a complete `ResearchSpecificationInput`, including project facts the application already knows, sampling/hypothesis placeholders, study infrastructure and extensive metadata. It is a transport request for accepted-document-shaped data, not a minimal bootstrap decision.
- Although v5 removed four duplicated outer graph arrays, `proposal.design` must still equal `initialDraft.study.design`: the full design/safeguards/evidence representation is duplicated.
- The strict output resolver marks envelope fields and many nonnullable contract properties as required. Full component records require links, design metadata and safeguards rather than a small research outline. Missing optional facts are represented through null/empty structures in a broad canonical shape.
- The candidate requires all **14 comparison dimensions**, including sample access and ethical burden, even for one initial candidate lacking classified study context. A second recommendation repeats rationale, assumptions, tradeoffs and dependencies.
- The instruction “one candidate/minimal graph” is advisory prose; output-boundary candidate count still permits the broader reasoning envelope. It is not an initial-mode deterministic output-size contract.
- The system prompt simultaneously says initial mode may create a graph, “do not add/remove canonical nodes,” and that sampling parameters are excluded from output while initialDraft must reproduce them. Initial-mode exceptions are implicit and cognitively expensive.
- Context includes preflight findings for an absent typed design. Asking the model for a full validated-shaped response at this point encourages filling out machinery instead of first resolving the study kind and experiment structure.

The v5 change reduces duplication but does not remove the architectural coupling. Without the discarded fragment it is impossible to apportion the 8,192 output tokens among these fields. Their presence in the contract is confirmed, and the output pressure is a justified inference, not a measurement of each response segment.

## Boundary, retry and accounting path

Claude completed with `max_tokens`. `ClaudeService` logged/recorded failed provider usage and threw `BoundedOutputTruncatedException` **before returning text**. The strict JSON parser, `Check`, canonical Merge and deterministic candidate validation were never reached for this response. This is a provider-completion boundary rejection, not a JSON/reference-validation failure. Empty findings and zero blockers do not mean validation passed; readiness correctly remains `NotAssessed` and acceptance is unavailable.

The dispatch catch calls `Execution.FailAsync`, which releases the reservation and hardcodes paid-attempt failure `ProviderUnavailable`. Reasoning catches the typed truncation exception and returns `Invalid/OutputTruncated`; lifecycle persists `Failed/InvalidModelOutput`. Thus the persisted attempt and result disagree. Replay of a settled attempt without a response can turn that misleading failure back into a transport error.

Each user Try again created a distinct durable run; these are not automatic HTTP retries. This run's one allowed physical attempt was consumed. No fallback/adjudication/automatic truncation retry occurred. Provider tokens were consumed even though student credits were released. Account credits may legitimately be refunded by product policy, but that must not erase provider usage/cost or classify work as an unavailable provider. Actual cost is unknown here, not zero.

## Population modeling audit

The history is decisive:

- 18:15:07 UTC initial run: problem and population empty.
- 18:15:57 UTC input-derived run: mixed systems/telemetry description populated; problem still empty.
- 18:16:34 UTC next run: problem filled; the same target persisted.
- v4 and v5 retries carry that exact population with blank unit of analysis and null Study.

`InputAsync` maps `TargetPopulation` text directly to `ResearchSpecificationInput.Population`. The public view copies that field into `population.target`. `ResearchDesignInitialDraft.Merge` requires design.TargetPopulation to equal that supplied text and preserves population on initial proposals. This is not evidence of an LLM converting the topic into this population; the classification defect precedes generation. The UI/API invites one free-text target, then treats an inventory of heterogeneous things as a canonical population without disambiguating their roles.

For this topic, separate **proposed roles**, requiring student confirmation:

| Supplied item | Proper role to clarify |
|---|---|
| Worker architecture / LLM pipeline | System under test and execution environment |
| Fenced versus unfenced protocol | Candidate intervention/experimental condition |
| Timeout, redelivery, partition scenario | Fault-injection condition; timing/intensity need definition |
| Independently executed workload/scenario run | Possible experimental unit; not yet selected by the user |
| Log event / API usage record | Observation/telemetry source, potentially nested within runs |
| Corrupt writes, duplicates, token consumption | Candidate outcomes/operationalisations; definitions not yet supplied |

Repeated log rows from one run must not be counted as independent replications. A protocol is not a participant, logs are not the population of workers, and a count of events is not a human sample-size requirement. Software studies can still be quantitative Experimental/Comparative; **study subject is a separate axis from quantitative/qualitative/mixed approach**. Some studies are observational rather than controlled experiments; do not infer intervention or causal identification from computing vocabulary.

Existing `UnitOfAnalysis`, question/source scope metadata, construct roles/scales, observation structure, group count, analyses, instruments, eligibility and lifecycle contracts provide useful infrastructure. `Characteristics.HumanParticipants` makes ethics conditional in part, but does not supply a positive systems-experiment model. `DesignStudyRules.RD-POP-002` requires target/access populations and unit universally; sample metadata remains universal, and collection taxonomy lacks an explicit simulation/telemetry technique. These are genuine modeling gaps; renaming the Population heading cannot resolve them.

## Smallest architectural correction

Keep `CanonicalResearchPlan.SpecificationJson` as the only accepted authority and the existing lifecycle, router, budget/credit ledger, evidence handoff and acceptance transaction. Change two seams rather than introduce another agent or aggregate.

**1. A small initial transport contract and deterministic materializer.** Initial response proposes tentative study subject/intent/design, at most one compact linked outline, unresolved questions and concise rationale. It must not echo project scalars, sampling defaults, hypotheses, resource contracts, the entire Study or duplicate design. Reuse existing component semantics; this is a draft transport DTO, not a second accepted specification. Local node keys map to application-assigned UUIDs scoped to run/candidate; persist the mapping idempotently so recovery and subsequent edits preserve stable IDs. Existing supplied IDs remain fixed. Bound node/list/string counts in code, not only prose. Materialize into the existing specification from the saved baseline, with absent facts unresolved and existing full validators still applied. Validate draft shape separately from acceptance completeness. Never convert missing input to a valid default.

Only send the selected branch's minimal schema/taxonomy; perform deterministic clarification before paid calls when subject/unit/context is unknown. Keep routing and output limits unchanged. In bootstrap, omit a 14-dimension candidate-comparison matrix; derive applicability or request comparison later when alternatives actually exist. Do not automatically rerun full reasoning for each clarification. Resolve conflicting initial/refinement prompt instructions explicitly. Version transport/prompt and bind fingerprints accordingly.

**2. Extend the existing Study contract with a subject discriminator and optional system-experiment details.** Suggested subject kinds: HumanParticipants, SoftwareSystems, Records/Artifacts, Unknown (reviewed names before implementation). Keep Quantitative/Qualitative/MixedMethods family independent. A systems branch records system/environment, experimental unit, conditions/baseline, workload/corpus selection, repetition/seed/order/independence plan, outcome constructs and source IDs, fault-injection protocol, and feasibility/ethics applicability. Conditions and plans have stable IDs and canonical edges; scope text is not a second authoritative graph. Use current question/objective/construct/source/analysis IDs; measures map to constructs, telemetry maps to dataSources, automated probes may map to instruments without invented psychometric validity.

Reuse Sampling for a genuine population/frame when applicable. Software repetition adequacy must be tied to the primary analysis, dependence/variance and planning assumptions, with unsupported calculations explicitly requiring reviewed planning. Do not repurpose qualitative transcript stopping rules or prevalence precision for repetitions. Preserve historical schema readers; a legacy null subject remains unresolved in new work and does not rewrite historical accepted JSON. Typed new fields need a schema/compatibility decision, but accepted JSON storage alone does not justify a new canonical table or automatic migration.

## Deterministic gates to add

- Unknown/ambiguous subject blocks bootstrap advancement with a typed clarification; keyword hints are recommendations, not authority.
- All primary RQs cover units, conditions when applicable, outcome constructs, obtainable sources, observation structure and compatible analysis.
- Human population/frame/recruitment obligations are conditional; systems unit/repetition/workload obligations replace them where applicable. User labels alone cannot waive required study scope.
- Conditions differ explicitly and identify a baseline; distinguish observational comparisons from randomized/manipulated treatments and constrain causal claims.
- Runs, workloads, seeds and telemetry levels are distinct. Repeated/clustered observations must not silently pass independent-analysis checks; per-log sample inflation blocks acceptance.
- Repetition counts/parameters are user-confirmed or evidence-supported, never model-calculated authoritative adequacy. Unsupported formulas remain blocked.
- Automated instrumentation requires metric definition, collection/aggregation procedure, provenance and relevant validation; questionnaire psychometrics are conditional.
- Human-data and privacy risks remain applicable if real user/production logs are used. “Software study” does not waive consent, privacy, access or security constraints universally.
- Output failure categories persist consistently across usage, attempt settlement and replay. Billable provider work and refunded student credits are separate facts in the existing ledger.
- Accepted design, generation context and revision impact include subject/units/conditions/repetition/source changes; affected student sections become stale, never overwritten. Phase 8 writer receives only relevant canonical facts and verified evidence. Mixed human/system studies require explicit scopes rather than a single forced population.

## Exit criteria before another live retry

Use bounded initial JSON fixtures for a human survey, software controlled experiment, observational production-log study and mixed human/system evaluation. Prove compact output can materialize without project-field duplication; missing scope/units/conditions remain actionable, and repeat saves do not cause another full canonical-output call. Test stable IDs through replay, cross-project references, stale accepted revisions, cancellation, authority/credit fences and truncation settlement/replay. Preserve all Phase 8 generation/staleness checks.

A golden system-experiment fixture must distinguish run versus log unit, fence intervention versus environment, repetitions versus event counts, telemetry sources versus population, and leave unconfirmed numeric/access facts unresolved. Schema-valid fake provider output is not evidence of live methodological quality or completion. Only after deterministic gates pass, perform one explicitly bounded live verification and record provider tokens, stop reason, response size and stage outcome; evaluate output sizing before considering any ceiling adjustment.

No architectural implementation is made by this audit. Recommended next change is the small bootstrap/materialization seam plus subject-aware clarification, followed by systems-specific canonical safeguards—not another prompt-only reduction or MaxTokens increase.
