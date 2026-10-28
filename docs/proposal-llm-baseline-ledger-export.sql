\set QUIET on
\pset tuples_only on
\pset format unaligned
SELECT json_agg(to_jsonb(l) ORDER BY l."CreatedAt")
FROM ai_call_logs l WHERE l."ProposalId" = '4ffb55e2-c8da-4feb-99c6-086c565fed6c';
