# Section 5.7 delay — 5 October 2026

Read-only investigation of proposal bf282007-306b-4a22-8201-fee5ead053c1. Times are South African local time (UTC+2). Final checkpoint: 09:32.

Section 5.6 saved 324 words at 08:54:40. Section 5.7 remains empty; the proposal has 15 completed sections and 5,922 words.

Two distinct problems explain the delay:

1. Whole-corpus evidence classification. The project contains 6,126 literature rows. ResearchService sends the field-eligible literature pool into Section57EvidenceRoleClassifier before drafting Study Variables. The classifier processes unclassified sources sequentially, in batches of 50, without a total source/call budget. From 09:16:50 through 09:20:53, job 13007 completed 62 classification calls, totalling 235.6 seconds of model latency and $0.596433 recorded estimated cost. It also made one claim-planning call taking 4.1 seconds. No section 5.7 writing call was recorded in that attempt. Classifying the entire 6,126-row pool would require up to 123 calls before later retrieval and writing phases.

2. Another worker interruption. API startup was recorded at 09:14:13 and again at 09:23:03. Job 13007's latest Processing state belongs to server PID 47088; the currently running API PID is 46112. Its last recorded successful classification was at 09:20:53, and its last project heartbeat was 09:20:45. At 09:25:04 the section reconciliation sweep reset a section older than ten minutes. Section 5.7 is now NotStarted with "Generation timed out — please try again." The proposal still says Starting and points at 5.7; Hangfire still labels the old job Processing. Those labels do not establish an active worker.

At 09:32 all 6,126 rows still had an empty Section57Role: the interrupted attempt's 62 successful calls did not leave persisted classification checkpoints. This explains why retrying can repeat already-paid classification. The current source now contains SaveChangesAsync after every classifier batch, but that does not retroactively recover the lost results or prove the old worker used that build.

The earlier overlapping-worker defect is no longer the primary observed issue: at 09:14:17 a duplicate continuation explicitly logged that another worker owned the proposal and exited without work.

Corrections needed: classify a bounded shortlist relevant to the study's variables instead of the entire accumulated corpus; enforce a total classification time/call budget; retain per-batch checkpoints; make section timeout and proposal recovery respect the live execution lease; expose interrupted/awaiting-recovery status instead of a drafting spinner. Avoid restarting the API during active generation.

No API restart, generation request, cancellation or application-code edit was performed in this investigation.
