# Proposal Studio UX consolidation - implementation report

Date: 2026-10-06. Verdict: **PROPOSAL STUDIO UX: NOT READY FOR ACADEMIC REVIEWER.**

The list and workspace consolidation is implemented. Accepted structured designs can move through explicit acceptance, writing-mode selection, proposal writing, source inspection and existing review/finalization in the current product shell. A new topic-only proposal still cannot obtain its initial typed design from the existing engine. The UI and backend now expose that limitation and fail closed. This report does not claim the requested new-proposal journey is complete.

## A. Current Proposal Studio UX audit

The focused audit was completed before substantial changes: [audit](proposal-studio-ux-consolidation-audit-2026-10-06.md). CodeGraph was consulted first; live sources supplemented the stale frontend index and the backend graph's database-open failure. Existing dirty work was preserved.

## B. Current new-proposal flow discovered

Creation previously asked Guided versus Autonomous before design acceptance. Neither flow established a typed Research Design from topic-only input. ResearchDesignLifecycleService requires a confirmed profile; ReasoningService rejects a missing Study.Design; OutputBoundary.Merge cannot add the initial question/objective/construct/analysis graph.

## C. Current Guided/Autonomous behaviour

The existing GENERATOR/AGENT implementations and autonomous job remain. Legacy reading, editing, progress, cancellation and explicit retry are preserved through the compatibility path; retry reads the saved section word preference. No legacy proposal is retroactively labelled accepted by Research Design.

## D. Existing Research Design integration

The Phase 7 workspace, questions, status polling, candidate review and acceptance commands are reused. ApplicationService owns allowedActions. The existing atomic methodology/canonical acceptance transaction is unchanged.

## E. Existing Deep Research/evidence integration

Existing bounded evidence handoff, package verification and selective revalidation remain backend responsibilities. No new search logic, agent, evidence store or provider client was added. Browser evidence states are fixtures, not verification of live research quality.

## F. Existing proposal overflow actions

The old overflow exposed Research Design, Evidence packages and Research & submission review as optional tools. Those entry points now live inside the proposal workspace.

## G. UX problems identified

Premature mode selection; scattered workflow entry points; progress-only completion language; dense all-section controls; technical source terminology; stale animated row content; browser-back navigation diverging from local tab state; and inaccessible secondary-button contrast outside the scoped product styles. The initial-design and incomplete clarification-contract gaps are the release blockers below.

## H. Information architecture changes

One list entry opens the existing proposal workflow route. The workspace offers Design study, Sources, Proposal and Review. Existing navigation, authentication, app header, sidebar and document/editor remain. No new shell, dashboard or global visual identity.

## I. New-proposal journey changes

One New proposal action opens a shared modal for topic and academic level, with referencing preferences under disclosure. Owned project creation saves a design-first marker using existing artifacts. A payload-specific idempotency key protects retries; conflicting reuse returns HTTP 409. Topic text is not copied into a discipline field. The new project cannot write or bypass the lifecycle through legacy specification acceptance.

**Incomplete:** topic setup cannot yet produce the typed draft required by the existing design engine. The backend returns a setup-required outcome without enqueuing paid reasoning; the view removes Start/Accept and explains the limitation. The existing setup remains accessible as a compatibility recovery path, not completion of the desired simple journey.

## J. Research Design integration changes

ResearchDesignWorkspace can be embedded without duplicating its commands, forms or candidate components. Accept & continue opens writing after a successful explicit acceptance command. Clarification replies now apply to the selected recommendation draft, preserving proposed components instead of reverting to the original request. Unsupported clarification types no longer link back to the same page in a loop.

## K. Writing-mode changes

After a current typed design is accepted, server-allowed choices are Write with guidance and Create first draft. Both bind the same accepted revision and use existing writer/evidence safeguards. Full draft requires confirmation mentioning credits. A durable command key prevents re-enqueueing the same full-draft request after a worker pause. Mode selection changes the writing preference, not accepted methodology, design JSON or student paragraphs. Writing options remain available when the server permits changing modes.

## L. Proposal list/filter changes

Filters are All, In progress, Needs attention and Completed versions. Existing Guided/Autonomous labels are no longer creation/filter concepts. Completed version available means an archived finalization exists for that revision; it is deliberately not a claim that the currently edited document is submission-ready. Unknown or unavailable state is not fabricated as complete.

## M. Proposal-row changes

Rows show title, academic level, modification date, referencing style, backend stage and a visible next-action label. Search, sorting, initial 25-row display and Load more remain in the existing list. Mocked browser fixtures retained all 94 legacy rows; no development database was read or migrated to substantiate that count.

## N. Overflow-menu changes

Open and Delete are the supported management actions. Delete uses the existing accessible Modal/Button components and requires confirmation; failures retain the dialog with safe feedback. Rename, Duplicate and Export were not invented where no existing project management implementation supports them.

## O. Evidence/source UX changes

