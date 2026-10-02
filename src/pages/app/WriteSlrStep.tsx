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
import type { ApiError } from '../../types'

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

interface ManuscriptIssue {
  type:    string
  section: string
  detail:  string
}

/// A 409 from the export gate carries the individual issues. Anything else is a genuine failure and
/// must not be dressed up as a consistency problem.
///
/// client.ts's response interceptor normalizes EVERY structured API error — this one included —
/// into a flat ApiError (`{ code, message, details }`) and rejects with THAT object directly, not
/// the original axios error (see client.ts's "Surface structured ApiError" block:
/// `body?.error` -> `Promise.reject(normalized)`). This is the same shape FACT_CONFLICT /
/// UNRESOLVED_CITATION_GAP handling already reads elsewhere in this codebase (e.g.
/// LiteratureReviewPage.tsx's `(err as ApiError)?.code`) — there is no `.response` on the object a
/// catch block here actually receives. Two earlier versions of this function looked for
/// `err.response.data.data.issues`, then `err.response.status`/`err.response.data.error.details` —
/// both wrong for the same reason, and both silently returned null, so every consistency-blocked
/// export fell through to the generic "could not export" message instead of ever showing the real
/// issues or the "Export anyway" action. No Blob handling is needed here either — the interceptor
/// already converts a JSON-typed Blob error body to a parsed object before this ever runs.
function extractConsistencyIssues(err: unknown): ManuscriptIssue[] | null {
  const apiError = err as Partial<ApiError> | undefined
  if (apiError?.code !== 'MANUSCRIPT_CONSISTENCY_BLOCKED') return null
  return (apiError.details as { issues?: ManuscriptIssue[] } | undefined)?.issues ?? null
}

/** One unmet precondition from the pre-generation readiness gate. */
type ManuscriptBlocker = { type: string; detail: string }

/// The 409 from the readiness gate, which fires BEFORE any section is generated (and before credits
/// are spent) when screening has not finished. Same normalized-ApiError shape as above.
function extractReadinessBlockers(err: unknown): ManuscriptBlocker[] | null {
  const apiError = err as Partial<ApiError> | undefined
  if (apiError?.code !== 'MANUSCRIPT_NOT_READY') return null
  return (apiError.details as { blockers?: ManuscriptBlocker[] } | undefined)?.blockers ?? null
}

