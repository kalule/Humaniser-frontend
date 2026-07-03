import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, Eye, Trash2, FileText, ChevronDown, X,
  BookOpen, LayoutGrid, ScrollText, Loader2,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useStudioStore } from '../../store/studioStore'
import { useLibraryStore } from '../../store/libraryStore'
import { useResearchStore } from '../../store/researchStore'
import type { StudioFilter, WizardMode } from '../../types/studio'

// ── Unified dashboard entry ────────────────────────────────────────────────────
// Normalises both ResearchProject and StudioDocument so the table is type-safe
// and both data sources render through the same DocRow component.

interface DashboardEntry {
  id:        string
  title:     string
  subtitle:  string   // field interest or topic title — shown as a muted second line
  typeLabel: 'Generator' | 'Agent'
  updatedAt: string
  open:      () => void
  remove:    () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WIZARD_CARDS: {
  mode:     WizardMode
  icon:     React.ReactNode
  title:    string
  subtitle: string
  color:    string
  bg:       string
}[] = [
  {
    mode:     'PROPOSAL',
    icon:     <ScrollText size={22} />,
    title:    'Create Research Proposals in minutes with AI',
    subtitle: 'Plan sections, citations, methods, and final documents faster.',
    color:    'text-amber-600',
    bg:       'bg-amber-50 border-amber-200',
  },
  {
    mode:     'LIT_REVIEW',
    icon:     <BookOpen size={22} />,
    title:    'Create Literature Review with citations using AI',
    subtitle: 'Build grounded reviews with cited sources and clean structure.',
    color:    'text-orange-600',
    bg:       'bg-orange-50 border-orange-200',
  },
  {
    mode:     'ARTICLE',
    icon:     <LayoutGrid size={22} />,
    title:    'Create Articles with AI',
    subtitle: 'Draft article-style content from research ideas and evidence.',
    color:    'text-rose-600',
    bg:       'bg-rose-50 border-rose-200',
  },
]

const WIZARD_LABELS: Record<WizardMode, string> = {
  PROPOSAL:   'Research Proposal',
  LIT_REVIEW: 'Literature Review',
  ARTICLE:    'Article',
}

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
          <p className="text-[11px] text-orange-500 font-semibold uppercase tracking-widest mb-1">{label}</p>
          <h3 className="text-[17px] font-bold text-slate-900">Name your workspace</h3>
          <p className="text-[13px] text-slate-500 mt-1">Give your {label.toLowerCase()} a working title — you can rename it any time.</p>
        </div>

