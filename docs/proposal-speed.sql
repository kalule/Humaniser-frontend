SELECT "GenerationStatus","GenerationCurrentSection","GenerationCompletedCount","GenerationWordsWritten","UpdatedAt" FROM research_projects WHERE "Id"='bf282007-306b-4a22-8201-fee5ead053c1';
SELECT "TaskType", count(*), round(avg("LatencyMs")/1000.0,1) AS avg_seconds,max("CreatedAt") AS latest FROM ai_call_logs WHERE "ProposalId"='bf282007-306b-4a22-8201-fee5ead053c1' AND "CreatedAt">'2026-10-04 15:03:00+00' GROUP BY "TaskType" ORDER BY latest DESC;
SELECT id,lastheartbeat FROM hangfire.server;
