import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { researchApi } from '../../api/research'
import { ComingSoon } from '../../components/app/ToolGate'
import { Skeleton } from '../../components/ui/Skeleton'
import { MatrixWorkspace } from '../../components/literatureMatrix/MatrixWorkspace'
import { ErrorAlert, buttonClass } from '../../components/literatureMatrix/parts'
import {
  failureMessage, isFeatureOff, isNotFound, MAX_NAME_CHARS, MAX_QUESTION_CHARS, validateName,
  type Matrix, type MatrixPreset, type MatrixSummary,
} from '../../lib/literatureMatrix'
import { formatShortDate } from '../../lib/utils'

type Load<T> = { state: 'loading' } | { state: 'ready'; value: T } | { state: 'off' } | { state: 'missing' } | { state: 'error'; message: string }

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="h-full overflow-y-auto bg-white"><div className="px-4 py-6 sm:px-6 sm:py-8"><div className="mx-auto max-w-4xl">{children}</div></div></div>
}

/**
 * Literature Matrix: a comparison table of studies, each value tied to a passage of its source.
 * `/app/literature-matrix` lists matrices and creates one; `/app/literature-matrix/:id` is one matrix.
 */
export default function LiteratureMatrixPage() {
  const { id } = useParams<{ id: string }>()
  return id ? <MatrixRoute key={id} id={id} /> : <ListRoute />
}

