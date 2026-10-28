# Proposal Studio P0 observability implementation

4 October 2026. Extends the existing `AiCallLog` ledger. No prompt, model, evidence selection, retry policy, review policy, quality gate or proposal budget changes were intentionally introduced. No representative paid proposal was generated.

## A. Files changed

Backend paths are relative to `../Humaniser`. These are this task's changes; the working tree also contains unrelated existing proposal-workflow, provider-resilience and background-enrichment changes which were preserved.

Core telemetry:

- `HumaniseAI.Application/Services/IAiUsageRecorder.cs`: nullable authoritative usage and immutable `ProposalAiAttribution`.
- `HumaniseAI.Domain/Entities/AiCallLog.cs`: attribution, attempts, completeness and category pricing in the existing ledger.
- `HumaniseAI.Infrastructure/Services/AiUsageRecorder.cs`: centralized category costs, immutable price snapshot/hash and structured completion events.
- `Services/ProposalAiCallContext.cs`: immutable nested contexts, shared strict-artifact collectors where explicitly needed, scope restoration.
- `Services/ProposalAiOperations.cs`: bounded operation/stage taxonomy.
- `Services/LlmAttemptHandler.cs`: physical HTTP attempts inside existing Polly policies; no retry-policy changes.
- `Services/ClaudeService.cs`: authoritative nullable SSE usage, request IDs, attempt linkage, failed-stream attempt recording and start events.
- `Services/AiCacheHitRecorder.cs`: attribution on existing application-cache-hit records.
- `Services/ProposalAiJobFilter.cs`: serialized Hangfire context snapshots, job retry metadata, stable fallback run identity for old queued jobs.
- `HumaniseAI.Infrastructure/DependencyInjection.cs`, `HumaniseAI.API/Program.cs`: register attempt handler and job filter.
- `Data/Configurations/AiCallLogConfiguration.cs`: ledger indexes and cost precision.
- `HumaniseAI.API/Controllers/AdminController.cs`: make existing token rollups safe with nullable counters. The P0 completeness-aware SQL report is the authoritative reporting mechanism; the older admin summary is not a substitute for it.

Attribution scopes were added around existing operations in `Services/ProposalWorkflowService.cs`, `ProposalGenerationJob.cs`, `ResearchService.cs`, `SectionGenerationJob.cs`, `ResearchLiteratureDiscoveryService.cs`, `ResearchMemoryProvider.cs`, `TopicScopeResolver.cs`, `MethodologyAnchorResolver.cs`, `MethodologyAnchorFetchJob.cs`, `CitationClaimSupportVerifier.cs`, `CitationClaimSupportVerificationJob.cs`, `FactsConsistencyChecker.cs`, `FactsConsistencyVerificationJob.cs`, `EligibilityConsistencyChecker.cs`, `ResearchScreeningJob.cs`, `SourceExtractionJob.cs`, `LiteratureIdentityMetadataExtractionJob.cs`, `LiteratureDistillationJob.cs`, `LiteratureAnalysisJob.cs`, `LiteratureAnalysisService.cs`, `ValidationService.cs`, `EthicsComplianceService.cs`, `InstrumentDesignerService.cs` and `ReviewerService.cs`.

Tests: new `HumaniseAI.IntegrationTests/ProposalLlmObservabilityTests.cs`; attribution assertions in `ProposalWorkflowArchitectureTests.cs` and `ProposalGenerationJobCitationRepairTests.cs`; existing `ClaudeServiceUsageRecordingTests.cs` updated to expect failed and successful physical attempts after a stream-overload retry.

Frontend documentation: this report and `docs/proposal-llm-cost-reporting.sql`. No frontend application code was changed.

## B. Schema/migration

Migration: `HumaniseAI.Infrastructure/Migrations/20261004110750_AddProposalLlmAttribution.cs`, its generated designer, and the existing model snapshot.

Only `ai_call_logs` changes: nullable input/output/cache counters; proposal/section/run/operation/pipeline/stage fields; logical and physical attempt fields; provider/request/job identifiers; completeness and pricing status; repair/regeneration/initial-generation flags; category costs and price snapshots. Indexes support proposal/run and logical-call/attempt lookups. Costs use `numeric(18,9)` to retain small-call precision. Old rows retain unknown completeness/pricing, without invented attribution. A downgrade refuses to replace unknown nullable usage with fabricated zeros.

