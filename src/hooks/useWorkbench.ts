import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { workbenchApi } from '../api/workbench'
import { useWorkbenchStore } from '../store/workbenchStore'
import { useAnalystStore } from '../store/analystStore'
import type { ChartResult } from '../types/analyst'
import type { ProseMode } from '../types/workbench'

export function useWorkbench() {
  const store = useWorkbenchStore()
  const schema = useAnalystStore((s) => s.schema)
  const messages = useAnalystStore((s) => s.messages)

  const pinChart = useCallback(
    (chart: ChartResult, sourcePrompt: string) => {
      store.pinChart({
        id: crypto.randomUUID(),
        base64Png: chart.base64Png,
        caption: chart.caption,
        sourcePrompt,
        pinnedAt: new Date().toISOString(),
      })
      toast.success('Chart pinned to asset library')
    },
    [store],
  )

  const generateAbstract = useCallback(async () => {
    if (!schema) { toast.error('Upload a dataset first'); return }

    const history = messages
      .filter((m) => m.role === 'user' || m.status === 'complete')
      .map((m) => ({ role: m.role, content: m.content }))

    if (history.length === 0) {
      toast('Run at least one analysis query in the chat panel first, then generate your abstract.', { icon: '💬' })
      return
    }

    store.setGeneratingAbstract(true)
    try {

      const res = await workbenchApi.generateAbstract({
        datasetId: schema.datasetId,
        conversationHistory: history,
      })

      store.setAbstractText(res.abstract)
      if (!store.manuscriptText) store.setManuscriptText(res.abstract)
      toast.success('Abstract generated')
    } catch {
      toast.error('Failed to generate abstract')
    } finally {
      store.setGeneratingAbstract(false)
    }
  }, [schema, messages, store])

  const optimizeProse = useCallback(
    async (selectedText: string, mode: ProseMode): Promise<string | null> => {
      store.setOptimizingProse(true)
      try {
        const res = await workbenchApi.optimizeProse({ text: selectedText, mode })
        return res.optimizedText
      } catch {
        toast.error('Failed to optimise prose')
        return null
      } finally {
        store.setOptimizingProse(false)
      }
    },
    [schema, store],
  )

  const runComplianceCheck = useCallback(
    async (text: string) => {
      if (!text.trim()) { toast.error('No manuscript text to scan'); return }
      store.setScanning(true)
      try {
        const [shieldResult, litResult] = await Promise.allSettled([
          workbenchApi.scanShield({ text }),
          workbenchApi.validateLiterature({
            query: schema
              ? `${schema.fileName} data analysis statistical findings`
              : 'data analysis research statistical methodology',
          }),
        ])

        if (shieldResult.status === 'rejected') {
          toast.error('Compliance scan failed')
          return
        }

        const shieldRes = shieldResult.value
        const citations = litResult.status === 'fulfilled' ? litResult.value.citations : []

        if (litResult.status === 'rejected') {
          toast('Scan complete — literature lookup unavailable', { icon: '⚠️' })
        } else {
          toast.success('Compliance scan complete')
        }

        store.setComplianceResults(
          shieldRes.aiPatternScore * 100,
          shieldRes.flaggedBlocks,
          citations,
        )
      } catch {
        toast.error('Compliance scan failed')
      } finally {
        store.setScanning(false)
      }
    },
    [schema, store],
  )

  const checkAssumptions = useCallback(
    async (independentVars: string[], dependentVar: string) => {
      if (!schema) { toast.error('Upload a dataset first'); return }
      if (independentVars.length === 0) { toast.error('Select at least one independent variable'); return }
      if (!dependentVar) { toast.error('Select a dependent variable'); return }

      store.setCheckingAssumptions(true)
      store.setAssumptionReport(null)
      try {
        const report = await workbenchApi.checkAssumptions({
          datasetId: schema.datasetId,
          independentVars,
          dependentVar,
        })
        store.setAssumptionReport(report)
        if (report.error) {
          toast.error(`Check failed: ${report.error}`)
        } else {
          const failures = [
            report.multicollinearity?.passed === false && 'multicollinearity',
            report.homoscedasticity?.passed === false && 'homoscedasticity',
            report.normality?.passed === false && 'normality',
          ].filter(Boolean)
          failures.length === 0
            ? toast.success('All assumptions passed')
            : toast.error(`${failures.length} assumption${failures.length > 1 ? 's' : ''} violated`)
        }
      } catch {
        toast.error('Assumption check failed — is the sandbox running?')
      } finally {
        store.setCheckingAssumptions(false)
      }
    },
    [schema, store],
  )

  return { pinChart, generateAbstract, optimizeProse, runComplianceCheck, checkAssumptions }
}
