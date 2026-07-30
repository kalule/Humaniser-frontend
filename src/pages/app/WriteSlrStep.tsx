import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Download, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useSystematicReviewStore } from '../../store/systematicReviewStore'
import { useCreditGate } from '../../hooks/useCreditGate'
import { CREDIT_COSTS } from '../../config/creditCosts'
import { downloadBlob } from '../../lib/utils'
import ConfirmActionModal from '../../components/app/ConfirmActionModal'
import type {
  ManuscriptSection, ManuscriptSectionKey, SystematicReviewDetail,
} from '../../types/systematicReview'

interface WriteSlrStepProps {
  reviewId: string
  detail:   SystematicReviewDetail
  onSaved:  () => void
}

const SECTION_ORDER: ManuscriptSectionKey[] = [
  'Abstract', 'Introduction', 'Methods', 'Results', 'Discussion', 'Limitations', 'Conclusion',
]

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function SectionSkeleton() {
  return (
    <div className="space-y-2 py-1 animate-pulse">
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-[92%]" />
      <div className="h-3 bg-slate-100 rounded w-[96%]" />
      <div className="h-3 bg-slate-100 rounded w-[70%]" />
    </div>
  )
}

// ── Manuscript section card ─────────────────────────────────────────────────
// Self-contained like CriterionCard/SearchStringCard: owns its own edit/regenerate state and
// persists directly, rather than lifting per-section state up to the parent step.

