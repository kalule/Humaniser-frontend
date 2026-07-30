import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Download, Loader2, Copy, CheckCircle2, AlertCircle } from 'lucide-react'
import { useResearchStore } from '../../store/researchStore'
import { researchApi } from '../../api/research'
import type { ProjectSection } from '../../types/research'
import '../../styles/research-agent-editor.css'

const CITATION_LABELS: Record<string, string> = {
  apa7: 'APA 7th', harvard: 'Harvard', mla: 'MLA', ieee: 'IEEE',
}

// Any generated project has, at minimum, an empty sections list — this stable
// reference avoids handing the Zustand selector a fresh `[]` on every render
// (see ResearchAgentPage's EMPTY_SECTIONS for the getSnapshot loop this avoids).
const EMPTY_SECTIONS: ProjectSection[] = []

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Wraps parenthetical in-text citations, e.g. "(Smith et al., 2023)", in a pill
// span purely for readability — a loose heuristic (any "(...)" ending in a
// 19xx/20xx year) rather than a real citation parser, so it can occasionally
// tag a non-citation parenthetical; that's an acceptable trade-off here since
// this view is read-only and never feeds back into stored content.
const CITATION_RE = /\(([^()]{2,100}?\b(?:19|20)\d{2}[a-z]?)\)/g

function wrapCitations(escapedText: string): string {
  return escapedText.replace(CITATION_RE, (match) => `<span class="doc-citation-pill">${match}</span>`)
}

function paragraphsToHtml(content: string): string {
  return content
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${wrapCitations(escapeHtml(p)).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export default function DocumentViewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { projects, loadProject, loadSections, exportDocx, exportThesisDocx, syncProject } = useResearchStore()
  const dbSections = useResearchStore(s => s.sections[projectId ?? ''] ?? EMPTY_SECTIONS)

  const [loadError,   setLoadError]   = useState(false)
  const [bibliography, setBibliography] = useState<string[]>([])
  const [loadingBib,  setLoadingBib]  = useState(true)
  const [loadingSections, setLoadingSections] = useState(true)
  const [exporting,   setExporting]   = useState(false)
  const [copied,      setCopied]      = useState(false)

  useEffect(() => {
    if (!projectId) return
    loadProject(projectId).catch(() => setLoadError(true))
    setLoadingSections(true)
    loadSections(projectId).catch(() => {}).finally(() => setLoadingSections(false))
  }, [projectId])

  useEffect(() => {
    if (!projectId) return
    setLoadingBib(true)
    researchApi.compileBibliography(projectId)
      .then(result => {
        const entries = result
          .split('\n')
          .filter(l => /^\d+\.\s/.test(l.trim()))
          .map(l => l.trim().replace(/^\d+\.\s*/, ''))
        setBibliography(entries)
      })
      .catch(() => {})
      .finally(() => setLoadingBib(false))
  }, [projectId])

  const project = projects.find(p => p.id === projectId)

  const sortedSections = useMemo(
    () => [...dbSections].filter(s => s.content.trim()).sort((a, b) => a.order - b.order),
    [dbSections],
  )

  const documentHtml = useMemo(() => {
    const parts: string[] = []
    for (const section of sortedSections) {
      parts.push(`<h2>${escapeHtml(section.code)} ${escapeHtml(section.title)}</h2>`)
      parts.push(paragraphsToHtml(section.content))
    }
    if (bibliography.length > 0) {
      parts.push('<h2>References</h2>')
      parts.push(`<ol class="doc-reference-list">${bibliography.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ol>`)
    }
    return parts.join('')
  }, [sortedSections, bibliography])

  const isThesisOrDissertation = project?.documentType === 'Thesis' || project?.documentType === 'Dissertation'
  const handleClose = () => navigate(isThesisOrDissertation ? '/app/thesis-studio' : '/app/proposal-studio')

  const handleCopy = async () => {
    const lines: string[] = [project?.title || 'Research Document', '']
    for (const section of sortedSections) {
      lines.push(`${section.code} ${section.title}`, '', section.content.trim(), '')
    }
    if (bibliography.length > 0) {
      lines.push('References', '', ...bibliography.map((e, i) => `${i + 1}. ${e}`))
    }
    await navigator.clipboard.writeText(lines.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = async () => {
    if (!project) return
    setExporting(true)
    try {
      await syncProject(project.id)
      if (project.documentMode === 'DISSERTATION') {
        await exportThesisDocx(project.id)
      } else {
        await exportDocx(project.id)
      }
    } finally {
      setExporting(false)
    }
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 text-center px-6 bg-white">
        <AlertCircle size={32} className="text-slate-300" />
        <p className="text-[14px] font-semibold text-slate-700">Document not found</p>
        <p className="text-[12px] text-slate-400">This project may have been deleted or doesn't belong to your account.</p>
        <button
          onClick={handleClose}
          className="mt-2 px-4 py-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-[13px] font-medium transition-colors"
        >
          Back
        </button>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full py-24">
        <Loader2 size={22} className="animate-spin text-slate-300" />
      </div>
    )
  }

  return (
    <div className="doc-surface-wrapper" style={{ padding: '16px 0 0' }}>
      <div className="doc-page-surface" style={{ maxWidth: 880 }}>

        {/* ── Title bar ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-slate-800 shrink-0">
          <p className="text-[13.5px] font-semibold text-white truncate">
            {project.title || 'Untitled research document'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-600 text-[11px] font-medium text-slate-200">
              {CITATION_LABELS[project.citationStyle] ?? project.citationStyle.toUpperCase()}
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-600 text-[12px] font-medium text-slate-200 hover:bg-slate-700 transition-colors"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-60 text-white text-[12px] font-semibold transition-colors"
            >
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              {exporting ? 'Building…' : 'Download'}
            </button>
            <button
              onClick={handleClose}
              title="Close"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Compiled document body ──────────────────────────────────── */}
        <div className="doc-editor-scroll">
          <div style={{ padding: '28px 48px' }}>
            {loadingSections ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 size={20} className="animate-spin text-slate-300" />
              </div>
            ) : sortedSections.length === 0 ? (
              <div className="doc-empty-state">
                <p className="doc-empty-title">Nothing to show yet</p>
                <p className="doc-empty-desc">No sections have been generated for this document yet.</p>
              </div>
            ) : (
              <div className="tiptap-doc-editor">
                <div className="ProseMirror" dangerouslySetInnerHTML={{ __html: documentHtml }} />
              </div>
            )}
            {loadingBib && sortedSections.length > 0 && (
              <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin" /> Compiling references…
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
