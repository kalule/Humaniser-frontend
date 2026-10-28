import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ProposalDesignReadinessPanel } from './ProposalDesignReadinessPanel'
import type { ProposalDesignReadiness } from '../../types/proposalWorkflow'

const mocked = vi.hoisted(() => ({ data: null as ProposalDesignReadiness | null, error: null as Error | null, pending: false }))
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: mocked.data, error: mocked.error, isPending: mocked.pending, refetch: vi.fn() }) }))
vi.mock('../../store/authStore', () => ({ useAuthStore: (selector: (s: { user: { id: string } }) => unknown) => selector({ user: { id: 'student' } }) }))
const render = () => renderToStaticMarkup(<MemoryRouter><ProposalDesignReadinessPanel projectId="project" /></MemoryRouter>)
describe('proposal research design readiness', () => {
  beforeEach(() => { mocked.error = null; mocked.pending = false; mocked.data = { mode: 'CanonicalResearchDesign', canGenerate: true, acceptedRevisionId: 'revision', acceptedVersion: 2, boundRevisionId: 'revision', validationFingerprint: 'hidden', findings: [], sections: [], allowedActions: ['ViewResearchDesign', 'Generate'] } })
  it('shows the accepted version and a design entry point without exposing pipeline details', () => { const html = render(); expect(html).toContain('version 2'); expect(html).toContain('/app/research-design/project'); expect(html).not.toContain('hidden'); expect(html).not.toContain('agent'); expect(html).not.toContain('Use updated design') })
  it('requires server permission for a design upgrade', () => { mocked.data!.allowedActions = ['UseUpdatedDesign']; mocked.data!.canGenerate = false; expect(render()).toContain('Use updated design'); mocked.data!.allowedActions = []; expect(render()).not.toContain('Use updated design') })
  it('keeps affected and unaffected sections distinct and promises preserved text', () => { mocked.data!.sections = [{ code: '5.7a', affected: true, generatedRevisionId: 'old', contentVersion: 'v', reason: 'Changed analysis' }, { code: '1.0', affected: false, generatedRevisionId: 'old', contentVersion: 'v', reason: null }]; const html = render(); expect(html).toContain('Review sections: 5.7a'); expect(html).not.toContain('Review sections: 5.7a, 1.0'); expect(html).toContain('Your text is preserved') })
  it('labels legacy compatibility without claiming design validation', () => { mocked.data!.mode = 'LegacyCompatibility'; const html = render(); expect(html).toContain('earlier research workflow'); expect(html).toContain('not been validated') })
  it('shows actionable server evidence blockers rather than a false completion state', () => { mocked.data!.canGenerate = false; mocked.data!.findings = [{ key: 'EVIDENCE', status: 'Pending', severity: 'Blocker', message: 'Instrument evidence needs review.', sectionCode: null }]; const html = render(); expect(html).toContain('Instrument evidence needs review'); expect(html).toContain('needs attention') })
  it('offers a retry when readiness is unavailable', () => { mocked.error = new Error('Unavailable'); expect(render()).toContain('Try again'); expect(render()).not.toContain('can use this research design') })
  it('shows a bounded loading message before readiness is known', () => { mocked.pending = true; expect(render()).toContain('Checking your proposal'); expect(render()).not.toContain('Use updated design') })
})
