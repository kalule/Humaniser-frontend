import { useEffect, useState, type FormEvent } from 'react'
import { errorMessage, qualApi, type QualAvailability, type QualCode, type QualEvidence, type QualStudy, type QualTheme, type QualThemeList } from '../../api/qualitativeAnalysis'
import { ThemeProposals } from './ThemeProposals'
import { Skeleton } from '../ui/Skeleton'
import { useConfirm } from '../ui/ConfirmDialog'
import { DangerButton, Notice, Pill, PrimaryButton, SecondaryButton, Section, inputClass, labelClass } from './ui'

/**
 * Themes: the researcher groups codes into themes and chooses quotes for them. Counts come from the coding; they
 * say how much of it sits under a theme, not how important the theme is.
 */
export function ThemesTab({ study, features }: { study: QualStudy; features: QualAvailability }) {
  const [list, setList] = useState<QualThemeList | null>(null)
  const [codes, setCodes] = useState<QualCode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const load = () => {
    qualApi.listThemes(study.id).then(setList).catch(e => setError(errorMessage(e, 'The themes could not be loaded.')))
    qualApi.listCodes(study.id).then(c => setCodes(c.filter(x => x.status !== 'Merged'))).catch(() => setCodes([]))
  }
  useEffect(load, [study.id])

  return (
    <>
      <Section title="Themes" id="qa-themes">
        {list && <p className="mb-2 text-[13px] text-slate-800">{list.note}</p>}
        {error && <Notice tone="error" className="mb-2">{error}</Notice>}
        {list === null ? <Skeleton lines={4} tone="light" /> : list.themes.length === 0 ? <p className="text-[14px] text-slate-700">No themes yet. Add one below, then choose the codes that belong to it.</p> : (
          <ul className="space-y-2">
            {list.themes.map(t => (
              <li key={t.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <button type="button" className="min-w-0 text-left text-[16px] font-semibold text-purple-deep underline [overflow-wrap:anywhere]" aria-expanded={openId === t.id} onClick={() => setOpenId(openId === t.id ? null : t.id)}>{t.name}</button>
                  <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-slate-700">
                    <Pill tone={t.status === 'Final' ? 'emerald' : 'slate'}>{t.status === 'Final' ? 'Final' : 'Draft'}</Pill>
                    {t.passages} passage{t.passages === 1 ? '' : 's'} · {t.participants} of {t.participantsInStudy} participants · {t.quotesVerified} quote{t.quotesVerified === 1 ? '' : 's'}
                  </span>
                </div>
                {t.definition && <p className="mt-1 text-[14px] text-slate-800">{t.definition}</p>}
                <p className="mt-1 text-[13px] text-slate-700">Codes: {t.codes.length === 0 ? 'none yet' : t.codes.map(c => c.name).join(', ')}</p>
                {t.quotesNotVerified > 0 && <Notice tone="warning" className="mt-2">{t.quotesNotVerified} quote{t.quotesNotVerified === 1 ? ' no longer matches' : 's no longer match'} the transcript. Select {t.quotesNotVerified === 1 ? 'it' : 'them'} again.</Notice>}
                {openId === t.id && <ThemeDetail study={study} theme={t} codes={codes} onChanged={load} onDeleted={() => { setOpenId(null); load() }} />}
              </li>
            ))}
          </ul>
        )}
        {list && list.codesInNoTheme.length > 0 && (
          <p className="mt-3 text-[13px] text-slate-800"><span className="font-medium">Codes not under any theme:</span> {list.codesInNoTheme.map(c => `${c.name} (${c.applications})`).join(', ')}</p>
        )}
      </Section>
      <Section title="Add a theme" id="qa-add-theme"><NewTheme studyId={study.id} onCreated={load} /></Section>
      {features.ai && study.aiMode === 'AiAssisted' && <ThemeProposals study={study} codes={codes} onDecided={load} />}
    </>
  )
}

function NewTheme({ studyId, onCreated }: { studyId: string; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [definition, setDefinition] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (!name.trim()) { setError('A theme needs a name.'); return }
    setBusy(true)
    try { await qualApi.createTheme(studyId, { name: name.trim(), definition: definition.trim() }); setName(''); setDefinition(''); onCreated() }
    catch (err) { setError(errorMessage(err, 'The theme could not be added.')) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="max-w-2xl space-y-3 rounded-xl border border-slate-200 p-4" noValidate>
      <div><label htmlFor="qa-theme-name" className={labelClass}>Name</label><input id="qa-theme-name" value={name} maxLength={120} onChange={e => setName(e.target.value)} className={inputClass} /></div>
      <div>
        <label htmlFor="qa-theme-def" className={labelClass}>What the theme says (optional)</label>
        <textarea id="qa-theme-def" rows={3} maxLength={4000} value={definition} onChange={e => setDefinition(e.target.value)} className={inputClass} aria-describedby="qa-theme-def-hint" />
        <p id="qa-theme-def-hint" className="mt-1 text-[12px] text-slate-700">A theme is your interpretation: the pattern of meaning you see across the codes, in your own words.</p>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <PrimaryButton type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add theme'}</PrimaryButton>
    </form>
  )
}

function ThemeDetail({ study, theme, codes, onChanged, onDeleted }: { study: QualStudy; theme: QualTheme; codes: QualCode[]; onChanged: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(theme.name)
  const [definition, setDefinition] = useState(theme.definition)
  const [selected, setSelected] = useState<Set<string>>(new Set(theme.codes.map(c => c.id)))
  const [quotes, setQuotes] = useState<QualEvidence[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { confirm: ask, dialog } = useConfirm()
  useEffect(() => { qualApi.evidenceForTheme(study.id, theme.id).then(l => setQuotes(l.quotes)).catch(() => setQuotes([])) }, [study.id, theme.id, theme.updatedAt])

  const act = async (f: () => Promise<unknown>, after: () => void = onChanged) => {
    setBusy(true); setError(null)
    try { await f(); after() } catch (e) { setError(errorMessage(e)) } finally { setBusy(false) }
  }
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const codesChanged = selected.size !== theme.codes.length || theme.codes.some(c => !selected.has(c.id))

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {dialog}
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label htmlFor={`qa-tn-${theme.id}`} className={labelClass}>Name</label><input id={`qa-tn-${theme.id}`} value={name} maxLength={120} onChange={e => setName(e.target.value)} className={inputClass} /></div>
        <div className="sm:col-span-2"><label htmlFor={`qa-td-${theme.id}`} className={labelClass}>What the theme says</label><textarea id={`qa-td-${theme.id}`} rows={3} maxLength={4000} value={definition} onChange={e => setDefinition(e.target.value)} className={inputClass} /></div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <PrimaryButton disabled={busy || !name.trim()} onClick={() => act(() => qualApi.updateTheme(theme.id, { name: name.trim(), definition }))}>Save</PrimaryButton>
          <SecondaryButton disabled={busy} onClick={() => act(() => qualApi.updateTheme(theme.id, { status: theme.status === 'Final' ? 'Draft' : 'Final' }))}>{theme.status === 'Final' ? 'Mark as draft' : 'Mark as final'}</SecondaryButton>
          <DangerButton disabled={busy} onClick={async () => { if (await ask({ title: `Delete the theme “${theme.name}”?`, message: 'Its codes and quotes are kept.', confirmLabel: 'Delete theme', tone: 'danger' })) await act(() => qualApi.deleteTheme(theme.id), onDeleted) }}>Delete theme</DangerButton>
        </div>
      </div>

      <fieldset>
        <legend className="text-[14px] font-semibold text-slate-900">Codes in this theme</legend>
        {codes.length === 0 ? <p className="text-[13px] text-slate-700">No codes yet.</p> : (
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            {codes.map(c => (
              <label key={c.id} className="flex items-start gap-2 text-[14px] text-slate-900">
                <input type="checkbox" className="mt-1" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                <span>{c.name} <span className="text-[12px] text-slate-700">({c.applications} passage{c.applications === 1 ? '' : 's'}{c.status === 'Retired' ? ', retired' : ''})</span></span>
              </label>
            ))}
          </div>
        )}
        <PrimaryButton className="mt-2" disabled={busy || !codesChanged} onClick={() => act(() => qualApi.setThemeCodes(theme.id, [...selected]))}>Save codes</PrimaryButton>
      </fieldset>

      <div>
        <h4 className="text-[14px] font-semibold text-slate-900">Quotes for this theme</h4>
        <p className="text-[12px] text-slate-700">To add one, select it while coding a transcript and keep it as a quote for this theme.</p>
        {quotes === null ? <Skeleton lines={2} tone="light" /> : quotes.length === 0 ? <p className="mt-1 text-[13px] text-slate-700">None yet.</p> : (
          <ul className="mt-1 space-y-1.5">
            {quotes.map(q => (
              <li key={q.id} className="rounded border border-slate-200 bg-white p-2 text-[13px]">
                {q.state === 'Verified' ? <>“{q.text}” <span className="text-slate-700">— {q.pseudonym}, {q.transcriptLabel}</span></> : <span className="text-amber-950"><strong>Not verified.</strong> {q.problem}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  )
}
