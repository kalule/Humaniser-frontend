START TRANSACTION;

CREATE TABLE research_design_runs (
    "Id" uuid NOT NULL,
    "ProjectId" uuid NOT NULL,
    "UserId" uuid NOT NULL,
    "CommandKey" uuid NOT NULL,
    "CommandHash" character varying(64) NOT NULL,
    "PreviousRunId" uuid,
    "SpecificationRevision" uuid,
    "Status" character varying(40) NOT NULL,
    "Stage" character varying(40) NOT NULL,
    "RequestJson" text NOT NULL,
    "InputFingerprint" character varying(64) NOT NULL,
    "StateFingerprint" character varying(64) NOT NULL,
    "EvidenceFingerprint" character varying(64) NOT NULL,
    "PromptVersion" character varying(80) NOT NULL,
    "PolicyVersion" character varying(80) NOT NULL,
    "SchemaVersion" character varying(80) NOT NULL,
    "ExecutionPolicyJson" text NOT NULL,
    "ModelRoute" character varying(150) NOT NULL,
    "AttemptsJson" text NOT NULL,
    "UsageJson" text NOT NULL,
    "ReasoningCallCount" integer NOT NULL,
    "AdjudicationCallCount" integer NOT NULL,
    "PhysicalAttemptAllowance" integer NOT NULL,
    "ReservedCredits" integer NOT NULL,
    "ConsumedCredits" integer NOT NULL,
    "ResultArtifactId" uuid,
    "ResultHash" character varying(64) NOT NULL,
    "AcceptedRevisionId" uuid,
    "AcceptCommandKey" uuid,
    "AcceptCommandHash" character varying(64) NOT NULL,
    "ReusedRunId" uuid,
    "CacheHit" boolean NOT NULL,
    "LeaseToken" uuid,
    "LeaseExpiresAt" timestamp with time zone,
    "ConcurrencyToken" uuid NOT NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    "StartedAt" timestamp with time zone,
    "CompletedAt" timestamp with time zone,
    "CancellationRequestedAt" timestamp with time zone,
    "FailureCode" character varying(80),
    "FailureSummary" character varying(300),
    CONSTRAINT "PK_research_design_runs" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_research_design_runs_canonical_research_plans_ProjectId_Acc~" FOREIGN KEY ("ProjectId", "AcceptedRevisionId") REFERENCES canonical_research_plans ("ProjectId", "Id"),
    CONSTRAINT "FK_research_design_runs_research_projects_ProjectId" FOREIGN KEY ("ProjectId") REFERENCES research_projects ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_research_design_runs_users_UserId" FOREIGN KEY ("UserId") REFERENCES users ("Id")
);

CREATE INDEX "IX_research_design_runs_ProjectId_AcceptedRevisionId" ON research_design_runs ("ProjectId", "AcceptedRevisionId");

CREATE INDEX "IX_research_design_runs_ProjectId_InputFingerprint_Status" ON research_design_runs ("ProjectId", "InputFingerprint", "Status");

CREATE UNIQUE INDEX "IX_research_design_runs_ProjectId_UserId_CommandKey" ON research_design_runs ("ProjectId", "UserId", "CommandKey");

CREATE INDEX "IX_research_design_runs_Status_LeaseExpiresAt" ON research_design_runs ("Status", "LeaseExpiresAt");

CREATE INDEX "IX_research_design_runs_UserId" ON research_design_runs ("UserId");

INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20261005181131_AddResearchDesignDurableRuns', '8.0.31');

COMMIT;

