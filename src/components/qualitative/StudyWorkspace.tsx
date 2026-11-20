import { useEffect, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage, qualApi, type QualAvailability, type QualStudy } from '../../api/qualitativeAnalysis'
import { METHOD_LABELS, languageLabel } from '../../lib/qualitative'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/Skeleton'
import { CodebookTab } from './CodebookTab'
import { ChecklistsTab } from './ChecklistsTab'
import { CodersTab } from './CodersTab'
import { ReportTab } from './ReportTab'
import { ThemesTab } from './ThemesTab'
import { EvidenceTab } from './EvidenceTab'
import { MemosTab } from './MemosTab'
import { SettingsTab } from './SettingsTab'
import { StatsTab } from './StatsTab'
import { SuggestionsTab } from './SuggestionsTab'
import { TranscriptsTab } from './TranscriptsTab'
import { Notice } from './ui'

type TabId = 'transcripts' | 'codebook' | 'themes' | 'evidence' | 'statistics' | 'memos' | 'coders' | 'suggestions' | 'report' | 'checklists' | 'settings'

export function StudyWorkspace({ studyId, features }: { studyId: string; features: QualAvailability }) {
  const [params, setParams] = useSearchParams()
  const [study, setStudy] = useState<QualStudy | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const load = () => { setFailed(null); qualApi.getStudy(studyId).then(setStudy).catch(e => setFailed(errorMessage(e, 'This study could not be loaded.'))) }
  useEffect(load, [studyId])

  const second = study?.myRole === 'SecondCoder'
  // A second coder works on the transcripts only: everything else belongs to the study's owner.
  const tabs: { id: TabId; label: string }[] = second ? [{ id: 'transcripts', label: 'Transcripts' }] : [
    { id: 'transcripts', label: 'Transcripts' },
    { id: 'codebook', label: 'Codebook' },
    { id: 'themes', label: 'Themes' },
    { id: 'evidence', label: 'Quotes' },
    { id: 'statistics', label: 'Counts' },
    { id: 'memos', label: 'Memos' },
    ...(features.agreement ? [{ id: 'coders' as TabId, label: 'Second coder' }] : []),
    ...(features.ai ? [{ id: 'suggestions' as TabId, label: 'AI suggestions' }] : []),
    { id: 'report', label: 'Report' },
    { id: 'checklists', label: 'Checklists' },
    { id: 'settings', label: 'Settings' },
  ]
  const requested = params.get('tab') as TabId | null
  const tab: TabId = tabs.some(t => t.id === requested) ? requested! : 'transcripts'
  const select = (id: TabId) => {
    const next = new URLSearchParams(params)
    if (id === 'transcripts') next.delete('tab'); else next.set('tab', id)
    setParams(next, { replace: true })
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.findIndex(t => t.id === tab)
    const to = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1
    if (to < 0) return
    e.preventDefault()
    select(tabs[to].id)
    requestAnimationFrame(() => document.getElementById(`qa-tab-${tabs[to].id}`)?.focus())
  }

  if (failed) return <Notice tone="error">{failed} <Link to="/app/qualitative-analysis" className="font-semibold underline">Back to your studies</Link></Notice>
  if (!study) return <Skeleton lines={6} tone="light" />

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[13px] text-slate-700"><Link to="/app/qualitative-analysis" className="underline">Studies</Link> / <span>{study.title}</span></nav>
      <h2 className="mt-1 text-[20px] font-semibold text-slate-900 [overflow-wrap:anywhere]">{study.title}</h2>
      <p className="mt-1 text-[13px] text-slate-700">
        {METHOD_LABELS[study.method]} · {languageLabel(study.analysisLanguage)} · {study.aiMode === 'ManualOnly' ? 'Manual coding only' : 'AI suggestions allowed'} · {study.transcriptsReady} of {study.transcripts} transcript{study.transcripts === 1 ? '' : 's'} ready · {study.participants} participant{study.participants === 1 ? '' : 's'}
      </p>
      {second && <Notice className="mt-3" title="You are the second coder on this study">Code each transcript with the codebook, without looking at anyone else’s coding, then mark it finished. You cannot see the owner’s coding, quotes or memos, and they do not see yours until they compare the two.</Notice>}

      <div role="tablist" aria-label="Study sections" className="mt-4 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.id} id={`qa-tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`qa-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1}
            onClick={() => select(t.id)} onKeyDown={onKey}
            className={cn('-mb-px rounded-t-lg border-b-2 px-3 py-2 text-[14px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/40',
              tab === t.id ? 'border-purple-deep text-purple-deep' : 'border-transparent text-slate-700 hover:text-slate-900')}>
            {t.label}
          </button>
        ))}
      </div>

      <div id={`qa-panel-${tab}`} role="tabpanel" aria-labelledby={`qa-tab-${tab}`} className="pb-10">
        {tab === 'transcripts' && <TranscriptsTab study={study} features={features} onChange={load} />}
        {tab === 'codebook' && <CodebookTab study={study} />}
        {tab === 'themes' && <ThemesTab study={study} features={features} />}
        {tab === 'checklists' && <ChecklistsTab study={study} />}
        {tab === 'coders' && <CodersTab study={study} />}
        {tab === 'report' && <ReportTab study={study} />}
        {tab === 'evidence' && <EvidenceTab study={study} />}
        {tab === 'statistics' && <StatsTab study={study} />}
        {tab === 'memos' && <MemosTab study={study} />}
        {tab === 'suggestions' && <SuggestionsTab study={study} />}
        {tab === 'settings' && <SettingsTab study={study} features={features} onChange={setStudy} />}
      </div>
    </>
  )
}
