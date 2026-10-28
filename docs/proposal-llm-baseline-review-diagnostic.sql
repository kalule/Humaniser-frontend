SELECT "Id", "Kind", "Status", "CreatedAt",
       left("PayloadJson"::jsonb->>'raw', 1200) AS review_response_excerpt
FROM proposal_workflow_artifacts
WHERE "ProjectId" = '4ffb55e2-c8da-4feb-99c6-086c565fed6c' AND "Kind" = 'Evidence'
ORDER BY "CreatedAt";

SELECT "Stage", "Operation", "Model", "Status", "InputTokens", "OutputTokens", "UsageCompleteness", "PricingStatus", "EstimatedCost", "ProviderRequestId"
FROM ai_call_logs
WHERE "ProposalId" = '4ffb55e2-c8da-4feb-99c6-086c565fed6c' AND "Pipeline" = 'StrictProposalWorkflow'
ORDER BY "CreatedAt";
