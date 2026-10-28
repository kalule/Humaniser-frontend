SELECT "Stage", "Pipeline", "Operation", count(*) AS attempts,
       sum("EstimatedCost") AS known_complete_cost_usd,
       count(*) FILTER (WHERE "UsageCompleteness" <> 'Complete') AS incomplete,
       count(*) FILTER (WHERE "PricingStatus" = 'Unknown') AS unpriced
FROM ai_call_logs
WHERE "ProposalId" = '4ffb55e2-c8da-4feb-99c6-086c565fed6c'
GROUP BY "Stage", "Pipeline", "Operation" ORDER BY known_complete_cost_usd DESC NULLS LAST;

SELECT statename, count(*) AS jobs
FROM hangfire.job
WHERE invocationdata::text LIKE '%4ffb55e2-c8da-4feb-99c6-086c565fed6c%'
   OR arguments::text LIKE '%4ffb55e2-c8da-4feb-99c6-086c565fed6c%'
GROUP BY statename;
