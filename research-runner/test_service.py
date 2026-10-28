import tempfile
import asyncio
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from main import create_app, scheduler
from store import Store, download_path
from worker import Tracker, run


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.headers = {'X-Runner-Secret': 's' * 32}
        self.client = TestClient(create_app(self.root, 's' * 32, run_jobs=False))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def submit(self):
        response = self.client.post('/v1/research-papers', headers=self.headers,
                                    json={'topic': 'University learning outcomes'})
        self.assertEqual(response.status_code, 202)
        return response.json()['id']

    def test_auth_validation_and_missing(self):
        self.assertEqual(self.client.post('/v1/research-papers', json={'topic': 'test'}).status_code, 401)
        self.assertEqual(self.client.post('/v1/research-papers', headers=self.headers,
                                         json={'topic': 'too short', 'output_dir': '../outside'}).status_code, 422)
        self.assertEqual(self.client.get('/v1/research-papers/00000000-0000-0000-0000-000000000000', headers=self.headers).status_code, 404)

    def test_status_download_and_traversal(self):
        job_id = self.submit()
        base = f'/v1/research-papers/{job_id}'
        self.assertEqual(self.client.get(base).status_code, 401)
        self.assertEqual(self.client.get(base + '/download/paper.md', headers=self.headers).status_code, 409)
        output = self.root / job_id / 'output'
        output.mkdir(parents=True)
        (output / 'paper.md').write_text('# Verified draft')
        (output / 'private.log').write_text('private')
        Store(self.root).update(job_id, status='Completed')
        status = self.client.get(base, headers=self.headers).json()
        self.assertEqual(status['artifacts'], ['paper.md'])
        self.assertNotIn('payload', status)
        self.assertEqual(self.client.get(base + '/download/paper.md', headers=self.headers).text, '# Verified draft')
        self.assertEqual(self.client.get(base + '/download/private.log', headers=self.headers).status_code, 404)
        with self.assertRaises(ValueError):
            download_path(output, '../paper.md')

    def test_queue_persistence_recovery_capacity_and_tracker(self):
        job_id = self.submit()
        store = Store(self.root)
        self.assertFalse(store.create('other', {}, capacity=1))
        self.assertEqual(store.claim(), job_id)
        self.assertIsNone(store.claim())
        Tracker(store, job_id).update_phase('citations', progress_percent=37)
        self.assertEqual(Store(self.root).get(job_id)['progress'], 37)
        store.recover()
        self.assertEqual(store.get(job_id)['error'], 'worker_interrupted')

    def test_worker_success_and_validation_failure(self):
        import sys
        from types import SimpleNamespace

        class PipelineValidationError(ValueError):
            pass

        def generate(**kwargs):
            self.assertFalse(kwargs['skip_validation'])
            output = kwargs['output_dir']
            output.mkdir(parents=True)
            (output / 'paper.md').write_text('# Draft')

        job_id = self.submit()
        fake = SimpleNamespace(generate_draft=generate, PipelineValidationError=PipelineValidationError)
        with patch.dict('os.environ', {'OPENDRAFT_ROOT': str(self.root)}), patch.dict(sys.modules, {'draft_generator': fake}):
            run(self.root, job_id)
            self.assertEqual(Store(self.root).get(job_id)['status'], 'Completed')
            def fail(**kwargs):
                raise PipelineValidationError('sensitive diagnostic')
            fake.generate_draft = fail
            failed_id = self.submit()
            with self.assertLogs(level='ERROR'):
                run(self.root, failed_id)
            job = Store(self.root).get(failed_id)
            self.assertEqual(job['error'], 'pipeline_validation_failed')
            self.assertEqual(job['status'], 'Failed')

    def test_scheduler_timeout_and_crashed_process(self):
        from types import SimpleNamespace

        async def exercise(timeout, exit_code, expected):
            store = Store(self.root)
            job_id = self.submit()
            process = SimpleNamespace(poll=lambda: exit_code, kill=lambda: None, wait=lambda: 0)
            app = SimpleNamespace(state=SimpleNamespace(store=store, python='python', timeout=timeout, process=None))
            with patch('main.subprocess.Popen', return_value=process):
                task = asyncio.create_task(scheduler(app))
                for _ in range(40):
                    await asyncio.sleep(0.02)
                    if store.get(job_id)['status'] == 'Failed':
                        break
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            self.assertEqual(store.get(job_id)['error'], expected)

        asyncio.run(exercise(-1, None, 'generation_timeout'))
        asyncio.run(exercise(100, 1, 'worker_exited'))


if __name__ == '__main__':
    unittest.main()
