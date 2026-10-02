import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, AlertTriangle, HelpCircle, Info, ShieldCheck, Upload, Clipboard, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { citationIntegrityApi } from '../../api/citationIntegrity'
import type { CitationFinding, CitationFindingSeverity } from '../../types/citationIntegrity'
import { useDragDrop } from '../../hooks/useDragDrop'
import { DropOverlay } from '../../components/ui/DropOverlay'
import { PanelLabel } from '../../components/ui/PanelLabel'
import { UtilityButton } from '../../components/ui/UtilityButton'
import { ClearButton } from '../../components/ui/ClearButton'
import { Skeleton } from '../../components/ui/Skeleton'
import { ResultsPanelHeader } from '../../components/ui/ResultsPanelHeader'
import { PanelFooterBar } from '../../components/ui/PanelFooterBar'
import { ToolBottomActionRow } from '../../components/ui/ToolBottomActionRow'
import { ToolWorkspaceCard } from '../../components/shared/ToolWorkspaceCard'
import { cn, primaryButtonClass } from '../../lib/utils'

// This tool audits citation-to-claim fit — it deliberately never rewrites the pasted text, unlike
// every other tool on this shell. That's the whole point: a mismatched citation should be
// surfaced for the author to fix, not silently corrected by an LLM rewrite.

const SEVERITY_STYLE: Record<CitationFindingSeverity, { icon: React.ReactNode; badge: string; label: string }> = {
  Critical: { icon: <AlertCircle size={12} />, badge: 'bg-red-50 border-red-200 text-red-600', label: 'Critical' },
  Warning: { icon: <AlertTriangle size={12} />, badge: 'bg-amber-50 border-amber-200 text-amber-600', label: 'Warning' },
  Info: { icon: <Info size={12} />, badge: 'bg-blue-50 border-blue-200 text-blue-600', label: 'Info' },
  RequiresVerification: { icon: <HelpCircle size={12} />, badge: 'bg-neutral-100 border-neutral-300 text-neutral-500', label: 'Needs verification' },
}

function FindingCard({ finding }: { finding: CitationFinding }) {
  const style = SEVERITY_STYLE[finding.severity] ?? SEVERITY_STYLE.Info
  return (
    <div className="rounded-xl border border-[#e0e0da] bg-white p-3.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-800 truncate">{finding.citation}</span>
        <span className={cn('shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', style.badge)}>
          {style.icon} {style.label}
        </span>
      </div>
      <p className="text-[12px] text-gray-500"><span className="font-medium text-gray-600">Claim: </span>{finding.claimSupported}</p>
      <p className="text-[12px] text-gray-700">{finding.issue}</p>
      <p className="text-[12px] text-purple-text bg-purple-tint/50 rounded-lg px-2.5 py-1.5">{finding.recommendedAction}</p>
    </div>
  )
}