Supporting research and Research evidence replace packages as primary student language. Existing verification, ownership, provenance, limitations and exact-claim controls remain. Detailed claim inspection is secondary. Source-panel review navigation stays inside the workspace; standalone consumers keep their existing functionality. Consolidated source errors suppress raw provider/database diagnostics.

## P. Proposal workspace changes

The current ProposalWorkflowPage composes existing design, evidence, readiness and generation components. Writing displays one selected section, retaining generation, acceptance, manual reconciliation and targeted-repair preview. Existing review checks and finish/download gating remain. History and gap/search coverage are secondary disclosures.

## Q. Status/next-action mapping

ProposalJourneyService supplies owned bulk summaries and project views. SettingUp, Designing, NeedsInput, CheckingEvidence, DesignReady, ReadyToWrite, Writing, NeedsAttention, ReadyForReview and CompletedVersionAvailable map to student wording. Staleness takes priority over old completion records. React translates labels; it does not grant acceptance, writing-mode or retry actions.

## R. Routing changes

New/open proposals use /app/research-agent/{projectId}/proposal-workflow. Workspace selection is URL-driven through its tab query parameter, so browser back restores the correct view. Standalone design/evidence routes remain compatible. No global route or navigation source was replaced.

## S. Legacy compatibility

Saved legacy proposals can be opened without new acceptance. Existing autonomous progress and stopped/error/review retry controls remain available; legacy retry is explicitly confirmed and labelled as the earlier research setup. Thesis Studio's icon controls and delete action were checked after the shared list changes. Actual production/development proposal data was not migrated or tested with live writes.

## T. Research Design revision/staleness UX

Existing Phase 8 readiness and affected-section metadata drive the warning. Updated design adoption is explicit. Drafts cannot generate against unresolved stale state. The archived content remains readable and available for manual reconciliation.

## U. Student-edit protection

Mode changes, design acceptance and binding do not replace section text. Regeneration retains its replace-draft confirmation; repair is preview-only until the student explicitly saves. Existing content-version, accepted-revision and idempotency fences remain. Browser checks confirmed the preserved paragraph after a simulated revision.

## V. Accessibility

Shared focus-trapping modals, labelled inputs, keyboard controls, error/status announcements and current-step indication are reused. The list prevents Enter on a nested control from opening the row. Scope styling makes secondary controls readable. This is focused interaction verification, not a complete screen-reader/automated accessibility audit.

## W. Responsive behaviour

Browser checks at 390, 768 and 1280 pixels found no horizontal overflow in the list or workspace. Screenshots are in [browser artifacts](proposal-journey-browser/results.json). Existing mobile shell and navigation remain.

## X. Performance/query impact

The list uses one owned summary request, not one design/evidence request per row. The server batches project scalars, artifact metadata, run statuses and section flags into four queries, excluding full artifact payloads. Full research projects are still loaded by the existing list API; backend pagination is a future optimization. Sources/discovery load only in their relevant workspace views. Existing active-work polling is retained. GETs do not run AI or write academic state.

## Y. Files changed

Changes in this task (other dirty files belong to preceding work):

Frontend:
- src/pages/app/ProposalStudioPage.tsx
- src/pages/app/ProposalWorkflowPage.tsx
- src/pages/app/ResearchDesignPage.tsx
- src/components/app/DocumentList.tsx
- src/components/research-design/ProposalDesignReadinessPanel.tsx
- src/components/research-design/ProposalSetupDialog.tsx (new)
- src/components/research-agent/EvidencePackageReusePanel.tsx
- src/api/research.ts
- src/api/proposalJourney.ts and proposalJourney.test.ts (new)
- src/types/proposalJourney.ts (new)
- src/lib/proposalJourney.ts and proposalJourney.test.ts (new)
- scripts/proposal-journey-smoke.mjs (new)
- this report, focused audit and generated browser artifacts

Backend paths relative to ../Humaniser:
- HumaniseAI.Application/DTOs/Research/ResearchDtos.cs
- HumaniseAI.Application/DTOs/Research/ProposalJourneyDtos.cs (new)
- HumaniseAI.Infrastructure/DependencyInjection.cs
- HumaniseAI.Infrastructure/Services/ResearchService.cs
- HumaniseAI.Infrastructure/Services/ProposalWorkflowService.cs
- HumaniseAI.Infrastructure/Services/ProposalWorkflowDesignIntegration.cs
- HumaniseAI.Infrastructure/Services/ProposalJourneyService.cs (new)
- HumaniseAI.Infrastructure/Services/ResearchDesign/ResearchDesignApplicationService.cs
- HumaniseAI.API/Controllers/ResearchController.cs
- HumaniseAI.API/Controllers/ProposalJourneyController.cs (new)
- HumaniseAI.IntegrationTests/ProposalJourneyTests.cs and ProposalJourneyApiTests.cs (new)

