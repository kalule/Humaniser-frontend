# Proposal Studio LLM and token audit

Audit date: 4 October 2026. Audit only; no implementation changes or paid generation requests.

## Scope and evidence

Inspected the frontend and adjacent `../Humaniser` .NET backend, including current uncommitted workflow changes. These are working-tree findings, not a claim that every path is deployed. Frontend CodeGraph worked; backend CodeGraph failed with `unable to open database file`, so backend tracing used source searches. Historical local `.api-release.stdout.log` supplies a small runtime sample. No production database, provider billing export, effective production configuration, or complete attributed proposal run was available. Consequently **the reported $10/proposal is not yet reconciled**.

Paths below are relative to the backend unless prefixed `frontend:`. `Services/` means `HumaniseAI.Infrastructure/Services/`. Line numbers describe the inspected working tree.

## A. Proposal LLM call graph

```text
frontend ProposalStudioPage / AutonomousProposalTools / research API
  -> ResearchService project creation (persistence)
  -> optional topic/title/methodology suggestions [LLM]
  -> research setup and literature discovery
       TopicScopeResolver [LLM on scope miss]
         -> ConceptTermValidator [semantic expansion classification]
       ResearchLiteratureDiscoveryService [dimensions, search-query planning]
       ResearchLiteratureDiscoveryJob -> scholarly provider HTTP requests
         -> ConsensusApiProvider -> direct Consensus search
            (no Anthropic query expansion or answer synthesis on this adapter)
       ResearchScreeningJob [evidence screening when requested]
       LiteratureDistillationJob [source background briefs]
  -> ProposalGenerationJob
       AcceptedSpecificationId present?
       YES -> ProposalWorkflowService.RunAutonomousAsync
         accepted CanonicalResearchPlan / deterministic specification validation
         BindEvidenceAsync -> Review [exact claim/passage semantic verification]
         RecordGapAsync -> Review [gap dossier semantic verification]
         GenerateAsync per applicable required section [LLM]
           specification + contract + exact evidence + dependency prose
           deterministic binding, citation rendering, word and version checks
         accept sections
         ReviewAsync semantic / examiner [LLM if deterministic blockers absent]
         FinalizeAsync [deterministic DOCX and bibliography]
       NO -> legacy ResearchService.GenerateSectionAsync
         ResearchMemoryProvider [LLM only if aggregate source hash changed]
         core-definition seed [conditional LLM]
         PlanSectionClaimsAsync [conditional LLM, fresh each generation]
         scope-aware evidence selection / retrieve gaps
           subtheme-queries [conditional LLM]
           MethodologyAnchorResolver [conditional extraction + verification LLM]
           Section57EvidenceRoleClassifier [unclassified-source batch LLM]
           CitationClaimSupportVerifier pre-verification [batch LLM]
         ResearchPrompts.GetSectionPrompt -> CompleteStreamAsync [section writer]
         citation-shortfall correction [conditional complete-section rewrite]
         citation-gap-fill verification [LLM: pool first, then retrieved candidates]
         gap-fill correction [up to 3 complete-section rewrites; 5.12 up to 1]
         RunPostGenerationPipelineAsync
           deterministic citation registry/reference cleanup
           CitationClaimSupportVerificationJob -> verifier [batch LLM]
             conditional section-quality screening [LLM]
           FactsConsistencyVerificationJob -> FactsConsistencyChecker [LLM]
         background identity metadata + SourceExtractionJob [pending-source LLM]
         approve only after required evidence/fact checks
         optional alignment / proposal-quality / chapter4 checks [LLM]
         user fix previews [LLM], confirm -> revalidation
         export -> bibliography compiler fallback [conditional LLM]
```

The two paths must be measured separately. The strict path does not call the legacy claim planner merely because it exists. Source discovery, evidence authorization, and gap acceptance are prerequisites; the strict autonomous writer does not manufacture missing verified evidence. Applicability/templates determine section counts: the strict policy defines 27 section codes, with hypotheses conditional; this is not a measured 27 calls for every proposal.

