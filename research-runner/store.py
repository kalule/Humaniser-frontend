"""Durable job state shared by API and isolated pipeline processes."""
import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path


def now():
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = self.root / 'jobs.sqlite3'
        with self.connect() as db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL, phase TEXT, progress INTEGER DEFAULT 0, error TEXT, created_at TEXT, updated_at TEXT)')
            db.execute('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, job_id TEXT NOT NULL, phase TEXT NOT NULL, created_at TEXT NOT NULL)')

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.db, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            with db:
                yield db
        finally:
            db.close()

    def create(self, job_id, payload, capacity=20):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            count = db.execute("SELECT count(*) FROM jobs WHERE status IN ('Queued','Running')").fetchone()[0]
            if count >= capacity:
                return False
            db.execute('INSERT INTO jobs (id,payload,status,phase,created_at,updated_at) VALUES (?,?,?,?,?,?)', (job_id, json.dumps(payload), 'Queued', 'queued', now(), now()))
        return True

    def get(self, job_id):
        with self.connect() as db:
            row = db.execute('SELECT * FROM jobs WHERE id=?', (str(job_id),)).fetchone()
        return dict(row) if row else None

    def update(self, job_id, **values):
        if not set(values) <= {'status', 'phase', 'progress', 'error'}:
            raise ValueError('Invalid job fields')
        values['updated_at'] = now()
        with self.connect() as db:
            db.execute('UPDATE jobs SET ' + ','.join(f'{key}=?' for key in values) + ' WHERE id=?', (*values.values(), str(job_id)))
            if 'phase' in values:
                db.execute('INSERT INTO events(job_id,phase,created_at) VALUES(?,?,?)', (str(job_id), values['phase'], now()))

    def events(self, job_id):
        with self.connect() as db:
            return [dict(row) for row in db.execute('SELECT phase,created_at FROM events WHERE job_id=? ORDER BY id DESC LIMIT 100', (str(job_id),))][::-1]

    def claim(self):
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT id FROM jobs WHERE status='Queued' ORDER BY created_at LIMIT 1").fetchone()
            if row:
                db.execute("UPDATE jobs SET status='Running',phase='initializing',updated_at=? WHERE id=?", (now(), row['id']))
                return row['id']

    def recover(self):
        with self.connect() as db:
            db.execute("UPDATE jobs SET status='Failed',error='worker_interrupted',updated_at=? WHERE status='Running'", (now(),))


ALLOWED = {'.md', '.tex', '.pdf', '.docx', '.zip'}


def artifacts(root):
    root = Path(root).resolve()
    return sorted(p.relative_to(root).as_posix() for p in root.rglob('*')
                  if p.is_file() and not p.is_symlink() and p.suffix.lower() in ALLOWED
                  and p.resolve().is_relative_to(root)) if root.exists() else []


def download_path(root, name):
    root = Path(root).resolve()
    path = (root / name).resolve()
    if not path.is_relative_to(root) or name not in artifacts(root):
        raise ValueError('Unknown artifact')
    return path
