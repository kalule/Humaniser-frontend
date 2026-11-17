# Research paper workflow

The Research Paper option now uses the existing .NET writer through a durable Hangfire run. OpenDraft informed the separation of planning, source collection, composition, review and checkpoints; its Python engine is not substituted for the app's existing evidence and statistic gates. No upstream implementation was copied.

## Writing

1. Choose the actual purpose: proposal/protocol, study in progress, completed empirical paper, or literature-based paper.
2. Supply methods and results when writing completed empirical research. Pasted results are user-attested; a linked Analyst run is resolved against its real registry.
3. Build and review the research outline. Section budgets sum to the requested total. Edit each section's focus, then approve writing.
4. Closing the dialog or navigating away leaves the server job running. The document's recovery panel can insert a finished draft, resume interrupted work, or cancel a run.

Proposals omit empirical Results and Discussion. Literature-based papers synthesize existing studies without claiming a new empirical experiment. Abstracts are drafted after the body. The final consistency review is advisory and never rewrites already-verified claims.

The literature-based Review Method is assembled from the actual source pool and provider provenance. It identifies the work as a narrative synthesis and does not invent future searches, a systematic screening protocol, or access to full texts. A final research-mode mismatch marks the draft incomplete and can be repaired through resume.

## Topic coverage and report checks

Before drafting, a web-sourced pool is checked per core concept of the topic (`ResearchPaperQualityGates`). "Sleep quality and academic performance among university students" requires sleep to appear in at least three records; matching "quality" and "academic" is not enough. If a concept is short, one repair retrieval round targets it. If it is still short, the run fails before any drafting, because such a paper could only report its own subject as a research gap. A My Files pool is exempt. Configure with `Workbench:ResearchPaper:TopicCoverageGate:Mode` (`block` default, `observe`, `off`) and `:MinSourcesPerConcept` (default 3).

The Review Method now records the real queries, the search date, and the automated topical screening result. Section prompts state the exact registry size and forbid unscoped "gap" claims. After drafting, advisory flags are raised for: absence claims not tied to the sources reviewed, a stated source count that differs from the registry or the cited count, near-duplicate paragraphs across sections, mixed-script author names, and an author field that repeats the journal.

## Persistence and safety

- Runs, immutable requests, source registries, validated sections and final outcomes use the existing Hangfire PostgreSQL storage. They expire after seven days of inactivity.
- Client request IDs make dropped-response retries idempotent. An account can have one active research-paper run. Changing an outline or evidence creates a different request rather than silently changing a running job.
- A heartbeat expires after two minutes without updates. Interrupted work becomes resumable instead of remaining “searching.” Orphaned queue entries are detected separately from genuinely queued jobs.
- Explicit cancellation stops future work; an in-flight provider request can take time to observe cancellation. Attempt fencing prevents a cancelled or superseded attempt from publishing a result.
- Resume retains the stable source IDs and validated sections. Retrying an incomplete paper also invalidates its abstract and final consistency review so these reflect the repaired body.
- Citation normalization runs before identity checks, including repairs. Unknown IDs, statistic mismatches, citation floors and claim-support checks remain enforced. Evidence-state repair is bounded and reruns all those gates.
- Source metadata/DOI confirmation does not establish peer review or claim support. Existing source-availability and evidence warnings remain visible.

## Integration

Backend additions live in `HumaniseAI.Infrastructure/Services/ResearchPaperRuns.cs`, `ResearchPaperPlan.cs`, `WorkbenchService.ResearchPaper.cs`, and `HumaniseAI.API/Controllers/ResearchPaperRunsController.cs` in the sibling Humaniser repository.

Authenticated routes below `/api/v1/workbench/research-paper`:

- `POST /plan`: build a state-appropriate outline and word budgets.
- `POST /runs`: start an owned document's run with `runId`, `documentId`, and `request`.
- `GET /runs/{id}`: owner-only state, stage, saved-section count, and final result.
- `POST /runs/{id}/retry`: resume failed, interrupted, cancelled or incomplete work.
- `DELETE /runs/{id}`: cancel active work.

The `research-paper` queue is consumed by the updated generation server. This avoids sending the new job type to an older local worker. Frontend Vite proxying defaults to `http://127.0.0.1:5062`; `HUMANISE_API_PROXY` can override it. Ensure that port runs a build containing these changes.

Research-paper sections use the table-aware renderer already used for literature reviews. Tables, captions and interactive citation metadata remain in the editor/export HTML. This does not retroactively convert old documents saved as pipe-delimited text.

## Verification scope

Focused tests cover research-state outlines, exact budgets, empirical evidence requirements, source-ID preservation and rejection, idempotency, ownership isolation, stale heartbeats, cancellation fencing, incomplete-run resume, stored outcomes, table rendering, citation metadata and Word export markup.

Live verification artifacts are under `artifacts/research-workflow`. The representative topic is the relationship between social media use, time management, and academic performance among university students, explicitly in `LiteratureOnly` mode. Partial outputs remain marked `Incomplete`; a completed background task alone does not establish a complete or scientifically valid paper.

Browser automation was unavailable during implementation. API integration checks and rendering tests do not substitute for visual editor QA. Existing Word export behavior is preserved; this change does not introduce a new PDF, DOCX or LaTeX engine.