At the end of P0, the migration had not been applied to the developer/production application database. PostgreSQL integration fixtures applied migrations to their disposable test databases. The EF pending-model check reported that the snapshot matches the model. Subsequent user-authorized baseline preparation applied the migration to the local development database; see [the baseline results](proposal-llm-baseline-results.md). Production was not migrated.

## C. Telemetry model and identities

`ProposalAiAttribution` is a serializable immutable record containing project/proposal/document/section identity, run and operation IDs, user, explicit pipeline, repair/regeneration flags and background-job identity/attempt. `ProposalAiCallContext` carries it through async/nested service work. Hangfire stores it as the `ProposalAiAttribution` job parameter at enqueue and restores it during execution.

For current proposal workflows **ProposalId equals ResearchProject.Id**: there is no separate proposal entity. DocumentId remains null when there is no distinct known document identity. SectionCode is available even if a section row does not yet exist; proposal-wide calls have no section. Project-wide enrichment jobs clear section identity while retaining the initiating proposal and generation run.

The existing legacy generation-run ID follows the enclosing job/autonomous run. New user operations outside that run receive a new run identity. New continuations preserve the serialized original run. Old pre-P0 queued jobs cannot reconstruct their original run; their fallback run is stable per Hangfire job across retries. Proposal lifetime aggregation includes every attributed run.

Every generic Claude provider request has a logical-call ID and physical attempt number. An HTTP handler inside the existing retry/timeout policies records failed sends with unknown usage; successful HTTP sends are recorded after SSE parsing. Stream-overload attempts share the same logical ID. Each row has its own ledger ID; CorrelationId remains available. Background-job attempts are separate from physical HTTP attempts. Duplicate recording when timeout/completion race is guarded per attempt.

Anthropic uncached input, cache reads and cache creation are separate categories. They are priced once each. Missing counters stay null; explicitly reported zero stays zero. Complete usage requires reported input/cache/output and a terminal stop reason. Other successful/interrupted responses can be Partial or Unknown. A genuine application cache hit has zero provider usage and zero cost, with pricing NotApplicable.

Price configuration remains centralized in `AI:Pricing`. Each priced record stores the rates used and a SHA-256 schedule version. Unknown model rates leave costs null with PricingStatus=Unknown. Partial usage may have known category costs but cannot produce a complete EstimatedCost; reporting shows the known component subtotal alongside incomplete counts.

## D. Taxonomy

Pipelines: `StrictProposalWorkflow`, `LegacyProposalWorkflow`. Existing model-routing decisions are unchanged.

Stages: Research, Planning, EvidenceProcessing, EvidenceVerification, Writing, CitationVerification, CitationCorrection, FactConsistency, AlignmentValidation, SectionReview, FinalReview, Repair, Export, Other.

Specific operations include TopicSuggestions, TitleSuggestions, TopicScopeResolution, DiscoveryDimensionPlanning, DiscoveryQueryPlanning, ResearchMemoryRefresh, ClaimPlanning, MethodologyAnchorVerification, Section57RoleClassification, ClaimSupportVerification, SectionGeneration, CitationShortfallCorrection, CitationGapVerification, CitationGapRedraft, FactsConsistencyCheck, SourceExtraction, SourceIdentityExtraction, SourceDistillation, SourceAnalysis, EvidenceScreening, AlignmentValidation, ProposalQualityValidation, EvidenceBinding, GapVerification, SemanticReview, ExaminerReview, SectionFixPreview, CitationFixPreview, AutomatedCitationRepairScreen and BibliographyFallback.

Original caller labels remain in TaskType. Labels outside the centralized map stay visible under Other; no costs are discarded. Repair flags follow correction/repair chains, including revalidation. Regeneration is determined from existing section content before writing, while initial writing is separately identified.

## E. Example Seq event

Illustrative fixture event, not a measured proposal baseline:

```json
{
  "EventType": "LlmAttemptCompleted",
  "LlmUsage": {
    "ProjectId": "11111111-1111-1111-1111-111111111111",
    "ProposalId": "11111111-1111-1111-1111-111111111111",
    "DocumentId": null,
    "SectionId": null,
    "SectionCode": "5.2",
    "GenerationRunId": "22222222-2222-2222-2222-222222222222",
    "Pipeline": "LegacyProposalWorkflow",
    "Stage": "CitationCorrection",
    "Operation": "CitationShortfallCorrection",
    "OperationId": "33333333-3333-3333-3333-333333333333",
    "LogicalCallId": "44444444-4444-4444-4444-444444444444",
    "ParentLogicalCallId": null,
    "PhysicalAttempt": 2,
    "Provider": "Anthropic",
    "Model": "test-model",
    "InputTokens": 100,
    "OutputTokens": 20,
    "CacheReadTokens": 10,
    "CacheWriteTokens": 5,
    "EstimatedInputCost": 0.0003,
    "EstimatedOutputCost": 0.0003,
    "EstimatedCacheReadCost": 0.000003,
    "EstimatedCacheCreationCost": 0.00001875,
    "EstimatedCost": 0.00062175,
    "PriceScheduleVersion": "sha256:<configuration hash>",
    "LatencyMs": 1000,
    "IsRetry": true,
    "IsRepair": true,
    "IsRegeneration": false,
    "CacheHit": false,
    "ProviderRequestId": "provider-request-1",
    "UsageCompleteness": "Complete",
    "PricingStatus": "Known",
    "RecordKind": "PhysicalAttempt",
    "CorrelationId": "44444444-4444-4444-4444-444444444444"
  }
}
```

CacheWriteTokens is the existing ledger name for provider cache-creation tokens; CacheHit means application response-cache hit. EstimatedCost is the estimated total. LatencyMs is attempt duration. Existing names were preserved rather than introducing duplicate cost/token fields. New events contain provenance, counters and price rates; they do not contain prompts, proposal prose, source contents or API credentials.

## F. Seq and SQL queries

Use [the reporting SQL](proposal-llm-cost-reporting.sql) with psql. It supplies proposal lifetime subtotal, pipeline/stage/section/model/operation/run breakdowns, citation correction, final review, retry, unknown/unpriced details and a disjoint waterfall. The view is session-local reporting over the existing ledger.

Seq's completion event stores fields under `LlmUsage`. Set a proposal signal/filter:

```text
EventType = 'LlmAttemptCompleted' and LlmUsage.ProposalId = '<project UUID>'
```

Additional filters:

```text
-- Stage / section drilldown
LlmUsage.Stage = 'CitationVerification'
LlmUsage.SectionCode = '5.2'

-- Citation correction / final review / retry
LlmUsage.Stage = 'CitationCorrection'
LlmUsage.Stage = 'FinalReview'
LlmUsage.IsRetry = true

-- Incomplete/unpriced
LlmUsage.UsageCompleteness <> 'Complete' or LlmUsage.PricingStatus = 'Unknown'
```

Example stage aggregation in Seq SQL, with incomplete counts retained:

```sql
select LlmUsage.Pipeline, LlmUsage.Stage,
       sum(LlmUsage.EstimatedCost) as KnownCompleteRecordCostUsd,
       count(*) as AttemptRecords
from stream
where EventType = 'LlmAttemptCompleted'
  and LlmUsage.ProposalId = '<project UUID>'
group by LlmUsage.Pipeline, LlmUsage.Stage
```

Run the incomplete/unpriced filter beside the aggregation; the SQL artifact additionally includes known partial category costs and completeness counts in every relevant breakdown. Never label a subtotal a complete total while incomplete records remain. Sum completion events only; start events do not represent additional billable records. Repair, regeneration and retry flags overlap stages; use the SQL waterfall's priority buckets for a total that does not double-count them.

## G. Tests added

Provider fixtures cover both pipeline identities, proposal/section/run metadata, returned output preservation, provider usage/request IDs, nullable missing usage versus explicit zero, physical retries, shared logical IDs, correction/repair/review taxonomy, regeneration, nested context restoration, job metadata and serialized background snapshots. Ledger tests cover persistence, category pricing without double-counting, unknown pricing, schedule changes, cache-hit zero cost and content-free telemetry schema. Actual strict-writer and legacy-writer regressions assert context at the model boundary.

## H. Validation

Final regression run: **256 passed, 0 failed, 0 skipped**, in 2 minutes 43 seconds. Evidence: `../Humaniser/HumaniseAI.IntegrationTests/TestResults/p0-verified-regressions.trx` and `../Humaniser/artifacts/p0-verified-regressions.log`. The test command rebuilt the backend successfully. Relevant suites include ProposalWorkflowArchitectureTests, ProposalWorkflowPostgresTests, ProposalSafetyTests, ProposalGenerationJobCitationRepairTests, GenerationRecoveryAndClaimPlanningTests, LiteratureSelectionScoringTests, ObjectivesAndResearchQuestionsCrudTests, ResearchGeographyAlignmentTests, SampleSizeDataAlignmentTests, ResearchWorkflowEvaluatorTests, citation-support/fact-consistency suites and provider/telemetry fixtures. These use mocked providers and disposable PostgreSQL fixtures, not live LLM generation.

