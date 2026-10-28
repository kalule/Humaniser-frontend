# Proposal Studio UX consolidation ? focused audit

Date: 2026-10-06. Audit completed before substantial application changes. Scope: one proposal journey, existing agent integration and legacy access. Research Design architecture remains frozen except demonstrated integration defects. No live providers or development DB changes.

## Current architecture

ProposalStudioPage merges ResearchProject and StudioDocument into the shared DocumentList. Authenticated AppShell/NAV_SECTIONS owns navigation; ResearchAgentPage is the existing full-screen section editor/setup wizard. ResearchDesignPage owns the existing Phase 7 guided design component and account-scoped React Query. ProposalWorkflowPage owns exact claims, gap evaluation, writing/reconciliation, semantic/examiner review and finalization. Phase 8 readiness owns accepted/bound revision, affected sections and allowed generation actions. EvidencePackageReusePanel currently exposes package-management controls with three initial requests, even outside source work.

The list performs bulk project/document loads; adding a design/status request per row would cause N+1 loading. GeneratorMode is persisted as GENERATOR/AGENT and is not a trustworthy completion state. ProgressPct can reflect wizard navigation; generation Completed means draft generation completed, not final submission. Current persisted values must remain compatible.

## Journeys discovered

| Journey | Current route/behaviour | Consolidation requirement |
|---|---|---|
| A New Guided | Name modal ? research-agent/new ? topic/title/location/methodology/literature wizard | Single minimal setup before design; writing choice later |
| B New Autonomous | Separate preference modal ? create/sync ? confirm methodology ? start generation | New topic-only proposals must not launch writing |
| C Existing Guided | List opens wizard/editor at saved step | Preserve editor and saved data; workspace entry with explicit legacy continuation |
| D Existing Autonomous | List opens generation panel or generated document according to phase | Preserve generation/resume/cancel and original sections |
| E Without design | Legacy profile/setup is independent of strict canonical workflow | Label compatibility; do not require retrospective acceptance to read |
| F Accepted design | Separate design route link ? Research & Review ? section controls | Same workspace; writing mode after accepted revision |
| G Needs input | Phase 7 asks one answerable backend question | Reuse it; allowedActions governs submission |
| H Evidence work | Phase 5 durable handoff; Phase 7 polls backend | Contextual automatic evidence work; no manual agent launch in ordinary flow |
| I Design changed | Phase 8 readiness/binding warns and marks affected sections | Explicit adoption/reconciliation; preserve paragraphs |
| J Completed | List can infer Complete from 100% progress | Distinguish finished draft from backend finalization; archived existing content stays readable |

## Verified creation integration defect

ResearchDesignLifecycleService.Snapshot requires CurrentMethodologyProfile before any design recommendation. ResearchDesignReasoningService preflight requires a typed Study.Design; OutputBoundary.Merge assumes it exists and forbids initial component creation. A topic-only project therefore cannot use the advertised Design-first journey. This is an integration defect, not a reason to fabricate a confirmed profile or weaken acceptance. A bounded initial draft branch must preserve explicit user facts, use the existing reasoning budget/provider/validator and leave unresolved findings blocking. Existing typed revision handling must remain unchanged.

## Decisions

- One New proposal action, existing project persistence, minimal topic/level/style setup; no new importer.
- Reuse ProposalWorkflowPage as the workspace and compose the existing ResearchDesignWorkspace there; standalone routes remain compatible.
- Design/evidence/writing/review become workspace stages. Overflow becomes Open/Delete only because unsupported management actions must not be invented.
- Preserve GENERATOR/AGENT internally; show Write with guidance/Create first draft after acceptance.
- Add a server-owned compact journey projection, batch list summaries and explicit writing-mode command; no per-row design/evidence reads.
- Use backend finalization and stale flags for lifecycle; no progress-only certification.
- Show Sources/supporting research; retain underlying package provenance and exact-claim gates.
- Keep the existing editor, autonomous job, review/finalizer and canonical writer. No new agent, model client, methodology rules, migration or duplicate shell.
