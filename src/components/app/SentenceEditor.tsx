import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, Loader2, RefreshCw, RotateCcw, X } from 'lucide-react'
import { humaniseApi } from '../../api/humanise'
import type { Tone } from '../../types'
import { cn } from '../../lib/utils'
import {
  acceptSentence, buildModel, countSentences, modelText, paragraphContext, replaceSentence, restoreSentence,
  sameText, sentences, type SentenceModel, type SentencePiece, type SentenceStatus,
} from '../../lib/sentenceEdit'

// The API refuses longer sentences; say so instead of sending a request that cannot succeed.
const MAX_SENTENCE_CHARS = 500

type Alternatives =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'ready'; items: string[] }

const STATUS_STYLE: Record<SentenceStatus, string> = {
  unchanged: 'hover:bg-gray-100',
  modified: 'bg-purple-50 hover:bg-purple-100 border-b border-dashed border-purple-300',
  accepted: 'bg-emerald-50 hover:bg-emerald-100 border-b border-emerald-300',
  restored: 'bg-gray-100 hover:bg-gray-200 border-b border-dotted border-gray-400',
}

const STATUS_LABEL: Record<SentenceStatus, string> = {
  unchanged: 'Unchanged from your text',
  modified: 'Changed from your text',
  accepted: 'Change accepted',
  restored: 'Your original wording restored',
}

interface SentenceEditorProps {
  /** The author's own text, used to find each sentence's original wording. */
  originalText: string
  /** The humanised text being edited. */
  outputText: string
  tone: Tone
  englishVariant: string
  /** Receives the whole updated text after every edit. */
  onChange: (text: string) => void
}

