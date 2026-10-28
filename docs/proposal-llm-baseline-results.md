# Representative baseline: partial, blocked at evidence review

Historical first attempt. The response-format fixes and latest measurements are in [the continuation results](proposal-llm-baseline-continuation-results.md).

The first strict baseline has a **known LLM subtotal of USD 0.36258**. No sections were written or finalized. This does not explain the reported USD 10 for a completed proposal.

## Project and deployment

Proposal ID: `4ffb55e2-c8da-4feb-99c6-086c565fed6c`. Topic: digital learning adoption among university students in South Africa. Accepted settings: master's level, 6,000 words, Harvard citations, quantitative cross-sectional survey.

The local API at `http://localhost:5062` now runs the tested P0 build. Migration `20261004110750_AddProposalLlmAttribution` was applied to `localhost:15433/humaniseaidb`. Production was not migrated. The [manifest](proposal-llm-baseline-manifest.json) records assembly hashes, dirty working-tree provenance, timestamps and the price schedule. First attributed call: 4 October 2026, 12:14:44 UTC; last: 12:23:38 UTC.

The initial EF command used the design-time fallback database on port 5432 and failed at an older vector-extension migration. The connection was then explicitly set to the verified development database on port 15433, where only P0 was pending and applied successfully. The failing port-5432 migration did not complete.

## Measured waterfall

| Operation | Physical attempts | Known LLM cost, USD |
|---|---:|---:|
| Topic scope | 1 | 0.001745 |
| Concept-term classification | 1 | 0.002252 |
| Discovery dimensions | 1 | 0.001811 |
| Discovery queries | 1 | 0.004122 |
| Source distillation | 40 | 0.053839 |
| Evidence screening | 28 | 0.294900 |
| Strict evidence binding | 1 | 0.003911 |
| **Known subtotal** | **73** | **0.362580** |

Provider-reported totals: 177,745 uncached input tokens and 36,967 output tokens. Cache-read and cache-creation tokens were explicitly zero. Unknown usage, partial usage, unpriced usage, incomplete-cost records and application cache hits: all zero. No physical retries were recorded.

All operations reached used `claude-haiku-4-5-20251001`; model selection was not changed. Schedule version: `sha256:494574674e2ffe052f1a2076e2880fdd19e6c3c357df5af29e93437989173cf7`. Rates used are retained in each ledger record. Costs are configured-price estimates, not reconciled provider invoices. Non-LLM scholarly-search charges remain unmeasured.

The [SQL output](proposal-llm-baseline-waterfall.txt) includes stage, section, operation, model and generation-run breakdowns, retries and incomplete counts. The [frozen ledger](proposal-llm-baseline-ledger.json) retains all 73 records. No unattributed ledger calls were found in the report's one-hour diagnostic window; this does not establish complete non-LLM billing coverage.

## Completed work and failure

Normal setup triggered existing literature-fetch/distillation work. Topic scope, dimensions and six queries were generated. Discovery completed at the unchanged 500-candidate cap. Screening completed for 420 unique candidates. Six relevant registered sources were selected through the ordinary inclusion API. The strict specification was accepted, establishing 27 required sections. All five related background jobs succeeded, with none pending at capture.

The first strict evidence request used an exact stored abstract passage with its real offset, length and source hash. The model returned a Markdown JSON fence containing a Pass object, followed by explanatory rationale outside the object. `ProposalWorkflowPolicy.ParseReview` requires the entire response to be valid JSON. It returned **Unknown: Review was not valid JSON**.

The [evidence result](proposal-llm-baseline-evidence-result-1.json) and [diagnostic output](proposal-llm-baseline-review-diagnostic.txt) preserve the failure. UsageCompleteness=Complete refers to provider token accounting, not successful evidence validation. The gate remains enforced. No evidence status was edited in the database; no section, gap dossier, final review or finalization was submitted. The failed review was not retried through additional paid calls.

## Telemetry findings

Seq returned 73 filtered `LlmAttemptCompleted` events whose ledger IDs exactly match all 73 persisted records. [Verification](proposal-llm-baseline-seq-verification.json) records zero ID differences. No attribution-propagation or AiCallLog-recording warnings were found. Existing console providers render events twice, so console-line counts are not billed-attempt counts.

Shared setup/research and enrichment calls carry `LegacyProposalWorkflow`, even for this strict project's setup. The strict evidence call carries `StrictProposalWorkflow`. Lifetime attribution works, but pipeline totals currently classify shared setup under the legacy label. This is a telemetry classification limitation; these are not two independently measured proposal-generation baselines. No records were relabelled after the fact.

Separate HTTP operations have separate generation-run IDs, with nested/background work retaining its initiating run. The lifetime subtotal includes them all. Strict evidence carries section `1.0`; proposal-wide setup has no fabricated section.

## Continuation

No prompts, models, routing, retry/review policies, quality gates, evidence policies or dollar limits were changed. New scripts and JSON/SQL/text artifacts capture this run. Credentials and tokens are absent from those artifacts, and the temporary Windows-encrypted token was removed.

Continuation requires a separately scoped reliability fix for structured-review responses, with regression coverage and preserved rejection of malformed or ambiguous reviews. That behavior change was not made during measurement. Then resume this same project through evidence, gap decisions, writing, acceptance and final reviews. Retain these partial costs in the lifetime waterfall. No completed-proposal cost or USD 1 to USD 3 outcome can be inferred from this attempt.
