import { useCallback, useEffect, useRef, useState } from 'react'
import { citationCheckApi } from '../api/citationCheck'
import type { CitationCheckReport } from '../types/citationCheck'
import type { SectionCheckVerdict } from './citationCard'
import { isTerminal } from './citationCheckView'

/**
 * "Check citations" in place: runs the Citation Checker's claim-source judge on one section (the
 * same run the Citation Check page starts from a section, W5) and keeps its verdicts by section, so
 * each citation's dot in the document updates without leaving the page. Results last for the
 * session; the server keeps the run for its own retention period.
 */

export type SectionCheckState = 'running' | 'done' | 'error'

const POLL_MS = 2500
/** A run that has not finished after this long is reported as not finished, not polled for ever. */
const GIVE_UP_MS = 6 * 60_000

export function verdictsFromReport(report: CitationCheckReport): SectionCheckVerdict[] {
  return report.cards.filter(c => !c.locked).map(c => ({
    markerText:   c.markerText,
    citedAuthors: c.citedAuthors ?? null,
    citedYear:    c.citedYear ?? null,
    claimText:    c.verdict?.claimText ?? '',
    verdict:      c.verdict?.verdict ?? null,
    failureType:  c.verdict?.failureType ?? null,
    reasoning:    c.verdict?.reasoning ?? null,
    flags:        c.flags,
  }))
}

export interface SectionCitationChecks {
  checks: Record<string, SectionCheckVerdict[]>
  state:  Record<string, SectionCheckState>
  runIds: Record<string, string>
  run:    (code: string) => Promise<SectionCheckState>
}

export function useSectionCitationChecks(projectId: string): SectionCitationChecks {
  const [checks, setChecks] = useState<Record<string, SectionCheckVerdict[]>>({})
  const [state, setState] = useState<Record<string, SectionCheckState>>({})
  const [runIds, setRunIds] = useState<Record<string, string>>({})
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  // A different project starts with no results.
  useEffect(() => { setChecks({}); setState({}); setRunIds({}) }, [projectId])

  const run = useCallback(async (code: string): Promise<SectionCheckState> => {
    setState(s => ({ ...s, [code]: 'running' }))
    try {
      const runId = await citationCheckApi.startFromSection(projectId, code)
      if (!alive.current) return 'running'
      setRunIds(r => ({ ...r, [code]: runId }))
      const started = Date.now()
      for (;;) {
        await new Promise(resolve => setTimeout(resolve, POLL_MS))
        if (!alive.current) return 'running'
        const report = await citationCheckApi.get(runId)
        if (!report) throw new Error('The check is no longer available.')
        // Verdicts land one by one: show each as it arrives.
        setChecks(c => ({ ...c, [code]: verdictsFromReport(report) }))
        if (isTerminal(report.status)) {
          const outcome: SectionCheckState = report.status === 'Completed' ? 'done' : 'error'
          setState(s => ({ ...s, [code]: outcome }))
          return outcome
        }
        if (Date.now() - started > GIVE_UP_MS) throw new Error('The check is taking too long.')
      }
    } catch (err) {
      if (alive.current) setState(s => ({ ...s, [code]: 'error' }))
      throw err
    }
  }, [projectId])

  return { checks, state, runIds, run }
}
