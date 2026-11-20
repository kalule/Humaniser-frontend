import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { researchApi } from '../../api/research'
import { studyDesignApi, type StudyDesignAvailability } from '../../api/studyDesign'
import { ConsistencyTab } from '../../components/studyDesign/ConsistencyTab'
import { DesignTab } from '../../components/studyDesign/DesignTab'
import { EthicsTab } from '../../components/studyDesign/EthicsTab'
import { InstrumentTab } from '../../components/studyDesign/InstrumentTab'
import { SampleSizeTab } from '../../components/studyDesign/SampleSizeTab'
import { ComingSoon } from '../../components/app/ToolGate'
import { Skeleton } from '../../components/ui/Skeleton'
import { projectOptionLabels } from '../../lib/studyDesign'
import { cn } from '../../lib/utils'

type TabId = 'design' | 'sample-size' | 'instrument' | 'export' | 'ethics' | 'consistency'
const TAB_LIST: { id: TabId; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'sample-size', label: 'Sample size' },
  { id: 'instrument', label: 'Instrument' },
  { id: 'export', label: 'Export' },
  { id: 'ethics', label: 'Ethics' },
  { id: 'consistency', label: 'Consistency' },
]

type Availability = 'loading' | 'on' | 'off' | 'error'
interface ProjectOption { id: string; title: string; updatedAt?: string }

/**
 * Study Design: design choice, sample size, instrument, export, ethics and consistency checks for one study. Sample
 * size is always available; the other tabs are available when switched on for the user. The rest are shown disabled so
 * the shape of the tool is visible without pretending they work.
 */