### Invocation inventory

`D` = `ClaudeService` generic configured model: checked-in `Claude:Model=claude-sonnet-4-6`; historical sample instead uses `claude-haiku-4-5-20251001`. Effective deployment overrides are unknown. Generic Complete/CompleteStream methods do not consult the capability router. `G` = configured generic output ceiling, currently 8,192 in checked-in appsettings, 2,000 code fallback. Output ceilings below are not actual consumption.

| Operation / caller | File:line / method | Model | Code-derived call multiplicity | Output ceiling / reuse |
|---|---|---|---|---|
| Topic suggestions / setup | Services/ResearchService.cs:528 GenerateTopicsAsync | D | 1 per request | G; saved suggestions |
| Title suggestions / setup | ResearchService.cs:614 GenerateTitlesAsync | D | 1 per request | G; saved titles |
| Methodology recommendation / setup | ResearchService.cs:692 recommendation path | D | 1 per request | G |
| Topic scope / discovery and generation | TopicScopeResolver.cs:114 ResolveAsync | D | 0 on persisted scope hit; 1 on miss/force | G; DiscoveryTopicScopeJson |
| Concept expansion classification / scope resolver | ConceptTermValidator.cs:235 classification path | D | conditional ambiguous-expansion calls | call-site settings; typed expansions persisted |
| Discovery dimensions / setup | ResearchLiteratureDiscoveryService.cs:175 | D | 1 per requested generation | G; persisted discovery state |
| Discovery queries / setup | ResearchLiteratureDiscoveryService.cs:251 | D | 1 per requested generation | G; saved queries |
| Subtheme queries / retrieval | ResearchService.cs:2206 | D | conditional retrieval planning | G |
| Evidence screening / screening job | ResearchScreeningJob.cs:130 ExecuteAsync | D | batch-dependent | G; screening records |
| Source distillation / fetch | LiteratureDistillationJob.cs:47 ExecuteAsync | D | pending-source dependent | G; KeyFindings persisted |
| Memory distillation / legacy writer | ResearchMemoryProvider.cs:110 RefreshAsync | D | 0 on hash hit, 1 on refresh | G; ResearchMemory cached |
| Core definition seed / legacy writer | ResearchService.cs:7665 EnsureCoreDefinitionsSeededAsync | D | conditional project seed | G; locked fact reused |
| Claim planning / legacy writer | ResearchService.cs:2698 PlanSectionClaimsAsync | D | 1 per eligible generation attempt | 700; ClaimPlanJson is audit-only, not reused |
| Methodology anchors / writer | MethodologyAnchorResolver.cs:116,541 | D | conditional candidate generation/verification | persisted anchors; inspect request multiplicity per run |
| Section 5.7 source roles / writer | Section57EvidenceRoleClassifier.cs:106 | D | batches of up to 50 unclassified items | BaseTokens + items*TokensPerItem; persisted roles |
| Claim/source comparison / pre- and post-writing | CitationClaimSupportVerifier.cs:582 AssessClaimSupportAsync | D | chunks, max 15 pairs and 12,000 estimated words; precheck selects top 2 candidates/claim | per-pair output ceiling; ClaimAssessment persistence is not proof of cache reuse |
| Section draft / legacy writer | ResearchService.cs:5662 GenerateSectionAsync | D | 1 per generation | CalculateSectionOutputTokenBudget |
| Citation shortfall / legacy writer | ResearchService.cs:5865 GenerateSectionAsync | D | 0 or 1 per attempt | same writer budget; full rewrite |
| Citation gap verification / repair | ResearchService.cs:6718,6777 TryFillCitationGapsAsync | D | per flagged claim, pool and external candidate branches | G; pool consulted first |
| Citation gap redraft / repair | ResearchService.cs:6028 GenerateSectionAsync | D | up to 3 rounds, 5.12 up to 1 | same writer budget; full rewrite |
| Fact extraction/consistency / post-generation | FactsConsistencyChecker.cs:179 CheckAsync | D | per checked section | G; facts/conflicts persisted |
| Section quality screen / verification job | CitationClaimSupportVerificationJob.cs:290 | D | conditional section screen | call-site settings |
| Bibliographic identity extraction / source job | LiteratureIdentityMetadataExtractionJob.cs:73 | D | pending-source batches | persisted extraction |
| Structured source extraction / source job | SourceExtractionJob.cs:92 ExecuteAsync | D | batch size 10, max 100 rows/run | G; extraction-version reuse |
| Alignment / user validation | ResearchService.cs:10650 ValidateAlignmentAsync | D | 1 per request | G, low-noise temperature |
| Proposal quality / user validation | ResearchService.cs:10737 ValidateProposalQualityAsync | D | 1 per request | G, low-noise temperature |
| Chapter 4 alignment / validation | ResearchService.cs:13285 ValidateChapter4AlignmentAsync | D | 1 per request | G |
| Eligibility consistency / validation | EligibilityConsistencyChecker.cs:74 CheckAsync | D | conditional consistency check | G; persisted findings |
| Section fix preview / user repair | ResearchService.cs:10932 ApplySectionFixAsync | D | 1 per preview | G; whole section supplied |
| Citation fix preview / user repair | ResearchService.cs:11227 PreviewCitationFixAsync | D | 1 per preview | G; whole section supplied |
| Hypothesis drafting / setup | ResearchService.cs:12837 GenerateDraftHypothesesAsync | D | 1 per request if applicable | 8,000 |
| Hypothesis prose / setup | ResearchService.cs:13048 GenerateHypothesisSectionAsync | D | 1 per request | G |
| Analysis plan / setup | ResearchService.cs:13223 GenerateAnalysisPlanInternalAsync | D | 1 per requested generation | G |
| Gap extraction / setup | ResearchService.cs:16340 ExtractLiteratureGapAsync | D | conditional extraction | G |
| Bibliography fallback / legacy export | ResearchService.cs:16063 TryCompileBibliographyFromContentAsync | D | conditional export fallback | G; avoidable with canonical registry |
| Evidence authorization / strict workflow | ProposalWorkflowService.cs:276 BindEvidenceAsync -> Review:251 | D | 1 per binding request | 4,000; immutable artifact |
| Gap dossier / strict workflow | ProposalWorkflowService.cs:313 RecordGapAsync -> Review | D | 1 per dossier request | 4,000; immutable artifact |
| Section writing / strict workflow | ProposalWorkflowService.cs:441 GenerateAsync | D | 1 per new valid attempt; successful matching idempotency hit 0 | min(30,000,max(4,000,MaxWords*3)) |
| Semantic/examiner / strict workflow | ProposalWorkflowService.cs:576 ReviewAsync -> Review | D | 0 with deterministic blockers, otherwise 1 per review request | 4,000; fingerprinted artifacts |

