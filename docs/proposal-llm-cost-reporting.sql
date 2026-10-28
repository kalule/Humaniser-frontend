-- PostgreSQL/psql read-only P0 reporting. Replace this with the research project UUID.
\set proposal_id '00000000-0000-0000-0000-000000000000'

-- Per-session view only; reads the existing ledger, does not create a second usage ledger.
CREATE TEMP VIEW proposal_llm_usage AS
SELECT *,
  CASE WHEN "EstimatedCost" IS NOT NULL THEN "EstimatedCost"
       WHEN "EstimatedInputCost" IS NOT NULL OR "EstimatedOutputCost" IS NOT NULL
         OR "EstimatedCacheReadCost" IS NOT NULL OR "EstimatedCacheCreationCost" IS NOT NULL
       THEN COALESCE("EstimatedInputCost",0) + COALESCE("EstimatedOutputCost",0)
          + COALESCE("EstimatedCacheReadCost",0) + COALESCE("EstimatedCacheCreationCost",0)
       ELSE NULL END AS "KnownCostUsd",
  CASE WHEN "IsRetry" THEN 'Retries'
       WHEN "IsRegeneration" THEN 'Regeneration'
       WHEN "Stage" = 'CitationCorrection' THEN 'Citation Correction'
       WHEN "IsRepair" OR "Stage" = 'Repair' THEN 'Repairs'
       WHEN "IsInitialGeneration" THEN 'Initial Writing'
       ELSE COALESCE("Stage", 'Unclassified') END AS "WaterfallBucket"
FROM ai_call_logs WHERE "ProposalId" = :'proposal_id'::uuid;

-- 1. Lifetime known subtotal, completeness, authoritative token subtotals and call counts.
-- A subtotal with unknown or unpriced records MUST NOT be called a complete proposal total.
SELECT COALESCE(SUM("KnownCostUsd"),0) AS "KnownCostSubtotalUsd",
       COUNT(*) AS "LedgerRecords",
       COUNT(DISTINCT "LogicalCallId") AS "LogicalCalls",
       COUNT(*) FILTER (WHERE "RecordKind" = 'PhysicalAttempt') AS "PhysicalAttempts",
       COUNT(*) FILTER (WHERE "UsageCompleteness" = 'Unknown') AS "UnknownUsageCount",
       COUNT(*) FILTER (WHERE "UsageCompleteness" = 'Partial') AS "PartialUsageCount",
       COUNT(*) FILTER (WHERE "PricingStatus" = 'Unknown' AND NOT "CacheHit") AS "UnpricedUsageCount",
       COUNT(*) FILTER (WHERE "EstimatedCost" IS NULL) AS "IncompleteCostRecordCount",
       COUNT(*) FILTER (WHERE "CacheHit") AS "ApplicationCacheHitCount",
       SUM("InputTokens") AS "ReportedUncachedInputTokens",
       SUM("OutputTokens") AS "ReportedOutputTokens",
       SUM("CacheReadTokens") AS "ReportedCacheReadTokens",
       SUM("CacheWriteTokens") AS "ReportedCacheCreationTokens"
FROM proposal_llm_usage;

-- 2. Stage/pipeline breakdown. Retains unknown and unclassified records.
SELECT "Pipeline", "Stage", COUNT(*) AS "Records", SUM("KnownCostUsd") AS "KnownCostUsd",
       COUNT(*) FILTER (WHERE "UsageCompleteness" <> 'Complete') AS "IncompleteUsageCount",
       COUNT(*) FILTER (WHERE "PricingStatus" = 'Unknown') AS "UnpricedUsageCount"
FROM proposal_llm_usage GROUP BY "Pipeline", "Stage" ORDER BY SUM("KnownCostUsd") DESC NULLS LAST;

-- 3. Sections: a null section is proposal-wide work, never a fabricated section ID.
SELECT "SectionId", "SectionCode", "Stage", SUM("KnownCostUsd") AS "KnownCostUsd", COUNT(*) AS "Records",
       COUNT(*) FILTER (WHERE "EstimatedCost" IS NULL) AS "IncompleteCostRecordCount"
FROM proposal_llm_usage GROUP BY "SectionId", "SectionCode", "Stage" ORDER BY "SectionCode", "Stage";

-- 4. Citation-correction cost, including redrafts and their incomplete attempts.
SELECT "Operation", "SectionCode", SUM("KnownCostUsd") AS "KnownCostUsd", COUNT(*) AS "Records",
       COUNT(*) FILTER (WHERE "EstimatedCost" IS NULL) AS "IncompleteCostRecordCount"
FROM proposal_llm_usage WHERE "Stage" = 'CitationCorrection'
GROUP BY "Operation", "SectionCode";

-- 5. Final review.
SELECT "Operation", SUM("KnownCostUsd") AS "KnownCostUsd", COUNT(*) AS "Records",
       COUNT(*) FILTER (WHERE "EstimatedCost" IS NULL) AS "IncompleteCostRecordCount"
FROM proposal_llm_usage WHERE "Stage" = 'FinalReview' GROUP BY "Operation";

-- 6. Retry cost: whole retried physical requests or background-job re-executions.
-- It cannot price a failed attempt whose provider never supplied usage.
SELECT "LogicalCallId", "PhysicalAttempt", "BackgroundJobId", "BackgroundJobAttempt", "RetryReason",
       "KnownCostUsd", "UsageCompleteness", "PricingStatus", "ProviderRequestId"
FROM proposal_llm_usage WHERE "IsRetry" ORDER BY "CreatedAt";

-- 7. Unknown/unpriced/incomplete records, kept visible alongside the known subtotal.
SELECT "Operation", "Stage", "SectionCode", "Model", "Status", "UsageCompleteness", "PricingStatus",
       "LogicalCallId", "PhysicalAttempt", "BackgroundJobId", "KnownCostUsd"
FROM proposal_llm_usage WHERE "UsageCompleteness" <> 'Complete' OR "PricingStatus" = 'Unknown'
  OR "EstimatedCost" IS NULL ORDER BY "CreatedAt";

-- 8. Disjoint cost waterfall; retry/regeneration/repair flags otherwise overlap stage totals.
SELECT "WaterfallBucket", SUM("KnownCostUsd") AS "KnownCostUsd", COUNT(*) AS "Records",
       COUNT(*) FILTER (WHERE "EstimatedCost" IS NULL) AS "IncompleteCostRecordCount"
FROM proposal_llm_usage GROUP BY "WaterfallBucket" ORDER BY "WaterfallBucket";

-- 9. Operation/model/run breakdown. Remove dimensions as desired, preserving completeness counts.
SELECT "GenerationRunId", "Pipeline", "Operation", "Model", "PriceScheduleVersion",
       SUM("KnownCostUsd") AS "KnownCostUsd", COUNT(*) AS "Records",
       COUNT(*) FILTER (WHERE "EstimatedCost" IS NULL) AS "IncompleteCostRecordCount"
FROM proposal_llm_usage GROUP BY "GenerationRunId", "Pipeline", "Operation", "Model", "PriceScheduleVersion";

-- 10. Investigate unexpected unattributed calls in the baseline window separately.
-- Time coincidence alone is NOT authority to assign their costs to this proposal.
SELECT "TaskType", "Model", "CreatedAt", "EstimatedCost", "UsageCompleteness", "CorrelationId"
FROM ai_call_logs WHERE "ProposalId" IS NULL AND "CreatedAt" >= now() - interval '1 hour'
ORDER BY "CreatedAt";
