import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, FileText, Plus, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { ProposalSetupDialog, type ProposalSetup } from '../../components/research-design/ProposalSetupDialog'
import { AutonomousProposalModal, GenerationPanel, useAutonomousProposalFlow } from '../../components/app/AutonomousProposalTools'
import type { AcademicLevel } from '../../types/research'
import { researchApi } from '../../api/research'
import { proposalJourneyApi } from '../../api/proposalJourney'
import { useAuthStore } from '../../store/authStore'
import { useResearchStore } from '../../store/researchStore'
import { useStudioStore } from '../../store/studioStore'
import { useLibraryStore } from '../../store/libraryStore'
import { matchesProposalFilter, proposalNextLabel, proposalStageLabel, type ProposalFilter } from '../../lib/proposalJourney'
import { formatShortDate } from '../../lib/utils'
import { DOCUMENT_KIND_META } from '../../config/documentKinds'
import { FORMAT_LABELS } from '../../types/citation'
import '../../components/research-design/researchDesign.css'

const filters: { value: ProposalFilter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'inProgress', label: 'In progress' }, { value: 'attention', label: 'Needs attention' }, { value: 'reviewed', label: 'Completed versions' }]
const levels: Record<string, string> = { UNDERGRADUATE: 'Undergraduate', MASTERS: 'Masters', PHD: 'PhD', HONOURS: 'Honours' }
export default function ProposalStudioPage() {
  const navigate = useNavigate(), userId = useAuthStore(s => s.user?.id ?? '')
  const research = useResearchStore(), studio = useStudioStore(), library = useLibraryStore()
  // The automated writing flow: its own details form, then a live progress panel while sections are written.
  const auto = useAutonomousProposalFlow()
  const [quick, setQuick] = useState<{ topic: string; level: AcademicLevel } | null>(null)
  const [filter, setFilter] = useState<ProposalFilter>('all'), [search, setSearch] = useState(''), [limit, setLimit] = useState(25)
  const [deleteBusy, setDeleteBusy] = useState(false), [deleteError, setDeleteError] = useState(''), [sort, setSort] = useState('updated'), [creating, setCreating] = useState(false), [deleting, setDeleting] = useState<{ id: string; title: string; remove: () => Promise<void> } | null>(null)
  const projects = useQuery({ queryKey: ['proposal-projects', userId], queryFn: () => researchApi.list(), enabled: !!userId, retry: false, refetchOnWindowFocus: true, refetchInterval: q => q.state.data?.some(p => ['Starting', 'Generating'].includes(p.generation?.status ?? '')) ? 10000 : false })
  const journeys = useQuery({ queryKey: ['proposal-journeys', userId], queryFn: ({ signal }) => proposalJourneyApi.list(signal), enabled: !!userId, retry: false, refetchOnWindowFocus: true, refetchInterval: q => q.state.data?.some(v => ['Designing', 'CheckingEvidence', 'Writing'].includes(v.stage)) ? 10000 : false })
  useEffect(() => { void studio.loadDocuments().catch(() => {}) }, [userId])
  useEffect(() => { setLimit(25) }, [filter, search])
  const allEntries = useMemo(() => {
    const proposals = (projects.data ?? []).map(p => {
      const summary = journeys.data?.find(v => v.projectId === p.id)
      return {
        id: p.id, title: p.title || p.selectedTopic?.title || p.fieldInterest || 'Untitled proposal',
        kind: p.documentMode === 'DISSERTATION' ? 'DISSERTATION' as const : 'PROPOSAL' as const,
        createdAt: p.createdAt, updatedAt: p.updatedAt, summary,
        meta: `${levels[p.academicLevel] ?? 'Research'} | Updated ${formatShortDate(p.updatedAt)} | ${FORMAT_LABELS[p.citationStyle]} citations`,
        // New proposals go straight to the writing workspace. Only proposals already started with the
        // retired design-first flow still need the workflow page to finish their accepted design.
        open: () => navigate(summary?.designRequired && p.documentMode !== 'DISSERTATION' ? `/app/research-agent/${p.id}/proposal-workflow` : `/app/research-agent/${p.id}`),
        remove: () => research.deleteProject(p.id),
      }
    })
    const documents = studio.documents.filter(doc => !proposals.some(p => p.id === doc.id)).map(doc => ({
      id: doc.id, title: doc.title || 'Untitled document', kind: doc.wizardMode, createdAt: doc.createdAt, updatedAt: doc.updatedAt, summary: undefined,
      meta: `Updated ${formatShortDate(doc.updatedAt)}`,
      open: async () => {
        let editorId = doc.linkedEditorId
        if (!editorId) { const d = await library.createDocument({ title: doc.title, type: 'doc' }); editorId = d.id; await studio.updateDocument(doc.id, { linkedEditorId: editorId }) }
        navigate(`/app/editor/${editorId}`)
      }, remove: () => studio.deleteDocument(doc.id),
    }))
    return [...proposals, ...documents]
  }, [projects.data, journeys.data, studio.documents])
  const entries = allEntries.filter(e => matchesProposalFilter(e.summary, filter) && e.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : Date.parse(sort === 'created' ? b.createdAt : b.updatedAt) - Date.parse(sort === 'created' ? a.createdAt : a.updatedAt))
  const rows: DocumentListEntry[] = entries.slice(0, limit).map(entry => {
    const kind = DOCUMENT_KIND_META[entry.kind], summary = entry.summary
    return { id: entry.id, title: entry.title, icon: <kind.icon size={16} />, iconClassName: `${kind.bg} ${kind.color}`, metaLine: entry.meta,
      statusBadge: summary ? { label: proposalStageLabel(summary.stage), className: ['NeedsInput', 'NeedsAttention'].includes(summary.stage) ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700' } : undefined,
      onOpen: () => { void entry.open() },
      inlineActions: [{ key: 'continue', icon: <ArrowRight size={14} />, label: proposalNextLabel(summary?.nextAction), showLabel: true, onClick: () => { void entry.open() } }],
      overflowActions: [{ key: 'open', icon: <FileText size={14} />, label: 'Open', destructive: false, onClick: () => { void entry.open() } }, { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', destructive: true, onClick: () => { setDeleteError(''); setDeleting(entry) } }],
    }
  })
  const create = async (setup: ProposalSetup) => {
    const project = await researchApi.create({ generatorMode: 'GENERATOR', documentMode: 'PROPOSAL', designFirst: false, topic: setup.topic, academicLevel: setup.academicLevel, citationStyle: setup.citationStyle })
    setCreating(false); void projects.refetch(); void journeys.refetch()
    navigate(`/app/research-agent/${project.id}`)
  }
  return <div className="research-design min-w-0 w-full px-4 sm:px-6 py-6 sm:py-8">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-7"><p className="text-sm text-text-secondary">Write your proposal yourself with AI help, or let us draft it automatically.</p><Button onClick={() => setCreating(true)} leftIcon={<Plus size={16} />}>New proposal</Button></div>
    {(projects.error || journeys.error) && <div role="alert" className="text-sm mb-5"><p>We could not check the latest proposal status. Your saved proposals remain available.</p><Button variant="ghost" onClick={() => { void projects.refetch(); void journeys.refetch() }}>Refresh proposals</Button></div>}
    {projects.isPending && <p role="status" className="mb-4 text-sm">Loading your proposals...</p>}
    <DocumentList entries={rows} totalCount={allEntries.length} search={search} onSearchChange={setSearch} searchPlaceholder="Search proposals..."
      filterBar={<div className="flex flex-wrap gap-1" aria-label="Filter proposals">{filters.map(f => <Button key={f.value} size="sm" variant={filter === f.value ? 'secondary' : 'ghost'} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label} {allEntries.filter(e => matchesProposalFilter(e.summary, f.value)).length}</Button>)}</div>}
      headerRight={<select aria-label="Sort proposals" className="rounded-lg border border-border bg-card p-2 text-sm" value={sort} onChange={e => setSort(e.target.value)}><option value="updated">Last modified</option><option value="title">Title</option><option value="created">Created</option></select>}
      emptyIcon={<FileText size={22} />} emptyTitle="No proposals here yet" emptySubtitle="Start a proposal or change the filter to find your saved work." />
    {entries.length > limit && <div className="flex justify-center mt-5"><Button variant="secondary" onClick={() => setLimit(v => v + 25)}>Load more ({entries.length - limit} remaining)</Button></div>}
    {auto.gen && <div className="mt-6"><GenerationPanel gen={auto.gen} onToggleArticleView={auto.onToggleArticleView} onCancel={auto.onCancelGeneration} onClose={auto.onCloseGeneration} onOpenDocument={auto.onOpenGeneratedDocument} onResume={() => void auto.onResumeGeneration()} resuming={auto.resuming} /></div>}
    {creating && <ProposalSetupDialog onClose={() => setCreating(false)} onCreate={create} onAutomate={s => { setCreating(false); setQuick({ topic: s.topic, level: s.academicLevel }) }} />}
    {quick && <AutonomousProposalModal initialTitle={quick.topic} initialLevel={quick.level} onClose={() => setQuick(null)}
      onCreate={async config => { await auto.handleCreate(config); setQuick(null); void projects.refetch(); void journeys.refetch() }} />}
    {deleting && <Modal panelClassName="research-design" isOpen title="Delete proposal?" onClose={() => { if (!deleteBusy) setDeleting(null) }}><p className="text-sm break-words">"{deleting.title}" and its saved workspace will be deleted. This cannot be undone.</p>{deleteError && <p role="alert" className="text-sm mt-4">{deleteError}</p>}<div className="mt-5 flex justify-end gap-3"><Button variant="ghost" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" disabled={deleteBusy} isLoading={deleteBusy} onClick={async () => { if (deleteBusy) return; setDeleteBusy(true); try { await deleting.remove(); setDeleting(null); await projects.refetch(); await journeys.refetch() } catch { setDeleteError('We could not delete this proposal. Please try again.') } finally { setDeleteBusy(false) } }}>Delete</Button></div></Modal>}
  </div>
}