Optional adjoining workflows: InstrumentDesignerService:233, EthicsComplianceService:61/164, LiteratureAnalysisJob:82, LiteratureAnalysisService:102, ReviewerService:367, CitationIntegrityService:39, ValidationService:314 each contain LLM calls. They must receive the same attribution if invoked for a proposal, but are not assumed automatic calls in every generation. Separate Workbench literature-review outline/draft/repair calls live in LiteratureReviewGenerationService:367/380/675/790, with 6,000 outline and 3,000 draft/repair limits; these are not automatically the proposal's section 2.0 writer.

Other provider entry points were found: ConsensusQueryTermExtractor and ConsensusAnswerService post directly to Anthropic; their options default to `claude-sonnet-5`. ConsensusApiProvider explicitly bypasses both, so these must not be charged to proposal discovery without an actual caller trace. ClaudeAnalystClient and DetectionService are separate model clients, not proven normal proposal-generation operations. Thesis audit, results/discussion, defence preparation, tense conversion and 32,000-token external-proposal extraction are distinct optional workflows, not normal newly generated proposal costs. Scholarly provider `PostAsJsonAsync` calls are not automatically LLM calls.

### Required inventory fields that remain unknown

For every operation above, **SystemPromptTokens, UserPromptTokens, ContextTokens, EvidenceTokens and PreviousSectionTokens are unmeasured**. Provider usage reports aggregate input, not these component allocations. Actual OutputTokens, NumberOfCalls, RetryCount, RegenerationCount, CacheUsage and EstimatedCost per completed proposal require attributed runtime records. Do not substitute output limits for output tokens or multiply static section counts into a fabricated proposal total.

