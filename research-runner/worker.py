"""One process per draft: isolate OpenDraft's global config and module imports."""
import json
import logging
import os
import sys
from pathlib import Path

from store import Store, artifacts


class Tracker:
    def __init__(self, store, job_id):
        self.store, self.job_id = store, job_id

    def update_phase(self, phase, progress_percent=None, **kwargs):
        values = {'phase': str(phase)[:80]}
        if progress_percent is not None:
            values['progress'] = max(0, min(99, int(progress_percent)))
        self.store.update(self.job_id, **values)

    def log_activity(self, message, **kwargs):
        logging.info('Pipeline event: %s', kwargs.get('phase', 'activity'))

    def update_exporting(self, **kwargs):
        self.update_phase('exporting')

    def update_research(self, **kwargs):
        self.update_phase('research')

    def log_source_found(self, *args, **kwargs):
        pass

    def send_heartbeat(self, *args, **kwargs):
        pass

    def check_cancellation(self):
        pass

    def mark_completed(self):
        pass  # Completion is committed only after artifact validation.

    def mark_failed(self, *args, **kwargs):
        pass  # The exception handler classifies failures without leaking secrets.


def run(root, job_id):
    store = Store(root)
    try:
        source = Path(os.environ['OPENDRAFT_ROOT']).resolve()
        sys.path.insert(0, str(source / 'engine'))
        sys.path.insert(1, str(source))
        # Pipeline imports config/utils/phases as top-level modules.
        import draft_generator
        from draft_generator import PipelineValidationError
        payload = json.loads(store.get(job_id)['payload'])
        if payload.pop('_job_type', None) == 'thesis':
            from thesis_pipeline import install
            payload = install(draft_generator, payload)
        output = store.root / job_id / 'output'
        try:
            draft_generator.generate_draft(**payload, output_dir=output, skip_validation=False,
                           verbose=False, tracker=Tracker(store, job_id))
        except PipelineValidationError:
            store.update(job_id, status='Failed', error='pipeline_validation_failed')
            logging.exception('Pipeline validation failed for %s', job_id)
            return
        if not artifacts(output):
            raise RuntimeError('Pipeline produced no downloadable artifacts')
        store.update(job_id, status='Completed', phase='completed', progress=100)
    except Exception:
        logging.exception('Generation failed for %s', job_id)
        store.update(job_id, status='Failed', error='generation_failed')


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO)
    run(sys.argv[1], sys.argv[2])
