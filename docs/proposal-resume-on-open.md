# Autonomous proposal resume on open

Implemented 5 October 2026 in the frontend and sibling Humaniser backend repository.

Opening a stopped or failed autonomous proposal requests continuation using its saved per-section word target. Opening an active run reconnects to its progress; opening a completed proposal opens its document. A NeedsReview checkpoint remains visible and requires explicit review/resume. Validation and methodology gates remain in force.

The project list API now includes generation metadata. List badges distinguish Starting, Generating, Stopped, Failed, Needs review, Incomplete, Complete and Not started. Percentages use completed sections divided by required sections, consistently with the progress dialog. Focus/visibility refreshes and polling keep active list rows current. Closing the dialog hides progress; only Stop requests cancellation.

Backend status, project and list reads reconcile counts and words from scalar saved section checkpoints. Legacy proposals use the current autonomous section codes; specification-based proposals count sections generated against the accepted specification. Resume retains checkpoints instead of resetting counters to zero. Approved legacy sections retain their protection from regeneration, and the existing draft citation-repair path remains available.

Legacy resume requests serialize through a PostgreSQL project-row lock. Specification-based resumes use the existing advisory lock with ReadCommitted isolation for this operation and reload tracked project state after acquiring the lock. This prevents duplicate jobs from simultaneous opens across API requests. Enqueue failures leave a retryable Error state. No database migration is required.

Verification:

- Frontend production build passed; final TypeScript check passed.
- 49 focused frontend tests passed, covering reopen state decisions, preserved word targets, badges, checkpoint precedence and partial completion.
- Backend API build passed in isolated outputs.
- 46 backend tests passed: ProposalResumeCheckpointTests, ProposalWorkflowArchitectureTests and ProposalWorkflowPostgresTests. Real PostgreSQL concurrency tests verify both pipelines enqueue once, retain counts/words, clear cancellation and preserve approved prose. Test provider mocks prevent paid model calls.
- A separately run existing citation-repair test, ExecuteAsync_FirstChapterHasUnresolvableImportedCitation_RegeneratesAndRequestsReview, fails: its next-section model call is unscripted, causing automatic continuation (Starting) instead of the expected NeedsReview. Its assertion was left unchanged; this separate failure is not hidden by the passing focused suite.

Runtime activation: the live API was left running because it is processing a proposal and source jobs. At the final check, the screenshot's proposal had GenerationStatus=Generating and 12 saved sections. Restart/relaunch the API with the updated build after active work finishes, then refresh Proposal Studio. The source fixes are implemented, but the currently running API process does not yet contain them. No live proposal was cancelled or restarted by this work.
