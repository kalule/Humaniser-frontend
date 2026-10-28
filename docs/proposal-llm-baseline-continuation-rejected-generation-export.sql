\set QUIET on
\pset tuples_only on
\pset format unaligned
SELECT json_agg(json_build_object('id', "Id", 'status', "Status", 'payload', "PayloadJson"::jsonb) ORDER BY "CreatedAt")
FROM proposal_workflow_artifacts WHERE "ProjectId"='4ffb55e2-c8da-4feb-99c6-086c565fed6c' AND "Kind"='GenerationResult';
