# Evidence scope implementation — 17 October 2026

This change extends the existing Essay workbench pipeline. No autonomous agents or alternative provider integration were introduced. The common atomic verifier also benefits research-paper callers. Generic continuation, case-study and literature-review orchestration are not replaced by this change.

## Production trace and causes

| Stage | Relevant implementation | Observed cause / disposition |
|---|---|---|
| Intake | Frontend `WriteWithAiModal.tsx`, `types/workbench.ts`; backend `WorkbenchDtos.cs` | Topic, level, discipline, word budget, style and approved plan already cross the API. Preserve the original question; distinguish explicit requirements from proposed framing. |
| Planning | `WorkbenchService.PlanEssayAsync`, `NormalizeEssayPlan`, `ValidateEssayPlan` | Thesis and component structure were proposed before retrieval; drafting was instructed to follow them exactly. Plans are now provisional; a post-retrieval evidence plan may narrow the thesis without replacing the question. |
| Queries / retrieval | `BuildEssaySubThemeQueries`, `BuildEssayStructuredQuery`, `FetchEssayLiteratureAsync`, `FetchWebSourcesForEssayAsync` | Existing topic-anchored, bounded provider fan-out and gap retrieval are retained. Query relevance is not claim entailment. |
| Selection / extraction | `BuildSourceTuples`, `BuildEssayEvidenceMap`, `EssayEvidenceAlignment` | The evidence map fell back to ineligible sources when no eligible candidate existed, and labelled keyword relevance as alignment. Removed that fallback and label ambiguity. Previously, writers received undifferentiated title/abstract strings with no structured access, task or outcome record. |
| Evidence planning | New `EssayEvidencePlanning.cs`, application `EssayEvidencePlan.cs` | One bounded semantic call extracts source records and a claim-relative support plan before writing. The selected corpus is capped at 20 records, 3,200 characters each; this is a context bound, not an adequacy/source-count requirement. |
| Drafting | `WriteWithAiCoreAsync` | Writer now receives the scope, bounded thesis, planned claims and grounded source extracts. Generic instructions that required the approved thesis verbatim are removed. Citation-count retries are disabled when an evidence plan is available; claim quality remains the gate. |
| Citations | Backend `BuildSourceTuples`; frontend `citationFormat.ts`, `essayReferenceOrder.ts` | Backend truncated author display metadata to three authors. Frontend inferred surnames from raw strings, misreading `Smithies TD`. Full ordered author metadata now survives, existing duplicate cleanup remains, structured family/given fields are preferred, and a narrowly constrained legacy MEDLINE fallback handles `Smithies TD`. |
| Review | `EssayClaimAuditService`, `EssayCitationVerifier.VerifyClaimsAsync` | Genuine factual assertions in thesis/conclusion could be classified as non-evidence synthesis. Audit instructions now explicitly include such assertions. Existing verifier now requests and enforces construct, outcome, exposure, mechanism, causality, magnitude and conflict-fit fields, in addition to population/scope checks. Missing verdicts are incomplete, not proven unsupported. |
| Repair | `BuildAtomicRepairEvidenceBlock`, new `EssayPassageRepair.cs`, existing bounded repair rounds | First existing-corpus repair now returns passage patches, preserving untouched text exactly. Relevant conflicting source citations cannot disappear during accepted claim repairs. Later bounded search/rewrite fallbacks remain for unresolved cases. Suggestions are not new evidence. |
| Delivery | `WriteWithAiResponse`, existing `EssayFlags` / audit outcome | Returns `EvidencePlan` and structured `EvidenceIssues` (claim/passage ID, source IDs, category, severity, reason and corrective action). Existing review flags expose unavailable planning and gaps. Later compression or citation edits invalidate final-text verification coverage rather than silently reporting a clean audit for changed text. |
| Operations | Existing `_claude`, `ClaudeService`, usage recorder, overall generation timeout and cancellation | Existing model route, physical-attempt usage records and pricing integrations are retained. The new logical planning call has a linked 60-second timeout and 6,000 output-token ceiling. It adds no retrieval/retry loop. Existing bounded retrieval and repair limits are unchanged. |

Backend paths above are under `../Humaniser/HumaniseAI.Infrastructure/Services/`, except DTOs under `HumaniseAI.Application/DTOs/Workbench/`. Existing user changes were retained; backend writes used hash checks against the inspected files.

## Contracts and operational bounds

Each source record identifies canonical source identity, actual access (`metadata`, `abstract`, or `supplied excerpt`), population, setting, design, conditions, constructs, tasks, outcomes, findings, limitations and a supporting excerpt/character locator. Unknown values remain null. This path does not obtain full text and never labels an abstract as full text. Titles cannot validate findings. A quoted excerpt must occur verbatim in the actual bounded source text; otherwise findings and inferred details are cleared and dependent claims become insufficient/omitted. This structural check is not semantic proof that every paraphrase follows from its quote.

Each claim carries source IDs, `direct`, `indirect`, `conflicting`, `insufficient` or `unsupported`, limitations, an action and bounded wording. Unknown source IDs, statuses or actions invalidate the planning result. A claim cannot retain direct support without a validated finding. Model-proposed requirements not quoted from the original topic are moved to proposed framing; an unsupported named theoretical perspective is not made mandatory. The raw original question is retained even when the existing query normalizer removes a category prefix for retrieval.

Reusable extraction records are cached in-process for six hours, capped at 256 entries. Keys hash extraction/prompt version, source identity, evidence access and source content. Supplied documents are never shared through this cache. On reuse, source IDs are remapped and claim-relative limitations are reassessed. There is no cross-scope claim-plan cache, so a different question cannot reuse an old support decision. The scope, plan and version travel with each drafting request.