## B. Cost hotspots: measured sample versus hypotheses

Parsed 11 usage lines from frontend `.api-release.stdout.log`, all historical Haiku calls, across incomplete generation activity. Each line reports provider usage. Cache read/write were zero throughout. Using only the repository's configured rates for that exact historical model ($1 input / $5 output per million), not a claim about current provider prices:

| Operation group | Calls | Input | Output | Config-based estimated USD |
|---|---:|---:|---:|---:|
| Full citation-shortfall rewrites, 5.2 and 5.4 | 2 | 15,367 | 1,856 | 0.024647 |
| Initial section drafts, 5.2 and 5.4 | 2 | 15,032 | 1,236 | 0.021212 |
| Memory refreshes | 2 | 9,928 | 1,234 | 0.016098 |
| Citation verification | 2 | 7,652 | 1,089 | 0.013097 |
| Fact consistency | 2 | 3,057 | 452 | 0.005317 |
| Methodology anchor verification | 1 | 1,926 | 403 | 0.003941 |
| Total partial sample | 11 | 52,962 | 6,270 | 0.084312 |

Source lines: 2364, 13672, 13732, 13770, 13952, 13990, 14057, 16819, 25873, 26021, 26057. These calls cannot establish an entire proposal cost, historical deployment mix, or production cost distribution. Input/output ratio is 8.45. Corrective rewrites account for 29.01% of sampled input and 29.23% of configured estimated sample cost; they cost more than sampled initial writing. These are logical corrections, not HTTP transport retries.

Likely larger-run hotspots, pending measurement: complete-section correction loops; repeated pre/post claim verification; changed-memory redistillation; large final-review corpus; asynchronous extraction of a large pending pool. No dollar ranking is justified for these beyond the sample.

## C. Context hotspots

1. Strict final review, ProposalWorkflowService:574: accepted specification, every contract, all current evidence/gaps, **all included-source abstracts and bibliographic metadata**, and all section prose. `CorpusSnapshot` uses full-text hashes, not full PDF contents. Both semantic and examiner reviews can resend this package. No operation-specific input ceiling is enforced here.
2. Strict generation, :429: full spec, contract, sampling calculation, all passing section evidence, and **full dependency prose**. Dependencies are bounded by metadata but not prompt size. Abstract depends on every other section; 3.x sections receive full literature-review prose. This is growing context in selected paths, not every section blindly receiving every previous chapter.
3. Legacy evidence verification: real abstracts and selected full-text excerpts repeated per citation pair, up to 15 pairs/12,000 estimated words per chunk. A single oversized item can still need a stronger hard-limit guard; word budgeting is not authoritative token counting.
4. Legacy writing already has candidate windows and compact source support: initial windows 8–60, study area 24; support text capped at 320 characters. Full-document dumping is not the default legacy proposal writer. The existing 320-character slicing can cut evidence qualifiers or structured KeyFindings mid-value; reducing it further is not a safe optimization.
5. Legacy preflight :5598–5635 checks only after heuristic input exceeds 100,000; blocks an authoritative count at 190,000, but proceeds if counting fails. It protects a provider context window, not an economical section context allowance. Strict workflow lacks this preflight.

