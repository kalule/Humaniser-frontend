import { useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { ApiError } from '../../../types'
import type { SectionStatus } from '../../../types/research'
import { useResearchStore } from '../../../store/researchStore'
import { useSectionAutosave, type SaveFailure, type SaveState } from '../../../hooks/useSectionAutosave'
import { sectionEditorExtensions, stripLeadingHeadingLines } from './sectionEditorExtensions'

export interface SectionEditorProps {
  projectId: string
  code:      string
  content:   string
  editable:  boolean
  label:     string
  /** An approved section lost its approval through a material edit. */
  onDemoted: (code: string) => void
  /** Lets the view save this section before approving, exporting or switching view. */
  registerFlush: (code: string, flush: (() => Promise<boolean>) | null) => void
}

const SAVE_TEXT: Record<Exclude<SaveState, 'idle' | 'error'>, string> = {
  pending: 'Saving…',
  saving:  'Saving…',
  saved:   'Saved',
}

const statusOf = (projectId: string, code: string): SectionStatus | undefined =>
  useResearchStore.getState().sections[projectId]?.find(s => s.code === code)?.status

/**
 * One editor per section, mounted only while the section is near the viewport. Reads and writes
 * the same section record Guided uses, as the same markdown, and only writes after the student
 * types, so viewing a section never changes what is stored or exported.
 */
export function SectionEditor({ projectId, code, content, editable, label, onDemoted, registerFlush }: SectionEditorProps) {
  const initial = useRef(stripLeadingHeadingLines(content))
  // The markdown this editor last produced or loaded; store updates equal to it are our own echo.
  const lastKnown = useRef(content)
  const programmatic = useRef(false)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  // Show the stored text again, dropping local edits the server refused.
  const resyncFromStore = useCallback(() => {
    const stored = useResearchStore.getState().sections[projectId]?.find(s => s.code === code)?.content
    const editor = editorRef.current
    if (stored === undefined || !editor) return
    lastKnown.current = stored
    programmatic.current = true
    editor.commands.setContent(stripLeadingHeadingLines(stored), { emitUpdate: false })
    programmatic.current = false
  }, [projectId, code])

  const save = useCallback(async (markdown: string) => {
    const store = useResearchStore.getState()
    const before = statusOf(projectId, code)
    await store.saveSection(projectId, code, markdown)
    // A save returns the text it was given; if the student typed on meanwhile, put the newer
    // local text back so word counts and the other view do not step backwards.
    if (lastKnown.current !== markdown) useResearchStore.getState().updateSectionContent(projectId, code, lastKnown.current)
    if (before === 'Approved' && statusOf(projectId, code) !== 'Approved') onDemoted(code)
  }, [projectId, code, onDemoted])

  const onError = useCallback((err: unknown): SaveFailure => {
    const apiErr = err as ApiError | undefined
    if (apiErr?.code === 'SECTION_GENERATING') {
      toast.error(`${code} is being written, so your edit was not saved. You can edit it when the draft is finished.`)
      resyncFromStore()
      useResearchStore.getState().loadSections(projectId).then(resyncFromStore, () => {})
      return 'discard'
    }
    if (apiErr?.code === 'SECTION_EDIT_CONFLICT') {
      toast.error(`${code} changed elsewhere while you were editing, so your last change was not saved. Reloading the current text.`)
      useResearchStore.getState().loadSections(projectId).then(resyncFromStore, () => {})
      return 'discard'
    }
    return 'retry'
  }, [projectId, code, resyncFromStore])

  const autosave = useSectionAutosave({ save, onError })
  const { schedule, flush, hasUnsaved } = autosave

  const editor = useEditor({
    extensions: sectionEditorExtensions(),
    content: initial.current,
    editable,
    editorProps: { attributes: { 'aria-label': `${label} text`, role: 'textbox', 'aria-multiline': 'true' } },
    onUpdate: ({ editor: e }) => {
      if (programmatic.current) return
      const markdown = (e.storage as unknown as { markdown: { getMarkdown(): string } }).markdown.getMarkdown()
      lastKnown.current = markdown
      schedule(markdown)
    },
  })

  editorRef.current = editor

  // Text that changed elsewhere (Guided, a rewrite, a reload) flows in, unless the student has
  // edits here the server has not confirmed yet; those win until they are saved.
  useEffect(() => {
    if (!editor || content === lastKnown.current || hasUnsaved()) return
    lastKnown.current = content
    programmatic.current = true
    editor.commands.setContent(stripLeadingHeadingLines(content), { emitUpdate: false })
    programmatic.current = false
  }, [editor, content, hasUnsaved])

  useEffect(() => {
    if (!editor) return
    programmatic.current = true
    editor.setEditable(editable)
    programmatic.current = false
  }, [editor, editable])

  // Resolves true when everything typed here is saved.
  const flushAndReport = useCallback(async () => { await flush(); return !hasUnsaved() }, [flush, hasUnsaved])
  useEffect(() => {
    registerFlush(code, flushAndReport)
    return () => registerFlush(code, null)
  }, [code, registerFlush, flushAndReport])

  return (
    <div>
      <EditorContent editor={editor} className="dm-prose dm-editor" />
      <div className="h-5 flex justify-end items-center text-[11px]" aria-live="polite" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {autosave.state === 'error' ? (
          <span className="inline-flex items-center gap-1.5" style={{ color: 'var(--color-red-text)' }}>
            <AlertCircle size={11} aria-hidden="true" /> Not saved
            <button type="button" onClick={autosave.retry} className="dm-action font-semibold underline">Retry</button>
          </span>
        ) : autosave.state !== 'idle' && (
          <span className="inline-flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            {autosave.state === 'saved'
              ? <Check size={11} aria-hidden="true" style={{ color: 'var(--color-green)' }} />
              : <Loader2 size={11} className="animate-spin" aria-hidden="true" />}
            {SAVE_TEXT[autosave.state]}
          </span>
        )}
      </div>
    </div>
  )
}
