import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import type { AcademicLevel, CitationStyle } from '../../types/research'
import { researchApi, type ProposalIdeaCheckResult } from '../../api/research'
import { proposalError } from '../../lib/proposalJourney'
import { canCheckIdea, CLAIM_LABELS, ideaHeadline, MIN_IDEA_LENGTH, QUALITY_LABELS, scoreWord } from '../../lib/proposalIdeaCheck'
import { cn } from '../../lib/utils'

export type ProposalStartMode = 'manual' | 'automated'
export interface ProposalSetup { topic: string; academicLevel: AcademicLevel; citationStyle: CitationStyle }

export const START_MODES: { value: ProposalStartMode; title: string; hint: string; action: string; recommended?: boolean }[] = [
  { value: 'manual', title: 'Guided', hint: 'Write step by step with AI help, and edit every section yourself.', action: 'Start writing', recommended: true },
  { value: 'automated', title: 'Automated', hint: 'We write a complete first draft with cited sources. You review and edit it afterwards.', action: 'Generate proposal' },
]

const LEVELS: { value: AcademicLevel; label: string }[] = [
  { value: 'UNDERGRADUATE', label: 'Undergraduate' },
  { value: 'MASTERS', label: 'Masters' },
  { value: 'PHD', label: 'PhD' },
]

const STYLES: { value: CitationStyle; label: string }[] = [
  { value: 'harvard', label: 'Harvard' },
  { value: 'apa7', label: 'APA 7' },
  { value: 'mla', label: 'MLA' },
  { value: 'ieee', label: 'IEEE' },
]

/** Pause after the last keystroke before the idea check starts by itself. */
export const AUTO_CHECK_DELAY_MS = 1500

const field = 'w-full bg-neutral-100 border-0 rounded-lg px-3.5 py-2.5 text-[#1a1a18] text-sm outline-none focus-visible:!outline-none focus:ring-2 focus:ring-[#7c3aed]/40 disabled:opacity-50'

