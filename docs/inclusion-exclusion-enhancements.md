# Section 5.4 enhancements

The strict proposal workflow now compiles accepted eligibility criteria into numbered inclusion and exclusion tables. The application owns the statements, operational definitions, groups, screening methods, verification labels and decision rules. The model writes an introduction, a rationale for each accepted decision, a closing and author notes. Missing, duplicated, added or rewritten criterion rows fail validation and receive at most one repair call.

This adapts the supplied proposal to the existing evidence and generation contracts. No derived criterion is automatically added: suggestions belong in author notes until the author accepts a specification change. The original provider response remains available for provenance. Citations still use exact evidence bindings and application-rendered citation styles, rather than model-generated author/year keys.

Optional decisions are stored in the existing immutable specification JSON, so no database migration is needed:

- `study.eligibility` remains the criterion authority. Its existing field, comparison, value, unit and exclusion flag are preserved.
- Per-criterion `details` may specify group, operational definition, screening method, verification, whether record access is required, and a supplied rationale.
- `study.eligibilityPlan` records shared screening and verification, authorised record access, all/any decision rules, alternative routes, handling of unknown information, participants without prior exposure, accommodations and optional group-specific logic.
- Criterion decision IDs (`D1`, `D2`, …) are application-owned positions within the immutable revision; displayed inclusion and exclusion IDs are numbered separately.

Controls appear in both the study specification editor and research design details. Unconfirmed choices stay null. Separate groups or phases require an accepted group-specific rule; that rule replaces shared all/any logic. Verification through approved direct observation does not falsely require access to institutional records.

Preflight blocks missing populations, inclusion conditions, screening procedures, verification settings and decision rules; identical contradictory or duplicate conditions; ambiguous conditions lacking an operational definition; conflicting numerical definitions; and record verification without authorised access. The application does not guess how unknown information should be handled.

Accepted consent, participation-outcome, data-quality, study-variable or recorded-only conditions remain visible and receive review notes. A supplied rationale is preserved. Model-generated unsupported claims of scientific necessity, invented numerical rationale claims, placeholders, unsupported citations, design drift and assembled word-budget failures trigger repair or review. Author notes are persisted with successful generation and shown through the existing review findings.

The current legacy Research Agent prose generator receives the shared 5.4 authority and scope instructions. Its forced citation floor is now zero. The strict section contract also permits accepted administrative criteria without external literature; citations that are used remain subject to evidence checks. Deterministic tables, preflight and repair operate in the strict workflow. Existing approved content is preserved until explicit regeneration or reconciliation.

Semantic suitability, population compatibility, non-identical logical contradictions and whether evidence supports a restriction's rationale still require the model and reviewer; these checks are not presented as fully deterministic guarantees.

Validation includes the eligibility regression suite, existing 5.2/5.3 checks, methods guidance, citation targets, workflow architecture and frontend editor/table tests. End-to-end tests cover successful repair and failure after exactly one repair across Harvard, APA, IEEE and MLA; a failed regeneration preserves the approved section.

No live model run, service restart, deployment or alteration of the approved section in the screenshot was performed.

Final validation: 366 backend tests and 29 frontend tests passed. Backend compilation and the frontend production build succeeded. Existing EF Core package-version and Vite bundle/import warnings remain.
