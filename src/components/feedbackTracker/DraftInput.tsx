import { useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { UPLOAD_EXTENSIONS, uploadKind, validateDraftText } from '../../lib/feedbackTracker'

/** A draft is either text (pasted, or read from a .txt) or a .pdf / .docx that the server reads. */
export interface DraftValue {
  text: string
  /** Set for .pdf and .docx only. */
  file: File | null
  /** Name of a .txt whose contents are now in `text`. */
  textFileName: string | null
}
export const EMPTY_DRAFT: DraftValue = { text: '', file: null, textFileName: null }

export function draftError(value: DraftValue): string | null {
  return value.file ? null : validateDraftText(value.text)
}

interface Props {
  idPrefix: string
  label: string
  hint?: string
  value: DraftValue
  onChange: (value: DraftValue) => void
  disabled?: boolean
  error?: string | null
}

export function DraftInput({ idPrefix, label, hint, value, onChange, disabled, error }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileProblem, setFileProblem] = useState<string | null>(null)
  const describedBy = [hint ? `${idPrefix}-hint` : '', error || fileProblem ? `${idPrefix}-error` : ''].filter(Boolean).join(' ') || undefined

  const choose = async (file: File | undefined) => {
    setFileProblem(null)
    if (!file) return
    const kind = uploadKind(file.name)
    if (kind === null) { setFileProblem('Choose a PDF, a Word (.docx) file or a .txt file, or paste the text.'); return }
    if (file.size > 50 * 1024 * 1024) { setFileProblem('That file is larger than 50 MB. Upload the chapter the comments are about, or paste the text.'); return }
    if (kind === 'server') { onChange({ text: '', file, textFileName: null }); return }
    try {
      onChange({ text: await file.text(), file: null, textFileName: file.name })
    } catch {
      setFileProblem('That file could not be read. Paste the text instead.')
    }
  }
  const clearFile = () => { onChange(EMPTY_DRAFT); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div>
      <label htmlFor={`${idPrefix}-text`} className="mb-1 block text-[13px] font-medium text-slate-800">{label}</label>
      {hint ? <p id={`${idPrefix}-hint`} className="mb-1.5 text-[13px] text-slate-700">{hint}</p> : null}

      {value.file ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-[14px] text-slate-900">
          <FileText size={16} aria-hidden="true" className="shrink-0 text-slate-600" />
          <span className="min-w-0 flex-1 break-all">{value.file.name}</span>
          <button type="button" onClick={clearFile} disabled={disabled} aria-label={`Remove ${value.file.name}`}
            className="rounded p-1 text-slate-700 outline-none hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-purple-accent/40">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <textarea id={`${idPrefix}-text`} value={value.text} disabled={disabled} rows={8} aria-describedby={describedBy} aria-invalid={error ? true : undefined}
          onChange={e => onChange({ text: e.target.value, file: null, textFileName: value.textFileName })}
          placeholder="Paste the text of the draft here"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[14px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-500 focus:border-purple-accent focus-visible:ring-2 focus-visible:ring-purple-accent/30" />
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-700">
        <input ref={fileRef} id={`${idPrefix}-file`} type="file" accept={UPLOAD_EXTENSIONS.join(',')} disabled={disabled} className="sr-only"
          onChange={e => { void choose(e.target.files?.[0]) }} />
        <label htmlFor={`${idPrefix}-file`}
          className="cursor-pointer rounded font-semibold text-purple-deep underline outline-none focus-within:ring-2 focus-within:ring-purple-accent/40">
          {value.file ? 'Choose a different file' : 'or choose a file (PDF, Word or .txt)'}
        </label>
        {value.textFileName && !value.file ? <span>Text read from {value.textFileName}.</span> : null}
        {!value.file && value.text.trim().length > 0 ? <span>{value.text.trim().length.toLocaleString('en-GB')} characters</span> : null}
      </div>
      {error || fileProblem ? <p id={`${idPrefix}-error`} role="alert" className="mt-1 text-[13px] font-medium text-red-700">{fileProblem ?? error}</p> : null}
    </div>
  )
}
