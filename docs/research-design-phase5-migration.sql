START TRANSACTION;

ALTER TABLE research_design_runs ADD "EvidenceWorkflowJson" text NOT NULL DEFAULT '{}';

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261006055645_AddResearchDesignEvidenceCheckpoint', '8.0.31');

COMMIT;

