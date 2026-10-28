SELECT "Id", "Title", "GenerationStatus", "GenerationCurrentSection", "GenerationCompletedCount", "GenerationFailedCount", "UpdatedAt" FROM research_projects WHERE "Title" ILIKE '%digital learning%' ORDER BY "UpdatedAt" DESC LIMIT 4;
SELECT id,statename,createdat FROM hangfire.job WHERE arguments::text LIKE '%4ffb55e2-c8da-4feb-99c6-086c565fed6c%' ORDER BY id DESC LIMIT 8;
SELECT "TaskType", "Status", "CreatedAt", "LatencyMs" FROM ai_call_logs WHERE "ProposalId"='4ffb55e2-c8da-4feb-99c6-086c565fed6c' ORDER BY "CreatedAt" DESC LIMIT 5;
