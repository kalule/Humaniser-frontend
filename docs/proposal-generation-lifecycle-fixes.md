# Autonomous proposal generation fixes

Implemented 5 October 2026, following the section 5.5 and 5.7 investigations. The observed delay combined large evidence-processing workloads with interrupted workers and stale UI state. These changes address both the work limits and recovery lifecycle.

| Scenario | Result |
| --- | --- |
| Reopen an interrupted autonomous proposal | Resume from persisted sections; completed content is retained. |
| Original job is redelivered while recovery starts | The shared PostgreSQL execution lock permits one proposal worker. |
| Worker dies but the proposal still says Generating | Recovery checks execution ownership every minute; a free lock permits continuation. A Starting checkpoint gets a two-minute queue grace period. |
| Worker is alive but a section is older than ten minutes | The standalone section sweep does not reset an active autonomous run. |
| Autosave updates an abandoned proposal | A recent project timestamp cannot conceal a Generating run without execution ownership. |
| Legacy proposal says Completed but has missing sections | Reconcile incomplete persisted sections; complete Draft content does not trigger repeated recovery. Strict specification completion uses its own workflow. |
| User stops while evidence/model work is running | The worker polls cancellation every 30 seconds and propagates it through the current operation. Saved sections survive. |
| API shuts down | Shutdown cancellation remains eligible for job redelivery; it is not treated as a user Stop. |
| Evidence pool contains thousands of sources | Role classification selects at most 150 relevant unclassified sources, in three batches per invocation, with a 90-second budget. Results are saved after each batch. |
| Classification returns invalid or omitted roles | Those sources remain Unknown rather than being labelled Ineligible. |
| Optional DOI metadata is slow | Enrich at most 60 distinct DOIs with a 30-second budget; retain available metadata on timeout. |
| Legacy proposal discovery expands excessively | Ordinary provider retrieval is capped at 40 results per provider and 120 merged results. Explicit wide/structured discovery and other feature pipelines retain their existing limits. |
| A section exceeds its work budget | A five-minute section deadline pauses the proposal as NeedsReview instead of allowing repeated paid retries. Both legacy and strict generation apply the deadline. |
| UI polling or progress counters are stale | Reconcile counts and words from saved sections; show the last recorded activity and overdue heartbeat. Heartbeats alone do not count as section progress. |
| Progress has stalled | Explain the lack of progress without promising automatic recovery within a few minutes. |

These limits bound calls and cooperative operations; cancellation relies on downstream clients observing the cancellation token. They do not guarantee successful generation within five minutes or bypass citation and review gates. No database migration is required.

Validation: 50 focused frontend tests and TypeScript checking passed. Final backend compilation passed with existing nullable-reference and EF package-version warnings. All 82 targeted backend tests passed: 72 recovery/workflow tests, eight classifier/worker-lease tests, and two API resume/checkpoint cases covering legacy and strict workflows. Tests use disposable databases and mocked AI calls.

Runtime checkpoint: the affected proposal remained at 15 of 25 sections, 5,922 words, section 5.7. The database had no advisory-lock owner when checked, despite the persisted Generating label. This is the abandoned-worker scenario covered by recovery.

Runtime activation: started the corrected development API on the vacant port 5062 (PID 15668). Readiness returned HTTP 200. Hangfire redelivered job 13007; the affected proposal acquired its execution lock and renewed its heartbeat at 10:12:18 local. A competing continuation exited without work. At 10:12:29 the active worker began claim planning for section 5.7. Recovery then correctly skipped the owned proposal. Generation has resumed; completion of section 5.7 and the entire proposal has not yet been verified.

Follow-up verification: at 10:14:56 local, section 5.7 was persisted as Draft with 599 words and no generation error. The proposal advanced to section 5.7a, with 16 of 25 sections complete (64%) and 6,521 words. Its worker still owned the execution lock. The initial section writing call took approximately 14 seconds; the citation correction took approximately 23 seconds. This confirms that the formerly blocked section saved successfully and the autonomous job continued. The entire proposal remains in progress.
