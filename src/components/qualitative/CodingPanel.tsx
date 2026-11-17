import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { errorMessage, qualApi, type ListedClass, type QualApplication, type QualAvailability, type QualCode, type QualEvidence, type QualLanguageCheck, type QualStudy, type QualTheme, type QualTranscript } from '../../api/qualitativeAnalysis'
import { PROVENANCE_LABELS, buildRuns, selectionOffsets, trimSelection, type Mark } from '../../lib/qualitative'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { TranscriptSuggestions } from './SuggestionsTab'
import { DangerButton, Notice, Pill, PrimaryButton, SecondaryButton, inputClass, labelClass } from './ui'

interface Selection { start: number; end: number }

/**
 * The coding screen for one confirmed transcript. Select words in the text (or pick a whole turn) and then apply a
 * code, keep the words as a quote, or replace them as an identifier. A coded passage stores positions only, so the
 * words shown are always the transcript's own.
 */
export function CodingPanel({ study, transcript, features, onTranscriptChange }: { study: QualStudy; transcript: QualTranscript; features: QualAvailability; onTranscriptChange: (t: QualTranscript) => void }) {
  const { confirm: ask, dialog } = useConfirm()
  const text = transcript.text ?? ''
  const segments = useMemo(() => transcript.segments ?? [], [transcript.segments])
  const [codes, setCodes] = useState<QualCode[] | null>(null)
  const [applications, setApplications] = useState<QualApplication[] | null>(null)
  const [quotes, setQuotes] = useState<QualEvidence[]>([])
  const [language, setLanguage] = useState<QualLanguageCheck | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [focusCode, setFocusCode] = useState<string>('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error' | 'warning'; text: string } | null>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const owner = study.myRole === 'Owner'
  const [themes, setThemes] = useState<QualTheme[]>([])
  const [finished, setFinished] = useState<boolean | null>(null)
  const tracksFinished = features.agreement && study.agreementApplies

  const loadCoding = useCallback(() => Promise.all([
    qualApi.listCodes(study.id).then(setCodes),
    qualApi.listApplications(transcript.id).then(setApplications),
    // Quotes, themes and the finished mark: the owner's tools; a second coder only marks their own coding finished.
    owner ? qualApi.evidence(study.id).then(l => setQuotes(l.quotes.filter(q => q.transcriptId === transcript.id))) : Promise.resolve(),
    owner ? qualApi.listThemes(study.id).then(l => setThemes(l.themes)) : Promise.resolve(),
    tracksFinished ? qualApi.completions(study.id).then(cs => setFinished(cs.some(c => c.transcriptId === transcript.id && c.current && (owner ? c.coderLabel === 'Coder A' : true)))) : Promise.resolve(),
  ]).catch(e => setMessage({ tone: 'error', text: errorMessage(e, 'The coding could not be loaded.') })), [study.id, transcript.id, owner, tracksFinished])
  useEffect(() => { void loadCoding() }, [loadCoding])
  useEffect(() => { qualApi.languageCheck(transcript.id).then(setLanguage).catch(() => setLanguage(null)) }, [transcript.id, transcript.version])

  const active = useMemo(() => (codes ?? []).filter(c => c.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)), [codes])
  const codeName = useMemo(() => new Map((codes ?? []).map(c => [c.id, c.name])), [codes])
  const segmentById = useMemo(() => new Map(segments.map(s => [s.id, s])), [segments])

  const marks = useMemo<Mark[]>(() => [
    ...(applications ?? []).filter(a => !focusCode || a.codeId === focusCode).map(a => ({ start: a.start, end: a.end, kind: 'code' as const })),
    ...(language?.flagged ?? []).flatMap(f => f.spans.map(s => ({ ...s, kind: 'language' as const }))),
    ...quotes.filter(q => q.state === 'Verified').map(q => ({ start: q.start, end: q.end, kind: 'evidence' as const })),
    ...(selection ? [{ ...selection, kind: 'selected' as const }] : []),
  ], [applications, focusCode, language, quotes, selection])
  const runs = useMemo(() => buildRuns(text.length, segments, marks), [text.length, segments, marks])

  const capture = () => {
    if (!textRef.current) return
    const raw = selectionOffsets(textRef.current)
    const s = raw && trimSelection(text, raw)
    if (s) { setSelection(s); setMessage(null) }
  }

  const selectedText = selection ? text.slice(selection.start, selection.end) : ''
  const report = (tone: 'success' | 'error' | 'warning', t: string) => setMessage({ tone, text: t })

  // ---- actions on the selection ----
  // `name` is passed for a code created a moment ago, which the name map (built from the previous render) does not hold yet.
  const apply = async (codeId: string, name?: string) => {
    if (!selection) return
    try {
      const made = await qualApi.applyCode(transcript.id, { codeId, ...selection })
      await loadCoding()
      report('success', `Coded with “${name ?? codeName.get(codeId) ?? 'the code'}”${made.length > 1 ? ` in ${made.length} turns` : ''}.`)
      setSelection(null); window.getSelection()?.removeAllRanges()
    } catch (e) { report('error', errorMessage(e, 'The code could not be applied.')) }
  }
  const createAndApply = async (name: string) => {
    try { const code = await qualApi.createCode(study.id, { name }); setCodes(c => [...(c ?? []), code]); await apply(code.id, code.name) }
    catch (e) { report('error', errorMessage(e, 'The code could not be created.')) }
  }
  const keepQuote = async (codeId: string | null, themeId: string | null) => {
    if (!selection) return
    try {
      await qualApi.addEvidence(transcript.id, { codeId, themeId, ...selection })
      await loadCoding()
      report('success', 'Kept as a verified quote.')
      setSelection(null); window.getSelection()?.removeAllRanges()
    } catch (e) { report('error', errorMessage(e, 'The quote could not be kept.')) }
  }
  const redact = async (cls: ListedClass) => {
    if (!selection) return
    if (!(await ask({ title: `Replace “${selectedText}” with a ${cls.toLowerCase()} token?`, message: 'Every other place it appears in this transcript is replaced too. Coded passages move with the text.', confirmLabel: 'Replace', tone: 'warning' }))) return
    try {
      const r = await qualApi.redact(transcript.id, { ...selection, class: cls, expectedContentHash: transcript.contentHash })
      onTranscriptChange(r.transcript)
      setSelection(null)
      await loadCoding()
      const extra = [r.applicationsNeedingReview > 0 ? `${r.applicationsNeedingReview} coded passage${r.applicationsNeedingReview === 1 ? '' : 's'} changed and are marked for a second look` : '',
        r.evidenceQuotesNotVerified > 0 ? `${r.evidenceQuotesNotVerified} quote${r.evidenceQuotesNotVerified === 1 ? ' is' : 's are'} no longer verified and must be selected again` : ''].filter(Boolean)
      report(extra.length ? 'warning' : 'success', `Replaced ${r.occurrences} time${r.occurrences === 1 ? '' : 's'} with ${r.token}.${extra.length ? ' ' + extra.join('; ') + '.' : ''}`)
    } catch (e) { report('error', errorMessage(e, 'The text could not be replaced.')) }
  }
  const removeApplication = async (a: QualApplication) => {
    try { await qualApi.removeApplication(a.id); await loadCoding() } catch (e) { report('error', errorMessage(e, 'The coded passage could not be removed.')) }
  }

  const participantTurns = segments.filter(s => s.role === 'Participant')
  const appsBySegment = useMemo(() => {
    const m = new Map<string, QualApplication[]>()
    for (const a of applications ?? []) m.set(a.segmentId, [...(m.get(a.segmentId) ?? []), a])
    return [...m.entries()].map(([id, list]) => ({ segment: segmentById.get(id), list: list.sort((x, y) => x.start - y.start) })).filter(x => x.segment).sort((a, b) => a.segment!.ordinal - b.segment!.ordinal)
  }, [applications, segmentById])

  if (codes === null || applications === null) return <div className="mt-4"><Skeleton lines={10} tone="light" /></div>

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {dialog}
      <div className="min-w-0">
        <p className="mb-2 text-[13px] text-slate-800">
          Select words with the mouse, or choose a whole turn on the right. {transcript.wordCount.toLocaleString()} words, {transcript.participantWordCount.toLocaleString()} from participants. Version {transcript.version}.
        </p>
        <Legend language={language} />
        <div ref={textRef} onMouseUp={capture} onKeyUp={capture} aria-label="Transcript text" role="document"
          className="max-h-[75vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-[15px] leading-7 text-slate-900">
          {runs.map(r => (
            <span key={r.start} data-offset={r.start}
              className={cn(r.segmentId === null && 'font-semibold text-slate-600', r.codes === 1 && 'bg-purple-100', r.codes > 1 && 'bg-purple-200',
                r.language && 'underline decoration-amber-600 decoration-dotted decoration-2 underline-offset-4', r.evidence && 'border-b-2 border-emerald-600', r.selected && 'bg-yellow-200')}>
              {text.slice(r.start, r.end)}
            </span>
          ))}
        </div>
        {owner && features.ai && study.aiMode === 'AiAssisted' && <TranscriptSuggestions study={study} transcript={transcript} codes={active} onDecided={loadCoding} />}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Coding tools">
        <div className="rounded-xl border border-slate-200 p-3">
          <label htmlFor="qa-turn" className={labelClass}>Select a whole turn</label>
          <select id="qa-turn" value="" className={inputClass} onChange={e => { const s = segmentById.get(e.target.value); if (s) { setSelection({ start: s.start, end: s.end }); setMessage(null) } }}>
            <option value="">Choose a participant turn…</option>
            {participantTurns.map(s => <option key={s.id} value={s.id}>Turn {s.ordinal + 1} · {s.pseudonym ?? 'Participant'}: {text.slice(s.start, Math.min(s.end, s.start + 50))}…</option>)}
          </select>
          <SelectionTools owner={owner} selection={selection} selectedText={selectedText} codes={active} themes={themes} onApply={apply} onCreate={createAndApply} onQuote={keepQuote} onRedact={redact} onClear={() => { setSelection(null); window.getSelection()?.removeAllRanges() }} />
        </div>
        {tracksFinished && finished !== null && (
          <div className="rounded-xl border border-slate-200 p-3 text-[13px] text-slate-800">
            <p>{finished ? 'You have marked your coding of this transcript finished. Changing it takes the mark back.' : 'When you have coded this whole transcript, mark it finished so the two coders’ work can be compared.'}</p>
            <SecondaryButton className="mt-2" onClick={async () => { try { if (finished) await qualApi.reopen(transcript.id); else await qualApi.markFinished(transcript.id); await loadCoding() } catch (e) { report('error', errorMessage(e)) } }}>
              {finished ? 'Reopen my coding' : 'Mark my coding finished'}
            </SecondaryButton>
          </div>
        )}
        {message && <Notice tone={message.tone} >{message.text}</Notice>}

        <div className="rounded-xl border border-slate-200 p-3">
          <label htmlFor="qa-focus" className={labelClass}>Show coding for</label>
          <select id="qa-focus" value={focusCode} onChange={e => setFocusCode(e.target.value)} className={inputClass}>
            <option value="">All codes</option>
            {active.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <h3 className="mt-3 text-[14px] font-semibold text-slate-900">Coded passages in this transcript ({applications.length})</h3>
          {appsBySegment.length === 0 ? <p className="mt-1 text-[13px] text-slate-700">Nothing coded yet.</p> : (
            <ul className="mt-1 max-h-[40vh] space-y-2 overflow-y-auto">
              {appsBySegment.map(({ segment, list }) => (
                <li key={segment!.id} className="text-[13px]">
                  <p className="font-medium text-slate-800">Turn {segment!.ordinal + 1} · {segment!.pseudonym ?? segment!.role}</p>
                  <ul className="mt-0.5 space-y-1">
                    {list.filter(a => !focusCode || a.codeId === focusCode).map(a => (
                      <li key={a.id} className="flex items-start justify-between gap-2 rounded border border-slate-200 p-1.5">
                        <span className="min-w-0">
                          <span className="font-semibold text-purple-deep">{codeName.get(a.codeId) ?? 'Code'}</span>{' '}
                          <span className="text-slate-700">“{text.slice(a.start, Math.min(a.end, a.start + 80))}{a.end - a.start > 80 ? '…' : ''}”</span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {a.provenance !== 'Human' && <Pill tone="purple">{PROVENANCE_LABELS[a.provenance] ?? a.provenance}</Pill>}
                            {a.needsReview && <Pill tone="amber">Check: text changed</Pill>}
                            {segment!.role !== 'Participant' && <Pill>Not participant speech</Pill>}
                          </span>
                        </span>
                        <button type="button" className="shrink-0 text-[12px] font-medium text-red-800 underline" onClick={() => removeApplication(a)} aria-label={`Remove ${codeName.get(a.codeId) ?? 'code'} from turn ${segment!.ordinal + 1}`}>Remove</button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        {quotes.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-3 text-[13px]">
            <h3 className="text-[14px] font-semibold text-slate-900">Quotes kept from this transcript ({quotes.length})</h3>
            <ul className="mt-1 space-y-1">
              {quotes.map(q => (
                <li key={q.id} className="rounded border border-slate-200 p-1.5">
                  {q.state === 'Verified' ? <>“{q.text}” <span className="text-slate-700">— {q.pseudonym}</span></> : <span className="text-amber-950"><strong>Not verified.</strong> {q.problem}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  )
}

function Legend({ language }: { language: QualLanguageCheck | null }) {
  return (
    <div className="mb-2 space-y-2">
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-800">
        <span><span className="bg-purple-100 px-1">shaded</span> coded (darker: more than one code)</span>
        <span><span className="border-b-2 border-emerald-600">underlined</span> kept as a quote</span>
        <span><span className="underline decoration-amber-600 decoration-dotted decoration-2 underline-offset-4">dotted</span> probably not in the language of analysis</span>
        <span><span className="bg-yellow-200 px-1">yellow</span> your selection</span>
      </p>
      {language && (language.status === 'NotSupported' || language.flagged.length > 0) && (
        <Notice tone={language.status === 'NotSupported' ? 'info' : 'warning'}>
          {language.status === 'Checked' && <strong>{language.flagged.length} turn{language.flagged.length === 1 ? '' : 's'} marked. </strong>}{language.note}
        </Notice>
      )}
    </div>
  )
}

function SelectionTools({ owner, selection, selectedText, codes, themes, onApply, onCreate, onQuote, onRedact, onClear }: {
  owner: boolean; selection: Selection | null; selectedText: string; codes: QualCode[]; themes: QualTheme[]
  onApply: (codeId: string) => void; onCreate: (name: string) => void; onQuote: (codeId: string | null, themeId: string | null) => void; onRedact: (cls: ListedClass) => void; onClear: () => void
}) {
  const [codeId, setCodeId] = useState('')
  const [themeId, setThemeId] = useState('')
  const [newName, setNewName] = useState('')
  const [cls, setCls] = useState<ListedClass>('PERSON')
  const [busy, setBusy] = useState(false)
  const run = async (f: () => unknown) => { setBusy(true); try { await f() } finally { setBusy(false) } }
  const submitNew = (e: FormEvent) => { e.preventDefault(); if (newName.trim()) void run(async () => { await onCreate(newName.trim()); setNewName('') }) }

  if (!selection) return <p className="mt-3 text-[13px] text-slate-700">Nothing selected.</p>
  return (
    <div className="mt-3 space-y-3" aria-live="polite">
      <div className="rounded-lg bg-yellow-50 p-2 text-[13px] text-slate-900">
        <span className="font-semibold">Selected ({selectedText.length} characters):</span> “{selectedText.length > 160 ? selectedText.slice(0, 160) + '…' : selectedText}”
        <button type="button" className="ml-2 text-[12px] underline" onClick={onClear}>Clear</button>
      </div>
      <div>
        <label htmlFor="qa-apply-code" className={labelClass}>Apply a code</label>
        <div className="flex gap-2">
          <select id="qa-apply-code" value={codeId} onChange={e => setCodeId(e.target.value)} className={inputClass}>
            <option value="">Choose a code…</option>
            {codes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <PrimaryButton disabled={!codeId || busy} onClick={() => run(() => onApply(codeId))}>Apply</PrimaryButton>
        </div>
      </div>
      {owner && <form onSubmit={submitNew}>
        <label htmlFor="qa-new-code" className={labelClass}>Or a new code</label>
        <div className="flex gap-2">
          <input id="qa-new-code" value={newName} maxLength={80} onChange={e => setNewName(e.target.value)} className={inputClass} placeholder="Name" />
          <SecondaryButton type="submit" disabled={!newName.trim() || busy}>Create and apply</SecondaryButton>
        </div>
      </form>}
      {owner && <div className="space-y-2">
        {themes.length > 0 && (
          <div>
            <label htmlFor="qa-quote-theme" className={labelClass}>Quote for a theme (optional)</label>
            <select id="qa-quote-theme" value={themeId} onChange={e => setThemeId(e.target.value)} className={inputClass}>
              <option value="">No theme</option>
              {themes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <SecondaryButton disabled={busy} onClick={() => run(() => onQuote(codeId || null, themeId || null))}>Keep as a quote{themeId ? ' for this theme' : codeId ? ' for this code' : ''}</SecondaryButton>
      </div>}
      {owner && <details className="rounded-lg border border-slate-200 p-2 text-[13px]">
        <summary className="cursor-pointer font-medium text-slate-900">Replace as an identifier</summary>
        <p className="mt-1 text-slate-800">For a name or place you missed. Every occurrence in this transcript is replaced.</p>
        <div className="mt-2 flex gap-2">
          <label htmlFor="qa-redact-class" className="sr-only">Kind of identifier</label>
          <select id="qa-redact-class" value={cls} onChange={e => setCls(e.target.value as ListedClass)} className={inputClass}>
            <option value="PERSON">Person</option><option value="ORG">Organisation</option><option value="PLACE">Place</option><option value="ROLE">Role</option><option value="OTHER">Other</option>
          </select>
          <DangerButton disabled={busy} onClick={() => run(() => onRedact(cls))}>Replace</DangerButton>
        </div>
      </details>}
    </div>
  )
}
