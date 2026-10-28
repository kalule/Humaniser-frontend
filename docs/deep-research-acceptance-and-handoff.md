# Deep Research acceptance and evidence handoff

## Integration status

Deep Research already supports manually adding sources to a project and binding evidence to proposal sections. This is partial integration. There is no validated automatic chain from Deep Research through Proposal Studio, Reviewer Agent, Research Design Agent, and Thesis.

This change adds an authenticated, owner-scoped `GET /api/v{version}/research/deep-research/{sessionId}/evidence-package` endpoint and a **Download evidence package** action. Export requires a terminal session, including a session stopped by its budget. A budget stop does not imply sufficient evidence.

Finished runs now persist the package snapshot inside the existing database-backed session checkpoint. Export returns that stored snapshot, preserving its original hash even when later student source decisions change. Older sessions without a snapshot can still export a package reconstructed from their stored evidence without provider or LLM calls. No additional database migration is needed for the checkpoint JSON field.

Research Library now has an **Evidence packages** tab at `/app/web-library/packages`. It lists finished sessions, supports question search and project filtering, and opens package details through a shareable `session` query parameter. Details include findings and supporting/contradicting source titles, verified accepted sources, contradictory/null evidence, potential gaps, insufficient evidence, limitations, search/provider coverage, usage and provenance. Partial evidence is labelled separately from evidence sufficiency. Users can download JSON or open the original research session. Browsing does not resume or start research, import sources, or change source decisions. The list uses the existing endpoint's latest-100-session limit, which is displayed explicitly. Explicit Proposal Studio package reuse and the Reviewer/design/thesis handoff are now implemented; see the project integration document below.

Validation: TypeScript compilation and `node scripts/evidence-packages-smoke.mjs` passed. The mocked browser check covers finished-session filtering, partial status, question search, project filter, JSON download, stale-detail removal on fetch failure, retry, no research-generation requests, and mobile horizontal overflow. It does not establish that the running backend has loaded the new package endpoint. Explicit Proposal Studio reuse is described in [Project integration](evidence-package-project-integration.md).

The versioned package contains the research question, scope, evidence questions, findings, verified accepted evidence, potential gaps, insufficient evidence, contradictory/null evidence, limitations, search/provider coverage, completion reason, usage, and a content hash. Findings referring to unverified or unaccepted evidence are excluded. Verification reflects the application's source checks; it does not independently prove that a paper supports a claim or that its full text was reviewed.

Excluded providers are now skipped before dispatch. Previously exclusions could filter returned sources after the provider had already been called. The live comparison excludes ConsensusApi, GoogleScholar, and Scopus because their subscription costs are not priced by this harness.

## Acceptance protocol

The live pilot covers retrieval practice and retention, South African digital learning adoption, limited literature on municipal AI in Lesotho, minimum-wage contradictory findings, qualitative maximum-variation sampling, and an intentionally obscure Antarctic COBOL question. Longer runs repeat three cases. Provider outages/429 and cross-provider duplication are covered by deterministic regression tests; those tests do not constitute live provider-quality evidence.

Reports record real searches, source identifiers, provider outcomes, findings, tokens, estimated LLM cost, and elapsed session time. The paired baseline uses the current proposal retrieval orchestrator with the same subscription-provider exclusions. It is a retrieval comparison, not a full proposal generation comparison.

Independent reviewers must label retrieved source relevance, accepted source relevance, actual study geography, finding support, contradictory/null findings, and proposed false gaps. The scorer accepts per-case `judgments.sources[sourceId]` with `relevant` and `geographyCorrect`, `judgments.claims[findingStatement]` with a boolean, and `judgments.gaps[questionId].falseGap` with a boolean. Unjudged rates remain null and report their judged denominator. Do not interpret no proposed gaps as a measured false-gap rate of zero.

Metrics: search precision is relevant retrieved sources / reviewed retrieved sources; relevant-source rate uses accepted sources; verified-source rate uses application verification status; duplicate rate uses duplicate observations / total observed candidates; geography and claim accuracy use independently reviewed items; false-gap rate is incorrect proposed gaps / reviewed proposed gaps. Contradictory and null evidence are counted separately. Coverage, searches, tokens, estimated cost, and session time accompany every result.

Run the scorer with `python scripts/score-deep-research-acceptance.py <report.json> <metrics.json>`. LLM cost is an estimate, not a provider billing statement. The total authorized live allowance is US$1; the harness reserves headroom and excludes unpriced subscription calls.

## Pilot results (5 October 2026)

Six initial live sessions finished in approximately 34–43 seconds each and stopped at the conservative iteration limit. Three expanded sessions stopped at the source limit, taking approximately 41–44 seconds each and accepting 1, 6, and 10 verified sources respectively. Combined estimated LLM spending was **US$0.134318**, including the initial **US$0.076539**. No run established sufficient evidence. The six-question retrieval baseline completed separately without LLM calls.

Artifacts: `deep-research-live-pilot.json`, `deep-research-live-extended.json`, `deep-research-retrieval-baseline.json`, and corresponding `*-metrics.json` reports. Quality judgment fields remain unpopulated; superiority and a false-gap rate have not been demonstrated. Backend compilation passed; 212 Deep Research safeguard tests and 16 focused frontend tests passed. The two opt-in live harness tests also passed, which confirms execution and budget checks, not research quality.

## Release decision

Explicit project package reuse and the existing Reviewer → Research Design → Thesis context handoff are now implemented. See [Project integration](evidence-package-project-integration.md). The quality gate below still applies to automatic research initiation and autonomous downstream acceptance; explicit student-selected reuse does not establish superiority.

Keep automatic downstream consumption disabled until a paired, independently judged comparison demonstrates improvement. Prioritize false-gap safety: every proposed gap needs adjudication, and empty results, skipped providers, failed providers, or 429 responses must remain coverage limitations rather than evidence of absence. Require meaningful label coverage for relevance, geography, claim support, and contradictions. Define acceptable cost/time and quality thresholds before a release comparison; a small pilot cannot establish reliable rates for rare failures.

After that gate, implement the chain in order: Deep Research → immutable evidence handoff → Proposal Studio → Reviewer Agent → Research Design Agent → Thesis. Consumers should retain session ID, package schema/hash and scope, import verified accepted sources idempotently, preserve contradictory findings and caveats, and invalidate stale handoffs when the research scope changes. Existing manual source import is not evidence that these downstream consumers already exist.

The new backend endpoint requires loading the updated backend build. Validation used isolated test databases and did not restart the running application or interrupt existing proposal jobs.