        <input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
          placeholder="e.g. AI Impact on Healthcare (required)"
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-[14px] text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition mb-5 placeholder-slate-400"
        />

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !title.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Create workspace
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── New Studio dropdown ────────────────────────────────────────────────────────

function NewStudioButton({ onSelect }: { onSelect: (mode: WizardMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[13px] font-semibold transition-colors shadow-md shadow-orange-200"
      >
        <Plus size={15} /> New studio <ChevronDown size={13} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden"
            >
              {WIZARD_CARDS.map(c => (
                <button
                  key={c.mode}
                  onClick={() => { setOpen(false); onSelect(c.mode) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  <span className={c.color}>{c.icon}</span>
                  {WIZARD_LABELS[c.mode]}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Delete confirmation modal ──────────────────────────────────────────────────

function DeleteModal({
  entry,
  onClose,
  onConfirm,
}: {
  entry:     DashboardEntry
  onClose:   () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors">
          <X size={16} />
        </button>

        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>

        <h3 className="text-[17px] font-bold text-slate-900 mb-1">Delete workspace?</h3>
        <p className="text-[13px] text-slate-500 mb-1">
          You are about to permanently delete:
        </p>
        <p className="text-[13px] font-semibold text-slate-800 truncate mb-5">
          "{entry.title}"
        </p>
        <p className="text-[12px] text-slate-400 mb-6">This action cannot be undone.</p>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors"
          >
            Delete
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Document row ───────────────────────────────────────────────────────────────
// The entire row is clickable. Action buttons call e.stopPropagation() so they
// don't trigger the row's navigation handler.

function DocRow({ entry, onDeleteRequest }: { entry: DashboardEntry; onDeleteRequest: (e: DashboardEntry) => void }) {
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={entry.open}
      className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer transition-colors duration-150"
    >
      {/* DOCUMENT */}
      <td className="py-3 px-4">
        <div className="flex items-start gap-2.5">
          <FileText size={15} className="text-orange-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 group-hover:text-orange-600 transition-colors truncate leading-snug">
              {entry.title}
            </p>
            {entry.subtitle && (
              <p className="text-[11px] text-slate-400 truncate mt-0.5 max-w-xs">
                {entry.subtitle}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* TYPE */}
      <td className="py-3 px-4">
        <span className={cn(
          'text-[12px] font-medium',
          entry.typeLabel === 'Agent' ? 'text-violet-600' : 'text-slate-500',
        )}>
          {entry.typeLabel}
        </span>
      </td>

      {/* UPDATED */}
      <td className="py-3 px-4">
        <span className="text-[12px] text-slate-500">{formatDate(entry.updatedAt)}</span>
      </td>

      {/* ACTIONS — stopPropagation so clicks don't bubble to the row handler */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); entry.open() }}
            title="Open"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDeleteRequest(entry) }}
            title="Delete"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </motion.tr>
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

  // Persisted `projects` is just a cache for instant paint — refresh from the
  // API on mount so the list survives clearing localStorage or switching devices.
  useEffect(() => {
    researchStore.loadProjects().catch(() => {})
  }, [])

  // ── Unified entry list ─────────────────────────────────────────────────────
  // Research projects (from the wizard) + studio docs (LIT_REVIEW, ARTICLE) are
  // merged, deduped by id, and sorted newest-first.

  const entries = useMemo<DashboardEntry[]>(() => {
    const researchEntries: DashboardEntry[] = researchStore.projects.map(p => ({
      id:        p.id,
      title:     p.title || p.selectedTopic?.title || p.fieldInterest || 'Untitled Research Project',
      subtitle:  p.selectedTopic?.title && p.title !== p.selectedTopic?.title ? p.selectedTopic.title : (p.fieldInterest ?? ''),
      typeLabel: p.generatorMode === 'AGENT' ? 'Agent' : 'Generator',
      updatedAt: p.updatedAt,
      open:   () => navigate(`/app/research-agent/${p.id}`),
      remove: () => researchStore.deleteProject(p.id),
    }))

    const studioEntries: DashboardEntry[] = studioStore.documents.map(doc => ({
      id:        doc.id,
      title:     doc.title || `Untitled ${WIZARD_LABELS[doc.wizardMode] ?? 'Document'}`,
      subtitle:  '',
      typeLabel: doc.studioType === 'AGENT' ? 'Agent' : 'Generator',
      updatedAt: doc.updatedAt,
      open: () => {
        if (doc.linkedEditorId) {
          navigate(`/app/editor/${doc.linkedEditorId}`)
        } else {
          const libDoc = libraryStore.createDocument({ title: doc.title, type: 'doc' })
          studioStore.updateDocument(doc.id, { linkedEditorId: libDoc.id })
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
      if (q && !e.title.toLowerCase().includes(q) && !e.subtitle.toLowerCase().includes(q)) return false
      return true
    })
  }, [entries, filter, search])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCreate = (title: string, mode: WizardMode) => {
    setModalMode(null)
    if (mode === 'PROPOSAL') {
      navigate(`/app/research-agent/new?mode=GENERATOR&doc=PROPOSAL&title=${encodeURIComponent(title)}`)
      return
    }
    const libDoc = libraryStore.createDocument({ title, type: 'doc' })
    studioStore.createDocument({ title, wizardMode: mode, studioType: 'GENERATOR', linkedEditorId: libDoc.id })
    navigate(`/app/editor/${libDoc.id}`)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white">
      <div className="max-w-5xl mx-auto w-full px-6 py-8">

        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-orange-500 mb-1">
              Proposal and Literature Studio
            </p>
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">Document home</h1>
            <p className="text-[13px] text-slate-500 mt-1">Create, search, and reopen proposal workspaces.</p>
          </div>
          <NewStudioButton onSelect={mode => setModalMode(mode)} />
        </div>

        {/* ── Wizard cards ──────────────────────────────────────────────────── */}
        <div className="mb-2">
          <p className="text-[12px] text-slate-400 font-medium mb-4">What can you do in the Studio?</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {WIZARD_CARDS.map(card => (
              <div
                key={card.mode}
                className="flex flex-col bg-white border border-slate-200 rounded-xl p-5 hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center mb-4 border', card.bg, card.color)}>
                  {card.icon}
                </div>
                <h3 className="text-[14px] font-bold text-slate-800 leading-snug mb-2 flex-1">{card.title}</h3>
                <p className="text-[12px] text-slate-500 leading-relaxed mb-4">{card.subtitle}</p>
                <div className="relative">
                  <GetStartedButton onSelect={() => setModalMode(card.mode)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 mb-4">
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

          <div className="relative max-w-xs w-full">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documents"
              className="w-full pl-8 pr-4 py-2 text-[13px] text-slate-700 border border-slate-200 rounded-lg outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition placeholder-slate-400"
            />
          </div>
        </div>

        {/* ── Document table ─────────────────────────────────────────────────── */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col />
              <col className="w-28" />
              <col className="w-36" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['DOCUMENT', 'TYPE', 'UPDATED', 'ACTIONS'].map(col => (
                  <th key={col} className="text-left text-[11px] font-semibold text-slate-400 uppercase tracking-widest px-4 py-2.5">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                          <FileText size={22} className="text-slate-400" />
                        </div>
                        <p className="text-[14px] text-slate-600 font-medium">No workspaces yet</p>
                        <p className="text-[12px] text-slate-400">
                          {search ? 'No documents match your search.' : 'Create your first studio workspace above.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(entry => <DocRow key={entry.id} entry={entry} onDeleteRequest={setPendingDelete} />)
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

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

      {/* ── Delete confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {pendingDelete && (
          <DeleteModal
            entry={pendingDelete}
            onClose={() => setPendingDelete(null)}
            onConfirm={() => {
              pendingDelete.remove()
              setPendingDelete(null)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── GetStarted button with dropdown ───────────────────────────────────────────

function GetStartedButton({ onSelect }: { onSelect: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative inline-flex">
      <button
        className="flex items-center gap-1.5 pl-4 pr-2 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-orange-200"
      >
        <span onClick={onSelect}>Get Started</span>
        <div
          onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-orange-400/40 transition-colors ml-0.5 cursor-pointer"
        >
          <ChevronDown size={12} />
        </div>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 overflow-hidden">
            <button onClick={() => { setOpen(false); onSelect() }}
              className="w-full text-left px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              Start with AI (Generator)
            </button>
            <button onClick={() => { setOpen(false); onSelect() }}
              className="w-full text-left px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
              Use Agent mode
            </button>
          </div>
        </>
      )}
    </div>
  )
}
