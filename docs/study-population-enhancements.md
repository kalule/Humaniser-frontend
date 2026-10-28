# Study Population enhancements

Section 5.3 guidance now applies to the current Research Agent prose generator and the strict proposal workflow. It defines target and accessible populations separately, preserves accepted boundaries, distinguishes recorded characteristics from eligibility, avoids inferred institutional clustering and subgroup priorities, and keeps construct definitions and sampling detail in their own sections.

The current Research Agent no longer requires eight scholarly citations for population definitions. Its citation target is zero; relevant supporting sources may still be cited and verified. The existing approved draft is not automatically rewritten.

Population decisions are stored in the existing immutable specification JSON:

- Target and accessible populations remain in `study.design.targetPopulation` and `study.design.accessiblePopulation`.
- Existing legacy specifications use `population` and the explicit `study.decisions.accessiblePopulation` value.
- Optional `study.populationDescription` records `accessStatus` (`NotDecided`, `Proposed`, `Confirmed`), nullable `samplingFrameDocumented`, and recorded characteristic names and category labels.
- Eligibility continues to use `study.eligibility`. A recorded-only characteristic cannot simultaneously define eligibility.

The new controls appear in the study specification editor and research design details. Unknown frame status stays distinct from an explicit absence. Documenting a frame does not establish completeness. Access is never inferred as confirmed from a feasibility flag or recruitment plan.

The strict writer blocks a missing target or accessible population and conflicting characteristic roles before a drafting call. It uses the existing JSON output, revision protection, exact evidence bindings and one bounded repair attempt introduced for section 5.2. Population counts must retain their exact verified source claims; numbers from unrelated literature, citation metadata or a temporal boundary cannot be repurposed as enrolment counts.

Population subset relationships, the substantive relevance of characteristics, count scope/reference-period adequacy and representativeness remain semantic review responsibilities. The prompt explicitly requires them; deterministic checks do not claim to prove them. The current legacy prose generator receives the shared prose guidance and citation-target change; the new deterministic preflight and repair checks run in the strict workflow.

Validation: 344 backend tests passed across population/design guidance, design integration, methods guidance, content helpers and workflow architecture. The end-to-end fixture covers a malformed population response repaired through all four citation styles. Frontend production build and 25 focused tests passed. The backend continues to report the existing EF Core Relational package-version warning; Vite reports its existing bundle-size/import warnings.

No live model run, service restart, deployment or modification of the screenshot's approved section was performed. Existing records acquire these optional decisions when the author saves and accepts an updated specification; no database migration is needed.