The code comment documenting an earlier ~736K-token assembled prompt is historical incident evidence, not a current observed prompt measurement. Largest directly sampled request: shortfall rewrite 5.2, 8,290 input tokens. No component dominance percentages can be inferred from aggregate usage.

## D. Repeated context

Legacy corrective calls reuse the system and original user prompt; gap-fill additionally appends accumulated evidence. Repeated specification, research memory, facts, source descriptions and bibliography instructions recur across writers. Strict calls repeat the full spec, full dependency prose and exact quote bindings. Final reviewers repeat the corpus and finished document. Citation verifiers can repeat the same source abstract for multiple different claims. Component fingerprints and provider token counts are needed to measure the repeated-context ratio accurately.

## E. Duplicate LLM work

ClaimPlanJson is explicitly audit-only: unchanged eligible regeneration replans. Preverification and postverification can assess related claim/source pairs; reuse is only safe for the same exact claim and unchanged evidence, not a paraphrase presumed equivalent. Research memory hashes all seven source sections plus top references, so one changed source can trigger redistillation of all inputs. Persistent source summaries/extractions and role labels already exist; optimize their invalidation and concurrent scheduling before adding another evidence database. Background jobs are enqueued after generation, so pending/version filters alone do not establish concurrency-safe single execution.

## F. Retry and regeneration cost

Legacy writer can make initial draft + one shortfall correction + up to three gap-fill redrafts, before verifier retries or a user regeneration. This is a conditional bound on writer calls per attempt, not observed frequency. ProposalGenerationJob has Hangfire automatic retries disabled but schedules bounded continuations with MaxContinuationAttempts=3; approved sections are skipped and failed/incomplete work can resume. CitationClaimSupportVerificationJob has AutomaticRetry(Attempts=2). HTTP Polly retry policies cover transient failures and 429; streaming adds two overload retries before any yielded delta. These layers can compound.

ClaudeService stores one usage record per logical call, with retry counts. Streaming passes overloadAttempt to the recorder, which omits HTTP-policy retries from that final count. Reused usage state also does not preserve each physical attempt's individual billing. A timeout after provider acceptance or an interrupted stream can incur usage that the client never receives. Record unknown usage explicitly rather than treating missing counters as authoritative zero. No observed transport-retry dollar total is available.

## G. Model routing and output budgets

AiModelRouter exists for tool capabilities, but generic proposal CompleteAsync/CompleteStreamAsync use modelOverride or Claude:Model directly. Current checked-in default is Sonnet; sampled runtime is Haiku. Routing every operation to Haiku is already possible through configuration and is not the solution to redundant work.

Keep strong writing/synthesis; evaluate bounded fast extraction/query classification on fixtures; use premium reasoning only for unresolved design conflicts or justified examiner review. Register proposal operations in the existing router rather than inventing a parallel router. Review currently has a uniform 4,000-token ceiling; strict writing has a 4,000 minimum even for short sections. Ceilings alone do not incur their full token cost: lower only with measured output distributions and truncation tests. Preserve bibliography/JSON overhead in legacy budgets.

## H. Deterministic opportunities

Existing deterministic code already performs sample-size formulas, structured question/objective links, canonical citation rendering, reference deduplication, word counting, exact evidence offsets, version checks and required-field checks. Reuse ProposalWorkflowPolicy.Validate/Calculate and legacy citation registry logic. Eliminate model bibliography compilation when complete canonical identities exist; flag incomplete identity for repair. Exact typed canonical fact equality, date bounds, DOI format/dedup and required headings belong in code. Semantic entailment, equivalent constructs, gap justification and methodological adequacy still require semantic judgment. Passing formatting checks cannot certify claim support.

## I. Cache and evidence reuse