Shared changes were limited to DocumentList, the opt-in source-panel presentation, and readiness view reuse/modal styling. DocumentList's outer AnimatePresence retained old child props in browser verification; removing it makes changed statuses visible. Row and overflow animations remain. Existing Thesis Studio actions were checked. No shared Button, Modal, shell or design-system replacement.

## Z. Tests added

28 new frontend tests cover stage/filter wording, uncertainty, safe errors, opaque retry-key persistence and API calls against the shared client's already-unwrapped response convention. 17 new backend cases cover ownership/read-only queries, design-first markers, unchanged authority/content for both modes, stale revisions, command replay, topic-only fail-closed behavior, creation idempotency and authenticated HTTP contracts.

Final frontend suite: **349 passed, 0 failed, 0 skipped, 45 files**. Broad backend selection: **1,410 passed, 0 failed, 0 skipped**, 11 min 48 sec, including previous Research Design/proposal regression suites and the new cases. After the final creation error and legacy compatibility adjustments, all **17 journey cases passed again, 0 failed, 0 skipped**. The last stage-label adjustment additionally passed all **8 deterministic policy cases**. These reruns overlap the broad selection; they are not added to its unique test count. TRX files are under ../Humaniser/HumaniseAI.IntegrationTests/TestResults/ (proposal-journey-regression.trx, proposal-journey-final.trx, proposal-journey-policy-final.trx). All providers were mocked; database integration used disposable test databases and existing migrations, never the development database.

## AA. Browser assertions

**54 assertions passed, 0 browser errors.** Coverage includes current shell, 94-row fixture preservation, management-only overflow, keyboard handling, single creation on double click, no invented setup authority, honest topic-only blocking, explicit acceptance, post-acceptance modes sharing one revision, retry keys, cancelled full draft, source/review views, finish gating, browser back, staleness/student text, failed readiness, mobile widths, legacy reading/autonomous retry confirmation and Thesis Studio shared-list controls. [Exact results](proposal-journey-browser/results.json).

No browser fixture claims an end-to-end topic-only design recommendation succeeds. Paid models and literature providers were not called.

## AB. Build result

Production build: PASS (tsc -b followed by vite build). Existing large-bundle and auth-store mixed-import warnings remain. Backend API compiled successfully; the integration build reports an existing EF Core relational-package version warning.

## AC. TypeScript result

PASS: no TypeScript errors in the production build.

## AD. Lint result

npm run lint cannot run: the ESLint executable is not installed. ESLint remains unavailable. This is separate from the concrete product release blockers; no unrelated dependency installation was performed.

## AE. Known limitations and scope declaration

| Item | Result |
|---|---|
| Backend code changed | Yes: owned projection, mode/setup commands, replay fences, safe controller errors and verified integration guards |
| API contracts changed | Yes: optional design-first creation fields; journey list/view and writing-experience command |
| Database schema changed | No |
| Migration created | No |
| Development DB changed | No |
| Research Design code changed | Yes: recommendation-preserving input and honest setup-required gates; no new reasoning, taxonomy or acceptance architecture |
| Deep Research code changed | No; opt-in frontend source presentation changed |
| Proposal generation logic changed | Start orchestration/revision/idempotency guards changed; section generation, prompts and existing jobs remain |
| Existing proposal data migrated | No |
| Live AI calls | 0 |
| Live literature-provider calls | 0 |
| Academic Reviewer started | No |

The new-topic flow is deliberately blocked before AI rather than falsely advertised as running. The compatibility setup link is not a substitute for implementing initial typed design creation. Verification does not certify live proposal output quality, all accessibility criteria or production deployment.

## AF. Recommended follow-up / release verdict

**PROPOSAL STUDIO UX: NOT READY FOR ACADEMIC REVIEWER.** Concrete blockers:

1. Topic-only setup cannot produce the initial typed Study.Design and canonical component graph. The current lifecycle requires a profile and the reasoning boundary only refines existing IDs. Implement a bounded initial draft command within the existing routing/budget/validation architecture, with explicit acceptance and no invented numeric/evidence/resource facts.
2. Methodological findings requiring structured sample-planning/resource inputs cannot all be resolved by the existing seven-field clarification contract. Generic Specification findings are not answerable through that API. Complete the typed clarification/revision path needed by initial designs and demonstrate a real topic-to-accepted-design golden fixture before calling the new journey complete.

Resolve these verified integration gaps before starting Academic Reviewer. Do not weaken validators, manufacture a confirmed profile or use a browser-only successful fixture as proof of completion.

## 2026-10-06 backend repair follow-up

See [initial-draft backend repair](research-design-initial-draft-backend-fix-2026-10-06.md). The backend now permits durable initial design runs without manufacturing a confirmed methodology profile, supports bounded initial graph proposals, and provides exact owned drafts plus typed specification clarification commands. Existing acceptance remains atomic and validation remains mandatory. These changes supersede the original backend setup-required restriction above.

This does not change this report into a complete UX release verdict: the student question component still requires structured-revision form integration. Backend API support must not be represented as a verified live student journey.
