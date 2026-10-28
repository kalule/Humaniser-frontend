SELECT "Id", "GenerationStatus", "GenerationCurrentSection", "GenerationCompletedCount", "AcceptedSpecificationId" FROM research_projects WHERE "Id"='bf282007-306b-4a22-8201-fee5ead053c1';
SELECT "SectionCode", "Status", "WordCount", "GenerationError" FROM project_sections WHERE "ProjectId"='bf282007-306b-4a22-8201-fee5ead053c1' ORDER BY "SectionCode";

