import { useCallback, useRef } from 'react'
import { nanoid } from 'nanoid'
import toast from 'react-hot-toast'
import { analystApi } from '../api/analyst'
import { useAnalystStore } from '../store/analystStore'
import type { AnalystMessage, WriteUpRequest, AcademicStyleGuide, CleanDatasetConfig, PreparationBlueprintRequest, PreparationBlueprint, AnalyticalMethod, LiteratureCitation, AcademicLevel } from '../types/analyst'
import { ACADEMIC_LEVEL_MAP } from '../types/analyst'
import { workbenchApi } from '../api/workbench'
import { classifyApiError } from '../lib/classifyApiError'

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS  = 300_000  // 5 min — retries can wait up to 3 × 90s for Claude rate limits

export function useAnalyst() {
  const {
    datasetId, schema, mode,
    sessionId, academicLevel, stepCount,
    setDataset, addMessage, updateMessage,
    setUploading, setQuerying, setExporting,
    setHealthReport, setProfiling, setCleaning, applyCleanResult,
    setWizardStep, setBlueprint, setGeneratingBlueprint, skipWizard, completeWizard,
    setSession, clearSession, setAcademicLevel,
  } = useAnalystStore()

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Upload ─────────────────────────────────────────────────────────────────

  const upload = useCallback(async (file: File) => {
    const MAX_MB = 50
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB} MB limit.`)
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!ext || !['csv', 'xlsx', 'xls', 'dta', 'rds', 'rdata', 'omv'].includes(ext)) {
      toast.error('Supported formats: CSV, Excel, Stata (.dta), R (.rds/.rdata), Jamovi (.omv)')
      return
    }

    setUploading(true)
    try {
      const res = await analystApi.upload(file)
      setDataset(res.datasetId, res.schema)
      toast.success(`Loaded: ${res.schema.rowCount.toLocaleString()} rows × ${res.schema.columnCount} columns`)
    } catch {
      toast.error('Failed to upload file. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [setDataset, setUploading])

  // ── Query ──────────────────────────────────────────────────────────────────

  const query = useCallback(async (text: string) => {
    if (!datasetId || !schema) return
    if (!text.trim()) return

    const userMsg: AnalystMessage = {
      id: nanoid(), role: 'user', content: text.trim(),
      createdAt: new Date().toISOString(),
    }
    addMessage(userMsg)

    const assistantId = nanoid()
    const assistantMsg: AnalystMessage = {
      id: assistantId, role: 'assistant', content: '',
      status: 'pending', createdAt: new Date().toISOString(),
      logStream: [],
    }
    addMessage(assistantMsg)
    setQuerying(true)

    try {
      const job = await analystApi.query({
        datasetId,
        query:        text.trim(),
        mode,
        sessionId,                               // null → backend creates a new session
        academicLevel: ACADEMIC_LEVEL_MAP[academicLevel],
      })

      // Persist the session ID returned from the first query
      if (job.sessionId) {
        setSession(job.sessionId, job.sessionStepCount ?? 0)
      }

      updateMessage(assistantId, { jobId: job.jobId, status: 'running' })

      const start = Date.now()

      pollRef.current = setInterval(async () => {
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          clearInterval(pollRef.current!)
          updateMessage(assistantId, {
            status: 'error',
            error: 'Analysis is taking longer than expected (possibly waiting on API rate limits). Please try again in a moment.',
          })
          setQuerying(false)
          return
        }

        try {
          const result = await analystApi.pollJob(job.jobId)

          // Stream live stdout lines into the message on every tick
          if (result.logStream?.length) {
            updateMessage(assistantId, { logStream: result.logStream })
          }

          // Surface self-healing retry count if backend sends it
          if (result.retryCount !== undefined) {
            updateMessage(assistantId, { retryCount: result.retryCount })
          }

          if (result.status === 'complete') {
            clearInterval(pollRef.current!)
            updateMessage(assistantId, {
              status:          'complete',
              content:         result.interpretation ?? '',
              results:         result.results ?? [],
              pythonCode:      result.pythonCode,
              conceptualGuide: result.conceptualGuide,
              logStream:       result.logStream,
              retryCount:      result.retryCount,
            })
            // Update session step count now that a new step has been persisted
            if (result.sessionId && result.sessionStepCount !== undefined) {
              setSession(result.sessionId, result.sessionStepCount)
            }
            setQuerying(false)
          } else if (result.status === 'error') {
            clearInterval(pollRef.current!)
            const classified = classifyApiError(result.error, { logStream: result.logStream })
            updateMessage(assistantId, {
              status:    'error',
              error:     classified.message,
              errorKind: classified.kind,
            })
            setQuerying(false)
            if (classified.kind !== 'offline' && classified.kind !== 'sandbox_offline') {
              toast.error(classified.message)
            }
          }
        } catch {
          clearInterval(pollRef.current!)
          const classified = classifyApiError('connection refused')
          updateMessage(assistantId, { status: 'error', error: classified.message, errorKind: classified.kind })
          setQuerying(false)
        }
      }, POLL_INTERVAL_MS)

    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      const classified = classifyApiError(raw)
      updateMessage(assistantId, { status: 'error', error: classified.message, errorKind: classified.kind })
      setQuerying(false)
      if (classified.kind !== 'offline') toast.error(classified.message)
    }
  }, [datasetId, schema, mode, sessionId, academicLevel, addMessage, updateMessage, setQuerying, setSession])

  // ── Literature cross-check ─────────────────────────────────────────────────

  const findLiterature = useCallback(async (jobId: string, messageId: string) => {
    updateMessage(messageId, { isFindingLiterature: true, literature: undefined })
    try {
      const citations = await analystApi.getLiterature(jobId)
      updateMessage(messageId, { isFindingLiterature: false, literature: citations })
      if (citations.length === 0) {
        toast('No related papers found for this analysis.')
      } else {
        toast.success(`Found ${citations.length} related paper${citations.length !== 1 ? 's' : ''}`)
      }
    } catch {
      updateMessage(messageId, { isFindingLiterature: false })
      toast.error('Literature search failed — is the server running?')
    }
  }, [updateMessage])

  // ── Write-up generation ────────────────────────────────────────────────────

  const generateWriteUp = useCallback(
    async (request: WriteUpRequest, messageId: string) => {
      updateMessage(messageId, { isGeneratingWriteUp: true })
      try {
        const { draft, citations } = await analystApi.generateWriteUp(request)
        updateMessage(messageId, { isGeneratingWriteUp: false, writeUpDraft: draft, writeUpCitations: citations })
        toast.success('Write-up generated')
      } catch {
        updateMessage(messageId, { isGeneratingWriteUp: false })
        toast.error('Write-up generation failed — is the server running?')
      }
    },
    [updateMessage],
  )

  // ── Outlier simulation ─────────────────────────────────────────────────────

  const runOutlierSimulation = useCallback(
    async (
      datasetId: string,
      xVar: string,
      yVar: string,
      messageId: string,
      indicesToExclude?: number[],
    ) => {
      updateMessage(messageId, { isRunningOutlierScan: true })
      const isSim = (indicesToExclude?.length ?? 0) > 0
      try {
        const result = await workbenchApi.simulateOutliers({
          datasetId, independentVariable: xVar, dependentVariable: yVar, indicesToExclude,
        })
        if (!isSim) {
          updateMessage(messageId, {
            isRunningOutlierScan: false, outlierScan: result, outlierSimResult: null,
          })
          if (result.error) {
            toast.error(`Scan failed: ${result.error}`)
          } else if (!result.outliersDetected) {
            toast.success('No high-leverage outliers detected')
          } else {
            toast(`${result.outliers.length} high-leverage outlier${result.outliers.length !== 1 ? 's' : ''} flagged`)
          }
        } else {
          updateMessage(messageId, { isRunningOutlierScan: false, outlierSimResult: result })
          if (result.error) toast.error(`Simulation failed: ${result.error}`)
          else toast.success('Cleaned model computed')
        }
      } catch {
        updateMessage(messageId, { isRunningOutlierScan: false })
        toast.error('Outlier simulation failed — is the sandbox running?')
      }
    },
    [updateMessage],
  )

  // ── Methodology appendix ──────────────────────────────────────────────────

  const getMethodologyAppendix = useCallback(
    async (jobId: string, messageId: string, styleGuide: AcademicStyleGuide = 'APA7') => {
      updateMessage(messageId, { isGeneratingMethodology: true })
      try {
        const appendix = await analystApi.getMethodologyAppendix(jobId, styleGuide)
        updateMessage(messageId, { isGeneratingMethodology: false, methodologyAppendix: appendix })
        toast.success(
          appendix.hasEvents
            ? `Methodology captured — ${appendix.events.length} audit events`
            : 'No data transformations detected for this analysis',
        )
      } catch {
        updateMessage(messageId, { isGeneratingMethodology: false })
        toast.error('Methodology export failed — is the server running?')
      }
    },
    [updateMessage],
  )

  // ── Data health profiling ──────────────────────────────────────────────────

  const profileDataset = useCallback(async () => {
    if (!datasetId) return
    setProfiling(true)
    try {
      const report = await analystApi.profileDataset(datasetId)
      setHealthReport(report)
      const critCount = report.anomalies.filter((a) => a.severity === 'critical').length
      if (critCount > 0) {
        toast(`${report.anomalies.length} issue${report.anomalies.length !== 1 ? 's' : ''} found — ${critCount} critical`, { icon: '⚠️' })
      } else if (report.anomalies.length > 0) {
        toast(`${report.anomalies.length} data quality issue${report.anomalies.length !== 1 ? 's' : ''} found`)
      } else {
        toast.success('Dataset looks clean — no anomalies detected')
      }
    } catch {
      toast.error('Health check failed — is the server running?')
    } finally {
      setProfiling(false)
    }
  }, [datasetId, setHealthReport, setProfiling])

  // ── Apply cleaning config ──────────────────────────────────────────────────

  const cleanDataset = useCallback(async (config: CleanDatasetConfig) => {
    if (!datasetId) return
    setCleaning(true)
    try {
      const res = await analystApi.cleanDataset({ ...config, datasetId })
      applyCleanResult(res.schema)
      const parts: string[] = []
      if (res.duplicatesRemoved > 0) parts.push(`${res.duplicatesRemoved} duplicate${res.duplicatesRemoved !== 1 ? 's' : ''} removed`)
      if (res.rowsRemoved > res.duplicatesRemoved) parts.push(`${res.rowsRemoved - res.duplicatesRemoved} rows dropped`)
      toast.success(parts.length > 0 ? `Cleaned: ${parts.join(' · ')}` : 'Dataset cleaned successfully')
    } catch {
      toast.error('Cleaning failed — is the server running?')
    } finally {
      setCleaning(false)
    }
  }, [datasetId, applyCleanResult, setCleaning])

  // ── NL → cleaning config → auto-apply ─────────────────────────────────────

  const parseAndApplyCleaningInstruction = useCallback(async (instruction: string) => {
    if (!datasetId) return
    setCleaning(true)
    try {
      const config = await analystApi.parseCleaningInstruction(datasetId, instruction)
      const res = await analystApi.cleanDataset({ ...config, datasetId })
      applyCleanResult(res.schema)
      toast.success('Cleaning applied successfully')
    } catch {
      toast.error('Cleaning failed — is the server running?')
    } finally {
      setCleaning(false)
    }
  }, [datasetId, applyCleanResult, setCleaning])

  // ── Academic synthesis ────────────────────────────────────────────────────

  const generateSynthesis = useCallback(
    async (
      jobId: string,
      messageId: string,
      literature: LiteratureCitation[],
      results?: import('../types/analyst').AnalystResult[],
    ) => {
      updateMessage(messageId, { isGeneratingSynthesis: true })
      try {
        // Auto-fetch literature if none is loaded yet so references are always included
        let resolvedLiterature = literature
        if (resolvedLiterature.length === 0) {
          try {
            updateMessage(messageId, { isFindingLiterature: true })
            resolvedLiterature = await analystApi.getLiterature(jobId)
            updateMessage(messageId, { isFindingLiterature: false, literature: resolvedLiterature })
          } catch {
            updateMessage(messageId, { isFindingLiterature: false })
            // proceed without citations rather than failing the whole synthesis
          }
        }

        const formatAuthor = (authors: string[]) => {
          if (!authors.length) return 'Unknown'
          if (authors.length === 1) return authors[0]
          if (authors.length === 2) return `${authors[0]} and ${authors[1]}`
          return `${authors[0]} et al.`
        }

        const request = {
          literature: resolvedLiterature.map((p) => ({
            author:  formatAuthor(p.authors ?? []),
            year:    p.year,
            title:   p.title,
            journal: p.sourceEngine ?? null,
          })),
          resultJson: results && results.length > 0
            ? JSON.stringify(results)
            : undefined,
        }

        const synthesis = await analystApi.generateSynthesis(jobId, request)
        updateMessage(messageId, { isGeneratingSynthesis: false, academicSynthesis: synthesis })
        toast.success(`Academic synthesis generated${resolvedLiterature.length > 0 ? ` · ${resolvedLiterature.length} references cited` : ''}`)
      } catch {
        updateMessage(messageId, { isGeneratingSynthesis: false })
        toast.error('Synthesis generation failed — is the server running?')
      }
    },
    [updateMessage],
  )

  // ── Session .docx export ──────────────────────────────────────────────────

  const exportSessionDocx = useCallback(async () => {
    if (!sessionId) {
      toast.error('No active session to export.')
      return
    }
    setExporting(true)
    const toastId = toast.loading('Generating report — this may take up to 30 seconds…')
    try {
      const blob = await analystApi.downloadSessionDocx(sessionId)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `analysis-session-${new Date().toISOString().slice(0, 10)}.docx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded successfully.', { id: toastId })
    } catch {
      toast.error('Export failed — is the server running?', { id: toastId })
    } finally {
      setExporting(false)
    }
  }, [sessionId, setExporting])

  // ── Generate preparation blueprint ────────────────────────────────────────

  const generateBlueprint = useCallback(async (request: PreparationBlueprintRequest) => {
    if (!datasetId) return
    setWizardStep('blueprint')
    setGeneratingBlueprint(true)
    try {
      const bp = await analystApi.generatePreparationBlueprint(datasetId, request)
      setBlueprint(bp)
    } catch {
      toast.error('Failed to generate blueprint — is the server running?')
      // Fall back to whichever step makes sense based on the method
      const needsVariables = request.analyticalMethod === 'regression' ||
                             request.analyticalMethod === 'hypothesis_testing'
      setWizardStep(needsVariables ? 'variables' : 'objectives')
    } finally {
      setGeneratingBlueprint(false)
    }
  }, [datasetId, setWizardStep, setGeneratingBlueprint, setBlueprint])

  // ── Apply blueprint (clean + prime conversation) ───────────────────────────

  const applyBlueprint = useCallback(async (blueprint: PreparationBlueprint, method: AnalyticalMethod) => {
    if (!datasetId) return
    setCleaning(true)
    try {
      const res = await analystApi.cleanDataset({ ...blueprint.config, datasetId })
      const methodLabel: Record<AnalyticalMethod, string> = {
        descriptive:        'descriptive analysis',
        regression:         'predictive modeling',
        hypothesis_testing: 'hypothesis testing',
        custom:             'your research goal',
      }
      const primedMessage =
        `Your dataset has been prepared for **${methodLabel[method]}**. ` +
        `${blueprint.explanation} ` +
        `Ask me anything about your data to get started.`
      completeWizard(res.schema, primedMessage)
      const parts: string[] = []
      if (res.duplicatesRemoved > 0) parts.push(`${res.duplicatesRemoved} duplicate${res.duplicatesRemoved !== 1 ? 's' : ''} removed`)
      if (res.rowsRemoved > res.duplicatesRemoved) parts.push(`${res.rowsRemoved - res.duplicatesRemoved} additional rows dropped`)
      toast.success(parts.length > 0 ? `Dataset prepared: ${parts.join(' · ')}` : 'Dataset prepared successfully')
    } catch {
      toast.error('Failed to apply blueprint — is the server running?')
    } finally {
      setCleaning(false)
    }
  }, [datasetId, completeWizard, setCleaning])

  return {
    upload, query, findLiterature, generateWriteUp, runOutlierSimulation,
    getMethodologyAppendix, profileDataset, cleanDataset, parseAndApplyCleaningInstruction,
    generateBlueprint, applyBlueprint, skipWizard, generateSynthesis,
    exportSessionDocx,
    // Expose session state so AnalystPage can render the UI without going through the store directly
    sessionId, academicLevel, stepCount,
    setAcademicLevel, clearSession,
  }
}
