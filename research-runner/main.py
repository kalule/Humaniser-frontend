"""Authenticated, durable research-paper job API. Run with ONE Uvicorn worker."""
import asyncio
import hmac
import json
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from uuid import UUID, uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

from store import Store, artifacts, download_path
from thesis_models import ThesisRequest


class PaperRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    topic: str = Field(min_length=10, max_length=2000)
    language: str = Field(default='en', pattern=r'^[a-z]{2}(?:-[A-Za-z]{2})?$')
    academic_level: Literal['research_paper', 'bachelor', 'master', 'phd'] = 'research_paper'
    output_type: Literal['full', 'expose', 'literature_review'] = 'full'
    citation_style: Literal['apa', 'ieee'] = 'apa'
    blurb: str | None = Field(default=None, max_length=10000)
    author_name: str | None = Field(default=None, max_length=200)
    institution: str | None = Field(default=None, max_length=300)


async def scheduler(app):
    while True:
        job_id = app.state.store.claim()
        if not job_id:
            await asyncio.sleep(0.3)
            continue
        job_dir = app.state.store.root / job_id
        job_dir.mkdir(exist_ok=True)
        with (job_dir / 'worker.log').open('ab') as log:
            try:
                process = subprocess.Popen(
                    [app.state.python, '-B', str(Path(__file__).with_name('worker.py')),
                     str(app.state.store.root), job_id], stdout=log, stderr=log,
                    cwd=job_dir, env={**os.environ, 'PYTHONIOENCODING': 'utf-8'},
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                app.state.process = process
                is_thesis = json.loads(app.state.store.get(job_id)['payload']).get('_job_type') == 'thesis'
                timeout = int(os.getenv('THESIS_JOB_TIMEOUT', '21600')) if is_thesis else app.state.timeout
                deadline = asyncio.get_running_loop().time() + timeout
                while process.poll() is None:
                    if asyncio.get_running_loop().time() > deadline:
                        process.kill()
                        process.wait()
                        app.state.store.update(job_id, status='Failed', error='generation_timeout')
                        break
                    await asyncio.sleep(0.3)
                if app.state.store.get(job_id)['status'] == 'Running':
                    app.state.store.update(job_id, status='Failed', error='worker_exited')
            except asyncio.CancelledError:
                if app.state.process and app.state.process.poll() is None:
                    app.state.process.kill()
                    app.state.process.wait()
                app.state.store.update(job_id, status='Failed', error='worker_interrupted')
                raise
            except Exception:
                app.state.store.update(job_id, status='Failed', error='worker_start_failed')
            finally:
                app.state.process = None


def create_app(root=None, secret=None, run_jobs=True):
    @asynccontextmanager
    async def lifespan(app):
        app.state.secret = secret or os.getenv('RESEARCH_RUNNER_SECRET', '')
        if len(app.state.secret) < 32:
            raise RuntimeError('RESEARCH_RUNNER_SECRET must contain at least 32 characters')
        app.state.store = Store(root or os.getenv('RESEARCH_OUTPUT_ROOT', str(Path(__file__).parent / 'data')))
        app.state.python = os.getenv('OPENDRAFT_PYTHON', sys.executable)
        app.state.timeout = int(os.getenv('RESEARCH_JOB_TIMEOUT', '7200'))
        app.state.process = None
        if run_jobs:
            source = Path(os.environ.get('OPENDRAFT_ROOT', ''))
            if not (source / 'engine/draft_generator.py').is_file():
                raise RuntimeError('Set OPENDRAFT_ROOT to the inspected OpenDraft repository')
            app.state.store.recover()
        task = asyncio.create_task(scheduler(app)) if run_jobs else None
        try:
            yield
        finally:
            if task:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    app = FastAPI(title='Research Paper Runner', lifespan=lifespan)

    def authenticate(request: Request, x_runner_secret: str = Header(default='')):
        if not hmac.compare_digest(x_runner_secret.encode(), request.app.state.secret.encode()):
            raise HTTPException(401, 'Invalid runner secret')

    def get_job(request, job_id):
        job = request.app.state.store.get(job_id)
        if not job:
            raise HTTPException(404, 'Job not found')
        return job

    @app.get('/health')
    def health():
        return {'status': 'ok', 'service': 'research-runner'}

    @app.post('/v1/research-papers', status_code=202, dependencies=[Depends(authenticate)])
    def submit(payload: PaperRequest, request: Request):
        job_id = str(uuid4())
        if not request.app.state.store.create(job_id, payload.model_dump()):
            raise HTTPException(429, 'Job queue is full')
        return {'id': job_id, 'status': 'Queued', 'status_url': f'/v1/research-papers/{job_id}'}

    @app.get('/v1/research-papers/{job_id}', dependencies=[Depends(authenticate)])
    def status(job_id: UUID, request: Request):
        job = get_job(request, job_id)
        job.pop('payload')
        job['artifacts'] = artifacts(request.app.state.store.root / str(job_id) / 'output') if job['status'] == 'Completed' else []
        return job

    @app.get('/v1/research-papers/{job_id}/download/{name:path}', dependencies=[Depends(authenticate)])
    def download(job_id: UUID, name: str, request: Request):
        job = get_job(request, job_id)
        if job['status'] != 'Completed':
            raise HTTPException(409, 'Job has not completed')
        try:
            path = download_path(request.app.state.store.root / str(job_id) / 'output', name)
        except ValueError:
            raise HTTPException(404, 'Artifact not found') from None
        return FileResponse(path, filename=path.name)

    def thesis_job(request, job_id):
        job = get_job(request, job_id)
        if json.loads(job['payload']).get('_job_type') != 'thesis':
            raise HTTPException(404, 'Thesis job not found')
        return job

    @app.post('/api/thesis/generate', status_code=202, dependencies=[Depends(authenticate)])
    def submit_thesis(payload: ThesisRequest, request: Request):
        job_id = str(uuid4())
        data = {**payload.model_dump(), '_job_type': 'thesis'}
        if not request.app.state.store.create(job_id, data):
            raise HTTPException(429, 'Job queue is full')
        return {'id': job_id, 'status': 'Queued', 'status_url': f'/api/thesis/status/{job_id}'}

    @app.get('/api/thesis/status/{job_id}', dependencies=[Depends(authenticate)])
    def thesis_status(job_id: UUID, request: Request):
        thesis_job(request, job_id)
        result = status(job_id, request)
        result['events'] = request.app.state.store.events(job_id)
        return result

    @app.get('/api/thesis/download/{job_id}/{name:path}', dependencies=[Depends(authenticate)])
    def thesis_download(job_id: UUID, name: str, request: Request):
        thesis_job(request, job_id)
        return download(job_id, name, request)

    return app


app = create_app()
