# Section 5.5 generation delay — 5 October 2026

Read-only investigation of proposal bf282007-306b-4a22-8201-fee5ead053c1 using PostgreSQL checkpoints, Hangfire state histories, AI attempt records and Seq events. Times below are South African local time (UTC+2).

| Time | Evidence |
|---|---|
| 08:23:58 | Section 5.4 saved; section 5.5 subsequently began. |
| 08:24:23 | Original job 12959 recorded its section 5.5 claim-planning result, latency 3.476 seconds. |
| 08:25:53 | Methodology-anchor verification cancelled after 15.190 seconds, consistent with the source's 15-second pre-draft budget. |
| 08:28:03 | API application startup recorded; the original job's server PID was 11796, the replacement PID 42428. |
| 08:40:10 | Stale-proposal reconciliation logged automatic continuation and enqueued job 13007. |
| 08:41:07 | Hangfire also redelivered original job 12959 to the replacement server, on a different worker. |
| 08:40:41 / 08:41:52 | Both job IDs recorded successful claim-planning calls for the same section, 4.457 and 6.501 seconds. |
| 08:44:10 / 08:44:52 | Source enrichment batches of 217 and 206 candidates took 74.474 and 104.068 seconds. OpenAlex timeouts and a remote connection reset were logged. |
| 08:47:49 | One section 5.5 literature-fetch phase finished after 432.169 seconds (7 minutes 12 seconds). |
| 08:48:00 | Its drafting model call completed in 10.972 seconds. |

The 20-plus-minute visible delay includes interruption/recovery downtime and repeated source preparation. It is not one 20-minute writing call. Both jobs were confirmed Processing on the same replacement server and both issued model calls for section 5.5: this is a concrete overlapping-execution problem, not merely two obsolete job labels.

Recovery flaw: HangfireJobs.ReconcileStaleProposalGenerationsAsync enqueues a new continuation after the project's heartbeat is stale for ten minutes. Hangfire's own abandoned-job redelivery can independently reclaim the original job. ProposalGenerationJob.ExecuteAsync does not take a project-wide execution lease before beginning work. The HTTP resume lock added in the preceding task prevents duplicate start requests, but does not serialize these independently executing worker jobs.

Retrieval overhead: claim searches request up to 100 results per provider. Logs show Consensus returning approximately 20 and enrichment falling back to additional providers because of the 80/100 shortfall. Some query result sets exceed 200 candidates. ResearchService.EnrichWithConceptsAsync performs DOI metadata lookups for candidates missing concept tags before subsequent selection. Slow external lookups therefore multiply across large candidate pools and overlapping workers. The Sample Size claim plan also includes sampling-strategy and inclusion/exclusion themes, broadening retrieval beyond sample adequacy.

Recommended order of correction:

1. Add a project execution lease/fencing mechanism shared by every ProposalGenerationJob entry path; make stale recovery and Hangfire redelivery converge on one owner. A duplicate worker must exit without model calls or checkpoint writes.
2. Bound source retrieval and DOI enrichment by a section-wide deadline and candidate budget, deduplicate/cache lookups, and enrich a ranked shortlist rather than every fetched candidate. Keep evidence and citation validation gates intact.
3. Narrow section 5.5 claims to qualitative sample adequacy/information power/saturation, and report actual phases (retrieval, enrichment, drafting, verification, interrupted/recovering) in the progress UI. Avoid promising recovery “within a few minutes” without evidence.

No API restart, job cancellation, generation request or code modification was performed during this investigation.
