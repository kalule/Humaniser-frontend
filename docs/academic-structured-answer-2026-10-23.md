# Structured answer-quality repair ? 2026-10-23

`EssayQuestionCoverage.RepairAsync` now requests passage IDs and structured claims rather than original/replacement prose strings. It uses the shared passage compiler: exact source IDs, no inline citations or guessed locators, no marker changes, and whole-batch validation before mutation. Invalid batches retain the original essay for the existing subsequent review.

Targets are paragraphs containing a review excerpt; omissions allow selection of an existing relevant paragraph. The pass handles at most four paragraphs per call. Each paragraph may cite only its existing source IDs; introductions cite nothing and conclusions remain limited to body sources. Retrieval and evidence-repair stages own new source assignment. This conservative boundary means an omission needing new citations cannot be fully repaired here.

The existing remote-work regression now supplies structured claims and still checks re-review, unchanged surrounding text and a bounded conclusion. Two additional cases verify atomic rejection when a later patch uses an unknown source or borrows a source from another passage.

Validation: Infrastructure build passed with 46 existing warnings and zero errors. The selected essay/citation/CSL/OpenAlex regression suite passed all 428 tests. Logs: backend `artifacts/structured-answer-build.log` and `artifacts/structured-answer-regression-tests.log`. No live model calls or deployment. Whole-essay writers remain an integration boundary.