Cost: one additional logical model call per essay, plus bounded planning prompt/output tokens. The cache reduces repeated extraction input; claim planning still runs for the current question. No live provider call was made during implementation, so incremental provider latency and actual cost have not been measured. The 60-second timeout is a limit, not an observed latency. Existing physical-attempt/token/cost recording remains authoritative; no dollar estimate is presented as an actual charge.

## Regression scope and honest limits

`EssayEvidenceScopeTests.cs` explicitly labels its data synthetic. Cases cover soldiers/N-back/component attribution, rats/reversal learning, vigilance versus working memory, tasks versus grades, exposure conflation, contradictory results, abstract-only numerical invention, overconfident conclusions, transport-policy downstream overreach, bounded failure, direct evidence, cache invalidation, scope provenance, local repair and ineligible-source fallback. `essayAuthorMetadata.test.ts` checks structured Smithies family/given metadata, multiword surnames, full author order, sorting and the legacy form.

Mocked semantic verdicts test application enforcement, not a live model's ability to discover mismatches. Full-text fidelity, live extraction quality, theory attribution, retention of disagreement throughout live drafting, and rubric performance still require inspecting real outputs. Automated review does not guarantee factual accuracy. Some provider records still supply only unstructured names; this change does not solve international name parsing or implement a complete CSL bibliography formatter. Existing style punctuation limitations remain.

The new pre-draft plan applies to the Essay document path. Other workbench document types retain their existing evidence planning; shared atomic-verifier improvements apply wherever that verifier is called. A wider rollout should be evaluated separately rather than silently changing unrelated generation flows.

## Repeat protocol

The original assignment text, word budget, academic level, model settings, complete source extracts/bibliography and original essay were not supplied with the diagnostic request. No same-evidence original regeneration or comparative score is claimed.

An exact, runnable **synthetic smoke request** is saved as `docs/evidence-scope-synthetic-request.json`. It uses the reported topic, an explicitly provisional overconfident thesis, Undergraduate level, 1,000 words, Harvard style and five labelled synthetic extracts. These are declared comparison assumptions, not recovered original settings or verified paper findings. It is not the original 64/100 essay replication.

After starting an authenticated test API with the intended fixed model/settings, run from this frontend repository:

```powershell
$env:HUMANISER_TEST_TOKEN = '<test session token>'
./scripts/Invoke-EvidenceScopeRepeat.ps1 -ApiBase 'http://localhost:5000'
```

For the actual first comparison, recover the original request and verified source text, create one fixed `MyFiles` request with its approved plan, and pass `-RequestPath` to the script. Use that identical file, model configuration and generation settings for both revisions. The script records the input hash, actual response and elapsed time. Set `allowAdditionalEvidenceRetrieval: false` (as in the smoke request) to disable all essay gap retrieval; `MyFiles` also defaults to no additional retrieval. Existing repair may qualify or omit unsupported claims using the fixed evidence. Inspect retrieval telemetry to confirm no sources were added. Do not call a fresh Web search a fixed-evidence comparison.

Inspect actual text and `evidencePlan`, `evidenceIssues`, `essayFlags`, `claimAudit`, and provider usage. Check each diagnostic failure, preserve clear supported findings, and inspect relevant counterevidence rather than merely counting citations. Score only an actually generated article: introduction/argument 15, conceptual understanding 20, evidence/relevance 25, critical analysis 20, structure/expression 10, referencing 10. Do not adjust scoring to reach 75. A later improved-retrieval run must be labelled separately.

## Test execution

Initial failures exposed stage-unaware mocks, an accidentally removed duplicate-author cleanup (corrected), and context-window fixtures whose `First`/`Second` evidence needs depended on the now-removed ineligible fallback. Those fixtures now use explicit relevant needs without restoring the fallback. Cache reuse has a dedicated regression checking that extraction can be reused while the new question and claim plan are reassessed.

Final outcomes:

| Command / check | Actual result |
|---|---|
| `dotnet test ../Humaniser/HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --no-restore --filter "FullyQualifiedName~Essay\|FullyQualifiedName~DynamicEvidenceCorpusTests\|FullyQualifiedName~ResearchPaperClaimSupportEnforcementTests" --logger "console;verbosity=minimal"` | **293 passed, 0 failed, 0 skipped.** Existing compiler/analyzer and assembly-version warnings remain. This is the relevant selection, not a claim that the entire backend suite ran. |
| `npm.cmd test -- src/lib/essayAuthorMetadata.test.ts src/lib/essayReferenceOrder.test.ts src/lib/citationMatch.test.ts src/lib/citationFormat.test.ts src/hooks/useWriteWithAiStream.test.ts` | **59 passed across 5 files.** |
| `npm.cmd test` | **445 passed, 1 failed across 57 files.** The untouched `FixIssuesPanel.test.tsx:85` expects `Reference diversity`; current label is `Source concentration`. No label change was made for this task. |
| `npm.cmd run build` | **Passed.** Vite reports existing chunk-size and mixed static/dynamic-import warnings. |
| `npx.cmd tsc -b` after the final contract edits | **Passed.** |
| PowerShell AST parse of `scripts/Invoke-EvidenceScopeRepeat.ps1` | **Passed.** JSON smoke request parses, its topic is within the API's 300-character bound, and additional retrieval is explicitly false. |
| `git diff --check` for touched tracked backend/frontend files | **Passed.** |
| Live provider generation / original essay scoring | **Not run.** No provider response, regenerated article, score, cost or measured provider latency is fabricated. |

The new evidence plan is a pre-draft snapshot. Sources added during a permitted gap-retrieval run are verified by the existing canonical claim verifier, rather than retroactively presented as if they were part of the original planning corpus. Use the fixed-corpus switch for the first controlled comparison.