export function ProposalSetupDialog({ onClose, onCreate, onAutomate }: {
  onClose: () => void
  onCreate: (setup: ProposalSetup) => Promise<void>
  onAutomate: (setup: { topic: string; academicLevel: AcademicLevel }) => void
}) {
  const [topic, setTopic] = useState(''), [level, setLevel] = useState<AcademicLevel>('MASTERS'), [style, setStyle] = useState<CitationStyle>('harvard')
  const [mode, setMode] = useState<ProposalStartMode>('manual')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [editingStyle, setEditingStyle] = useState(false)
  const locked = useRef(false)
  const topicRef = useRef<HTMLTextAreaElement>(null)

  // Idea check: advice only. It never blocks or delays Start. A change to the topic or level cancels a running check
  // and hides an old result, so the card always describes the text on screen. 'failed' is a quiet line, never a toast.
  const [ideaCheck, setIdeaCheck] = useState<{ status: 'idle' | 'checking' | 'failed' } | { status: 'done'; result: ProposalIdeaCheckResult }>({ status: 'idle' })
  const ideaAbort = useRef<AbortController | null>(null)
  useEffect(() => () => ideaAbort.current?.abort(), [])
  const resetIdeaCheck = () => { ideaAbort.current?.abort(); ideaAbort.current = null; setIdeaCheck({ status: 'idle' }) }
  const changeTopic = (value: string) => { setTopic(value); resetIdeaCheck() }
  const changeLevel = (value: AcademicLevel) => { setLevel(value); resetIdeaCheck() }
  // Results are kept per level + text, so going back to an earlier wording (or re-typing it) costs nothing.
  const ideaCache = useRef(new Map<string, ProposalIdeaCheckResult>())
  const checkIdea = async () => {
    if (!canCheckIdea(topic)) return
    const key = `${level}|${topic.trim()}`
    const cached = ideaCache.current.get(key)
    if (cached) { setIdeaCheck({ status: 'done', result: cached }); return }
    ideaAbort.current?.abort()
    const controller = new AbortController()
    ideaAbort.current = controller
    setIdeaCheck({ status: 'checking' })
    try {
      const result = await researchApi.checkProposalIdea(topic.trim(), level, controller.signal)
      if (controller.signal.aborted) return
      const usable = result?.available && ideaHeadline(result)
      if (usable) ideaCache.current.set(key, result)
      setIdeaCheck(usable ? { status: 'done', result } : { status: 'failed' })
    } catch {
      if (!controller.signal.aborted) setIdeaCheck({ status: 'failed' })
    } finally {
      if (ideaAbort.current === controller) ideaAbort.current = null
    }
  }
  // The check runs by itself once the student pauses typing; the link stays for an immediate check. It only starts from
  // 'idle', so a failure is not retried in a loop: the next edit (which resets to idle) tries again.
  const checkRef = useRef(checkIdea)
  checkRef.current = checkIdea
  useEffect(() => {
    if (busy || ideaCheck.status !== 'idle' || !canCheckIdea(topic)) return
    const timer = setTimeout(() => void checkRef.current(), AUTO_CHECK_DELAY_MS)
    return () => clearTimeout(timer)
  }, [topic, level, busy, ideaCheck.status])
  const applyRewrite = (rewrite: string) => { changeTopic(rewrite); topicRef.current?.focus() }
  const submit = async () => {
    if (locked.current || !topic.trim()) return
    // The automated flow collects the remaining details itself, so hand over without creating anything here.
    if (mode === 'automated') { onAutomate({ topic: topic.trim(), academicLevel: level }); return }
    locked.current = true; setBusy(true); setError('')
    try { await onCreate({ topic: topic.trim(), academicLevel: level, citationStyle: style }) }
    catch (e) { setError(proposalError(e)) }
    finally { locked.current = false; setBusy(false) }
  }
  const action = START_MODES.find(m => m.value === mode)!.action
  const hasTopic = topic.trim().length > 0
  const styleLabel = STYLES.find(s => s.value === style)?.label ?? style
  return <Modal isOpen title="Start your proposal" onClose={() => { if (!busy) onClose() }} panelClassName="research-design rounded-xl max-w-xl" bodyClassName="flex flex-col">
    <form onSubmit={e => { e.preventDefault(); void submit() }} className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <label htmlFor="proposal-topic" className="block text-[13px] font-medium text-[#1a1a18] mb-2">Research topic or idea</label>
          <textarea
            ref={topicRef}
            id="proposal-topic"
            autoFocus
            required
            rows={3}
            maxLength={500}
            value={topic}
            disabled={busy}
            onChange={e => changeTopic(e.target.value)}
            // The topic was a one-line input where Enter submitted; keep that. Shift+Enter adds a line break.
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit() } }}
            placeholder="e.g. 'The effect of load-shedding on small retailers in Gauteng'"
            className={cn(field, 'resize-none')}
          />
          <div className="mt-1.5 flex items-center gap-2 text-[12px]">
            <button
              type="button"
              onClick={() => void checkIdea()}
              disabled={busy || ideaCheck.status === 'checking' || !canCheckIdea(topic)}
              title={canCheckIdea(topic) ? 'Get an assessment of scope, wording, feasibility and design, plus a search plan. Optional.' : `Write at least ${MIN_IDEA_LENGTH} characters to check your idea`}
              className="!min-h-0 rounded font-medium text-[#7c3aed] hover:underline disabled:text-neutral-400 disabled:no-underline disabled:cursor-not-allowed"
            >
              Check my idea
            </button>
            <span className="text-neutral-400">{canCheckIdea(topic) ? 'Runs when you stop typing' : `Starts after ${MIN_IDEA_LENGTH} characters`}</span>
          </div>
          <div aria-live="polite">
            {ideaCheck.status === 'checking' && (
              <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#7c3aed]"><Loader2 size={12} className="animate-spin" aria-hidden="true" />Checking your idea…</p>
            )}
            {ideaCheck.status === 'failed' && (
              <p className="mt-2 text-[12px] text-neutral-500">We could not check your idea just now. You can still start.</p>
            )}
            {ideaCheck.status === 'done' && <IdeaCheckCard result={ideaCheck.result} disabled={busy} onUseRewrite={applyRewrite} />}
          </div>
        </div>

        <fieldset disabled={busy}>
          <legend className="block text-[13px] font-medium text-[#1a1a18] mb-2">Academic level</legend>
          <div className="inline-flex rounded-xl bg-neutral-100 p-1 gap-1">
            {LEVELS.map(l => (
              <label key={l.value} className={cn(
                'cursor-pointer rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#7c3aed]/40',
                level === l.value ? 'bg-white text-[#7c3aed] shadow-sm' : 'text-neutral-600 hover:text-[#1a1a18]',
              )}>
                <input type="radio" name="proposal-level" value={l.value} className="sr-only" checked={level === l.value} onChange={() => changeLevel(l.value)} />
                {l.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-2" disabled={busy}>
          <legend className="block text-[13px] font-medium text-[#1a1a18] mb-2">How would you like to write it?</legend>
          {START_MODES.map(m => (
            <label key={m.value} className={cn('flex gap-3 rounded-xl border p-3 cursor-pointer transition-colors', mode === m.value ? 'border-[#7c3aed] bg-[#7c3aed]/5' : 'border-neutral-200 hover:border-neutral-300')}>
              <input type="radio" name="proposal-start" className="mt-1 accent-[#7c3aed]" checked={mode === m.value} onChange={() => setMode(m.value)} />
              <span>
                <span className="flex items-center gap-2 text-sm font-medium text-[#1a1a18]">
                  {m.title}
                  {m.recommended && <span className="rounded-full bg-[#7c3aed]/10 px-2 py-0.5 text-[11px] font-medium text-[#7c3aed]">Recommended</span>}
                </span>
                <span className="block text-xs text-neutral-500 mt-0.5">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {/* Citation style only applies to Guided: the automated flow asks for its own settings. */}
        {mode === 'manual' && (editingStyle
          ? <div>
              <label htmlFor="proposal-style" className="block text-[13px] font-medium text-[#1a1a18] mb-2">Citation style</label>
              <select id="proposal-style" className={field} disabled={busy} value={style} onChange={e => setStyle(e.target.value as CitationStyle)}>
                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          : <p className="text-[13px] text-neutral-500">
              Citation style: <span className="text-[#1a1a18] font-medium">{styleLabel}</span>
              {' · '}
              <button type="button" disabled={busy} onClick={() => setEditingStyle(true)} className="!min-h-0 text-[#7c3aed] hover:underline disabled:opacity-50" aria-label={`Change citation style (currently ${styleLabel})`}>change</button>
            </p>)}

        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="shrink-0 flex justify-end gap-2 border-t border-neutral-100 px-6 py-4">
        <button type="button" disabled={busy} onClick={onClose} className="!min-h-0 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 text-[13px] font-medium transition-colors disabled:opacity-50">Cancel</button>
        {/* Disabled buttons swallow hover in some browsers, so the hint also sits on a wrapper. */}
        <span title={hasTopic ? undefined : 'Enter a research idea to continue'}>
          <button
            type="submit"
            disabled={busy || !hasTopic}
            aria-busy={busy}
            title={hasTopic ? undefined : 'Enter a research idea to continue'}
            className={cn(
              '!min-h-0 inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#4c1d95] text-white text-[13px] font-medium transition-colors disabled:cursor-not-allowed',
              busy ? 'disabled:cursor-wait disabled:hover:bg-[#7c3aed]' : 'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {busy ? 'Starting…' : action}
          </button>
        </span>
      </div>
    </form>
  </Modal>
}

function IdeaCheckCard({ result, disabled, onUseRewrite }: {
  result: ProposalIdeaCheckResult
  disabled: boolean
  onUseRewrite: (rewrite: string) => void
}) {
  const headline = ideaHeadline(result)
  if (!headline) return null
  const Icon = result.verdict === 'proceed' ? CheckCircle2 : result.verdict === 'rework' ? AlertTriangle : Info
  const iconColour = result.verdict === 'proceed' ? 'text-emerald-600' : result.verdict === 'rework' ? 'text-amber-600' : 'text-[#7c3aed]'
  const { parsed, design, feasibility, searchPlan } = result
  return <section aria-label="Idea check" className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-[13px] text-[#1a1a18]">
    <p className="flex items-start gap-1.5 font-medium">
      <Icon size={15} className={cn('mt-0.5 shrink-0', iconColour)} aria-hidden="true" />
      {headline}
    </p>

    {result.topFixes.length > 0 && <>
      <p className="mt-2 text-[12px] font-medium text-neutral-600">Top fixes</p>
      <ol className="mt-1 ml-5 list-decimal space-y-0.5 text-[12px] text-neutral-700">
        {result.topFixes.map(f => <li key={f}>{f}</li>)}
      </ol>
    </>}

    {result.titleRewrite && <>
      <p className="mt-2.5 text-[12px] text-neutral-500">Suggested title (you can edit it after):</p>
      <button type="button" disabled={disabled} onClick={() => onUseRewrite(result.titleRewrite!)}
        className="!min-h-0 mt-1.5 w-full text-left rounded-lg bg-white border border-neutral-200 hover:border-[#7c3aed]/50 hover:bg-[#7c3aed]/5 focus-visible:border-[#7c3aed] px-2.5 py-2 text-[12px] leading-snug transition-colors disabled:opacity-50">
        {result.titleRewrite}
      </button>
    </>}

    {design && (
      <p className="mt-2.5 text-[12px] text-neutral-700">
        <span className="font-medium">Suggested design:</span> {design.approach}{' '}
        <span className="text-neutral-500">It {CLAIM_LABELS[design.claimType] ?? design.claimType}, but cannot show {lowerFirst(design.cannotClaim)}</span>
      </p>
    )}

    <details className="mt-2.5 group">
      <summary className="cursor-pointer text-[12px] font-medium text-[#7c3aed] hover:underline">See the full assessment</summary>
      <div className="mt-2 space-y-3 text-[12px] text-neutral-700">
        {result.quality.length > 0 && <Part title="Quality">
          <dl className="grid grid-cols-[auto_auto_1fr] gap-x-2 gap-y-1">
            {result.quality.map(q => <div key={q.key} className="contents">
              <dt className="font-medium">{QUALITY_LABELS[q.key] ?? q.key}</dt>
              <dd className="text-neutral-500 whitespace-nowrap">{scoreWord(q.score)} ({q.score}/2)</dd>
              <dd>{q.reason}</dd>
            </div>)}
          </dl>
        </Part>}

        {parsed && <Part title="How we read your topic">
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {([['Exposure', parsed.exposure], ['Outcome', parsed.outcome], ['Population', parsed.population], ['Region', parsed.region], ['Setting', parsed.setting]] as const)
              .map(([k, v]) => <div key={k} className="contents"><dt className="font-medium">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {result.assumptions.length > 0 && <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-neutral-500">
            {result.assumptions.map(a => <li key={a}>{a}</li>)}
          </ul>}
        </Part>}

        {result.constructs.length > 0 && <Part title="Key terms">
          <ul className="space-y-1">
            {result.constructs.map(c => <li key={c.name}>
              <span className="font-medium">{c.name}</span>: {c.definition}
              <span className="block text-neutral-500">Also: {c.synonyms.join(', ')}</span>
            </li>)}
          </ul>
        </Part>}

        {feasibility && <Part title="Feasibility">
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <dt className="font-medium">Sampling frame</dt><dd>{feasibility.samplingFrame}</dd>
            <dt className="font-medium">Access</dt><dd>{feasibility.access}</dd>
            <dt className="font-medium">Sample size</dt><dd>{feasibility.sampleSize}</dd>
            <dt className="font-medium">Ethics</dt><dd>{feasibility.ethics} <span className="text-neutral-500">({feasibility.ethicsComplexity} complexity)</span></dd>
          </dl>
        </Part>}

        {searchPlan && <Part title="Search plan">
          <ol className="space-y-1.5">
            {searchPlan.tiers.map(t => <li key={t.tier}>
              <span className="font-medium">Tier {t.tier}: {t.purpose}</span>
              <code className="mt-0.5 block whitespace-pre-wrap break-words rounded bg-white border border-neutral-200 px-2 py-1 text-[11px]">{t.query}</code>
            </li>)}
          </ol>
          <p className="mt-1.5"><span className="font-medium">Include:</span> {searchPlan.include.join('; ')}</p>
          <p><span className="font-medium">Exclude:</span> {searchPlan.exclude.join('; ')}</p>
        </Part>}
      </div>
    </details>
  </section>
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="mb-1 font-medium text-[#1a1a18]">{title}</p>{children}</div>
}

const lowerFirst = (s: string) => s.length > 1 && s[1] !== s[1].toUpperCase() ? s[0].toLowerCase() + s.slice(1) : s
