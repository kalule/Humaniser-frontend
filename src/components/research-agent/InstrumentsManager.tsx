import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check, ChevronDown, ChevronUp, Download, FileUp, Loader2, Sparkles, Upload } from 'lucide-react'
import { researchApi } from '../../api/research'
import { useFileInput } from '../../hooks/useFileInput'
import { ACCEPTED_EXTENSIONS } from '../../lib/fileExtract'
import { cn } from '../../lib/utils'
import type { ApiError } from '../../types'
import type { InstrumentDetail, InstrumentSource, InstrumentSummary, InstrumentType } from '../../types/research'

const TYPE_LABELS: Record<InstrumentType, string> = {
  InterviewGuide: 'Interview Guide',
  Questionnaire: 'Questionnaire',
  ObservationChecklist: 'Observation Checklist',
  FocusGroupGuide: 'Focus Group Guide',
}

const SOURCE_LABELS: Record<InstrumentSource, string> = {
  AiGenerated: 'AI-drafted',
  Imported: 'Imported',
  ManuallyEntered: 'Manually entered',
}

// Only Interview Guide generation exists on the backend today (InstrumentDesignerService.GenerateAsync
// throws NotSupportedException for the other three) — gating the button here avoids a round-trip
// just to show that error.
const AI_GENERATION_SUPPORTED: InstrumentType[] = ['InterviewGuide']

type ImportFormState = {
  type: InstrumentType
  title: string
  source: Extract<InstrumentSource, 'Imported' | 'ManuallyEntered'>
  content: string
  fileName: string
  file: File | null
}

