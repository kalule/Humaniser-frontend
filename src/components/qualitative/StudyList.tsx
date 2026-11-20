import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage, qualApi, type AiMode, type QualAvailability, type QualMethod, type QualStudy } from '../../api/qualitativeAnalysis'
import { LANGUAGES, METHOD_LABELS, METHOD_NOTES, languageLabel } from '../../lib/qualitative'
import { Skeleton } from '../ui/Skeleton'
import { Notice, PrimaryButton, Section, date, inputClass, labelClass } from './ui'

export function StudyList({ features }: { features: QualAvailability }) {
  const [studies, setStudies] = useState<QualStudy[] | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const load = () => { setFailed(null); qualApi.listStudies().then(setStudies).catch(e => setFailed(errorMessage(e, 'Your studies could not be loaded.'))) }
  useEffect(load, [])

  return (
    <>
      <header>
        <p className="max-w-3xl text-[15px] text-slate-800">
          Import interview and focus-group transcripts, replace names and other identifiers, code the data, and keep the quotes you will use word for word.
        </p>
        <p className="mt-2 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">
          You are the analyst. Codes and themes are what you construct from the data. {features.ai ? 'AI suggestions, where you switch them on, are proposals that you accept, change or reject.' : 'Everything here works without AI.'}
        </p>
      </header>

      {failed && <Notice tone="error" className="mt-5">{failed} <button type="button" className="font-semibold underline" onClick={load}>Try again</button></Notice>}

      <Section title="Your studies" id="qa-studies">
        {studies === null && !failed ? <Skeleton lines={3} tone="light" /> : studies && studies.length === 0 ? (
          <p className="text-[14px] text-slate-700">No studies yet. Create one below.</p>
        ) : studies && (
          <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
            {studies.map(s => (
              <li key={s.id}>
                <Link to={`/app/qualitative-analysis/${s.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40">
                  <span className="min-w-0 max-w-full text-[15px] font-semibold text-purple-deep underline [overflow-wrap:anywhere]">{s.title}</span>
                  <span className="text-[13px] text-slate-700">
                    {s.myRole === 'SecondCoder' && <strong className="text-slate-900">You are the second coder · </strong>}{METHOD_LABELS[s.method]} · {s.transcriptsReady} of {s.transcripts} transcript{s.transcripts === 1 ? '' : 's'} ready · {s.participants} participant{s.participants === 1 ? '' : 's'} · deleted after {date(s.deleteAfter)} without activity
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={studies && studies.length > 0 ? 'Start another study' : 'Start a study'} id="qa-new">
        <NewStudyForm features={features} />
      </Section>
    </>
  )
}

function NewStudyForm({ features }: { features: QualAvailability }) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [method, setMethod] = useState<QualMethod>('ReflexiveTA')
  const [language, setLanguage] = useState('en')
  const [aiMode, setAiMode] = useState<AiMode>('ManualOnly')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorField, setErrorField] = useState<'title' | 'consent' | null>(null)

  // A validation error names the field it is about: it is marked invalid and given focus, so a keyboard or screen-reader user lands on it.
  const invalid = (field: 'title' | 'consent', message: string) => {
    setError(message); setErrorField(field)
    requestAnimationFrame(() => document.getElementById(field === 'title' ? 'qa-title' : 'qa-consent')?.focus())
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setErrorField(null)
    if (!title.trim()) { invalid('title', 'Give the study a title.'); return }
    if (!consent) { invalid('consent', 'Confirm the statement about your data before creating the study.'); return }
    setBusy(true)
    try {
      const study = await qualApi.createStudy({ title: title.trim(), method, analysisLanguage: language, aiMode, consentAccepted: true })
      navigate(`/app/qualitative-analysis/${study.id}`)
    } catch (err) { setError(errorMessage(err, 'The study could not be created.')) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 p-4" noValidate>
      <div>
        <label htmlFor="qa-title" className={labelClass}>Title</label>
        <input id="qa-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={inputClass} aria-describedby={errorField === 'title' ? 'qa-title-hint qa-error' : 'qa-title-hint'} aria-invalid={errorField === 'title' || undefined} />
        <p id="qa-title-hint" className="mt-1 text-[12px] text-slate-700">Shown only to you. Do not put a participant’s name or a place that identifies anyone in it.</p>
      </div>
      <div>
        <label htmlFor="qa-method" className={labelClass}>Method</label>
        <select id="qa-method" value={method} onChange={e => setMethod(e.target.value as QualMethod)} className={inputClass} aria-describedby="qa-method-note">
          {features.methods.map(m => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </select>
        <p id="qa-method-note" className="mt-1 text-[12px] text-slate-700">{METHOD_NOTES[method]}</p>
      </div>
      <div>
        <label htmlFor="qa-language" className={labelClass}>Language of analysis</label>
        <select id="qa-language" value={language} onChange={e => setLanguage(e.target.value)} className={inputClass} aria-describedby="qa-language-note">
          {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <p id="qa-language-note" className="mt-1 text-[12px] text-slate-700">
          Passages in another language are marked so you can read them yourself. Nothing is translated. Marking works for English and Afrikaans; for {language === 'en' || language === 'af' ? 'other languages' : languageLabel(language)} no passages are marked.
        </p>
      </div>
      <fieldset>
        <legend className={labelClass}>AI suggestions</legend>
        <div className="space-y-1.5 text-[14px] text-slate-900">
          <label className="flex items-start gap-2"><input type="radio" name="qa-ai" className="mt-1" checked={aiMode === 'ManualOnly'} onChange={() => setAiMode('ManualOnly')} /> <span>Manual coding only. Nothing from this study is ever sent to an AI model.</span></label>
          <label className="flex items-start gap-2"><input type="radio" name="qa-ai" className="mt-1" checked={aiMode === 'AiAssisted'} onChange={() => setAiMode('AiAssisted')} />
            <span>Allow AI code suggestions. When you ask for them, participants’ turns are sent to an AI model after names you listed are replaced. {!features.ai && <em>Not available yet on this account; the setting is kept for later.</em>}</span></label>
        </div>
        <p className="mt-1 text-[12px] text-slate-700">You can change this later in the study’s settings.</p>
      </fieldset>
      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-900">
        <input id="qa-consent" type="checkbox" className="mt-0.5" checked={consent} onChange={e => setConsent(e.target.checked)}
          aria-describedby={errorField === 'consent' ? 'qa-error' : undefined} aria-invalid={errorField === 'consent' || undefined} />
        <span>
          I may store and analyse this data here under my ethics approval and my participants’ consent. Transcripts are kept encrypted and deleted after {features.retentionDays} days without activity, or when I delete them.
          Replacing names reduces risk; it does not make a transcript anonymous.
        </span>
      </label>
      {error && <div id="qa-error"><Notice tone="error">{error}</Notice></div>}
      <PrimaryButton type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create study'}</PrimaryButton>
    </form>
  )
}