function ManuscriptSectionCard({ reviewId, section, onSaved }: {
  reviewId: string
  section:  ManuscriptSection
  onSaved:  () => void
}) {
  const store = useSystematicReviewStore()
  const hasEnoughCredits = useCreditGate()
  const [content, setContent] = useState(section.content)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [pendingRegenerate, setPendingRegenerate] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setContent(section.content) }, [section.content])

  const handleBlur = async () => {
    if (content === section.content) return
    setSaving(true)
    try {
      await store.updateManuscriptSection(reviewId, section.key, content)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewManuscriptGeneration)) {
      setPendingRegenerate(false)
      return
    }
    setError(null)
    setRegenerating(true)
    try {
      await store.regenerateManuscriptSection(reviewId, section.key)
      onSaved()
    } catch {
      setError('Could not regenerate this section. Please try again.')
    } finally {
      setRegenerating(false)
      setPendingRegenerate(false)
    }
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 bg-slate-50/50 border-b border-slate-100">
        <span className="text-[13px] font-bold text-slate-800">{section.title}</span>
        <span className="text-[11px] text-slate-400">{section.wordCount} word{section.wordCount === 1 ? '' : 's'}</span>
        {saving && <span className="text-[10px] font-medium text-slate-400">Saving…</span>}
        <div className="flex-1" />
        <button
          onClick={() => setPendingRegenerate(true)}
          disabled={regenerating}
          className="flex items-center gap-1 text-[11px] font-medium text-violet-500 hover:text-violet-700 transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          Regenerate
        </button>
      </div>
      <div className="px-4 py-3">
        {regenerating ? (
          <SectionSkeleton />
        ) : (
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            onBlur={handleBlur}
            rows={Math.max(4, Math.ceil(content.length / 100))}
            className="w-full resize-y border-0 outline-none text-[13px] text-slate-800 leading-relaxed focus:ring-0 p-0"
          />
        )}
        {error && <p className="text-[11px] text-red-600 mt-2">{error}</p>}
      </div>

      <AnimatePresence>
        {pendingRegenerate && (
          <ConfirmActionModal
            title={`Regenerate ${section.title}?`}
            message="This replaces the current text with a freshly AI-generated draft for this section. Any manual edits will be lost."
            confirmLabel="Regenerate"
            onClose={() => setPendingRegenerate(false)}
            onConfirm={handleRegenerate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Write SLR step ───────────────────────────────────────────────────────────

export default function WriteSlrStep({ reviewId, detail, onSaved }: WriteSlrStepProps) {
  const store = useSystematicReviewStore()
  const hasEnoughCredits = useCreditGate()
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [pendingRegenerateAll, setPendingRegenerateAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const manuscript = detail.manuscript
  const hasManuscript = manuscript !== null && manuscript.sections.length > 0
  const totalWords = manuscript?.sections.reduce((sum, s) => sum + s.wordCount, 0) ?? 0

  const handleGenerate = async () => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewManuscriptGeneration)) {
      setPendingRegenerateAll(false)
      return
    }
    setGenerateError(null)
    setGenerating(true)
    try {
      await store.generateManuscript(reviewId)
      onSaved()
    } catch {
      setGenerateError('Could not generate the manuscript. Please try again.')
    } finally {
      setGenerating(false)
      setPendingRegenerateAll(false)
    }
  }

  const handleExport = async () => {
    setExportError(null)
    setExporting(true)
    try {
      const blob = await store.exportManuscript(reviewId)
      const safeTitle = (detail.researchQuestion || 'systematic-review')
        .slice(0, 60)
        .replace(/[^\w\- ]/g, '')
        .trim()
      downloadBlob(blob, `${safeTitle || 'systematic-review'}.docx`)
    } catch {
      setExportError('Could not export the manuscript. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-4xl px-6 py-6 pb-20">
      <div className="mb-6">
        <h2 className="text-[18px] font-bold text-slate-900 mb-1">Write SLR</h2>
        <p className="text-[13px] text-slate-500">
          Draft a full manuscript — Abstract, Introduction, Methods, Results, Discussion, Limitations, and
          Conclusion — from everything gathered in this review, with citations pulled from your included papers.
        </p>
      </div>

      {!hasManuscript ? (
        <div className="border border-dashed border-slate-300 rounded-xl px-6 py-12 text-center">
          <FileText size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-700 mb-1">No manuscript draft yet</p>
          <p className="text-[12px] text-slate-500 mb-5 max-w-md mx-auto">
            Generate a draft manuscript from this review's eligibility criteria, included papers, extracted data,
            risk of bias, and evidence grading.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[13px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Writing manuscript…' : 'Generate Manuscript'}
          </button>
          {generateError && <p className="text-[12px] text-red-600 mt-3">{generateError}</p>}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-slate-500">
                {totalWords} words · {manuscript!.citations.length} citation{manuscript!.citations.length === 1 ? '' : 's'}
                {manuscript!.generatedAt && ` · Generated ${formatDateTime(manuscript!.generatedAt)}`}
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 text-[12px] font-medium transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Export .docx
            </button>
            <button
              onClick={() => setPendingRegenerateAll(true)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-semibold transition-colors shadow-sm shadow-violet-200 disabled:opacity-70"
            >
              {generating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {generating ? 'Regenerating…' : 'Regenerate manuscript'}
            </button>
          </div>

          {generateError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{generateError}</p>
          )}
          {exportError && (
            <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{exportError}</p>
          )}

          <div className="space-y-4 mb-8">
            {SECTION_ORDER.map(key => {
              const section = manuscript!.sections.find(s => s.key === key)
              if (!section) return null
              return <ManuscriptSectionCard key={key} reviewId={reviewId} section={section} onSaved={onSaved} />
            })}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
              <span className="text-[13px] font-bold text-slate-800">Citations ({manuscript!.citations.length})</span>
            </div>
            <div className="px-4 py-3 space-y-2">
              {manuscript!.citations.length === 0 ? (
                <p className="text-[12px] text-slate-400">
                  No papers have been included via Full Text Screening yet, so there are no citations.
                </p>
              ) : (
                manuscript!.citations.map(c => (
                  <p key={c.paperId} className="text-[12px] text-slate-700 leading-relaxed">
                    <span className="font-semibold text-violet-600">[{c.index}]</span> {c.citationText}
                  </p>
                ))
              )}
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {pendingRegenerateAll && (
          <ConfirmActionModal
            title="Regenerate the entire manuscript?"
            message="This replaces every section with a fresh AI-generated draft and assigns new citation numbers. Any manual edits will be lost."
            confirmLabel="Regenerate all"
            onClose={() => setPendingRegenerateAll(false)}
            onConfirm={handleGenerate}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
