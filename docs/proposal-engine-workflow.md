# Proposal research workflow

## Researcher sequence

1. Confirm methodology in the research workspace and include the intended source corpus.
2. Open **Research & Submission Review** from the research dashboard. Complete the imported design, linked research records and sampling inputs; explicitly accept the reconciled revision. Imports are not automatically verified.
3. In **Claim Evidence**, choose a section/source, select the actual passage from the read-only source text, enter the exact claim and request support/counterevidence review. Abstract-only coverage stays explicit. Resolve Unknown/Fail before depending on a binding.
4. Run discovery in the existing literature workspace. Create a scoped **Research Gap** dossier with executed queries and reviewed evidence. Record coverage limitations and counterevidence assessment, including when no counterevidence was located.
5. Generate sections in dependency order through **Writing & Acceptance**. Read and explicitly accept each draft. Researcher edits pin the loaded content version and declare their exact bindings. Resolve citation/fact conflicts in the research workspace; acknowledgement does not verify them. Autonomous generation checkpoints after each new draft; accept then resume from the dashboard.
6. Resolve deterministic blockers in **Submission Review**, run semantic and examiner reviews, then **Finalize & Download**. Later changes require fresh checks. **History** retains the finalized snapshot for download.

Unsupported sampling designs return Unknown. The two-group calculation is a balanced, two-sided normal approximation. Institution templates must use supported section codes and match the citation style; illustrative templates cannot certify readiness.

## Architecture ownership

Backend paths are relative to the sibling Humaniser repository.

| Responsibility | Implementation |
|---|---|
| Accepted design/schema | CanonicalResearchPlan and ProposalWorkflowDtos.cs |
| Graph/sampling/section policy | Infrastructure/Services/ProposalWorkflowPolicy.cs |
| Orchestration/freshness/finalization | Infrastructure/Services/ProposalWorkflowService.cs |
| Immutable provenance | ProposalWorkflowArtifact, its EF configuration and ProposalAiCallContext |
| Owned API | API/Controllers/ProposalWorkflowController.cs |
| Compatibility and checkpoints | ResearchService, ProposalGenerationJob, question/objective synchronization |
| Executed-search records | ResearchLiteratureDiscoveryJob |
| Frontend | ProposalWorkflowPage.tsx and ResearchSpecificationEditor.tsx |

API base: `/api/v1/research/projects/{projectId}/proposal-workflow`. GET operations provide state, sources, source passages and history. POST operations accept specifications, assess evidence/gaps, generate/reconcile/accept sections, review semantically/as examiner and finalize. Archived downloads return stored bytes and `X-Document-SHA256`.

Readiness follows current inputs rather than job progress. Unknown/Pending/Stale/Fail and unresolved Warning blockers prevent finalization. Artifacts preserve earlier decisions; freshness/supersession are computed on read. Fingerprints exclude review artifacts so both reviewers can evaluate the same input.

## Rollout and checks

Apply the migrations listed in the [implementation status](proposal-engine-implementation-status.md) through the existing API process. Include the existing earlier library migrations in the deployment chain. Reconciliation is explicit; no automatic verification backfill is performed.

Frontend: `npm test` and `npm run build`. Mocked browser smoke:

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175
node scripts/proposal-workflow-smoke.mjs
```

Use separate terminals. `PROPOSAL_SMOKE_ORIGIN` selects another local origin. The fixture intercepts only `/api/v1/` requests and writes screenshots to the OS temporary directory; no production account is needed.

From the API repository:

```powershell
dotnet test HumaniseAI.IntegrationTests/HumaniseAI.IntegrationTests.csproj --filter "FullyQualifiedName~ProposalWorkflowArchitectureTests|FullyQualifiedName~ProposalWorkflowPostgresTests|FullyQualifiedName~ProposalSafetyTests|FullyQualifiedName~ProposalGenerationJobCitationRepairTests|FullyQualifiedName~ObjectivesAndResearchQuestionsCrudTests|FullyQualifiedName~ResearchGeographyAlignmentTests|FullyQualifiedName~SampleSizeDataAlignmentTests|FullyQualifiedName~ResearchWorkflowEvaluatorTests"
```

PostgreSQL tests use the existing ResearchTestFactory disposable pgvector configuration. Provider mocks prevent live search/LLM spending. Production rollout still needs institution-specific DOCX review and separately budgeted live evidence/contradiction/thin-corpus evaluation. Test success does not certify scholarly correctness.
