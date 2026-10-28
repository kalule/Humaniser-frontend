# Baseline continuation: structured responses fixed

Strict review and writer response-format handling is fixed and deployed locally. **94 relevant tests passed**, including PostgreSQL workflow checks. The same proposal was resumed: `4ffb55e2-c8da-4feb-99c6-086c565fed6c`.

The baseline remains incomplete. Its updated **known lifetime LLM subtotal is USD 0.391349 across 80 physical attempts**. This continuation added USD 0.028769 across seven calls: five evidence reviews and two introduction-generation attempts. All earlier costs remain included.

## Implementation and validation

Backend changes:

- `HumaniseAI.Infrastructure/Services/ProposalWorkflowPolicy.cs`: accept one JSON presentation fence. Reviews may include the observed trailing rationale heading; writer responses must have no trailing prose. Parse and validate the JSON object afterwards. Reject malformed payloads, duplicate root fields, additional payloads and explicit competing verdicts. Reviews retain their existing schema/status/issue checks.
- `HumaniseAI.Infrastructure/Services/ProposalWorkflowService.cs`: use the model-output reader at the existing strict writer deserialization point. Keep raw output and all subsequent generation checks unchanged.
- `HumaniseAI.IntegrationTests/ProposalReviewResponseParsingTests.cs`: add wrapped-review and writer cases, malformed and ambiguous rejection cases, and content/unresolved-need preservation checks.
- `HumaniseAI.IntegrationTests/ProposalWorkflowArchitectureTests.cs`: prove a fenced writer response passes the existing exact-evidence validation and registry-citation rendering, remaining a draft.

The first review-only verification passed 88 tests. The expanded run passed 92 tests but two PostgreSQL tests could not start the API because concurrent unrelated Deep Research changes produced an interface/service assembly mismatch. Those unrelated source changes were preserved. An isolated build subsequently passed **94/94, zero failures or skips**, in 1 minute 12 seconds.

Evidence: `../Humaniser/HumaniseAI.IntegrationTests/TestResults/baseline-structured-output-isolated.trx` and `../Humaniser/artifacts/baseline-structured-output-isolated-tests.log`. The local API now runs from `../Humaniser/artifacts/baseline-parser-isolated/bin/HumaniseAI.API/debug`, with its normal development configuration. [The continuation manifest](proposal-llm-baseline-continuation-manifest.json) freezes assembly hashes and measurements. No new migration was required for these parser changes.

## Live continuation results

Four evidence rechecks passed after the format fix. The fifth returned a substantive Fail concerning scope and methodological fit; it remains rejected. The original failed evidence record remains in history.

The first introduction attempt hit the same Markdown-fence failure in the writer's original JSON reader. After the writer fix and tests, the second attempt parsed successfully, then failed the existing exact-claim/passage check. Its returned claim records matched verified bindings, but the generated prose omitted each bound claim's terminal full stop before its evidence token. For example, the binding ends `Technology.` while the prose ends `Technology [E:...]`. The required verbatim claim/token pair is therefore absent.

No punctuation was silently inserted, no exact-claim check was relaxed, and no rejected prose was promoted into an accepted section. [The generation diagnostic](proposal-llm-baseline-continuation-generation-diagnostic.txt) retains both failures. [Rejected generation artifacts](proposal-llm-baseline-continuation-rejected-generations.json) preserve the actual model outputs for review. Both requests are separate logical generation operations with distinct idempotency keys, not hidden physical HTTP retries.

No section was saved or accepted, and gap assessment, final reviews and finalization have not been reached. The parser failure is resolved; the current blocker is model compliance with the literal claim/citation contract. Continuing requires an explicit decision on that formatting contract or an ordinary generation/input correction that still satisfies it. This report does not certify a completed proposal or explain the reported USD 10 total.

## Updated measured waterfall

| Operation | Attempts | Known LLM cost, USD |
|---|---:|---:|
| Evidence screening | 28 | 0.294900 |
| Source distillation | 40 | 0.053839 |
| Strict evidence binding | 6 | 0.021637 |
| Strict section generation | 2 | 0.011043 |
| Discovery queries | 1 | 0.004122 |
| Concept-term classification | 1 | 0.002252 |
| Discovery dimensions | 1 | 0.001811 |
| Topic scope | 1 | 0.001745 |
| **Known lifetime subtotal** | **80** | **0.391349** |

Provider-reported totals: 193,619 uncached input tokens and 39,546 output tokens. Reported cache reads and creation: zero. Unknown usage, partial usage and unpriced records: all zero. These are usage-completeness statements, not successful workflow verdicts.

Seq contains the same 80 completion records as the ledger, with zero ledger-ID differences. No attribution-propagation or AiCallLog-recording warnings appeared in the continuation API logs. The five related background jobs remain succeeded; none are pending. The original shared-setup pipeline-label limitation remains documented in [the initial results](proposal-llm-baseline-results.md).

See [the updated SQL waterfall](proposal-llm-baseline-continuation-waterfall.txt), [frozen ledger](proposal-llm-baseline-continuation-ledger.json) and [manifest](proposal-llm-baseline-continuation-manifest.json). Configured-price estimates remain unreconciled against the provider invoice, and non-LLM scholarly-search charges remain unmeasured. No prompts, models, routing, budgets or evidence/review rules were changed. Temporary authentication material was removed.