Reuse CanonicalResearchPlan, ProjectFacts, ProjectLiterature, ClaimAssessment, source extraction versions, ResearchMemory and ProposalWorkflowArtifact. Scope cache currently reuses persisted JSON unless forced; verify invalidation when topic/population/geography changes. Cache exact claim/passage verdicts by project, specification revision, canonical source ID, source content hash, exact claim, scope, passage offset, coverage, policy/prompt and model version. Preserve negative/Unknown states distinctly; do not reuse them as Pass.

Cache claim plans against section contract/specification/template inputs. Distill only changed source fields; avoid memory invalidation solely from bibliography changes when canonical research facts did not change. Add single-flight protection for identical pending extraction. Reuse claim-authorized evidence across sections when scope and claim remain valid; retrieve externally only for demonstrated gaps. Existing gap-fill already searches the pool first.

Generic proposal Claude calls send a plain system string and do not place cache_control breakpoints. Humanise-specific cached system blocks do not imply proposal prompt caching. Consider eligible stable prefixes after correctness and actual provider cache behavior are verified. Provider cache hit and application response-cache hit are separate metrics.

## J. Minimum target architecture and ledger design

```text
Accepted CanonicalResearchPlan + typed canonical facts + section contract
  + claim-authorized, versioned evidence + selected dependency summaries
 -> SectionContextBuilder (component sizes/fingerprints and provenance)
 -> operation context guard + proposal budget reservation
 -> existing AiModelRouter with proposal operation policies
 -> writer -> deterministic checks
 -> required claim-support verification / justified semantic escalation
 -> targeted paragraph patch -> all affected checks -> save
```

Separate execution prerequisites from prompt dependencies: accepting a prior section does not imply sending its whole prose. Sample-size context needs design, population, outcome, assumptions and methodological evidence; study-area context needs geography, population/institution and geographical evidence. Final examiner review legitimately needs global consistency context, but not every uncited abstract. Retain contrary evidence and the verified passages needed to assess claims.

Extend existing AiCallLog/AiUsageRecord rather than add a second ledger. Already present: correlation ID, model, operation label, aggregate provider input/output/cache read/cache creation tokens, estimated total cost, latency, status, retry/fallback and application cache-hit flags. Missing direct ledger attribution: ProjectId, ProposalId/DocumentId (explicit mapping), SectionId/code, Provider, generation run, operation ID, physical attempt, repair/regeneration flags and separate input/output/cache cost. ProposalAiCallContext already carries project and operation IDs, but RecordUsageSafeAsync only propagates user/prompt and stores a reduced call collection in workflow artifacts. Artifacts can join some strict calls by correlation ID; legacy background jobs are not comprehensively attributable.

Use an ambient immutable operation context propagated explicitly into Hangfire arguments/scopes. Record each physical attempt with a parent logical-call ID; persist provider request ID and completeness of usage. Snapshot price schedule/version. Anthropic InputTokens here means uncached input; total processed input = input + cache read + cache creation. Price each category once. Unknown pricing stays null; aggregations must report unpriced/unknown records, not silently sum them as free. Existing user/day/month guardrails do not constitute proposal budgets.

Maintain component token estimates separately from authoritative aggregate usage, with estimator method and uncertainty. Use provider counting for aggregate preflight where appropriate; do not claim its result allocates tokens precisely across prompt components. Reject pathological assembled context safely; select/dedup evidence and summarize dependencies before retrying a budget check. Never silently slice a citation passage.

Proposal budget should include configurable soft/hard USD and input/output/call/runtime limits, per research/write/review/repair stage. Reserve a conservative maximum before dispatch, reconcile actual usage, and account for concurrent/background calls and unknown usage. Pause with a persisted reason and resumable state; required integrity checks stay pending, never bypassed. Search loops need query, iteration, call, token, cost and runtime limits, including paid external retrieval. No dollar envelopes should be selected before a complete baseline.

Internal reporting can start as SQL views/Seq events: group by proposal, section, operation, model, stage and attempt; report input/output ratio, token-weighted cache-read rate, application hit rate, retry and repair totals, missing usage and pricing. Repeated context requires component fingerprints; cache savings require an explicit uncached-price counterfactual including cache-write premiums. Avoid an admin UI in P0.

