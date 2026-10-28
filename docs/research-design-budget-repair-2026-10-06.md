# Research Design budget repair

The supplied run ended in under one second with no charged credits or generated components. Its public response does not identify the precise exhausted limit; the historical runtime cause is not proven from that response alone.

The initial-draft prompt included every contract type as verbose repeated property descriptors. The configured ComplexReasoning route allows 8,000 input tokens. The initial contract now serializes as a compact type-to-property map, preserving all field names, types and enum values. It does not increase route/run budgets or remove validations. A RAG initial-draft regression verifies dispatch through that route using bounded mocked token counting. Provider tokenization/output quality still needs live verification.

Preflight failures now retain distinct safe usage failure reasons: RouteInputTokenLimit, RunInputTokenLimit, OutputTokenLimit, CallLimit, PricingUnavailable, CostLimit and CreditReservationFailed. The existing application view translates them into specific student attention messages. Missing pricing still blocks a configured cost cap; it is never treated as zero cost. The prompt is versioned v3, so earlier persisted prompt results are not silently reused against different instructions.

The frontend avoids repeating a generic allowance statement when the server supplies an explanation. A stopped, unassessed design displays “Design checks have not completed yet” instead of “No issues reported.” Explicit acceptance and saved inputs remain unchanged.

Verification: 112 focused backend reasoning/lifecycle/API tests passed, no failures/skips, including the configured-route and failure-reason regressions. Backend API compiled as part of that run. Frontend TypeScript passed and 8 focused review/clarification tests passed. No live model calls, migration or development data modification.

Load the updated backend by rebuilding/restarting the API. Refresh the proposal and explicitly use Try again to create a new attempt under the current prompt; the old terminal run remains historical and its saved inputs are preserved. If the new attempt stops, the new attention message identifies the recorded budget failure instead of requiring repeated blind retries.