export function InstrumentsManager({ projectId }: { projectId: string }) {
  const [availableTypes, setAvailableTypes] = useState<InstrumentType[] | null>(null)
  const [instruments, setInstruments] = useState<InstrumentSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<InstrumentDetail | null>(null)
  const [importForOpenType, setImportForOpenType] = useState<InstrumentType | null>(null)
  const [importForm, setImportForm] = useState<ImportFormState | null>(null)

  // Real file upload — reuses this app's own shared extraction utility (FileReader for .txt,
  // mammoth for .docx; see IntakeModal.tsx for the other consumer), not a bare filename text box.
  // One hook instance shared across whichever instrument type's form is currently open; the
  // functional update below applies to it regardless of which type that is.
  const { openFilePicker, isProcessing: isExtracting, fileInputElement } = useFileInput({
    onText: (text, filename) => setImportForm(f => f && { ...f, content: text, fileName: filename }),
    onFile: (file) => setImportForm(f => f && { ...f, file }),
  })
  const [downloadingFile, setDownloadingFile] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      researchApi.getAvailableInstrumentTypes(projectId),
      researchApi.getInstruments(projectId),
    ])
      .then(([types, list]) => { setAvailableTypes(types); setInstruments(list) })
      .catch((error: ApiError) => toast.error(error?.message ?? 'Could not load instruments — confirm a methodology classification in Ethics first.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [projectId])

  const openImportForm = (type: InstrumentType) => {
    setImportForOpenType(type)
    setImportForm({
      type, title: `${TYPE_LABELS[type]}`, source: 'Imported', content: '', fileName: '', file: null,
    })
  }

  const submitImport = async () => {
    if (!importForm) return
    if (!importForm.content.trim()) {
      toast.error('Paste or type the instrument’s actual content first.')
      return
    }
    setBusy('import')
    try {
      await researchApi.importInstrument(
        projectId, importForm.type, importForm.title, importForm.source,
        importForm.content, importForm.source === 'Imported' ? (importForm.fileName || null) : null,
        importForm.source === 'Imported' ? importForm.file : null,
      )
      toast.success(`${TYPE_LABELS[importForm.type]} recorded as ${SOURCE_LABELS[importForm.source]}. Review it, then approve when ready.`)
      setImportForOpenType(null)
      setImportForm(null)
      load()
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not record this instrument.')
    } finally {
      setBusy(null)
    }
  }

  const generateWithAi = async (type: InstrumentType) => {
    setBusy(`generate:${type}`)
    try {
      const created = await researchApi.createInstrument(projectId, type, TYPE_LABELS[type])
      await researchApi.generateInstrumentItems(created.id)
      toast.success(`${TYPE_LABELS[type]} drafted with AI. Review each item before approving.`)
      load()
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not generate this instrument.')
    } finally {
      setBusy(null)
    }
  }

  const toggleExpand = async (instrument: InstrumentSummary) => {
    if (expanded === instrument.id) { setExpanded(null); setDetail(null); return }
    setExpanded(instrument.id)
    try {
      setDetail(await researchApi.getInstrument(instrument.id))
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not load this instrument.')
      setExpanded(null)
    }
  }

  const downloadFile = async (instrumentId: string, fileName: string | null) => {
    setDownloadingFile(true)
    try {
      const blob = await researchApi.downloadInstrumentFile(instrumentId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'instrument-file'
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not download this file.')
    } finally {
      setDownloadingFile(false)
    }
  }

  const updateStatus = async (instrumentId: string, status: 'Draft' | 'Approved') => {
    setBusy(`status:${instrumentId}`)
    try {
      const updated = await researchApi.updateInstrumentStatus(instrumentId, status)
      if (expanded === instrumentId) setDetail(updated)
      toast.success(status === 'Approved' ? 'Instrument approved.' : 'Approval reverted — instrument returned to Draft.')
      load()
    } catch (error) {
      toast.error((error as ApiError)?.message ?? 'Could not update this instrument.')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-violet-600" /></div>

  if (!availableTypes || availableTypes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
        <p className="text-[13px] font-medium text-slate-600">No instruments required</p>
        <p className="mt-1 text-[12px] text-slate-400">
          {availableTypes === null
            ? 'Confirm a methodology classification in Ethics before recording instruments.'
            : "This project's confirmed data-collection methods (e.g. Secondary Data) don't require a dedicated instrument."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {fileInputElement}
      <p className="text-[12px] text-slate-500">
        One approved instrument is required for each data-collection method your confirmed methodology
        classification selected. Import or type in an instrument you already have — approval is always
        a separate, explicit step after you've reviewed it.
      </p>

      {availableTypes.map(type => {
        const forType = (instruments ?? []).filter(i => i.instrumentType === type)
        const hasApproved = forType.some(i => i.status === 'Approved')

        return (
          <section key={type} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', hasApproved ? 'bg-emerald-500' : 'bg-amber-400')} />
                <h3 className="text-sm font-semibold text-slate-800">{TYPE_LABELS[type]}</h3>
              </div>
              <div className="flex items-center gap-2">
                {AI_GENERATION_SUPPORTED.includes(type) && (
                  <button
                    disabled={busy !== null}
                    onClick={() => void generateWithAi(type)}
                    className="flex items-center gap-1.5 rounded-lg border border-violet-200 px-3 py-1.5 text-[11px] font-medium text-violet-700 disabled:opacity-50"
                  >
                    {busy === `generate:${type}` ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate with AI
                  </button>
                )}
                <button
                  disabled={busy !== null}
                  onClick={() => openImportForm(type)}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  <Upload size={12} /> Import / enter manually
                </button>
              </div>
            </div>

            {importForOpenType === type && importForm && (
              <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  value={importForm.title}
                  onChange={e => setImportForm(f => f && { ...f, title: e.target.value })}
                  placeholder="Title (e.g. Interview Guide — Final)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none"
                />
                <div className="flex gap-3 text-[12px] text-slate-600">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={importForm.source === 'Imported'}
                      onChange={() => setImportForm(f => f && { ...f, source: 'Imported' })} />
                    Uploaded/imported file
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={importForm.source === 'ManuallyEntered'}
                      onChange={() => setImportForm(f => f && { ...f, source: 'ManuallyEntered' })} />
                    Typed in manually
                  </label>
                </div>
                {importForm.source === 'Imported' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isExtracting}
                      onClick={openFilePicker}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 disabled:opacity-50"
                    >
                      {isExtracting ? <Loader2 size={13} className="animate-spin" /> : <FileUp size={13} />}
                      {isExtracting ? 'Reading file…' : 'Choose file'}
                    </button>
                    <span className="truncate text-[12px] text-slate-500">
                      {importForm.fileName || `No file selected (${ACCEPTED_EXTENSIONS.join(', ')})`}
                    </span>
                  </div>
                )}
                <textarea
                  rows={6}
                  value={importForm.content}
                  onChange={e => setImportForm(f => f && { ...f, content: e.target.value })}
                  placeholder={importForm.source === 'Imported'
                    ? 'Content will appear here once you choose a file — check it over, then Save.'
                    : 'Type the actual instrument content — the real questions/items you used to collect the analysed data.'}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={busy !== null || isExtracting}
                    onClick={() => void submitImport()}
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                  >
                    {busy === 'import' ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    disabled={busy !== null}
                    onClick={() => { setImportForOpenType(null); setImportForm(null) }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              {forType.length === 0 && (
                <p className="text-[12px] text-slate-400">No {TYPE_LABELS[type].toLowerCase()} recorded yet.</p>
              )}
              {forType.map(instrument => (
                <div key={instrument.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <button onClick={() => void toggleExpand(instrument)} className="flex min-w-0 items-center gap-2 text-left">
                      {expanded === instrument.id ? <ChevronUp size={14} className="shrink-0 text-slate-400" /> : <ChevronDown size={14} className="shrink-0 text-slate-400" />}
                      <span className="truncate text-[12px] font-medium text-slate-700">{instrument.title}</span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{SOURCE_LABELS[instrument.source]}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', instrument.status === 'Approved' ? 'bg-green-tint text-green-text' : 'bg-amber-tint text-amber-text')}>
                        {instrument.status}
                      </span>
                      {instrument.status === 'Draft' ? (
                        <button
                          disabled={busy !== null}
                          onClick={() => void updateStatus(instrument.id, 'Approved')}
                          className="flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-[10px] font-medium text-emerald-700 disabled:opacity-50"
                        >
                          <Check size={11} /> Approve
                        </button>
                      ) : (
                        <button
                          disabled={busy !== null}
                          onClick={() => void updateStatus(instrument.id, 'Draft')}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-600 disabled:opacity-50"
                        >
                          Revert
                        </button>
                      )}
                    </div>
                  </div>
                  {expanded === instrument.id && detail && detail.id === instrument.id && (
                    <div className="mt-2 border-t border-slate-100 pt-2">
                      {detail.content && (
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 font-sans text-[12px] leading-relaxed text-slate-700">
                          {detail.content}
                        </pre>
                      )}
                      {detail.fileName && (
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                          <span>From file: {detail.fileName}</span>
                          {detail.hasStoredFile && (
                            <button
                              disabled={downloadingFile}
                              onClick={() => void downloadFile(detail.id, detail.fileName)}
                              className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 disabled:opacity-50"
                            >
                              {downloadingFile ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />} Download original
                            </button>
                          )}
                        </div>
                      )}
                      {detail.researchQuestions.length > 0 && (
                        <div className="space-y-2">
                          {detail.researchQuestions.map(rq => (
                            <div key={rq.number}>
                              <p className="text-[11px] font-semibold text-slate-500">RQ{rq.number}: {rq.questionText}</p>
                              <ul className="mt-1 list-disc pl-5 text-[12px] text-slate-700">
                                {rq.items.map(item => <li key={item.id}>{item.text}</li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