export default function StudyDesignPage() {
  const [params, setParams] = useSearchParams()
  const projectId = params.get('projectId') ?? ''
  const [availability, setAvailability] = useState<Availability>('loading')
  const [features, setFeatures] = useState<StudyDesignAvailability | null>(null)
  const [projects, setProjects] = useState<ProjectOption[] | null>(null)
  const [projectsFailed, setProjectsFailed] = useState(false)

  const check = () => {
    setAvailability('loading')
    studyDesignApi.availability().then(a => { setFeatures(a); setAvailability(a.enabled ? 'on' : 'off') })
      // A backend without the feature (not deployed yet, or switched off) answers 404: that is "off", not a fault.
      .catch((e: { code?: string; response?: { status?: number } }) => setAvailability(e?.code === 'STUDY_DESIGN_DISABLED' || e?.response?.status === 404 ? 'off' : 'error'))
  }
  useEffect(check, [])

  useEffect(() => {
    if (availability !== 'on') return
    let cancelled = false
    researchApi.list()
      .then(list => { if (!cancelled) setProjects(list.map(p => ({ id: p.id, title: p.title || 'Untitled project', updatedAt: p.updatedAt }))) })
      .catch(() => { if (!cancelled) { setProjects([]); setProjectsFailed(true) } })
    return () => { cancelled = true }
  }, [availability])

  const project = projects?.find(p => p.id === projectId) ?? null
  const optionLabels = useMemo(() => projectOptionLabels(projects ?? []), [projects])
  const chooseProject = (id: string) => {
    const next = new URLSearchParams(params)
    if (id) next.set('projectId', id); else next.delete('projectId')
    setParams(next, { replace: true })
  }

  const advisorOn = !!features?.advisor
  const instrumentOn = !!features?.instrument
  const ethicsOn = !!features?.ethics
  const consistencyOn = !!features?.consistency
  const TABS = TAB_LIST.map(t => ({ ...t, ready: t.id === 'sample-size' || (t.id === 'design' && advisorOn) || (t.id === 'instrument' && instrumentOn) || (t.id === 'ethics' && ethicsOn) || (t.id === 'consistency' && consistencyOn) }))
  const ready = TABS.filter(t => t.ready)
  const requested = params.get('tab') as TabId | null
  const tab: TabId = ready.some(t => t.id === requested) ? requested! : 'sample-size'
  const selectTab = (id: TabId) => {
    const next = new URLSearchParams(params)
    if (id === 'sample-size') next.delete('tab'); else next.set('tab', id)
    setParams(next, { replace: true })
  }
  // Arrow keys move between the tabs that are available; disabled tabs are skipped.
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = ready.findIndex(t => t.id === tab)
    const to = e.key === 'ArrowRight' ? (i + 1) % ready.length : e.key === 'ArrowLeft' ? (i - 1 + ready.length) % ready.length : e.key === 'Home' ? 0 : e.key === 'End' ? ready.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    selectTab(ready[to].id)
    requestAnimationFrame(() => document.getElementById(`sd-tab-${ready[to].id}`)?.focus())
  }

  if (availability === 'loading') return <div className="px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl"><Skeleton lines={6} tone="light" /></div></div>
  if (availability === 'off') return <ComingSoon tool="study-design" />
  if (availability === 'error') {
    return (
      <div className="px-4 py-8 sm:px-6"><div className="mx-auto max-w-6xl">
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-[14px] text-red-800">
          Study Design could not be reached. Check your connection.{' '}
          <button type="button" onClick={check} className="font-semibold underline">Try again</button>
        </div>
      </div></div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto max-w-6xl">
          {/* The app header already shows "Study Design" as the page's h1, so there is no second heading here. */}
          <header>
            <p className="max-w-3xl text-[15px] text-slate-800">
              Choose a design that fits your questions and work out how many participants you need, with the reasoning shown so you can defend it.
            </p>
            <p className="mt-2 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[13px] text-slate-800">
              A planning aid. It does not replace a statistician, your supervisor or your research ethics committee, and it never changes your project.
            </p>
          </header>

          <div className="mt-5 max-w-xl">
            <label htmlFor="sd-project" className="mb-1 block text-[13px] font-medium text-slate-800">Project</label>
            {projects === null ? <Skeleton lines={1} tone="light" /> : (
              <>
                <select id="sd-project" value={project ? projectId : ''} onChange={e => chooseProject(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] text-slate-900 outline-none focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30">
                  <option value="">No project (nothing is saved)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{optionLabels.get(p.id) ?? p.title}</option>)}
                </select>
                {/* A select clips long titles, so the chosen title is also shown in full. */}
                {project ? <p className="mt-1 text-[13px] leading-snug text-slate-700">{project.title}</p> : null}
                {projectsFailed ? <p role="alert" className="mt-1 text-[13px] font-medium text-red-700">Your projects could not be loaded. You can still calculate without one.</p> : null}
                {!projectsFailed && projects.length === 0 ? <p className="mt-1 text-[13px] text-slate-700">You have no projects yet. You can calculate without one, or <Link to="/app/proposal-studio" className="font-medium text-purple-deep underline">start a project</Link> to save your calculations.</p> : null}
                {projectId && !project && projects.length > 0 ? <p role="alert" className="mt-1 text-[13px] font-medium text-red-700">That project was not found. Choose another.</p> : null}
              </>
            )}
          </div>

          <div role="tablist" aria-label="Study Design sections" className="mt-6 flex flex-wrap gap-x-1 border-b border-slate-200">
            {TABS.map(t => t.ready ? (
              <button key={t.id} type="button" role="tab" id={`sd-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`sd-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
                onClick={() => selectTab(t.id)} onKeyDown={onTabKey}
                className={cn('-mb-px min-h-10 rounded-t border-b-[3px] px-3 text-[14px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
                  tab === t.id ? 'border-purple-accent text-purple-deep' : 'border-transparent text-slate-700 hover:text-slate-900')}>
                {t.label}
              </button>
            ) : (
              <button key={t.id} type="button" role="tab" aria-selected="false" aria-disabled="true" tabIndex={-1} title={`${t.label} is not available yet`}
                className={cn('-mb-px min-h-10 cursor-not-allowed rounded-t border-b-[3px] border-transparent px-3 text-[14px] font-medium text-slate-500')}>
                {t.label} <span className="text-[12px] font-normal">(later)</span>
              </button>
            ))}
          </div>

          {/* Both panels stay mounted so switching tabs does not discard what was typed or calculated. */}
          <div role="tabpanel" id="sd-panel-sample-size" aria-labelledby="sd-tab-sample-size" hidden={tab !== 'sample-size'} className="pt-5">
            <SampleSizeTab projectId={project?.id ?? ''} projectTitle={project?.title ?? null} />
          </div>
          {instrumentOn ? (
            <div role="tabpanel" id="sd-panel-instrument" aria-labelledby="sd-tab-instrument" hidden={tab !== 'instrument'} className="pt-5">
              <InstrumentTab projectId={project?.id ?? ''} projectTitle={project?.title ?? null} />
            </div>
          ) : null}
          {ethicsOn ? (
            <div role="tabpanel" id="sd-panel-ethics" aria-labelledby="sd-tab-ethics" hidden={tab !== 'ethics'} className="pt-5">
              <EthicsTab projectId={project?.id ?? ''} />
            </div>
          ) : null}
          {consistencyOn ? (
            <div role="tabpanel" id="sd-panel-consistency" aria-labelledby="sd-tab-consistency" hidden={tab !== 'consistency'} className="pt-5">
              <ConsistencyTab projectId={project?.id ?? ''} active={tab === 'consistency'} />
            </div>
          ) : null}
          {advisorOn ? (
            <div role="tabpanel" id="sd-panel-design" aria-labelledby="sd-tab-design" hidden={tab !== 'design'} className="pt-5">
              <DesignTab projectId={project?.id ?? ''} projectTitle={project?.title ?? null} credits={features?.advisorCredits ?? 3} designs={features?.designs ?? {}} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
