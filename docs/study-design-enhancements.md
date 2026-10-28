# Study Design generation enhancements

Implemented in the sibling `Humaniser` backend repository, within the existing strict proposal workflow. No frontend API or output-status changes are required.

Section 5.2 now receives dedicated guidance covering accepted design dimensions, question/objective fit, canonical constructs, fair alternative comparisons, inferential boundaries, and evidence-only citations. Its bounded context includes the accepted problem, intent, constructs, feasibility constraints and mixed-methods integration details.

The existing accepted-revision, design-readiness, exact evidence-binding, credit reservation, idempotency, word-budget and concurrent-edit guards remain in force. Citation formatting continues through the application's registry for the selected style.

A section 5.2 response with malformed output, design drift, an invalid word budget, placeholders or invalid evidence citations gets at most one repair call. That call receives the original input, previous response and specific validation errors. The first response and errors are recorded as a `GenerationRepair` artifact; the final response still passes the existing persistence guards. The repair shares the original generation charge and records both provider calls through the existing AI context. Genuine unresolved methodological decisions are not automatically repaired away.

The drift validator permits narrowly recognised hypothetical alternative clauses, while checking subsequent assertions about the planned study. This is a heuristic, not a complete semantic guarantee. Prompt instructions govern the quality and fairness of justification; human review remains relevant.

Changed backend files:

- `HumaniseAI.Infrastructure/Services/StudyDesignSectionGuidance.cs`
- `HumaniseAI.Infrastructure/Services/ProposalSectionContextCompiler.cs`
- `HumaniseAI.Infrastructure/Services/ProposalDesignDriftValidator.cs`
- `HumaniseAI.Infrastructure/Services/ProposalWorkflowService.cs`
- `HumaniseAI.IntegrationTests/StudyDesignSectionGuidanceTests.cs`

Validation uses deterministic regression tests and existing workflow architecture tests. No live model generation, deployment or service restart is performed.

Final validation: backend build succeeded; 105 tests passed across `StudyDesignSectionGuidanceTests`, `ProposalDesignIntegrationTests` and `ProposalWorkflowArchitectureTests`. The build still reports the existing EF Core Relational package-version conflict warning.
