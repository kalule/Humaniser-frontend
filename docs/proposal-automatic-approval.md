# Automatic approval for autonomous proposals

Autonomous generation now calls the normal approval gates after drafting. It never acknowledges or dismisses conflicts automatically. Citation, shared-fact, methodology and section-policy blockers still pause the run for review.

Legacy autonomous drafting runs verification inline so approval cannot race its newly queued verification jobs. An inconclusive citation-support check or disabled verification prevents automatic publication. On resumption, existing drafts are verified before approval; they are not regenerated unless their existing citation-identity repair path requires it. Successful legacy approval records a content hash and content version in the workflow artifact log.

The strict specification workflow accepts each validated section before advancing, so approved prerequisites become available to subsequent sections. Its normal specification/version/evidence gates still apply. The existing acceptance artifact is retained alongside an automatic-approval event. Semantic/examiner review and finalization remain separate.

Historic Completed proposals with unapproved drafts are reported as incomplete when reopened. Resume-on-open then queues their remaining validation and approval. Generation counters remain draft checkpoints during execution; the editor's approved-section count reflects actual approval. Completed requires the autonomous loop to finish approval. Editing a section already moves it to Edited, and reopening a completed proposal can revalidate it.

There is no migration. Already-running backend processes must load the rebuilt binaries before this behavior is active. This change does not blanket-approve existing content or bypass unresolved checks.

Verification: final build passed. All 97 focused backend tests passed: 72 workflow/recovery cases and 25 classifier, consistency and saved-draft approval cases. The new saved-draft cases verify that approval runs without regeneration and unresolved conflicts leave the proposal in NeedsReview. Strict workflow coverage verifies that a valid first section is automatically accepted before the next section is attempted.

Activation attempt found an existing API listener on port 5062 and left it running. Load the rebuilt backend during the next controlled restart to activate this behavior; do not restart an active generation operation solely to pick up this patch.