export default function WriteSlrStep({ reviewId, detail, onSaved }: WriteSlrStepProps) {
  const store = useSystematicReviewStore()
  const hasEnoughCredits = useCreditGate()
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [pendingRegenerateAll, setPendingRegenerateAll] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [consistencyIssues, setConsistencyIssues] = useState<ManuscriptIssue[] | null>(null)
  const [readinessBlockers, setReadinessBlockers] = useState<ManuscriptBlocker[] | null>(null)

  const manuscript = detail.manuscript
  const hasManuscript = manuscript !== null && manuscript.sections.length > 0
  const totalWords = manuscript?.sections.reduce((sum, s) => sum + s.wordCount, 0) ?? 0

  // Generation is gated on the review actually being ready to write up — records still unscreened,
  // or flagged for manual review and never adjudicated, mean the included set is provisional and
  // every finding drawn from it is too. The gate runs before any model call, so a blocked attempt
  // costs nothing. As with export, the blockers are shown and the reviewer can proceed anyway; the
  // manuscript is then required to disclose the incompleteness in its Abstract, Methods and Results.
  const handleGenerate = async (acknowledgeIncomplete = false) => {
    if (!hasEnoughCredits(CREDIT_COSTS.systematicReviewManuscriptGeneration)) {
      setPendingRegenerateAll(false)
      return
    }
    setGenerateError(null)
    setReadinessBlockers(null)
    setGenerating(true)
    try {
      await store.generateManuscript(reviewId, acknowledgeIncomplete)
      onSaved()
    } catch (err) {
      const blockers = extractReadinessBlockers(err)
      if (blockers) setReadinessBlockers(blockers)
      else setGenerateError('Could not generate the manuscript. Please try again.')
    } finally {
      setGenerating(false)
      setPendingRegenerateAll(false)
    }
  }

  // Export is gated on the manuscript reconciling with the review's own data (an unreconcilable
  // PRISMA flow, or an intervention named in the prose that appears nowhere in the extracted data).
  // The issues are shown rather than a bare failure, and export can proceed on a second, explicit
  // request — a gate with no route through is one people work around instead of fixing.
  const handleExport = async (acknowledgeConflicts = false) => {
    setExportError(null)
    setConsistencyIssues(null)
    setExporting(true)
    try {
      const blob = await store.exportManuscript(reviewId, acknowledgeConflicts)
      const safeTitle = (detail.researchQuestion || 'systematic-review')
        .slice(0, 60)
        .replace(/[^\w\- ]/g, '')
        .trim()
      downloadBlob(blob, `${safeTitle || 'systematic-review'}.docx`)
    } catch (err) {
      const issues = extractConsistencyIssues(err)
      if (issues) setConsistencyIssues(issues)
      else setExportError('Could not export the manuscript. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  // Defined once and rendered in both the empty state and the generated-manuscript view — the gate
  // fires on first generation, when the empty state is what the reviewer is looking at.
  const readinessPanel = readinessBlockers && readinessBlockers.length > 0 ? (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 mb-4 text-left">
      <p className="text-[12px] font-semibold text-amber-900 mb-1.5">
        This review isn&apos;t ready to write up yet
      </p>
      <ul className="space-y-1 mb-2.5">
        {readinessBlockers.map((blocker, i) => (
          <li key={i} className="text-[11.5px] leading-relaxed text-amber-900">{blocker.detail}</li>
        ))}
      </ul>
      <p className="text-[11px] text-amber-800 mb-2.5">
        Finish screening first — a manuscript written now would draw its conclusions from a partly
        examined corpus. If you write it up anyway, it must state that in its Abstract, Methods and
        Results.
      </p>
      <button
        onClick={() => handleGenerate(true)}
        disabled={generating}
        className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-[11.5px] font-semibold transition-colors disabled:opacity-60"
      >
        Write it up anyway
      </button>
    </div>
  ) : null

  return (
    <div className="max-w-4xl px-6 py-6 pb-20">
      <div className="mb-6">
        <h2 className="text-[18px] font-bold text-slate-900 mb-1">Write SLR</h2>
        <p className="text-[13px] text-slate-500">
          Draft a full manuscript — Abstract, Introduction, Methods, Results, Discussion, Limitations, and
          Conclusion — from everything gathered in this review, with citations pulled from your included papers.
        </p>
      </div>

      {/* Rendered in BOTH branches: the readiness gate fires hardest on the very first generation,
          when there is no manuscript yet and the empty state is what's on screen. */}
      {!hasManuscript && readinessPanel}

      {!hasManuscript ? (
        <div className="border border-dashed border-slate-300 rounded-xl px-6 py-12 text-center">
          <FileText size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-[14px] font-semibold text-slate-700 mb-1">No manuscript draft yet</p>
          <p className="text-[12px] text-slate-500 mb-5 max-w-md mx-auto">
            Generate a draft manuscript from this review's eligibility criteria, included papers, extracted data,
            risk of bias, and evidence grading.
          </p>
          <button
            onClick={() => handleGenerate()}
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
            {/* Wrapped, not passed directly: onClick hands the handler a MouseEvent, which as a
                truthy first argument would arrive as acknowledgeConflicts and silently bypass the
                consistency gate on the very first click. */}
            <button
              onClick={() => handleExport(false)}
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

          {readinessPanel}

          {consistencyIssues && consistencyIssues.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 mb-4">
              <p className="text-[12px] font-semibold text-amber-900 mb-1.5">
                This manuscript doesn&apos;t reconcile with the review&apos;s own data
              </p>
              {/* The specific discrepancies, not a count — each names a section and something the
                  reviewer can go and check against the review's data. */}
              <ul className="space-y-1 mb-2.5">
                {consistencyIssues.map((issue, i) => (
                  <li key={i} className="text-[11.5px] leading-relaxed text-amber-900">
                    <span className="font-semibold">{issue.section}</span> — {issue.detail}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-800 mb-2.5">
                Regenerate the affected sections to fix these, or export anyway if you have checked them
                and accept them as they are.
              </p>
              <button
                onClick={() => handleExport(true)}
                disabled={exporting}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-[11.5px] font-semibold transition-colors disabled:opacity-60"
              >
                Export anyway
              </button>
            </div>
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
            onConfirm={() => handleGenerate()}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