The initial backend build passed. The prior broader regression run passed 254 tests. The EF model/snapshot check passed. Existing compiler/analyzer warnings and the EF relational-package version warning were visible; no dependency upgrades were performed as part of P0.

## I. Remaining attribution limits

- Normal identified strict/legacy ClaudeService generation, correction, verification, research and background enrichment paths now carry proposal context. Call-site coverage does not retroactively assign old ledger rows or reconstruct missing historical invoices.
- External proposal import performs extraction before creating its research project; that optional extraction remains outside proposal-ID attribution. It is visible in the generic ledger but cannot honestly be joined to an existing proposal without a separate import identity/linking change.
- Direct Consensus Anthropic query-expansion/answer clients, ClaudeAnalystClient and DetectionService are separate entry points. The normal proposal scholarly-search adapter bypasses the Consensus Anthropic clients. These are not included as normal generation costs; invoking them through new proposal paths would need the same context/attempt adapter.
- Paid non-LLM scholarly search/API charges are not inferred from LLM tokens. Reconcile those against provider usage separately if the reported $10 includes them.
- Provider acceptance followed by timeout can incur an unknowable charge. Such attempts stay Unknown. Job-filter propagation or ledger-write failures produce diagnostics; the workflow's behavior is preserved, but a baseline with such diagnostics is incomplete.

## J. Procedure for one representative baseline

1. Review/deploy this P0 change with the existing working-tree changes separately accounted for. Apply the migration to the intended application database through the normal deployment process. Restart API/workers so the attempt handler and Hangfire filter are active. Do not leave old workers writing the old schema semantics during the baseline.
2. Verify the effective model and AI:Pricing entries, and confirm Seq receives LlmCallStarted/LlmAttemptCompleted. Preserve effective configuration provenance without exporting secrets. Record the tested deployment revision and baseline start time.
3. Create exactly one fresh representative proposal with its normal academic level, expected word count, methodology, evidence requirements and citation style. Record its ResearchProject.Id; this is ProposalId. Choose the pipeline being investigated explicitly. One proposal cannot establish both pipelines' cost distributions; measure the other independently later.
4. Begin from ordinary research setup/discovery so those costs are included. Follow the existing process unchanged: accept the specification if using strict workflow, bind evidence, review gap decisions, write required sections, complete required citation/fact/semantic/examiner checks and finalize/export. Record any user-triggered regeneration or fix; do not add extra exploratory calls just for this measurement.
5. Allow the proposal's already-enqueued enrichment/verification jobs to finish or stop under their existing controls. Record the baseline end time and pending/failed job state. Capture all GenerationRunIds associated with the proposal, including separate review/repair requests.
6. Run the SQL artifact with that UUID. Preserve lifetime and per-run breakdowns, the disjoint waterfall, correction/redraft costs, retry records, cache usage and unknown/unpriced counts. Inspect Other operations and unattributed calls in the time window; do not assign time-adjacent calls by guesswork.
7. Check for propagation/recording warnings and incomplete provider usage. Present **known cost $X; unknown/partial/unpriced records N**. A complete cost claim requires those gaps to be reconciled, not hidden.
8. Reconcile against provider request IDs and available billing/usage exports, including non-LLM API charges if relevant. Preserve citation validity, unsupported-claim/alignment findings, finalization status and completion time alongside cost.
9. Use that measured waterfall to decide the next phase. Do not change prompts, models, evidence, review requirements or dollar limits during this baseline. No $1–$3 outcome is claimed by P0.

## K. Risks and stopping point

Nullable usage requires completeness-aware downstream reporting. Old admin sums are known subtotals and are not a complete invoice. Previously queued jobs have stable fallback identities but cannot recover their original run. Instrumentation is failure-safe, so recording diagnostics must be investigated during baseline collection. Model prices remain estimates from effective configuration, with the exact historical rates retained. Physical attempts increase ledger row counts; reports must distinguish attempts from logical operations. No original project authority, source provenance, citation gate or proposal-output behavior was intentionally changed.

Stop after P0. The next action is a separately initiated representative proposal baseline, not P1/P2/P3 optimization.