## K. Savings expectations

| Change | Expected impact | Confidence / evidence |
|---|---|---|
| Targeted correction instead of full redraft | HIGH where failures recur | HIGH redundancy evidence; sample correction input exceeds initial writing input |
| Compact final-review corpus and dependency summaries | HIGH for large proposals | HIGH code evidence; dollar effect unmeasured |
| Reuse exact claim/source verdicts and source processing | MEDIUM–HIGH | MEDIUM; exact-input hit rate and job overlap unknown |
| Canonical facts instead of whole-memory refresh | MEDIUM | HIGH on cache invalidation behavior; frequency unmeasured |
| Stable-prefix provider caching | MEDIUM | MEDIUM; eligibility, prefix size and TTL need verification |
| Deterministic bibliography and typed checks | LOW–MEDIUM | HIGH on feasible existing primitives |
| Fast model for eligible structured operations | MEDIUM | MEDIUM; fixture quality and actual deployment mix unknown |
| Merely lowering output ceilings | LOW/uncertain | HIGH that ceilings are not actual usage; truncation risk |

These are qualitative impact/confidence ratings, not dollar promises. >60% redundant-input reduction, >50% unnecessary-call reduction and $1–$3 completed proposals remain acceptance targets requiring baseline measurement and quality parity.

## L. Implementation plan, after baseline audit

**P0:** finish project/section/attempt telemetry across both paths and background jobs; collect one complete real proposal with effective model config and billing reconciliation; add strict-workflow context guards and fail-closed handling for pathological legacy preflight; expose missing-usage/pricing counters. Measure before optimization.

**P1:** SectionContextBuilder over existing specification/facts/contracts/evidence; distinguish prompt dependencies; deduplicate by canonical work identity while preserving claim-to-passage links; rank within configurable section/claim evidence allowances, reporting unmet evidence needs; reuse extracted sources and exact verdicts; improve source-summary representation without blind truncation.

**P2:** operation policies in existing router; deterministic-first validation; semantic checks for actual meaning/risk; paragraph-addressed repairs with expected content hashes and immutable unaffected paragraphs. Keep mandatory source entailment and examiner/design checks required by current workflow policy.

**P3:** stable semantic cache keys, single-flight jobs, selective invalidation, provider prefix caching, proposal-wide atomic reservations and cost-aware bounded retrieval. Optional work can pause near limits; mandatory checks cannot turn into Pass to save money.

## M. Exact change locations and proposed tests