export function SentenceEditor({ originalText, outputText, tone, englishVariant, onChange }: SentenceEditorProps) {
  const [model, setModel] = useState<SentenceModel>(() => buildModel(originalText, outputText))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<Record<string, Alternatives>>({})
  const controllers = useRef(new Set<AbortController>())
  const lastOriginal = useRef(originalText)

  // A new humanise run, a restore, or an edit to the input replaces the text from outside: start again from it. Edits made
  // here come back through `outputText` unchanged, so they do not trigger this.
  useEffect(() => {
    if (outputText === modelText(model) && originalText === lastOriginal.current) return
    lastOriginal.current = originalText
    setModel(buildModel(originalText, outputText))
    setSelectedId(null)
    setAlternatives({})
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `model` is compared, not tracked
  }, [originalText, outputText])

  useEffect(() => {
    const live = controllers.current
    return () => { live.forEach((c) => c.abort()); live.clear() }
  }, [])

  const commit = useCallback((next: SentenceModel) => {
    setModel(next)
    onChange(modelText(next))
  }, [onChange])

  const items = sentences(model)
  const selected = items.find((s) => s.id === selectedId) ?? null
  const counts = countSentences(model)

  const generate = useCallback(async (piece: SentencePiece) => {
    if (piece.text.length > MAX_SENTENCE_CHARS) {
      setAlternatives((a) => ({ ...a, [piece.id]: { state: 'error', message: 'This sentence is too long for alternatives. Try a shorter one.' } }))
      return
    }
    const controller = new AbortController()
    controllers.current.add(controller)
    setAlternatives((a) => ({ ...a, [piece.id]: { state: 'loading' } }))
    try {
      const list = await humaniseApi.sentenceAlternatives({
        sentence: piece.text,
        surroundingContext: paragraphContext(model, piece.id),
        tone,
        originalSentence: piece.original ?? undefined,
        englishVariant,
      }, controller.signal)
      if (controller.signal.aborted) return
      setAlternatives((a) => ({ ...a, [piece.id]: { state: 'ready', items: list } }))
    } catch {
      if (controller.signal.aborted) return
      setAlternatives((a) => ({ ...a, [piece.id]: { state: 'error', message: "Couldn't generate alternatives. Try again." } }))
    } finally {
      controllers.current.delete(controller)
    }
  }, [model, tone, englishVariant])

  const choose = (piece: SentencePiece, text: string) => {
    commit(replaceSentence(model, piece.id, text))
    setAlternatives((a) => Object.fromEntries(Object.entries(a).filter(([id]) => id !== piece.id)))
  }

  const select = (id: string) => setSelectedId((current) => (current === id ? null : id))

  if (items.length === 0) return null

  const current = selected ? alternatives[selected.id] : undefined
  const differsFromOriginal = !!selected && selected.original !== null && !sameText(selected.text, selected.original)

  return (
    <div>
      <p className="text-[11px] text-text-mut mb-2">
        Click a sentence to review it. {counts.changed} of {counts.total} sentence{counts.total === 1 ? '' : 's'} changed
        {counts.restored > 0 ? `, ${counts.restored} restored` : ''}.
      </p>

      <div className="whitespace-pre-wrap text-[14px] leading-7 text-gray-800">
        {model.pieces.map((p, i) =>
          p.kind === 'gap' ? (
            <span key={`g${i}`}>{p.text}</span>
          ) : (
            <span
              key={p.id}
              role="button"
              tabIndex={0}
              aria-pressed={p.id === selectedId}
              aria-label={`${STATUS_LABEL[p.status]}: ${p.text}`}
              onClick={() => select(p.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(p.id) } }}
              className={cn(
                'cursor-pointer rounded-sm px-0.5 -mx-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-accent/60',
                STATUS_STYLE[p.status],
                p.id === selectedId && 'ring-2 ring-purple-accent/60',
              )}
            >
              {p.text}
            </span>
          ),
        )}
      </div>

      <p className="text-[11px] text-text-mut pt-3">
        <span className="inline-block w-2 h-2 rounded-sm bg-purple-100 mr-1" />Changed &nbsp;
        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-100 mr-1 ml-2" />Accepted &nbsp;
        <span className="inline-block w-2 h-2 rounded-sm bg-gray-200 mr-1 ml-2" />Original restored
      </p>

      {selected && (
        <section
          aria-label="Sentence review"
          className="sticky bottom-0 mt-4 rounded-xl border border-[#e0e0da] bg-white shadow-elevated p-3 text-[13px] space-y-2.5"
        >
          <header className="flex items-center justify-between">
            <span className="font-semibold text-gray-700">{STATUS_LABEL[selected.status]}</span>
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Close sentence review" className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </header>

          {differsFromOriginal && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-text-mut">Your original</p>
              <p className="text-gray-600">{selected.original}</p>
            </div>
          )}
          {selected.original === null && (
            <p className="text-[12px] text-text-mut">No matching sentence was found in your original, so there is nothing to restore here.</p>
          )}
          <div>
            <p className="text-[11px] uppercase tracking-wide text-text-mut">Now</p>
            <p className="text-gray-800">{selected.text}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generate(selected)}
              disabled={current?.state === 'loading'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-purple-accent text-purple-accent bg-purple-tint hover:text-purple-deep disabled:opacity-60"
            >
              {current?.state === 'loading' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {current?.state === 'ready' ? 'More alternatives' : 'Generate alternatives'}
            </button>
            {selected.status === 'modified' && (
              <button
                type="button"
                onClick={() => commit(acceptSentence(model, selected.id))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              >
                <Check size={12} /> Accept change
              </button>
            )}
            {differsFromOriginal && (
              <button
                type="button"
                onClick={() => commit(restoreSentence(model, selected.id))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                <RotateCcw size={12} /> Restore original
              </button>
            )}
          </div>

          {current?.state === 'error' && (
            <p className="flex items-center gap-1.5 text-[12px] text-red-600"><AlertCircle size={12} /> {current.message}</p>
          )}
          {current?.state === 'ready' && current.items.length === 0 && (
            <p className="text-[12px] text-text-mut">
              No safe alternatives this time. Every suggestion changed a number, citation, quotation, hedge or meaning, or repeated the sentence.
              You can try again.
            </p>
          )}
          {current?.state === 'ready' && current.items.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-text-mut mb-1">
                Alternatives (checked against your original: numbers, citations, quotations and hedges are kept)
              </p>
              <ul className="space-y-1.5">
                {current.items.map((text) => (
                  <li key={text} className="flex items-start justify-between gap-3 rounded-lg border border-[#e0e0da] p-2">
                    <span className="text-gray-800">{text}</span>
                    <button
                      type="button"
                      onClick={() => choose(selected, text)}
                      className="shrink-0 px-2 py-1 rounded-md text-[12px] font-semibold bg-purple-accent text-white hover:bg-purple-deep"
                    >
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
