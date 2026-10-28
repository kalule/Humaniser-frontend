# Reusing Deep Research across a project

Research Library's **Reuse in Proposal Studio** action opens the project's Research & Submission Review workspace with its package selected. The student selects sources, reviews the scope, acknowledges partial evidence if necessary, and chooses **Reuse selected evidence**. An accepted specification and current confirmed methodology are required. Only packages from the same owned project are supported; this does not silently transfer evidence to a different project.

The backend imports verified accepted sources through the existing reference-import path and appends an `EvidencePackageReuse` workflow artifact containing the immutable package, original hash, specification revision and source-to-reference mappings. A project transaction/advisory lock serializes reuse. An identical active selection is idempotent; a changed selection creates another immutable handoff. Existing excluded or retracted references remain excluded. **Stop using package** appends a detached handoff and preserves references and student decisions. No new migration is required; this uses the existing workflow artifact table and session checkpoints.

Consumers receive a projection of the original package filtered by current source acceptance, verification, project inclusion and retraction status. Findings whose linked sources are not selected are removed. The package hash identifies the original snapshot, not this filtered projection. Partial or reduced selections cannot inherit the package's evidence-sufficient label. Specification or confirmed-methodology changes make attachments stale; stale handoffs and handoffs with no eligible selected sources block generation until resolved or detached.

## Proposal Studio

Both governed section generation and the existing proposal/thesis writer receive the stored package context. Governed proposal review receives it too. Package eligibility contributes to the workflow fingerprint, making earlier reviews stale when relevant source decisions change. The reuse panel proposes exact passage bindings through the existing binding modal; the student still chooses the section and claim and submits the binding for validation. Package reuse does not manufacture a passing evidence binding or validated gap dossier.

For attached current packages, the existing writer suppresses automatic topic discovery, supplementary Scholar searches, technical/claim-gap discovery, methodology-anchor retrieval and citation-gap-fill discovery. It uses project evidence already stored. Existing citation/claim verification and quality gates remain active and can reject insufficient evidence. Explicit new Deep Research is still available when more coverage is needed. This avoids rerunning research merely to consume its package; it does not claim that verification makes no provider calls.

## Reviewer → Research Design → Thesis

The existing Reviewer receives package findings, contradictory/null evidence, coverage and limitations with the project document. Its result is stored as an `EvidencePackageReviewerHandoff` artifact, linked to the package/source-selection and document-content fingerprint captured before review. Changing the source selection, eligibility, specification or document makes feedback stale.

The research-design workspace displays current/stale reviewer feedback and links to the report. The existing analysis-plan generator receives current package evidence and reviewer feedback as input; it does not silently rewrite the accepted research specification. Reviewer workspace now links directly to Research Design, project packages and the thesis-readiness tab.

Thesis readiness audits and thesis section writing receive the same project handoff. Existing readiness, empirical-data, research-state and transition checks remain in force. Literature findings are explicitly distinguished from the student's empirical results. This connects the existing design and thesis workflows; it does not add a separate autonomous Research Design Agent or claim that Deep Research has demonstrated superior evidence quality.

## Validation and activation

Eight new backend tests cover ownership, partial acknowledgment, stale hashes/revisions, idempotent source imports, exclusion preservation, retraction, reviewer-fingerprint invalidation, detach/reattach and stale-methodology generation blocks. These use the EF in-memory provider; they do not prove PostgreSQL concurrency behavior. The final regression run passed **266 tests**, covering deterministic Deep Research, package reuse, proposal governance, Reviewer parity and thesis readiness. The backend build passed with existing warnings. Existing Deep Research behavior was revalidated after restoring the service from its last compiled build following an editing encoding error.

TypeScript checks passed. `scripts/evidence-package-reuse-smoke.mjs` checks source selection, partial acknowledgment, provenance, reuse, binding proposal availability, reviewer handoff availability and detach with mocked APIs. `scripts/evidence-packages-smoke.mjs` checks Research Library browsing, download, error recovery and mobile width. These checks do not invoke paid providers/models or establish research quality.

The updated local backend is running on `http://localhost:5062`. Live and readiness health checks returned HTTP 200; its Swagger schema exposes package retrieval, reuse/detach, project packages and reviewer-feedback endpoints. Unauthenticated project-package access returned HTTP 401. Startup migrations were disabled for this activation. These checks verify service availability and authentication enforcement; they do not replace an authenticated end-to-end reuse check.

Proposal Studio research-project menus now include **Evidence packages** and **Research design & review** for direct access to these workflows. The frontend TypeScript check passed after adding these actions. Automatic research initiation and autonomous acceptance of package evidence remain disabled; reuse is an explicit student action.
