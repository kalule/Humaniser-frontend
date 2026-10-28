import { useEffect, useRef, useState } from 'react'
import { humaniseJobs, type EditingSettings, type HumaniseJobRequest, type HumaniseJobView } from '../../api/humaniseJobs'
import { applicableSuggestions, humaniseBlocks, humaniseOutcomeLabels } from '../../lib/humaniseJobs'
import { useHumaniserStore } from '../../store/humaniserStore'
import { useAuthStore } from '../../store/authStore'

export function ProductionHumaniser() {
  const { inputText, outputText, setInputText, setOutputText } = useHumaniserStore()
  const userId = useAuthStore(s => s.user?.id)
  const storageKey = `humanise-job:${userId ?? 'anonymous'}`
  const [settings, setSettings] = useState<EditingSettings>({ strength: 'light', genre: 'general', voice: 'preserve', englishVariant: 'preserve' })
  const [view, setView] = useState<HumaniseJobView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [undo, setUndo] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const request = useRef<HumaniseJobRequest | null>(null)
  const input = useRef(inputText); input.current = inputText
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    const jobId = sessionStorage.getItem('humanise-review-job') ?? localStorage.getItem(storageKey)
    if (jobId) void humaniseJobs.get(jobId).then(result => {
      if (mounted.current) { setView(result); setSnapshot(null); localStorage.setItem(storageKey, jobId); sessionStorage.removeItem('humanise-review-job') }
    }).catch(() => { localStorage.removeItem(storageKey); sessionStorage.removeItem('humanise-review-job') })
  }, [storageKey])
  useEffect(() => {
    if (!view || view.result) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void humaniseJobs.get(view.jobId, controller.signal).then(setView).catch(e => {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Could not refresh this job. Reload to resume.')
      })
    }, 1200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [view])
  useEffect(() => {
    if (view?.result) setSelected(applicableSuggestions(view.result))
  }, [view?.result])
  const start = async () => {
    setBusy(true); setError(null)
    try {
      const source = input.current
      const blocks = humaniseBlocks(source)
      // Reuse the same key after an ambiguous network failure, but never for changed content/settings.
      const payload = JSON.stringify({ blocks, settings })
      if (!request.current || JSON.stringify({ blocks: request.current.blocks, settings: request.current.settings }) !== payload)
        request.current = { idempotencyKey: crypto.randomUUID(), blocks, settings, format: 'plain_text' }
      const started = await humaniseJobs.start(request.current)
      request.current = null
      setSnapshot(source); setView(started); localStorage.setItem(storageKey, started.jobId)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start rewriting.') }
    finally { setBusy(false) }
  }
  const apply = async () => {
    if (!view?.result) return
    const original = input.current
    setBusy(true); setError(null)
    try {
      const result = await humaniseJobs.apply(view.jobId, view.result.sourceVersion, humaniseBlocks(original), selected)
      // Client documents are local: compare again AFTER the asynchronous subset verifier returns.
      if (input.current !== original || result.outcome === 'version_conflict') { setError('The source changed. Generate suggestions for the current version.'); return }
      if (result.outcome !== 'applied') { setError('The selected changes could not be validated together. Your original is preserved.'); return }
      const text = result.blocks.map(b => b.text).join('')
      setUndo(original); setInputText(text); setOutputText(text)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not apply the selected suggestions.') }
    finally { setBusy(false) }
  }
  const active = !!view && !view.result
  return <main className="max-w-6xl mx-auto p-6 space-y-5">
    <div><h1 className="text-2xl font-semibold">Humaniser</h1><p className="text-sm text-text-sec">Improve clarity and flow while preserving meaning. Review suggestions before applying them.</p></div>
    <div className="flex flex-wrap gap-4">
      {(['strength', 'genre', 'voice', 'englishVariant'] as const).map(key => <label key={key} className="text-sm space-x-2">
        <span>{({ strength: 'Editing', genre: 'Genre', voice: 'Voice', englishVariant: 'English' })[key]}</span>
        <select aria-label={key} value={settings[key]} disabled={busy || active} className="border rounded px-2 py-1" onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}>
          {({ strength: ['light', 'substantial'], genre: ['general', 'academic', 'technical', 'business', 'personal'], voice: ['preserve', 'professional', 'casual', 'warm', 'blunt'], englishVariant: ['preserve', 'en-GB', 'en-US', 'en-ZA'] })[key].map(value => <option key={value}>{value}</option>)}
        </select>
      </label>)}
    </div>
    <label className="block"><span className="font-medium">Your text</span><textarea className="block w-full min-h-60 p-4 border rounded-xl mt-2" value={inputText} onChange={e => setInputText(e.target.value)} /></label>
    <div className="flex gap-3 items-center">
      <button type="button" className="bg-purple-accent text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy || active || !inputText.trim()} onClick={() => void start()}>{busy ? 'Working…' : 'Generate suggestions'}</button>
      {active && <><span role="status">{view.state === 'queued' ? 'Queued' : 'Rewriting and checking meaning'}…</span><button type="button" className="border rounded-lg px-3 py-2" onClick={() => { void humaniseJobs.cancel(view.jobId).then(setView).catch(() => setError('Could not cancel. Retry cancellation.')) }}>Cancel</button></>}
      {undo !== null && <button type="button" className="border rounded-lg px-3 py-2" onClick={() => { setInputText(undo); setOutputText(''); setUndo(null) }}>Undo applied changes</button>}
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {view?.result && <section className="space-y-4" aria-label="Rewrite review">
      <h2 className="font-semibold" role="status">{humaniseOutcomeLabels[view.result.outcome]}</h2>
      {snapshot !== null && snapshot !== inputText && undo === null && <p className="text-amber-800">The source has changed since generation. Apply will check its version.</p>}
      {view.result.warnings.length > 0 && <ul className="text-sm text-amber-800">{view.result.warnings.map((w, i) => <li key={i}>{w.blockId ? `${w.blockId}: ` : ''}{w.code.replaceAll('_', ' ').toLowerCase()}</li>)}</ul>}
      {view.result.blocks.filter(b => b.text !== b.original || !b.accepted).map(b => <article key={b.id} className="border rounded-xl p-4 space-y-2">
        <label className="flex gap-2 font-medium"><input type="checkbox" disabled={!b.accepted || busy || undo !== null} checked={selected.includes(b.id)} onChange={e => setSelected(s => e.target.checked ? [...s, b.id] : s.filter(id => id !== b.id))} />{b.accepted ? 'Use this suggestion' : 'Original kept'}</label>
        <div className="grid md:grid-cols-2 gap-4"><div><p className="text-xs text-text-sec">Original</p><p className="whitespace-pre-wrap">{b.original}</p></div><div><p className="text-xs text-text-sec">{b.accepted ? 'Suggestion' : 'Reason'}</p><p className="whitespace-pre-wrap">{b.accepted ? b.text : b.reasonCode?.replaceAll('_', ' ')}</p></div></div>
      </article>)}
      <div className="flex gap-3">
        <button type="button" className="bg-purple-accent text-white rounded-lg px-4 py-2 disabled:opacity-50" disabled={busy || selected.length === 0 || undo !== null} onClick={() => void apply()}>Apply selected suggestions</button>
        <button type="button" className="border rounded-lg px-3 py-2" disabled={busy} onClick={() => { void humaniseJobs.delete(view.jobId).then(() => { setView(null); request.current = null; localStorage.removeItem(storageKey) }).catch(() => setError('Could not delete this job.')) }}>Delete saved review</button>
      </div>
    </section>}
    {undo !== null && outputText && <section><h2 className="font-medium">Applied text</h2><p className="whitespace-pre-wrap border rounded-xl p-4">{outputText}</p></section>}
  </main>
}
