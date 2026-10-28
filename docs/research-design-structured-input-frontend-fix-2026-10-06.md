# Research Design structured clarification — frontend repair

The existing Research Design workspace now handles the backend's `Specification` clarification using its exact `draft`. It reuses the existing specification and study editors inside the current application shell. Saving submits `ProvideInput` with `value.specification`; it never invokes acceptance or proposal generation. After server validation permits acceptance, the existing explicit acceptance confirmation remains required.

The new details section exposes access/resources, sample-planning assumptions, measurement, analysis, missingness, ethics and instrument availability/permissions. Optional contracts can be added as incomplete proposed input. No authoritative sample calculation or methodological compatibility decision runs in React. Shape checks prevent invalid closed-enum and nonfinite numeric payloads; the backend owns reference integrity, evidence sufficiency, methodological findings and readiness.

The full draft is cloned and edited without rebuilding its graph. Existing stable IDs, unedited metadata and evidence provenance survive. Evidence IDs and verification claims are excluded from generic editing. Title, academic level, citation style and template stay fixed for this clarification command. Pending requests disable the form. Review confirmation is required before **Save details & check design**. Missing draft data produces an actionable message instead of an invented specification. Existing server versions and payload-specific idempotency keys remain in use.

Changes:

- `src/types/researchDesign.ts`: additive draft and specification-input contracts.
- `src/pages/app/ResearchDesignPage.tsx`: structured clarification within the reused workspace, including embedded Proposal Studio.
- `src/components/research-agent/ResearchSpecificationEditor.tsx`: opt-in draft-check mode and pending locks; its existing acceptance consumer retains default behavior.
- `src/components/research-design/ResearchDesignDetailsEditor.tsx`: structured details using existing fields, links and buttons.
- `src/lib/researchDesignDetails.ts`: immutable edits, API shape options and basic input checks.
- Focused helper/rendering tests and `scripts/research-design-details-smoke.mjs`.

Verification:

- **365 frontend tests passed**, 47 files, including 12 new helper/rendering cases.
- **19 new mocked browser assertions passed**, zero browser errors: exact draft editing, ID/metadata preservation, explicit review, input command payload, idempotency, pending controls, missing-draft handling and widths 390/768/1280. [Results](research-design-details-browser/results.json).
- **41 existing Research Design browser assertions passed**: acceptance, cancellation, conflicts, retries, evidence states, history and responsive behavior.
- TypeScript and production build passed. Existing bundle-size/auth-store import warnings remain.

All browser API requests were intercepted. No live AI/literature calls, development database writes, migrations, or Academic Reviewer changes. These tests establish frontend contract integration; they do not certify real model output, every methodological design family, or a live topic-to-accepted-design journey. The earlier consolidation report's missing structured-input frontend path is addressed here; its historical test counts and release verdict remain historical.

Student flow: open the proposal workspace's **Design study** view, answer scope questions, complete requested study details, **Save details & check design**, resolve remaining server findings/evidence, then explicitly **Accept research design** before choosing writing mode.
