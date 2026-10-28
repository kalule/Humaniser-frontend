# Research paper service

## Thesis API (30–80 page draft targets)

`POST /api/thesis/generate`, `GET /api/thesis/status/{job_id}`, and
`GET /api/thesis/download/{job_id}/{name}` use the same X-Runner-Secret header.
The thesis queue shares the paper worker; its default timeout is six hours
(`THESIS_JOB_TIMEOUT=21600`). No thesis is generated merely by starting the API.

Requests specify `topic`, `field`, `institution`, `degree_level`, `target_pages`,
`university_guidelines`, `research_material`, and a curated `peer_reviewed_dois`
list. Seven ordered `chapters` accept `kind`, `title`, `sections`, and `min_sources`.
Omit chapters to use Abstract, Introduction, Literature Review, Methodology,
Implementation and Results, Discussion, Conclusion. Required chapter kinds are
abstract/introduction/literature_review/methodology/results/discussion/conclusion.
Each substantive chapter defaults to three sources; abstract defaults to zero.
Use actual DOI identifiers that you have checked as peer reviewed, not placeholders.

Example body (replace the DOI placeholders with your curated real sources):

```json
{
  "topic": "Urban green infrastructure and heat mitigation in dense cities",
  "degree_level": "master",
  "field": "Environmental science",
  "institution": "Your University",
  "target_pages": 50,
  "university_guidelines": "APA 7, clearly numbered chapters, describe study limitations",
  "peer_reviewed_dois": ["10.1234/replace-a", "10.1234/replace-b", "10.1234/replace-c"],
  "research_material": "Supply actual methods and findings here, or describe the proposed study."
}
```

The worker adapts OpenDraft in its own isolated process: original research,
structure and citation phases and strict inter-phase validation remain active;
thesis composition and compilation supply top-level chapters instead of Main Body.
Chapter sections are generated in approximately 1000-word calls with bounded
output tokens and continuation context. Abstract is generated after the body.
Each section must meet a length tolerance; total chapters must be within 20% of
the target word budget. Page targets use 300 words/page and are estimates, not
a guarantee that a PDF has exactly the requested number of pages.

The source threshold counts only journal records whose DOI is in the caller's
curated list AND has OpenDraft `multi_source_confirmed` status. Peer review is
caller-attested: database DOI confirmation does not establish peer review.
Automatic discovery might not retrieve enough of your curated sources; the job
fails rather than silently relaxing that threshold. Every cited section is run
through OpenDraft's semantic claim verifier; unknown IDs, missing source coverage,
uncertain/irrelevant verdicts, and unresolved compiled markers fail the job.
These are automated checks, not a guarantee of scholarly correctness. Do not
submit generated empirical results as observed research; missing material is
instructed to be framed as a proposal rather than invented data.

Completed jobs expose merged Markdown/PDF/DOCX, optional LaTeX, separate chapter
Markdown, citation audit reports, a generation report and `exports/thesis_bundle.zip`.
The status response includes the last 100 phase events. Export failures are fatal;
failed jobs do not expose incomplete drafts through download endpoints.

Run all tests with `python -B -m unittest discover -s . -p "test_*.py" -v`.
Tests do not generate a live thesis or validate final PDF pagination.

FastAPI wrapper for the inspected OpenDraft 1.8.1 repository. Calls its real
`engine/draft_generator.py::generate_draft` with strict validation enabled.
The pipeline builds its own DraftContext and runs research → structure → citations
→ compose → validate → compile/export. Its tracker supplies phase/progress updates.
No generation logic or citation verification is replaced by this wrapper.

## Setup (PowerShell)

```powershell
cd research-runner
python -m venv venv
./venv/Scripts/python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env with the actual source location, pipeline Python, and credentials.
# In a separate pipeline venv, install the source repository's requirements.txt.
# OpenDraft's PDF exporters may also require system libraries or Pandoc/LaTeX.
./start.ps1
```

`OPENDRAFT_PYTHON` must point to an interpreter with OpenDraft's dependencies.
The API interpreter needs only this service's requirements. The configured source
directory must contain `engine/draft_generator.py`; it is imported directly, so a
PyPI installation is unnecessary. Existing engine/.env.local can override provider
configuration: inspect that file when choosing OpenRouter. OpenDraft model/provider
configuration remains server-controlled; callers cannot supply credentials or paths.

## API

Send `X-Runner-Secret` on every job/status/download request. Generate a random
32+ character secret and keep it in the backend, never the browser. This is a
trusted backend service, not a multi-tenant public API. The main application must
enforce user ownership before proxying status/download requests. Bind to localhost
or a private network; use TLS at the public application gateway.

```powershell
$headers = @{ 'X-Runner-Secret' = $env:RESEARCH_RUNNER_SECRET }
$body = @{ topic='How university learning environments affect student outcomes'; academic_level='research_paper'; citation_style='apa' } | ConvertTo-Json
$job = Invoke-RestMethod http://127.0.0.1:8008/v1/research-papers -Method Post -Headers $headers -ContentType application/json -Body $body
$status = Invoke-RestMethod "http://127.0.0.1:8008/v1/research-papers/$($job.id)" -Headers $headers
# Poll until Completed or Failed. Artifacts are relative filenames, e.g. exports/draft.md.
$name = $status.artifacts[0]
Invoke-WebRequest "http://127.0.0.1:8008/v1/research-papers/$($job.id)/download/$name" -Headers $headers -OutFile draft.md
```

POST returns 202 and a status URL. Status includes Queued/Running/Completed/Failed,
phase, progress, timestamps, error code, and completed artifacts. Downloads are
allowlisted Markdown, LaTeX, PDF, and DOCX files inside that job's output folder;
logs, checkpoints, arbitrary paths, and outside symlinks cannot be downloaded.
OpenDraft determines available export formats; this service does not claim every
format is installed or successfully generated.

SQLite stores the bounded queue (20 active jobs) under `data/`. One isolated
subprocess runs at a time. Queued work survives restarts; interrupted Running work
is marked Failed rather than automatically repeating paid generation. Timeouts
default to 7200 seconds. Shutdown terminates the active pipeline. Run exactly one
API instance and one Uvicorn worker per data directory; horizontal deployment
requires an external queue/worker system. Plan retention/backups for local data.

PipelineValidationError becomes `pipeline_validation_failed`; other failures get
stable diagnostic codes. Detailed stack traces stay in `data/<id>/worker.log` for
operators and may contain source content/provider details: restrict filesystem
access and do not expose logs through the public application. Outputs and SQLite
contain submitted research data.

## Verification

```powershell
./venv/Scripts/python.exe -B -m unittest discover -s . -p test_service.py -v
```

Tests cover auth, validation, durable queue state, recovery, progress, pipeline
success/failure classification, and download confinement. They stub model generation
and incur no provider costs. A complete live paper remains a separate end-to-end
acceptance check requiring citation services, model credentials and export tooling.