function ListRoute() {
  const navigate = useNavigate()
  const [list, setList] = useState<Load<{ matrices: MatrixSummary[]; presets: MatrixPreset[] }>>({ state: 'loading' })

  const load = useCallback(() => {
    setList({ state: 'loading' })
    Promise.all([literatureMatrixApi.list(), literatureMatrixApi.presets()])
      .then(([matrices, presets]) => setList({ state: 'ready', value: { matrices, presets } }))
      .catch(e => setList(isFeatureOff(e) ? { state: 'off' } : { state: 'error', message: failureMessage(e, 'load') }))
  }, [])
  useEffect(load, [load])

  if (list.state === 'loading') return <Frame><Skeleton lines={6} tone="light" /></Frame>
  if (list.state === 'off') return <ComingSoon tool="literature-matrix" />
  if (list.state !== 'ready') return <Frame><ErrorAlert message={list.state === 'error' ? list.message : 'This could not be loaded.'} onRetry={load} /></Frame>

  const { matrices, presets } = list.value
  return (
    <Frame>
      <p className="max-w-3xl text-[15px] text-slate-800">
        Put the studies you are reading side by side: aim, method, sample, findings and limitations, each linked to the passage it came from.
      </p>
      <p className="mt-2 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">
        A matrix is your own comparison of the studies you chose. It is not a systematic review; for that, use <Link to="/app/systematic-review" className="font-medium text-purple-deep underline">Systematic Review</Link>.
      </p>

      {matrices.length > 0 ? (
        <section aria-labelledby="lm-list-title" className="mt-6">
          <h2 id="lm-list-title" className="text-[16px] font-semibold text-slate-900">Your matrices</h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {matrices.map(m => (
              <li key={m.id}>
                <Link to={`/app/literature-matrix/${m.id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-3 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-accent/40">
                  <span className="min-w-0 max-w-full text-[15px] font-semibold text-purple-deep underline [overflow-wrap:anywhere]">{m.name}</span>
                  <span className="text-[13px] text-slate-700">
                    {m.studyCount} {m.studyCount === 1 ? 'study' : 'studies'}{m.researchProjectTitle ? ` · ${m.researchProjectTitle}` : ''} · last used {formatShortDate(m.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="lm-new-title" className="mt-7">
        <h2 id="lm-new-title" className="mb-3 text-[16px] font-semibold text-slate-900">{matrices.length > 0 ? 'Create another matrix' : 'Create a matrix'}</h2>
        <NewMatrixForm presets={presets} onCreated={m => navigate(`/app/literature-matrix/${m.id}`)} />
      </section>
    </Frame>
  )
}

function NewMatrixForm({ presets, onCreated }: { presets: MatrixPreset[]; onCreated: (m: Matrix) => void }) {
  const [name, setName] = useState('')
  const [question, setQuestion] = useState('')
  const [preset, setPreset] = useState('general')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; title: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)

  // Linking a project is optional; if the list cannot be loaded the matrix can still be created.
  useEffect(() => { researchApi.list().then(p => setProjects(p.map(x => ({ id: x.id, title: x.title || 'Untitled project' })))).catch(() => setProjects([])) }, [])

  const nameError = submitted ? validateName(name) : null
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (validateName(name)) { document.getElementById('lm-name')?.focus(); return }
    setBusy(true)
    setError(null)
    try {
      onCreated(await literatureMatrixApi.create({ name: name.trim(), researchQuestion: question.trim() || undefined, preset, researchProjectId: projectId || null }))
    } catch (err) {
      setError(failureMessage(err, 'create'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div>
        <label htmlFor="lm-name" className="block text-[14px] font-medium text-slate-900">Name</label>
        <input id="lm-name" value={name} maxLength={MAX_NAME_CHARS + 20} onChange={e => setName(e.target.value)} aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? 'lm-name-error' : undefined}
          placeholder="For example: Chapter 2, digital learning adoption" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
        {nameError ? <p id="lm-name-error" role="alert" className="mt-1 text-[13px] text-red-700">{nameError}</p> : null}
      </div>
      <div>
        <label htmlFor="lm-question" className="block text-[14px] font-medium text-slate-900">Research question <span className="font-normal text-slate-600">(optional)</span></label>
        <textarea id="lm-question" value={question} maxLength={MAX_QUESTION_CHARS} rows={2} onChange={e => setQuestion(e.target.value)} aria-describedby="lm-question-help"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]" />
        <p id="lm-question-help" className="mt-1 text-[12px] text-slate-600">Used only for the Relevance column. Without it, that column stays empty.</p>
      </div>
      <fieldset>
        <legend className="text-[14px] font-medium text-slate-900">Kind of studies</legend>
        <p className="text-[12px] text-slate-600">Sets the starting columns. You can hide them or add your own later.</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {presets.map(p => (
            <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-[13px] has-[:checked]:border-purple-accent has-[:checked]:bg-purple-tint/40">
              <input type="radio" name="lm-preset" value={p.key} checked={preset === p.key} onChange={() => setPreset(p.key)} className="mt-0.5" />
              <span><span className="font-semibold text-slate-900">{p.label}</span><span className="block text-slate-700">{p.description}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {projects.length > 0 ? (
        <div>
          <label htmlFor="lm-project" className="block text-[14px] font-medium text-slate-900">Project <span className="font-normal text-slate-600">(optional)</span></label>
          <select id="lm-project" value={projectId} onChange={e => setProjectId(e.target.value)} className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-[14px]">
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      ) : null}
      {error ? <ErrorAlert message={error} /> : null}
      <button type="submit" disabled={busy} className={buttonClass.primary}>{busy ? 'Creating…' : 'Create matrix'}</button>
    </form>
  )
}

function MatrixRoute({ id }: { id: string }) {
  const navigate = useNavigate()
  const [matrix, setMatrix] = useState<Load<Matrix>>({ state: 'loading' })
  const load = useCallback(() => {
    setMatrix({ state: 'loading' })
    literatureMatrixApi.get(id)
      .then(value => setMatrix({ state: 'ready', value }))
      .catch(e => setMatrix(isFeatureOff(e) && !(e as { message?: string }).message ? { state: 'off' }
        : isNotFound(e) ? { state: 'missing' } : { state: 'error', message: failureMessage(e, 'load') }))
  }, [id])
  useEffect(load, [load])

  if (matrix.state === 'loading') return <Frame><Skeleton lines={8} tone="light" /></Frame>
  if (matrix.state === 'off') return <ComingSoon tool="literature-matrix" />
  if (matrix.state === 'missing') {
    return (
      <Frame>
        <div role="alert" className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-[14px] text-slate-900">
          This matrix does not exist, or it was deleted. <Link to="/app/literature-matrix" className="font-semibold text-purple-deep underline">See your matrices</Link>
        </div>
      </Frame>
    )
  }
  if (matrix.state === 'error') return <Frame><ErrorAlert message={matrix.message} onRetry={load} /></Frame>

  return <MatrixWorkspace matrix={matrix.value} onMatrixChange={value => setMatrix({ state: 'ready', value })} onDeleted={() => navigate('/app/literature-matrix', { replace: true })} />
}