export default function CitationIntegrityPage() {
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [findings, setFindings] = useState<CitationFinding[] | null>(null)
  const [citationCount, setCitationCount] = useState(0)

  const { isDragging, isProcessing: isFileProcessing, dragHandlers, openFilePicker, fileInputElement } = useDragDrop({
    onText: (t) => setInputText(t),
    disabled: isLoading,
  })

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInputText(text)
      toast.success('Pasted from clipboard!')
    } catch {
      toast.error('Clipboard access denied')
    }
  }, [])

  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length
  const canAudit = wordCount >= 20 && !isLoading

  const handleAudit = async () => {
    if (!canAudit) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await citationIntegrityApi.audit(inputText)
      setFindings(res.findings)
      setCitationCount(res.citationCount)
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Failed to audit citations. Please try again.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const reset = () => { setInputText(''); setFindings(null); setError(null); setCitationCount(0) }

  const leftPanel = {
    header: (
      <div className="flex items-center px-4 py-2.5 border-b border-[#e0e0da] shrink-0">
        <PanelLabel label="Your text" />
      </div>
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col relative" {...dragHandlers}>
        {fileInputElement}
        <DropOverlay isDragging={isDragging} isProcessing={isFileProcessing} />
        <div className="relative flex-1 min-h-0">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            className="textarea-body absolute inset-0 w-full h-full bg-white text-gray-800 resize-none outline-none focus:ring-2 focus:ring-inset focus:ring-purple-accent/30 rounded-lg px-4 py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          />
          {!inputText && (
            <div className="textarea-body pointer-events-none absolute inset-0 px-4 py-4 text-gray-300 select-none">
              Paste an essay, chapter, or draft with in-text citations. Minimum 20 words.
            </div>
          )}
        </div>
      </div>
    ),
    footer: (
      <>
        <PanelFooterBar
          metadata={<span className="text-xs font-normal tabular-nums text-gray-400">{wordCount} words</span>}
          actions={
            <>
              <UtilityButton icon={<Clipboard size={14} />} label="Paste" className="h-8 px-3 text-[13px]" onClick={handlePasteFromClipboard} disabled={isLoading} />
              <UtilityButton icon={<Upload size={14} />} label="Upload" className="h-8 px-3 text-[13px]" onClick={openFilePicker} disabled={isLoading || isFileProcessing} />
            </>
          }
        />
        <ToolBottomActionRow
          clearButton={<ClearButton onClick={reset} disabled={!(inputText || findings)} />}
          hint={wordCount === 0
            ? 'Minimum 20 words'
            : wordCount < 20
            ? `Minimum 20 words required (${20 - wordCount} more needed).`
            : undefined}
          primaryButton={
            <button type="button" onClick={handleAudit} disabled={!canAudit} className={primaryButtonClass(canAudit)}>
              {isLoading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                    <Wand2 size={14} />
                  </motion.div>
                  Auditing…
                </>
              ) : (
                findings ? 'Re-audit citations' : 'Audit citations'
              )}
            </button>
          }
        />
      </>
    ),
  }

  const rightPanel = {
    header: (
      <ResultsPanelHeader
        title={<PanelLabel label="Findings" count={findings?.length} />}
      />
    ),
    footer: findings && (
      <PanelFooterBar
        metadata={<span className="text-[11px] text-gray-400">{citationCount} citation{citationCount === 1 ? '' : 's'} found</span>}
      />
    ),
    body: (
      <div className="flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {!findings && !isLoading && !error ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 min-h-0 overflow-y-auto py-4 flex flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center">
                <ShieldCheck size={16} className="text-indigo-500 opacity-70" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-gray-600">Citation findings will appear here</p>
                <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">
                  Checks whether each citation actually fits the claim it's attached to. This tool never rewrites your text — it only reports issues for you to fix.
                </p>
              </div>
            </motion.div>
          ) : isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 px-5 py-4">
              <Skeleton variant="text" tone="light" lines={6} />
            </motion.div>
          ) : !findings && error ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
                <AlertCircle size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-gray-600">Couldn't audit your text</p>
                <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">{error}</p>
              </div>
              <button type="button" onClick={handleAudit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-purple-accent hover:bg-purple-deep text-white transition-colors">
                <Wand2 size={12} /> Retry
              </button>
            </motion.div>
          ) : findings && findings.length === 0 ? (
            <motion.div key="clean" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center justify-center h-full gap-3 text-center px-8">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <ShieldCheck size={16} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-gray-600">No citation issues found</p>
                <p className="text-[12px] text-gray-400 mt-1 max-w-[240px] leading-relaxed">
                  {citationCount} citation{citationCount === 1 ? '' : 's'} checked — every one appears to fit the claim it supports.
                </p>
              </div>
            </motion.div>
          ) : findings ? (
            <motion.div key="output" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {findings.map((f, i) => <FindingCard key={i} finding={f} />)}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    ),
  }

  return (
    <div className="min-h-0 bg-transparent px-4 py-6 w-full">
      <ToolWorkspaceCard
        className="lg:sticky lg:top-4"
        style={{ height: 'calc(100vh - 7rem)' }}
        leftPanel={leftPanel}
        rightPanel={rightPanel}
      />
    </div>
  )
}
