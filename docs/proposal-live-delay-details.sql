SELECT id,statename,createdat, invocationdata::jsonb->>'Type' AS job_type FROM hangfire.job WHERE arguments::text LIKE '%bf282007-306b-4a22-8201-fee5ead053c1%' ORDER BY id DESC LIMIT 10;
SELECT j.id,s.name,s.reason,left(s.data::text,900) AS details FROM hangfire.job j JOIN hangfire.state s ON s.id=j.stateid WHERE j.arguments::text LIKE '%bf282007-306b-4a22-8201-fee5ead053c1%' ORDER BY j.id DESC LIMIT 6;
SELECT "TaskType", "Status", "CreatedAt", "LatencyMs", "PhysicalAttempt", "RetryReason" FROM ai_call_logs WHERE "ProposalId"='bf282007-306b-4a22-8201-fee5ead053c1' ORDER BY "CreatedAt" DESC LIMIT 10;
SELECT now();

