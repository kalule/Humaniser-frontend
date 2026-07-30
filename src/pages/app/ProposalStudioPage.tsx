import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, Trash2, FileText, Search, X, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useStudioStore } from '../../store/studioStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useResearchStore } from '../../store/researchStore'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import { ToolCard } from '../../components/app/ToolCard'
import { DocumentList, type DocumentListEntry } from '../../components/app/DocumentList'
import { DOCUMENT_KIND_META, type ContentKind } from '../../config/documentKinds'
import {
  AutonomousProposalModal, SimilarPapersModal, GenerationPanel, useAutonomousProposalFlow,
} from '../../components/app/AutonomousProposalTools'
import type { StudioFilter, WizardMode } from '../../types/studio'

// ── Unified dashboard entry ────────────────────────────────────────────────────
// Normalises both ResearchProject and StudioDocument so both data sources
// render through the same shared DocumentList component.

interface DashboardEntry {
  id:         string
  title:      string
  typeLabel:  'Generator' | 'Agent'
  contentKind: ContentKind
  updatedAt:  string
  // Compact single-line metadata, matching the format AI Thesis's Generated
  // Documents list already uses (e.g. "9 Jul 2026 · MASTERS · APA7") — only
  // ResearchProject-backed entries carry academicLevel/citationStyle, so
  // studio-only entries (Lit. Review / Article) fall back to just the date.
  metaLine:   string
  open:       () => void | Promise<void>
  remove:     () => void | Promise<void>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WIZARD_CARDS: {
  mode:     WizardMode
  title:    string
  subtitle: string
}[] = [
  {
    mode:     'PROPOSAL',
    title:    'Create Research Proposals in minutes with AI',
    subtitle: 'Plan sections, citations, methods, and final documents faster.',
  },
  {
    mode:     'LIT_REVIEW',
    title:    'Create Literature Review with citations using AI',
    subtitle: 'Build grounded reviews with cited sources and clean structure.',
  },
  {
    mode:     'ARTICLE',
    title:    'Create Articles with AI',
    subtitle: 'Draft article-style content from research ideas and evidence.',
  },
]

const WIZARD_LABELS: Record<WizardMode, string> = {
  PROPOSAL:   'Research Proposal',
  LIT_REVIEW: 'Literature Review',
  ARTICLE:    'Article',
}

const PAGE_SIZE = 25

const FILTER_TABS: { label: string; value: StudioFilter }[] = [
  { label: 'All',       value: 'all'       },
  { label: 'Generator', value: 'generator' },
  { label: 'Agent',     value: 'agent'     },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Creation modal ─────────────────────────────────────────────────────────────

function CreateModal({
  mode,
  onClose,
  onCreate,
}: {
  mode:     WizardMode
  onClose:  () => void
  onCreate: (title: string, mode: WizardMode) => void
}) {
  const [title,   setTitle]   = useState('')
  const [loading, setLoading] = useState(false)
  const label = WIZARD_LABELS[mode]

  const handleCreate = async () => {
    if (!title.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    onCreate(title.trim(), mode)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <div className="mb-5">
          <p className="text-[11px] text-purple-text font-semibold uppercase tracking-widest mb-1">{label}</p>
          <h3 className="text-[17px] font-bold text-slate-900">Name your workspace</h3>
          <p className="text-[13px] text-slate-500 mt-1">Give your {label.toLowerCase()} a working title — you can rename it any time.</p>
        </div>

        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          placeholder="e.g. AI Impact on Healthcare (required)"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-tint transition mb-5 placeholder-slate-400"
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !title.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-accent hover:bg-purple-deep text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Create workspace
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProposalStudioPage() {
  const navigate      = useNavigate()
  const studioStore   = useStudioStore()
  const libraryStore  = useLibraryStore()
  const researchStore = useResearchStore()

  const [filter,        setFilter]        = useState<StudioFilter>('all')
  const [search,        setSearch]        = useState('')
  const [modalMode,     setModalMode]     = useState<WizardMode | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DashboardEntry | null>(null)
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE)
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem('proposal_studio_hide_onboarding') !== 'true',
  )

  const {
    gen, showCreateModal, setShowCreateModal, openCreateModal,
    showSimilarModal, setShowSimilarModal, handleCreate: handleCreateAutonomous,
    onToggleArticleView, onCancelGeneration, onCloseGeneration, onOpenGeneratedDocument,
  } = useAutonomousProposalFlow()

  const dismissOnboarding = () => {
    localStorage.setItem('proposal_studio_hide_onboarding', 'true')
    setShowOnboarding(false)
  }
  const restoreOnboarding = () => {
    localStorage.removeItem('proposal_studio_hide_onboarding')
    setShowOnboarding(true)
  }

  // Persisted `projects` is just a cache for instant paint — refresh from the
  // API on mount so the list survives clearing localStorage or switching devices.
  useEffect(() => {
    researchStore.loadProjects().catch(() => {})
    studioStore.loadDocuments().catch(() => {})
  }, [])

  // ── Unified entry list ─────────────────────────────────────────────────────
  // Research projects (from the wizard) + studio docs (LIT_REVIEW, ARTICLE) are
  // merged, deduped by id, and sorted newest-first.

  const entries = useMemo<DashboardEntry[]>(() => {
    const researchEntries: DashboardEntry[] = researchStore.projects.map(p => ({
      id:          p.id,
      title:       p.title || p.selectedTopic?.title || p.fieldInterest || 'Untitled Research Project',
      typeLabel:   p.generatorMode === 'AGENT' ? 'Agent' : 'Generator',
      contentKind: p.documentMode === 'DISSERTATION' ? 'DISSERTATION' : 'PROPOSAL',
      updatedAt:   p.updatedAt,
      metaLine:    `${formatDate(p.updatedAt)} · ${p.academicLevel} · ${p.citationStyle.toUpperCase()}`,
      open:   () => navigate(`/app/research-agent/${p.id}`),
      remove: () => researchStore.deleteProject(p.id),
    }))

    const studioEntries: DashboardEntry[] = studioStore.documents.map(doc => ({
      id:          doc.id,
      title:       doc.title || `Untitled ${WIZARD_LABELS[doc.wizardMode] ?? 'Document'}`,
      typeLabel:   doc.studioType === 'AGENT' ? 'Agent' : 'Generator',
      contentKind: doc.wizardMode,
      updatedAt:   doc.updatedAt,
      metaLine:    formatDate(doc.updatedAt),
      open: async () => {
        if (doc.linkedEditorId) {
          navigate(`/app/editor/${doc.linkedEditorId}`)
        } else {
          const libDoc = await libraryStore.createDocument({ title: doc.title, type: 'doc' })
          await studioStore.updateDocument(doc.id, { linkedEditorId: libDoc.id })
          navigate(`/app/editor/${libDoc.id}`)
        }
      },
      remove: () => studioStore.deleteDocument(doc.id),
    }))

    // Merge and sort newest-first
    return [...researchEntries, ...studioEntries].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    )
  }, [researchStore.projects, studioStore.documents])

  // ── Filtered view ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter(e => {
      if (filter === 'generator' && e.typeLabel !== 'Generator') return false
      if (filter === 'agent'     && e.typeLabel !== 'Agent')     return false
      if (q && !e.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, filter, search])

  // TYPE is only informative when the current view actually mixes Generator and
  // Agent docs — otherwise every row would repeat the same label for nothing.
  const showTypeBadge = useMemo(
    () => new Set(filtered.map(e => e.typeLabel)).size > 1,
    [filtered],
  )

  // Reset how many rows are shown whenever the underlying result set changes —
  // otherwise switching tabs/searching could leave visibleCount pointing past
  // the end of a much shorter filtered list.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [filter, search])

  const visibleEntries = filtered.slice(0, visibleCount)
  const hasMore = filtered.length > visibleEntries.length

  const documentEntries: DocumentListEntry[] = visibleEntries.map(entry => {
    const kind = DOCUMENT_KIND_META[entry.contentKind]
    return {
      id: entry.id,
      icon: <kind.icon size={16} />,
      iconClassName: cn(kind.bg, kind.color),
      title: entry.title,
      metaLine: entry.metaLine,
      badges: [
        { label: kind.label, className: cn(kind.bg, kind.color) },
        ...(showTypeBadge ? [{
          label: entry.typeLabel,
          className: entry.typeLabel === 'Agent' ? 'bg-violet-50 text-violet-600 border-violet-200' : 'bg-slate-100 text-slate-500 border-slate-200',
        }] : []),
      ],
      onOpen: () => entry.open(),
      inlineActions: [
        { key: 'preview', icon: <Eye size={14} />, label: 'Preview', onClick: (e) => { e.stopPropagation(); entry.open() } },
      ],
      overflowActions: [
        { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', onClick: () => setPendingDelete(entry) },
      ],
    }
  })

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreate = async (title: string, mode: WizardMode) => {
    setModalMode(null)
    if (mode === 'PROPOSAL') {
      navigate(`/app/research-agent/new?mode=GENERATOR&doc=PROPOSAL&title=${encodeURIComponent(title)}`)
      return
    }
    const libDoc = await libraryStore.createDocument({ title, type: 'doc' })
    await studioStore.createDocument({ title, wizardMode: mode, studioType: 'GENERATOR', linkedEditorId: libDoc.id })
    navigate(`/app/editor/${libDoc.id}`)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="w-full px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        {/* The top app header (AppNavbar, shared across every /app page) already
            states "Proposal Studio" — this page body states its identity once
            more (not twice, via a separate eyebrow + H1) and otherwise sticks to
            descriptive copy. "Proposal Studio" (not "...and Literature Studio")
            since Literature Review has no separate destination — it's just one
            of three creation options here, no more special-cased than Article. */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Proposal Studio</h1>
            <p className="text-[13px] text-slate-500 mt-1">Create, search, and reopen proposal workspaces.</p>
          </div>
          {!showOnboarding && (
            <button
              onClick={restoreOnboarding}
              className="text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors shrink-0"
            >
              Show tips
            </button>
          )}
        </div>

        {/* ── Autonomous generation progress ───────────────────────────────── */}
        {gen && (
          <GenerationPanel
            gen={gen}
            onToggleArticleView={onToggleArticleView}
            onCancel={onCancelGeneration}
            onClose={onCloseGeneration}
            onOpenDocument={onOpenGeneratedDocument}
          />
        )}

        {/* ── Wizard cards ──────────────────────────────────────────────────── */}
        {showOnboarding && (
          <div className="mb-2">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] text-slate-500 font-medium">What can you do in the Studio?</p>
              <button
                onClick={dismissOnboarding}
                title="Hide tips"
                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-8">
              {WIZARD_CARDS.map(card => {
                const kind = DOCUMENT_KIND_META[card.mode]
                return (
                  <ToolCard
                    key={card.mode}
                    icon={<kind.icon size={16} />}
                    iconClassName={cn(kind.bg, kind.color)}
                    title={card.title}
                    description={card.subtitle}
                    onCta={() => setModalMode(card.mode)}
                  />
                )
              })}
              <ToolCard
                icon={<FileText size={16} />}
                iconClassName="bg-orange-50 text-orange-600"
                title="Autonomous Proposal"
                description="Generate a complete research proposal with citations in one click. Configure settings and let AI do the rest."
                ctaLabel="Get Started"
                onCta={openCreateModal}
              />
              <ToolCard
                icon={<Search size={16} />}
                iconClassName="bg-slate-100 text-slate-600"
                title="Similar Papers Finder"
                description="Find related research papers using Semantic Scholar. Enter any topic, title, or DOI to discover similar publications."
                ctaLabel="Get Started"
                onCta={() => setShowSimilarModal(true)}
              />
            </div>
          </div>
        )}

        <DocumentList
          entries={documentEntries}
          totalCount={entries.length}
          search={search}
          onSearchChange={setSearch}
          filterBar={
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {FILTER_TABS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setFilter(t.value)}
                  className={cn(
                    'px-3 py-1 rounded-md text-[12px] font-medium transition-all',
                    filter === t.value
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          }
          emptyIcon={<FileText size={22} className="text-slate-400" />}
          emptyTitle={filter === 'all' ? 'No workspaces yet' : `No ${filter === 'agent' ? 'agent-generated' : 'generator'} documents yet`}
          emptySubtitle={filter === 'all' ? 'Create your first studio workspace above.' : 'Get started above to create one.'}
        />

        {/* ── Load more ─────────────────────────────────────────────────────── */}
        {hasMore && (
          <div className="flex items-center justify-center pt-4">
            <button
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              Load more ({filtered.length - visibleEntries.length} remaining)
            </button>
          </div>
        )}

      </div>

      {/* ── Creation modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modalMode && (
          <CreateModal
            mode={modalMode}
            onClose={() => setModalMode(null)}
            onCreate={handleCreate}
          />
        )}
      </AnimatePresence>

      {/* ── Autonomous Proposal modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateModal && (
          <AutonomousProposalModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateAutonomous}
          />
        )}
      </AnimatePresence>

      {/* ── Similar Papers Finder ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showSimilarModal && (
          <SimilarPapersModal onClose={() => setShowSimilarModal(false)} />
        )}
      </AnimatePresence>

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {pendingDelete && (
          <ConfirmActionModal
            title={`Delete "${pendingDelete.title}"?`}
            message="This action cannot be undone."
            confirmLabel="Delete"
            onClose={() => setPendingDelete(null)}
            onConfirm={async () => {
              await pendingDelete.remove()
              setPendingDelete(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