| Files/classes/methods | Required future change |
|---|---|
| Domain/Entities/AiCallLog.cs; Application/Services/IAiUsageRecorder.cs; Services/AiUsageRecorder.cs RecordAsync/EstimateCost | Extend existing attributed attempt ledger, category costs and price snapshots; matching configuration/migration |
| Services/ClaudeService.cs CompleteAsync, CompleteStreamAsync, StreamClaudeDeltasAsync, RecordUsageSafeAsync; Infrastructure/DependencyInjection.cs | Operation policies, physical-attempt usage/retries, cache prefixes, context gate |
| Services/ProposalAiCallContext.cs; ProposalWorkflowService.cs GenerateAsync, Review, ReviewAsync, BindEvidenceAsync, RecordGapAsync | Propagate project/section/stage context; compact payloads; exact evidence reuse |
| Services/ProposalWorkflowPolicy.cs Contracts/Validate/Calculate | Separate prompt dependencies from prerequisite acceptance; section allowances |
| Services/ResearchService.cs GenerateSectionAsync, PlanSectionClaimsAsync, TryFillCitationGapsAsync, ApplySectionFixAsync, PreviewCitationFixAsync, TryCompileBibliographyFromContentAsync | Compact assembly, cached plans, targeted corrections, deterministic bibliography |
| Services/ResearchPrompts.cs GetSectionPrompt/BuildLiteratureBlock/BuildClaimEvidenceBlock | Compact provenance-preserving evidence and nonduplicated instructions |
| Services/ResearchMemoryProvider.cs GetContextAsync/RefreshAsync/ComputeHash; ResearchMemoryPrompts.cs | Canonical structured facts and selective summary refresh |
| Services/CitationClaimSupportVerifier.cs AssessClaimSupportAsync; CitationClaimSupportVerificationJob.cs ExecuteAsync; FactsConsistencyVerificationJob.cs | Exact verdict reuse, changed-input fencing, attributed jobs, preserved mandatory checks |
| Services/SourceExtractionJob.cs; LiteratureIdentityMetadataExtractionJob.cs; LiteratureDistillationJob.cs; Section57EvidenceRoleClassifier.cs | Versioned summaries, single-flight pending work, job attribution |
| Services/TopicScopeResolver.cs ResolveAsync; ConceptTermValidator.cs; MethodologyAnchorResolver.cs | Input-specific invalidation, reuse and eligible routing |
| Services/ProposalGenerationJob.cs ExecuteAsync/RunAsync; AiModelRouter.cs Resolve; AiRoutingOptions.cs; AiCostGuardrailService.cs | Proposal budget, persisted stop reasons and bounded stage policies |
| API/appsettings configuration sections (not secrets); optional direct Anthropic clients if used | Operation budgets/versioned price table; consistent telemetry |

Proposed new components: SectionContextBuilder and proposal budget reservation service, integrated with existing entities and router. Avoid a second canonical research authority.

Future regression coverage maps to all requested acceptance cases: no whole proposal in normal writer; required canonical facts present and irrelevant prose absent; evidence dedup and configurable allowances with explicit unmet-needs failure; oversized context rejected safely; eligible model routing; deterministic checks make zero model calls; semantic review only when its policy requires it; patch leaves unaffected paragraphs byte-identical; provider usage/retries attributed to proposal and section; exact cache hits avoid calls; changed inputs invalidate correctly; evidence reuse preserves provenance; concurrent hard-budget reservations cannot silently overspend; citation verification remains required; specification consistent across sections; failed optimization never silently drops required evidence. Include both accepted-spec and legacy paths, delayed jobs, cancellation, stale outputs, missing usage and pricing.

Relevant existing suites include ProposalWorkflowArchitectureTests, ProposalWorkflowPostgresTests, ProposalSafetyTests, ProposalGenerationJobCitationRepairTests, GenerationRecoveryAndClaimPlanningTests, LiteratureSelectionScoringTests, ObjectivesAndResearchQuestionsCrudTests, ResearchGeographyAlignmentTests, SampleSizeDataAlignmentTests and ResearchWorkflowEvaluatorTests. Add ledger/provider streaming fixtures and targeted patch tests, then run the relevant full regression suite during implementation. No tests were added or executed in this audit-only phase.

## N. Risks and decision

Summaries can lose qualifiers, contrary findings or provenance. Cache keys can preserve obsolete scope/design or policy verdicts. Exact-value matching cannot prove semantic equivalence. Paragraph patches can alter surrounding entailment and require revalidation. Cross-section prose dependencies can hide facts not yet present in typed state; reconcile before removing them. Shared EF contexts must not be used concurrently by verifier work. Async jobs can produce stale flags or duplicate calls without generation fencing. Hard-budget accounting must cover concurrent attempts and unknown usage. Conditional review must not bypass mandatory source support or final-review policy. Current uncommitted strict workflow behavior needs deployment confirmation before interpreting production costs.

**Stop after audit.** The strongest measured redundancy is complete-section citation correction; the strongest unmeasured context risk is the strict final-review corpus. First complete proposal attribution and obtain a full baseline. The available evidence does not yet explain a $10 invoice or demonstrate a safe $1–$3 completed-proposal cost.
