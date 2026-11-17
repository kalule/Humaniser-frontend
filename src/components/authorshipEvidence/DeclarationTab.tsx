import { useEffect, useState } from 'react'
import { authorshipEvidenceApi } from '../../api/authorshipEvidence'
import {
  CATEGORIES, categoryLabel, failureMessage, formatDateTime, plural,
  type Declaration, type DeclarationCategory, type DeclarationDraft, type DeclarationTemplate, type EvidenceDocument,
} from '../../lib/authorshipEvidence'
import { ErrorNote, Note, field, labelText, linkButton, primaryButton, secondaryButton } from './ui'

const STEPS = ['Review what is recorded', 'Choose a category', 'Explain', 'Review and edit', 'Approve'] as const

/**
 * The declaration builder. The draft is built from what the register holds; the student chooses the category,
 * edits the wording and must tick that it is accurate. Nothing here says an institution will accept the result.
 */
export function DeclarationTab({ doc, wordingCredits, onReload, onOpenRegister }: {
  doc: EvidenceDocument
  wordingCredits: number
  onReload: () => Promise<void>
  onOpenRegister: () => void
}) {
  const saved = doc.declaration
  const [step, setStep] = useState(saved ? 3 : 0)
  const [suggestion, setSuggestion] = useState<DeclarationDraft | null>(null)
  const [category, setCategory] = useState<DeclarationCategory | null>(saved?.category ?? null)
  const [templates, setTemplates] = useState<DeclarationTemplate[]>([])
  const [templateKey, setTemplateKey] = useState<string>(saved?.templateKey ?? '')
  const [explanation, setExplanation] = useState('')
  const [draft, setDraft] = useState<DeclarationDraft | null>(null)
  const [text, setText] = useState(saved?.text ?? '')
  const [origin, setOrigin] = useState(saved?.draftOrigin ?? 'Template')
  const [declaration, setDeclaration] = useState<Declaration | null>(saved)
  const [accurate, setAccurate] = useState(saved?.confirmed ?? false)
  const [busy, setBusy] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const current = doc.register.filter(e => !e.corrected)

  // What the records support, and the wordings available. Both are free and make no model call.
  useEffect(() => {
    let live = true
    authorshipEvidenceApi.draftDeclaration(doc.documentId, {}).then(d => {
      if (!live) return
      setSuggestion(d)
      // A category is pre-selected only when the recorded uses support one.
      setCategory(c => c ?? d.suggestedCategory)
    }).catch(() => { /* the suggestion is a convenience; the student can still choose */ })
    authorshipEvidenceApi.templates().then(t => { if (live) setTemplates(t) }).catch(() => {})
    return () => { live = false }
  }, [doc.documentId, doc.register.length])

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key)
    setFailure(null)
    try { await work() } catch (err) { setFailure(failureMessage(err, 'save')) } finally { setBusy(null) }
  }

  const buildDraft = (useAiWording: boolean) => run(useAiWording ? 'ai' : 'draft', async () => {
    if (!category) return
    const d = await authorshipEvidenceApi.draftDeclaration(doc.documentId, { category, templateKey: templateKey || null, explanation: explanation.trim() || null, useAiWording })
    setDraft(d)
    setText(d.text)
    setOrigin(d.draftOrigin)
    setAccurate(false)
    setStep(3)
  })

  const save = () => run('save', async () => {
    if (!category) return
    const d = await authorshipEvidenceApi.saveDeclaration(doc.documentId, { category, text, templateKey: templateKey || null, draftOrigin: draft && text === draft.text ? origin : 'Student' })
    setDeclaration(d)
    setAccurate(d.confirmed)
    setStep(4)
    await onReload()
  })

  // The box ticks at once and is put back if the server does not accept it, so a click is never left looking ignored.
  const confirm = (value: boolean) => {
    setAccurate(value)
    return run('confirm', async () => {
      try {
        const d = await authorshipEvidenceApi.confirmDeclaration(doc.documentId, value)
        setDeclaration(d)
        setAccurate(d.confirmed)
      } catch (err) {
        setAccurate(!value)
        throw err
      }
      await onReload()
    })
  }

  const saveTemplate = () => run('template', async () => {
    const t = await authorshipEvidenceApi.saveTemplate({ name: templateName.trim(), category, body: text })
    setTemplates(list => [...list, t])
    setTemplateKey(t.key)
    setTemplateName('')
    setSavingTemplate(false)
  })

  const unsaved = declaration ? text.trim() !== declaration.text || category !== declaration.category : text.trim().length > 0
  const edited = draft !== null && text !== draft.text
  const textProblem = text.trim().length < 20 ? 'The declaration must be at least 20 characters.' : null
  const warnings = declaration && !unsaved ? declaration.warnings : draft?.warnings ?? []

  return (
    <div className="space-y-5">
      <ol aria-label="Steps" className="flex flex-wrap gap-x-1 gap-y-2 text-[13px]">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button type="button" onClick={() => setStep(i)} aria-current={step === i ? 'step' : undefined}
              disabled={(i >= 2 && !category) || (i === 4 && !declaration)}
              className={`rounded-full border px-3 py-1 outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40 disabled:cursor-not-allowed disabled:opacity-50 ${step === i ? 'border-purple-accent bg-purple-accent font-semibold text-white' : 'border-slate-300 bg-white text-slate-900'}`}>
              {i + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      {failure ? <ErrorNote>{failure}</ErrorNote> : null}

      {step === 0 ? (
        <section aria-labelledby="ae-dec-0" className="space-y-3">
          <h3 id="ae-dec-0" className="text-[15px] font-semibold text-slate-900">What is recorded about AI use in this document</h3>
          {current.length === 0 ? (
            <Note>No AI tool use is recorded for this document. That does not show that none was used. If you used a tool, here or anywhere else, add it to the register so your declaration can describe it.</Note>
          ) : (
            <ul className="list-disc space-y-1 pl-5 text-[14px] text-slate-900">
              {(suggestion?.statements.filter(s => s.evidenceIds.length > 0) ?? []).map(s => <li key={s.text}>{s.text}</li>)}
              {!suggestion ? <li>{plural(current.length, 'AI tool use')} in the register.</li> : null}
            </ul>
          )}
          <p className="text-[13px] text-slate-700">Check this against what you remember. <button type="button" onClick={onOpenRegister} className={linkButton}>Open the register</button> to add a tool you used elsewhere or to correct an entry.</p>
          <button type="button" onClick={() => setStep(1)} className={primaryButton}>This is complete: continue</button>
        </section>
      ) : null}

      {step === 1 ? (
        <fieldset className="space-y-3">
          <legend className="text-[15px] font-semibold text-slate-900">Which category describes your use of AI in this document?</legend>
          {suggestion ? <Note>{suggestion.suggestionReason}</Note> : null}
          <div className="space-y-2">
            {CATEGORIES.map(c => (
              <label key={c.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 text-[14px] ${category === c.value ? 'border-purple-accent bg-purple-50' : 'border-slate-200 bg-white'}`}>
                <input type="radio" name="ae-category" value={c.value} checked={category === c.value} onChange={() => { setCategory(c.value); setAccurate(false) }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-purple)]" />
                <span>
                  <span className="font-semibold text-slate-900">{c.label}</span>
                  {suggestion?.suggestedCategory === c.value ? <span className="ml-2 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[12px] text-slate-800">Fits what is recorded</span> : null}
                  <span className="block text-[13px] text-slate-700">{c.description}</span>
                </span>
              </label>
            ))}
          </div>
          <button type="button" onClick={() => setStep(2)} disabled={!category} className={primaryButton}>Continue</button>
        </fieldset>
      ) : null}

      {step === 2 ? (
        <section aria-labelledby="ae-dec-2" className="space-y-3">
          <h3 id="ae-dec-2" className="text-[15px] font-semibold text-slate-900">Explain, in your own words</h3>
          <div>
            <label htmlFor="ae-dec-explanation" className={labelText}>Anything you want to add <span className="font-normal text-slate-700">(optional)</span></label>
            <textarea id="ae-dec-explanation" rows={4} maxLength={4000} value={explanation} onChange={e => setExplanation(e.target.value)} className={field}
              placeholder="For example: how you checked what the tool suggested, or which parts of the work it was not used for" />
          </div>
          <div>
            <label htmlFor="ae-dec-template" className={labelText}>Wording to start from</label>
            <select id="ae-dec-template" value={templateKey} onChange={e => setTemplateKey(e.target.value)} className={field}>
              <option value="">Standard wording for "{category ? categoryLabel(category) : ''}"</option>
              {templates.filter(t => !t.builtIn).map(t => <option key={t.key} value={t.key}>{t.name}{t.institution ? ` (${t.institution})` : ''}</option>)}
            </select>
            <p className="mt-1 text-[13px] text-slate-700">If your institution requires a particular form of words, paste it at the next step and save it as your own wording to reuse.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { void buildDraft(false) }} disabled={busy !== null} className={primaryButton}>{busy === 'draft' ? 'Writing the draft…' : 'Write the draft'}</button>
            <span className="text-[13px] text-slate-700">Free. Built from the register; no AI is used to write it.</span>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section aria-labelledby="ae-dec-3" className="space-y-3">
          <h3 id="ae-dec-3" className="text-[15px] font-semibold text-slate-900">Review and edit the declaration</h3>
          <p className="text-[14px] text-slate-800">Category: <span className="font-semibold">{category ? categoryLabel(category) : 'not chosen'}</span>. This is a draft. Change anything that is not true or not complete.</p>
          {draft ? (
            <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-800">
              <summary className="cursor-pointer font-semibold text-slate-900">Where each sentence of the draft came from</summary>
              <ul className="mt-2 space-y-1.5">
                {draft.statements.map(s => (
                  <li key={s.text} className="[overflow-wrap:anywhere]">
                    <span className={`mr-2 inline-block rounded-full border px-2 py-0.5 text-[12px] font-medium ${s.evidenceIds.length > 0 ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>
                      {s.evidenceIds.length > 0 ? `From ${plural(s.evidenceIds.length, 'register entry', 'register entries')}` : 'Your own statement: check it is true'}
                    </span>
                    {s.text}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <div>
            <label htmlFor="ae-dec-text" className={labelText}>Declaration</label>
            <textarea id="ae-dec-text" rows={9} maxLength={20000} value={text} onChange={e => { setText(e.target.value); setAccurate(false) }} className={`${field} leading-relaxed`}
              aria-describedby={textProblem && text.length > 0 ? 'ae-dec-text-error' : undefined} />
            {textProblem && text.length > 0 ? <p id="ae-dec-text-error" role="alert" className="mt-1 text-[13px] font-medium text-red-700">{textProblem}</p> : null}
          </div>
          {warnings.map(w => <p key={w} className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-950">{w}</p>)}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => { void save() }} disabled={busy !== null || !category || textProblem !== null} className={primaryButton}>{busy === 'save' ? 'Saving…' : 'Save and continue'}</button>
            <button type="button" onClick={() => setStep(2)} disabled={busy !== null} className={secondaryButton}>Start the draft again</button>
            {draft ? <button type="button" onClick={() => { void buildDraft(true) }} disabled={busy !== null || edited} aria-describedby="ae-dec-ai-note" className={secondaryButton}>{busy === 'ai' ? 'Rewording…' : `Improve the wording with AI (${wordingCredits} credits)`}</button> : null}
          </div>
          {draft ? (
            <p id="ae-dec-ai-note" className="text-[13px] text-slate-700">
              {edited
                ? 'AI rewording starts from the draft as it was written, so it would replace your edits. Save your edits, or start the draft again to use it.'
                : 'AI rewording changes how the draft reads, not what it says. Any sentence where it changed a fact, a tool, a date or a number keeps its original wording. You are charged only if a reworded draft comes back.'}
            </p>
          ) : null}
          {savingTemplate ? (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="ae-dec-template-name" className={labelText}>Name for this wording</label>
                <input id="ae-dec-template-name" value={templateName} maxLength={120} onChange={e => setTemplateName(e.target.value)} className={field} placeholder="For example: My university's AI statement" />
              </div>
              <button type="button" onClick={() => { void saveTemplate() }} disabled={busy !== null || templateName.trim().length === 0 || textProblem !== null} className={secondaryButton}>{busy === 'template' ? 'Saving…' : 'Save wording'}</button>
              <button type="button" onClick={() => setSavingTemplate(false)} className={secondaryButton}>Cancel</button>
            </div>
          ) : (
            <button type="button" onClick={() => setSavingTemplate(true)} className={linkButton}>Save this wording to reuse for other documents</button>
          )}
        </section>
      ) : null}

      {step === 4 && declaration ? (
        <section aria-labelledby="ae-dec-4" className="space-y-3">
          <h3 id="ae-dec-4" className="text-[15px] font-semibold text-slate-900">Approve the declaration</h3>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <p className="text-[13px] font-semibold text-slate-800">{categoryLabel(declaration.category)}</p>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-900 [overflow-wrap:anywhere]">{declaration.text}</p>
          </div>
          {declaration.warnings.map(w => <p key={w} className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[13px] text-amber-950">{w}</p>)}
          <label className="flex items-start gap-2.5 rounded-lg border border-slate-300 bg-white p-3 text-[14px] text-slate-900">
            <input type="checkbox" checked={accurate} disabled={busy !== null} onChange={e => { void confirm(e.target.checked) }}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-400 accent-[var(--color-purple)]" />
            <span>
              <span className="font-semibold">I have checked this is accurate.</span>
              <span className="block text-[13px] text-slate-700">This is your statement. HumaniseAI helped set it out and has not verified it, and it does not know whether your institution will accept it. Check your institution's own rules.</span>
            </span>
          </label>
          <p className="text-[13px] text-slate-700" aria-live="polite">
            {declaration.confirmed && declaration.accuracyConfirmedAt
              ? `Confirmed on ${formatDateTime(declaration.accuracyConfirmedAt)}. You can now create a report. Editing the declaration withdraws the confirmation.`
              : 'A report cannot be created or exported until this box is ticked.'}
          </p>
          <button type="button" onClick={() => setStep(3)} className={secondaryButton}>Edit the declaration</button>
        </section>
      ) : null}
    </div>
  )
}
