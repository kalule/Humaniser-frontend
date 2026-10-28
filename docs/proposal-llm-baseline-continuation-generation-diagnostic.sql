SELECT "Id", "Kind", "Status", "SectionCode", "CreatedAt",
       "PayloadJson"::jsonb->>'message' AS failure,
       left("PayloadJson"::jsonb->>'rawOutput', 130) AS response_prefix
FROM proposal_workflow_artifacts
WHERE "ProjectId"='4ffb55e2-c8da-4feb-99c6-086c565fed6c' AND "Kind"='GenerationResult'
ORDER BY "CreatedAt";
