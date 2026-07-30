import { useState, useEffect, useCallback, useRef } from 'react'
import type { DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Brain, Loader2, Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight,
  RotateCw, CheckCircle, XCircle, Trophy, RefreshCw,
  Upload, FileText, X, BookOpen, ChevronDown, Layers,
  Sparkles, AlertTriangle, Check, RotateCcw,
} from 'lucide-react'
import { useFlashcard } from '../../hooks/useFlashcard'
import type { AssessmentItem, StudyDeck } from '../../types/flashcard'

type MasteryRating = 'unknown' | 'partial' | 'mastered'
type MasteryMap    = Record<string, MasteryRating>
type StudyMode     = 'flashcard' | 'mcq' | 'scenario' | 'all'
type ActiveView    = 'create' | 'study' | 'mcq'
type DeckFilter    = 'all' | 'ready' | 'error'

// ── Neutral palette (purple diet — see UX audit) ────────────────────────────────
// Only the primary "Generate study materials" button (and sidebar chrome) keeps purple.

const NEUTRAL_900 = '#171717'
const NEUTRAL_600 = '#525252'
const NEUTRAL_400 = '#a3a3a3'
const NEUTRAL_100 = '#f5f5f5'
const NEUTRAL_200 = '#e5e5e5'

// ── Utils ──────────────────────────────────────────────────────────────────────

function countWords(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0
}

// A raw filename/id string ("39005 1550 32097 1 10 2025...") reads as noise, not a title.
function isUnreadableTitle(title: string): boolean {
  const stripped = title.replace(/\.\.\.$/, '').trim()
  if (!stripped) return true
  const compact = stripped.replace(/\s+/g, '')
  const digitCount = (compact.match(/\d/g) ?? []).length
  return digitCount / compact.length > 0.5
}

function sanitizeTitle(rawTitle: string | null | undefined, createdAt: string): string {
  if (rawTitle && !isUnreadableTitle(rawTitle)) return rawTitle
  const date = new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `Document Draft (${date})`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function stableShuffle<T>(arr: T[], seed: string): T[] {
  const hash = seed.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
  const out  = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.abs((hash + i * 2654435761) % (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: StudyDeck['status'] | 'generating' }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ready:      { bg: '#d1fae5', color: '#065f46', label: 'Ready' },
    error:      { bg: '#fee2e2', color: '#991b1b', label: 'Error' },
    processing: { bg: '#ede9fe', color: '#5b21b6', label: 'Generating' },
    generating: { bg: '#ede9fe', color: '#5b21b6', label: 'Generating' },
  }
  const s = map[status] ?? { bg: '#f1f5f9', color: '#555555', label: status }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      background: s.bg, color: s.color, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ── Deck item (left panel) ─────────────────────────────────────────────────────

function DeckItem({ deck, isActive, onClick, onDelete, onRetry }: {
  deck: StudyDeck; isActive: boolean; onClick: () => void
  onDelete: () => void; onRetry: () => void
}) {
  const [hover, setHover]                 = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isError      = deck.status === 'error'
  const isProcessing = deck.status === 'processing'
  const displayTitle = sanitizeTitle(deck.title || deck.sourceName, deck.createdAt)

  const thumbnailBg     = isError ? '#fee2e2' : isActive ? NEUTRAL_100 : '#f1f5f9'
  const thumbnailBorder = isError ? '#fca5a5' : isActive ? NEUTRAL_400 : 'var(--border-hairline)'
  const thumbnailColor  = isError ? '#dc2626' : NEUTRAL_900
  const rowBg           = isActive ? NEUTRAL_100 : hover ? '#f8fafc' : 'transparent'

  return (
    <div
      role="button"
      aria-pressed={isActive}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirmDelete(false) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px',
        cursor: 'pointer',
        borderBottom: '0.5px solid #f1f5f9',
        background: rowBg,
        transition: 'background 0.1s ease',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 7, flexShrink: 0,
        background: thumbnailBg,
        border: `0.5px solid ${thumbnailBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: thumbnailColor,
      }}>
        {isError
          ? <AlertCircle size={16} />
          : isProcessing
          ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
          : <Brain size={16} />
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }} title={displayTitle}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: 'var(--text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {displayTitle}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {isError
            ? `${relativeTime(deck.createdAt)} · Failed`
            : isProcessing
            ? 'Generating…'
            : `${deck.itemCount} items · ${relativeTime(deck.createdAt)}`
          }
        </div>
      </div>

      {hover && !isProcessing ? (
        confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onDelete()}
              style={{
                fontSize: 10, fontWeight: 600, padding: '3px 7px', borderRadius: 5,
                background: '#fee2e2', border: '0.5px solid #fca5a5', color: '#dc2626', cursor: 'pointer',
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ fontSize: 10, padding: '3px 5px', borderRadius: 5, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            {isError && (
              <button
                onClick={e => { e.stopPropagation(); onRetry() }}
                title="Retry generation"
                style={{
                  width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: NEUTRAL_600, cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              title="Delete deck"
              style={{
                width: 22, height: 22, borderRadius: 5, border: 'none', background: 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: NEUTRAL_600, cursor: 'pointer',
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        )
      ) : (
        <StatusBadge status={deck.status} />
      )}
    </div>
  )
}

// ── Left panel ─────────────────────────────────────────────────────────────────

const DECK_FILTERS: { id: DeckFilter; label: string }[] = [
  { id: 'all',   label: 'All' },
  { id: 'ready', label: 'Ready' },
  { id: 'error', label: 'Errors' },
]

function DeckListPanel({ decks, activeDeck, onSelectDeck, onNewDeck, onDeleteDeck, onRetryDeck }: {
  decks: StudyDeck[]
  activeDeck: StudyDeck | null
  onSelectDeck: (deck: StudyDeck) => void
  onNewDeck: () => void
  onDeleteDeck: (id: string) => void
  onRetryDeck: (id: string) => void
}) {
  const [filter, setFilter] = useState<DeckFilter>('all')
  const errorCount = decks.filter(d => d.status === 'error').length
  const readyCount = decks.filter(d => d.status === 'ready').length
  const visibleDecks = decks.filter(d => filter === 'all' || d.status === filter)

  return (
    <div style={{
      width: 280, flexShrink: 0,
      background: '#ffffff',
      borderRight: '0.5px solid var(--border-hairline)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Pinned header */}
      <div style={{
        padding: '14px 14px 12px',
        borderBottom: '0.5px solid var(--border-hairline)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7,
        }}>
          Your decks
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{decks.length} deck{decks.length !== 1 ? 's' : ''}</strong>
          {' · '}{readyCount} ready
          {errorCount > 0 && (
            <span style={{ color: 'var(--color-red)' }}>, {errorCount} with errors</span>
          )}
        </div>
        <button
          onClick={onNewDeck}
          style={{
            width: '100%', height: 32,
            background: '#ffffff', color: NEUTRAL_900,
            border: `1px solid ${NEUTRAL_200}`, borderRadius: 8,
            fontSize: 12, fontWeight: 500,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Plus size={13} />
          Generate new deck
        </button>

        {decks.length > 0 && (
          <div style={{ display: 'flex', gap: 2, padding: 2, background: NEUTRAL_100, borderRadius: 7, marginTop: 10 }}>
            {DECK_FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 5, border: 'none',
                  fontSize: 11, fontWeight: 500, cursor: 'pointer',
                  background: filter === f.id ? NEUTRAL_900 : 'transparent',
                  color: filter === f.id ? '#ffffff' : NEUTRAL_600,
                  transition: 'all 0.1s ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {decks.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 16px', gap: 8, textAlign: 'center',
          }}>
            <Brain size={22} style={{ color: 'var(--text-disabled)' }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              No decks yet. Generate one to get started.
            </p>
          </div>
        ) : visibleDecks.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '40px 16px', gap: 8, textAlign: 'center',
          }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              No {filter} decks.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {visibleDecks.map(deck => (
              <motion.div
                key={deck.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <DeckItem
                  deck={deck}
                  isActive={activeDeck?.id === deck.id}
                  onClick={() => onSelectDeck(deck)}
                  onDelete={() => onDeleteDeck(deck.id)}
                  onRetry={() => onRetryDeck(deck.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

// ── Generate options (checkbox pills) ─────────────────────────────────────────

const OPTION_TYPES = [
  { key: 'flashcard', label: 'Flashcards' },
  { key: 'mcq',       label: 'MCQs' },
  { key: 'scenario',  label: 'Scenario / Case Study' },
] as const

interface GenOptions { flashcard: boolean; mcq: boolean; scenario: boolean }

function GenerateOptions({ options, onChange }: {
  options: GenOptions; onChange: (o: GenOptions) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          Generate
        </span>
        {OPTION_TYPES.map(opt => {
          const checked = options[opt.key]
          return (
            <button
              key={opt.key}
              onClick={() => onChange({ ...options, [opt.key]: !checked })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 16,
                border: `0.5px solid ${checked ? NEUTRAL_900 : 'var(--border-strong)'}`,
                background: checked ? NEUTRAL_900 : '#ffffff',
                cursor: 'pointer', fontSize: 12,
                color: checked ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.1s ease',
              }}
            >
              {checked ? (
                <Check size={12} style={{ flexShrink: 0 }} />
              ) : (
                <span style={{
                  width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                  border: '1.5px solid var(--border-strong)',
                }} />
              )}
              {opt.label}
            </button>
          )
        })}
      </div>
      {options.scenario && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          Scenario / Case Study generates longer-form questions.
        </p>
      )}
    </div>
  )
}

// ── Error banner ───────────────────────────────────────────────────────────────

function ErrorBanner({ count, onRetryAll, onDismiss }: { count: number; onRetryAll: () => void; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--color-red-tint)',
        border: '0.5px solid #fca5a5',
        borderRadius: 8,
        padding: '10px 14px',
        display: 'flex', alignItems: 'flex-start', gap: 8,
        marginBottom: 16,
      }}
    >
      <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-red-text)' }}>
          {count} {count === 1 ? 'deck' : 'decks'} failed to generate
        </div>
        <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 2, lineHeight: 1.5 }}>
          The document may have exceeded 12,000 words or contained unsupported content. Retry with a shorter extract.
        </div>
        <button
          onClick={onRetryAll}
          style={{
            fontSize: 11, color: NEUTRAL_900, fontWeight: 500,
            background: 'none', border: 'none',
            textDecoration: 'underline', cursor: 'pointer',
            padding: 0, marginTop: 4,
          }}
        >
          Retry all failed decks
        </button>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
          border: 'none', background: 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#b91c1c', cursor: 'pointer',
        }}
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ── Create view ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.pdf,.docx,.pptx,.txt,.md'
type InputMode = 'upload' | 'paste'
interface Extracted { text: string; filename: string; wordCount: number }

function CreateView({ isGenerating, errorCount, onGenerate, onExtractDocument, onRetryAll }: {
  isGenerating: boolean
  errorCount: number
  onGenerate: (title: string, text: string, types: string[], sourceName?: string) => void
  onExtractDocument: (file: File) => Promise<Extracted>
  onRetryAll: () => void
}) {
  const [mode, setMode]               = useState<InputMode>('upload')
  const [title, setTitle]             = useState('')
  const [text, setText]               = useState('')
  const [options, setOptions]         = useState<GenOptions>({ flashcard: true, mcq: true, scenario: false })
  const [extracted, setExtracted]     = useState<Extracted | null>(null)
  const [isExtracting, setExtracting] = useState(false)
  const [dragOver, setDragOver]       = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const prevErrorCount = useRef(errorCount)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (errorCount > prevErrorCount.current) setBannerDismissed(false)
    prevErrorCount.current = errorCount
  }, [errorCount])

  const wc         = extracted ? extracted.wordCount : countWords(text)
  const wcOver     = wc > 12000
  const activeText = extracted ? extracted.text : text
  const canSubmit  = !isGenerating && !!title.trim() && !!activeText.trim() && !wcOver && (options.flashcard || options.mcq || options.scenario)

  const handleFile = async (file: File) => {
    setExtractError(null)
    setExtracting(true)
    try {
      const result = await onExtractDocument(file)
      setExtracted(result)
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Failed to extract text from file.'
      setExtractError(msg)
    } finally {
      setExtracting(false)
    }
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }

  const submit = () => {
    if (!canSubmit) return
    const types = [
      ...(options.flashcard ? ['flashcard'] : []),
      ...(options.mcq       ? ['mcq']       : []),
      ...(options.scenario  ? ['scenario']  : []),
    ]
    onGenerate(title.trim(), activeText.trim(), types, extracted?.filename)
    setTitle(''); setText(''); setExtracted(null)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {errorCount > 0 && !bannerDismissed && (
          <ErrorBanner count={errorCount} onRetryAll={onRetryAll} onDismiss={() => setBannerDismissed(true)} />
        )}

        {/* Create card */}
        <div style={{
          background: '#ffffff',
          border: '0.5px solid var(--border-hairline)',
          borderRadius: 12,
          padding: '18px 20px',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16,
          }}>
            <Sparkles size={16} style={{ color: NEUTRAL_900 }} />
            Generate study materials
          </div>

          {/* Mode selector — inline neutral pill (Settings Selector pattern) */}
          <div style={{ marginBottom: 14 }}>
            <span style={{
              display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
            }}>
              Generate from
            </span>
            <div style={{ display: 'inline-flex', gap: 2, padding: 2, background: NEUTRAL_100, borderRadius: 8 }}>
              {([
                { id: 'upload' as InputMode, label: 'Upload document' },
                { id: 'paste'  as InputMode, label: 'Paste raw text' },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => { setMode(id); setExtracted(null); setExtractError(null); setText('') }}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: mode === id ? NEUTRAL_900 : 'transparent',
                    color: mode === id ? '#ffffff' : NEUTRAL_600,
                    transition: 'all 0.1s ease',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Upload zone */}
          {mode === 'upload' && (
            <div style={{ marginBottom: 14 }}>
              {extracted ? (
                <div style={{
                  borderRadius: 10, border: `0.5px solid ${wcOver ? '#fca5a5' : '#6ee7b7'}`,
                  background: wcOver ? 'var(--color-red-tint)' : '#ecfdf5', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: wcOver ? '#fee2e2' : '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <FileText size={16} style={{ color: wcOver ? '#dc2626' : '#059669' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: wcOver ? '#991b1b' : '#065f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{extracted.filename}</div>
                    <div style={{ fontSize: 11, color: wcOver ? '#b91c1c' : '#10b981', marginTop: 1 }}>
                      {wcOver
                        ? `${extracted.wordCount.toLocaleString()} words — exceeds the 12,000-word limit. Trim or extract a shorter section.`
                        : `${extracted.wordCount.toLocaleString()} words extracted`
                      }
                    </div>
                  </div>
                  <button
                    onClick={() => { setExtracted(null); setExtractError(null) }}
                    style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: wcOver ? '#fee2e2' : '#d1fae5', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: wcOver ? '#dc2626' : '#059669',
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `1.5px dashed ${dragOver ? NEUTRAL_900 : 'var(--border-strong)'}`,
                      borderRadius: 10, padding: '28px 16px', textAlign: 'center',
                      cursor: 'pointer', background: dragOver ? NEUTRAL_100 : '#ffffff',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = NEUTRAL_900
                      e.currentTarget.style.background = NEUTRAL_100
                    }}
                    onMouseLeave={e => {
                      if (!dragOver) {
                        e.currentTarget.style.borderColor = 'var(--border-strong)'
                        e.currentTarget.style.background = '#ffffff'
                      }
                    }}
                  >
                    {isExtracting ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <Loader2 size={24} style={{ color: NEUTRAL_600, animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Extracting text…</p>
                      </div>
                    ) : (
                      <>
                        <Upload size={22} style={{ color: NEUTRAL_600, margin: '0 auto 8px' }} />
                        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                          Drag &amp; drop or <span style={{ color: NEUTRAL_900, textDecoration: 'underline' }}>browse</span>
                        </p>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 6 }}>PDF · DOCX · PPTX · TXT · MD · max 12,000 words</p>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) void handleFile(file)
                    e.target.value = ''
                  }} />
                  {extractError && <p style={{ marginTop: 6, fontSize: 12, color: 'var(--color-red)' }}>{extractError}</p>}
                </>
              )}
            </div>
          )}

          {/* Paste zone */}
          {mode === 'paste' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Source text
                </label>
                <span style={{ fontSize: 11, color: wcOver ? 'var(--color-red)' : wc > 10000 ? '#d97706' : 'var(--text-muted)', fontWeight: 500 }}>
                  {wc.toLocaleString()} / 12,000 words
                </span>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your study notes, textbook excerpt, or lecture transcript here…"
                rows={9}
                style={{
                  width: '100%', resize: 'none',
                  border: `0.5px solid ${wcOver ? 'var(--color-red)' : 'var(--border-strong)'}`,
                  borderRadius: 8, padding: '10px 12px',
                  fontSize: 13, color: 'var(--text-primary)',
                  background: '#ffffff', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit',
                }}
              />
              {wcOver && <p style={{ fontSize: 11, color: 'var(--color-red)', marginTop: 4 }}>Text exceeds 12,000 words. Please shorten it.</p>}
            </div>
          )}

          {/* Deck title */}
          <div style={{ marginBottom: 14 }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5,
            }}>
              Deck title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Object-oriented design patterns"
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              style={{
                width: '100%', height: 36,
                border: '0.5px solid var(--border-strong)',
                borderRadius: 8, padding: '0 10px',
                fontSize: 13, color: 'var(--text-primary)',
                background: '#fff', outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={e => { e.target.style.borderColor = 'var(--color-purple)'; e.target.style.boxShadow = '0 0 0 3px var(--color-purple-tint)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border-strong)'; e.target.style.boxShadow = 'none' }}
            />
          </div>

          <GenerateOptions options={options} onChange={setOptions} />

          {/* Generate button */}
          <button
            onClick={submit}
            disabled={!canSubmit}
            aria-disabled={!canSubmit}
            aria-busy={isGenerating}
            style={{
              width: '100%', height: 40,
              background: !canSubmit ? NEUTRAL_100 : 'var(--color-purple)',
              color: !canSubmit ? NEUTRAL_400 : '#ffffff',
              border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 500,
              cursor: !canSubmit ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              transition: 'background 0.15s ease',
            }}
          >
            {isGenerating
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><Sparkles size={15} /> Generate study materials</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Processing view ────────────────────────────────────────────────────────────

function ProcessingView({ deck }: { deck: StudyDeck }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%', position: 'relative',
        background: 'var(--color-purple-tint)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader2 size={28} style={{ color: 'var(--color-purple)', animation: 'spin 1s linear infinite' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{sanitizeTitle(deck.title || deck.sourceName, deck.createdAt)}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Generating your study materials…</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Claude is extracting concepts and building your cards. This may take a minute.</p>
      </div>
    </div>
  )
}

// ── Error view (selected deck with error status) ───────────────────────────────

function ErrorView({ deck, onRetry }: { deck: StudyDeck; onRetry: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      <div style={{
        width: 60, height: 60, borderRadius: 16,
        background: 'var(--color-red-tint)', border: '0.5px solid #fca5a5',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <AlertTriangle size={26} style={{ color: '#dc2626' }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{sanitizeTitle(deck.title || deck.sourceName, deck.createdAt)}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Generation failed</p>
        {deck.errorMessage && (
          <p style={{
            fontSize: 12, color: '#b91c1c', marginTop: 10,
            background: 'var(--color-red-tint)', border: '0.5px solid #fca5a5',
            borderRadius: 8, padding: '10px 14px', textAlign: 'left', lineHeight: 1.6,
          }}>
            {deck.errorMessage}
          </p>
        )}
      </div>
      <button
        onClick={onRetry}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '8px 18px', borderRadius: 8,
          background: 'var(--color-purple)', color: '#fff',
          border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <RotateCw size={14} /> Retry generation
      </button>
    </div>
  )
}

// ── Flashcard (3D flip) — light theme ─────────────────────────────────────────

function FlashCardItem({ item, onRate }: { item: AssessmentItem; onRate: (r: MasteryRating) => void }) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => { setFlipped(false) }, [item.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); setFlipped(v => !v) }
      if (!flipped) return
      if (e.key === '1') onRate('unknown')
      if (e.key === '2') onRate('partial')
      if (e.key === '3') onRate('mastered')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flipped, onRate])

  return (
    <div className="flex flex-col gap-4 select-none">
      <div className="relative h-64 cursor-pointer" style={{ perspective: '1200px' }} onClick={() => setFlipped(v => !v)}>
        <div
          className="w-full h-full transition-all duration-500"
          style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)' }}
        >
          {/* Front */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <div style={{
              width: '100%', height: '100%',
              borderRadius: 16, background: '#ffffff',
              border: '0.5px solid var(--border-hairline)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 28, gap: 12, position: 'relative',
            }}>
              <span style={{ fontSize: 10, color: 'var(--color-purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Question</span>
              <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'center', lineHeight: 1.6 }}>{item.prompt}</p>
              <div style={{ position: 'absolute', bottom: 16, fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-purple-tint)', display: 'inline-block' }} />
                Click to reveal answer
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-purple-tint)', display: 'inline-block' }} />
              </div>
            </div>
          </div>
          {/* Back */}
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            <div style={{
              width: '100%', height: '100%',
              borderRadius: 16, background: 'var(--color-purple-tint)',
              border: '0.5px solid #c4b5fd',
              boxShadow: '0 2px 12px rgba(124,58,237,0.08)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: 28, gap: 12,
            }}>
              <span style={{ fontSize: 10, color: 'var(--color-purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Answer</span>
              <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-purple-text)', textAlign: 'center', lineHeight: 1.6 }}>{item.correctAnswer}</p>
              {item.explanation && (
                <p style={{
                  fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6,
                  borderTop: '0.5px solid #c4b5fd', paddingTop: 14, marginTop: 4, maxWidth: 400,
                }}>{item.explanation}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {flipped && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2 }} className="flex flex-col gap-2">
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>How well did you know this?</p>
            <div className="flex items-stretch gap-2">
              <button onClick={() => onRate('unknown')} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 10, border: '0.5px solid #fca5a5',
                background: '#fee2e2', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                <XCircle size={14} /> Don't Know
              </button>
              <button onClick={() => onRate('partial')} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 10, border: '0.5px solid #fcd34d',
                background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                ⚡ Partial
              </button>
              <button onClick={() => onRate('mastered')} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px 0', borderRadius: 10, border: '0.5px solid #6ee7b7',
                background: '#d1fae5', color: '#065f46', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                <CheckCircle size={14} /> Know It
              </button>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
              Keyboard: <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>1</kbd> Don't Know&nbsp;
              <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>2</kbd> Partial&nbsp;
              <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>3</kbd> Know It
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {!flipped && (
        <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
          <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>Space</kbd> to flip&nbsp;
          <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>←</kbd>
          <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>→</kbd> to navigate
        </p>
      )}
    </div>
  )
}

// ── MCQ item — light theme ─────────────────────────────────────────────────────

function McqItem({ item, onRate }: { item: AssessmentItem; onRate: (r: MasteryRating) => void }) {
  const [selected,  setSelected]  = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSelected(null); setSubmitted(false)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [item.id])

  const options = stableShuffle([item.correctAnswer, ...(item.distractors ?? [])], item.id)

  const handleSubmit = () => {
    if (!selected || submitted) return
    setSubmitted(true)
    const isCorrect = selected === item.correctAnswer
    timerRef.current = setTimeout(() => onRate(isCorrect ? 'mastered' : 'unknown'), 1500)
  }

  return (
    <div style={{
      background: '#ffffff', border: '0.5px solid var(--border-hairline)',
      borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px 22px',
    }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 16 }}>{item.prompt}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map((opt, idx) => {
          const isChosen  = selected === opt
          const isCorrect = opt === item.correctAnswer
          let bg = '#ffffff', border = 'var(--border-hairline)', color = 'var(--text-primary)'
          let icon: React.ReactNode = null
          if (!submitted) {
            if (isChosen) { bg = 'var(--color-purple-tint)'; border = '#c4b5fd'; color = 'var(--color-purple-text)' }
          } else if (isCorrect) {
            bg = '#d1fae5'; border = '#6ee7b7'; color = '#065f46'
            icon = <CheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
          } else if (isChosen) {
            bg = '#fee2e2'; border = '#fca5a5'; color = '#991b1b'
            icon = <XCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          } else {
            color = 'var(--text-muted)'
          }
          return (
            <button key={idx} onClick={() => { if (!submitted) setSelected(opt) }} disabled={submitted}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 9,
                border: `0.5px solid ${border}`, background: bg, color,
                fontSize: 13, textAlign: 'left', cursor: submitted ? 'not-allowed' : 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${isChosen || (submitted && isCorrect) ? 'var(--color-purple)' : 'var(--border-strong)'}`,
                background: (isChosen && !submitted) ? 'var(--color-purple)' : submitted && isCorrect ? '#10b981' : submitted && isChosen ? '#ef4444' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.1s ease',
              }}>
                {(isChosen || (submitted && isCorrect)) && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
              </span>
              <span style={{ flex: 1, lineHeight: 1.4 }}>{opt}</span>
              {icon}
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {selected && !submitted && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ marginTop: 12 }}>
            <button onClick={handleSubmit} style={{
              width: '100%', padding: '10px 0', borderRadius: 9,
              background: 'var(--color-purple)', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              Submit Answer
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {submitted && item.explanation && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
            style={{ marginTop: 12, background: '#f8fafc', border: '0.5px solid var(--border-hairline)', borderRadius: 8, padding: '10px 14px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Explanation: </span>{item.explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Scenario card — light theme ────────────────────────────────────────────────

function ScenarioCardItem({ item, onRate }: { item: AssessmentItem; onRate: (r: MasteryRating) => void }) {
  const [revealed,     setRevealed]     = useState(false)
  const [stepsOpen,    setStepsOpen]    = useState(false)
  const [deepDiveOpen, setDeepDiveOpen] = useState(false)
  const sa = item.scenarioAnswer

  useEffect(() => { setRevealed(false); setStepsOpen(false); setDeepDiveOpen(false) }, [item.id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === ' ') { e.preventDefault(); if (!revealed) setRevealed(true) }
      if (!revealed) return
      if (e.key === '1') onRate('unknown')
      if (e.key === '2') onRate('partial')
      if (e.key === '3') onRate('mastered')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, onRate])

  const summaryText = sa?.summaryConclusion ?? item.correctAnswer

  return (
    <div style={{
      background: '#ffffff', border: '0.5px solid #e9d5ff',
      borderRadius: 14, boxShadow: '0 2px 12px rgba(124,58,237,0.05)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--color-purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Scenario Question</span>
          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--color-purple-tint)', color: 'var(--color-purple-text)', fontWeight: 500 }}>Case Study</span>
        </div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.6 }}>{item.prompt}</p>
      </div>

      {!revealed ? (
        <div style={{ padding: '0 22px 20px' }}>
          <button onClick={() => setRevealed(true)} style={{
            width: '100%', padding: '10px 0', borderRadius: 9,
            background: 'var(--color-purple)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            Reveal Answer
          </button>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
            <kbd style={{ padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', fontSize: 10 }}>Space</kbd> to reveal
          </p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
          style={{ borderTop: '0.5px solid #e9d5ff' }}>
          <div style={{ padding: '16px 22px' }}>
            <div style={{ fontSize: 10, color: 'var(--color-purple)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>Summary Verdict</div>
            <p style={{ fontSize: 14, color: 'var(--color-purple-text)', lineHeight: 1.6, fontWeight: 500 }}>{summaryText}</p>
          </div>

          <div style={{ padding: '0 22px 16px' }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8 }}>How did you do?</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onRate('unknown')} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 0', borderRadius: 9, border: '0.5px solid #fca5a5',
                background: '#fee2e2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                <XCircle size={14} /><span>Missed It</span>
              </button>
              <button onClick={() => onRate('partial')} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 0', borderRadius: 9, border: '0.5px solid #fcd34d',
                background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                <span style={{ fontSize: 14 }}>⚡</span><span>Core Steps</span>
              </button>
              <button onClick={() => onRate('mastered')} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 0', borderRadius: 9, border: '0.5px solid #6ee7b7',
                background: '#d1fae5', color: '#065f46', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>
                <CheckCircle size={14} /><span>Nailed It</span>
              </button>
            </div>
          </div>

          {sa && (sa.criticalEvaluationSteps?.length ?? 0) > 0 && (
            <div style={{ borderTop: '0.5px solid #f1f5f9' }}>
              <button onClick={() => setStepsOpen(v => !v)} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 22px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <Layers size={13} style={{ color: 'var(--color-purple)' }} />
                  Critical Evaluation Steps
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({sa.criticalEvaluationSteps?.length ?? 0})</span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: stepsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <AnimatePresence initial={false}>
                {stepsOpen && (
                  <motion.div key="steps" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '4px 22px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(sa.criticalEvaluationSteps ?? []).map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            background: 'var(--color-purple-tint)', border: '0.5px solid #c4b5fd',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, color: 'var(--color-purple)',
                          }}>{i + 1}</span>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>{step}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {sa?.deepDiveExplanation && (
            <div style={{ borderTop: '0.5px solid #f1f5f9' }}>
              <button onClick={() => setDeepDiveOpen(v => !v)} style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 22px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <BookOpen size={13} style={{ color: 'var(--color-purple)' }} />
                  Full Explanation
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: deepDiveOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              <AnimatePresence initial={false}>
                {deepDiveOpen && (
                  <motion.div key="deepdive" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '4px 22px 20px' }}>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{sa.deepDiveExplanation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}

// ── Session summary — light theme ──────────────────────────────────────────────

function SessionSummary({ total, mastery, onRestart, onReviewWeak }: {
  total: number; mastery: MasteryMap; onRestart: () => void; onReviewWeak: () => void
}) {
  const mastered = Object.values(mastery).filter(v => v === 'mastered').length
  const partial  = Object.values(mastery).filter(v => v === 'partial').length
  const unknown  = Object.keys(mastery).length - mastered - partial
  const pct      = total > 0 ? Math.round((mastered / total) * 100) : 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'var(--color-purple-tint)', border: '0.5px solid #c4b5fd',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Trophy size={32} style={{ color: 'var(--color-purple)' }} />
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Session Complete!</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>You reviewed all {total} cards.</p>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'Mastered',   count: mastered, bg: '#d1fae5', border: '#6ee7b7', color: '#065f46' },
          { label: 'Partial',    count: partial,  bg: '#fef3c7', border: '#fcd34d', color: '#92400e' },
          { label: "Don't Know", count: unknown,  bg: '#fee2e2', border: '#fca5a5', color: '#991b1b' },
        ].map(({ label, count, bg, border, color }) => (
          <div key={label} style={{ background: bg, border: `0.5px solid ${border}`, borderRadius: 12, padding: '14px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 24, fontWeight: 700, color }}>{count}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</p>
          </div>
        ))}
      </div>
      <div style={{ width: '100%', maxWidth: 280 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mastery score</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-purple)' }}>{pct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', borderRadius: 4, background: 'var(--color-purple)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        {unknown + partial > 0 && (
          <button onClick={onReviewWeak} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8,
            border: '0.5px solid #fcd34d', background: '#fef3c7', color: '#92400e',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>
            <RefreshCw size={14} /> Review Weak ({unknown + partial})
          </button>
        )}
        <button onClick={onRestart} style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8,
          background: 'var(--color-purple)', color: '#fff',
          border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
        }}>
          <RotateCw size={14} /> Restart Deck
        </button>
      </div>
    </div>
  )
}

// ── Study panel — light theme ──────────────────────────────────────────────────

function StudyPanel({ deck, studyIndex, studyMode, onDelete, onIndexChange, onModeChange, onAllMastered }: {
  deck: StudyDeck; studyIndex: number; studyMode: StudyMode
  onDelete: (id: string) => void; onIndexChange: (i: number) => void
  onModeChange: (m: StudyMode) => void; onAllMastered: (deckId: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mastery, setMastery]             = useState<MasteryMap>({})
  const [sessionDone, setSessionDone]     = useState(false)
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const items         = deck.items ?? []
  const filtered      = items.filter(i => studyMode === 'all' || i.itemType === studyMode)
  const total         = filtered.length
  const current       = filtered[studyIndex] ?? null
  const flashCount    = items.filter(i => i.itemType === 'flashcard').length
  const mcqCount      = items.filter(i => i.itemType === 'mcq').length
  const scenarioCount = items.filter(i => i.itemType === 'scenario').length
  const masteredCount = filtered.filter(i => mastery[i.id] === 'mastered').length
  const masteryPct    = total > 0 ? (masteredCount / total) * 100 : 0

  const MODES: { id: StudyMode; label: string }[] = [
    { id: 'all',       label: `All (${items.length})` },
    { id: 'flashcard', label: `Cards (${flashCount})` },
    { id: 'mcq',       label: `MCQs (${mcqCount})` },
    ...(scenarioCount > 0 ? [{ id: 'scenario' as StudyMode, label: `Scenario (${scenarioCount})` }] : []),
  ]

  const goNext = useCallback(() => {
    if (studyIndex < total - 1) onIndexChange(studyIndex + 1)
    else setSessionDone(true)
  }, [studyIndex, total, onIndexChange])

  const goPrev = useCallback(() => { onIndexChange(Math.max(0, studyIndex - 1)) }, [studyIndex, onIndexChange])

  const handleRate = useCallback((itemId: string, rating: MasteryRating) => {
    setMastery(prev => {
      const next     = { ...prev, [itemId]: rating }
      const allItems = items.filter(i => studyMode === 'all' || i.itemType === studyMode)
      const allDone  = allItems.every(i => (i.id === itemId ? rating : next[i.id]) === 'mastered')
      if (allDone && studyMode === 'all') onAllMastered(deck.id)
      return next
    })
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current)
    advanceTimerRef.current = setTimeout(goNext, 600)
  }, [goNext, items, studyMode, deck.id, onAllMastered])

  const handleRestart    = useCallback(() => { setMastery({}); setSessionDone(false); onIndexChange(0) }, [onIndexChange])
  const handleReviewWeak = useCallback(() => { setMastery({}); setSessionDone(false); onIndexChange(0) }, [onIndexChange])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev() }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPrev, goNext])

  useEffect(() => () => { if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current) }, [])
  useEffect(() => { setSessionDone(false); setMastery({}) }, [deck.id, studyMode])

  if (sessionDone) return <SessionSummary total={total} mastery={mastery} onRestart={handleRestart} onReviewWeak={handleReviewWeak} />

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        padding: '10px 20px', borderBottom: '0.5px solid var(--border-hairline)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap',
        background: '#fafaf8',
      }}>
        <div style={{ flex: 1, minWidth: 0 }} title={sanitizeTitle(deck.title || deck.sourceName, deck.createdAt)}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sanitizeTitle(deck.title || deck.sourceName, deck.createdAt)}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            {[flashCount > 0 && `${flashCount} card${flashCount !== 1 ? 's' : ''}`, mcqCount > 0 && `${mcqCount} MCQ${mcqCount !== 1 ? 's' : ''}`, scenarioCount > 0 && `${scenarioCount} scenario${scenarioCount !== 1 ? 's' : ''}`].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div style={{
          display: 'flex', gap: 2, padding: 3,
          background: '#f1f5f9', borderRadius: 8, border: '0.5px solid var(--border-hairline)',
        }}>
          {MODES.map(m => (
            <button key={m.id}
              onClick={() => { onModeChange(m.id); onIndexChange(0); setSessionDone(false); setMastery({}) }}
              style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, border: 'none', cursor: 'pointer',
                background: studyMode === m.id ? '#ffffff' : 'transparent',
                color: studyMode === m.id ? 'var(--color-purple)' : 'var(--text-muted)',
                boxShadow: studyMode === m.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.1s ease',
              }}
            >{m.label}</button>
          ))}
        </div>

        {confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Delete deck?</span>
            <button onClick={() => onDelete(deck.id)} style={{
              padding: '4px 10px', borderRadius: 6, background: '#fee2e2', border: '0.5px solid #fca5a5',
              color: '#dc2626', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            }}>Delete</button>
            <button onClick={() => setConfirmDelete(false)} style={{
              padding: '4px 8px', borderRadius: 6, background: 'none', border: 'none',
              color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
            }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
          }}>
            <Trash2 size={13} /> Delete
          </button>
        )}
      </div>

      {/* Progress */}
      <div style={{ padding: '12px 20px 8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Progress <strong style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{studyIndex + 1} / {total}</strong>
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-purple)' }}>{masteredCount} / {total} mastered</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: '#f1f5f9', overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, right: `${100 - ((studyIndex + 1) / Math.max(total, 1)) * 100}%`, background: '#e2e8f0', borderRadius: 3, transition: 'right 0.3s ease' }} />
          <motion.div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, background: 'var(--color-purple)', borderRadius: 3 }} animate={{ width: `${masteryPct}%` }} transition={{ duration: 0.4, ease: 'easeOut' }} />
        </div>
        <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
          {filtered.map((item, idx) => (
            <div key={item.id} style={{
              flex: 1, height: 3, borderRadius: 2, transition: 'background 0.3s ease',
              background: mastery[item.id] === 'mastered' ? '#10b981'
                : mastery[item.id] === 'partial'  ? '#f59e0b'
                : mastery[item.id] === 'unknown'  ? '#ef444499'
                : idx <= studyIndex               ? '#c4b5fd'
                : '#e2e8f0',
            }} />
          ))}
        </div>
      </div>

      {/* Card area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px 20px' }}>
        {filtered.length === 0 ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No items match this filter.</p>
          </div>
        ) : current ? (
          <div style={{ maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <AnimatePresence mode="wait">
              <motion.div key={current.id} initial={{ opacity: 0, x: 20, scale: 0.98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -20, scale: 0.98 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                {current.itemType === 'flashcard' ? (
                  <FlashCardItem item={current} onRate={(r) => handleRate(current.id, r)} />
                ) : current.itemType === 'scenario' ? (
                  <ScenarioCardItem item={current} onRate={(r) => handleRate(current.id, r)} />
                ) : (
                  <McqItem item={current} onRate={(r) => handleRate(current.id, r)} />
                )}
              </motion.div>
            </AnimatePresence>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button onClick={goPrev} disabled={studyIndex === 0} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: '0.5px solid var(--border-hairline)', background: '#ffffff',
                fontSize: 12, color: studyIndex === 0 ? 'var(--text-disabled)' : 'var(--text-secondary)',
                cursor: studyIndex === 0 ? 'not-allowed' : 'pointer',
              }}>
                <ChevronLeft size={15} /> Previous
              </button>

              {mastery[current.id] && (
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 14,
                  background: mastery[current.id] === 'mastered' ? '#d1fae5' : mastery[current.id] === 'partial' ? '#fef3c7' : '#fee2e2',
                  color: mastery[current.id] === 'mastered' ? '#065f46' : mastery[current.id] === 'partial' ? '#92400e' : '#991b1b',
                }}>
                  {mastery[current.id] === 'mastered'
                    ? (current.itemType === 'scenario' ? '✓ Nailed It'   : '✓ Know It')
                    : mastery[current.id] === 'partial'
                    ? (current.itemType === 'scenario' ? '⚡ Core Steps' : '⚡ Partial')
                    : (current.itemType === 'scenario' ? '✗ Missed It'  : "✗ Don't Know")}
                </span>
              )}

              <button onClick={goNext} disabled={studyIndex >= total - 1} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: '0.5px solid var(--border-hairline)', background: '#ffffff',
                fontSize: 12, color: studyIndex >= total - 1 ? 'var(--text-disabled)' : 'var(--text-secondary)',
                cursor: studyIndex >= total - 1 ? 'not-allowed' : 'pointer',
              }}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ── Sub-topbar ─────────────────────────────────────────────────────────────────

function SubTopbar({ activeView, setActiveView, selectedDeck, onStudyNow }: {
  activeView: ActiveView
  setActiveView: (v: ActiveView) => void
  selectedDeck: StudyDeck | null
  onStudyNow: () => void
}) {
  const tabs: { id: ActiveView; label: string }[] = [
    { id: 'create', label: 'Create new deck' },
    { id: 'study',  label: 'Study mode'      },
    { id: 'mcq',    label: 'MCQ practice'    },
  ]

  return (
    <div style={{
      height: 48, background: '#fafaf8',
      borderBottom: '0.5px solid var(--border-hairline)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 2, flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const active = activeView === tab.id
        const disabled = tab.id !== 'create' && selectedDeck?.status !== 'ready'
        return (
          <button
            key={tab.id}
            onClick={() => { if (!disabled) setActiveView(tab.id) }}
            title={disabled ? 'Select a ready deck first' : undefined}
            style={{
              height: 34, padding: '0 12px', borderRadius: 7,
              fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer', border: 'none',
              fontWeight: active ? 500 : 400,
              background: active ? NEUTRAL_900 : 'transparent',
              color: disabled ? 'var(--text-disabled)' : active ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.1s ease',
            }}
          >
            {tab.label}
          </button>
        )
      })}

      <div style={{ flex: 1 }} />

      {selectedDeck?.status === 'ready' && activeView !== 'study' && (
        <button
          onClick={onStudyNow}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
            borderRadius: 7, background: NEUTRAL_900, color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Study now
        </button>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function FlashcardPage() {
  const {
    decks, activeDeck, isGenerating, isLoadingDeck, studyIndex, studyMode,
    generate, selectDeck, removeDeck, retryDeck, retryAllFailed, setStudyIndex, setStudyMode, setActiveDeck,
    extractDocument,
  } = useFlashcard()

  const [activeView, setActiveView] = useState<ActiveView>('create')

  const errorCount = decks.filter(d => d.status === 'error').length

  const handleAllMastered = useCallback((_deckId: string) => {
    // session-level tracking only; no persistent state needed
  }, [])

  const handleSelectDeck = (deck: StudyDeck) => {
    if (deck.status === 'processing') { setActiveDeck(deck); return }
    if (deck.status === 'error') { setActiveDeck(deck); setActiveView('create'); return }
    void selectDeck(deck.id).then(() => setActiveView('study'))
  }

  const handleNewDeck = () => {
    setActiveDeck(null)
    setActiveView('create')
  }

  const handleRetrySelected = async () => {
    if (activeDeck) {
      await retryDeck(activeDeck.id)
      setActiveDeck(null)
      setActiveView('create')
    }
  }

  const handleDeleteFromList = (id: string) => {
    void removeDeck(id)
    if (activeDeck?.id === id) {
      setActiveDeck(null)
      setActiveView('create')
    }
  }

  const handleRetryFromList = (id: string) => { void retryDeck(id) }

  const showStudyPanel = activeView !== 'create' && activeDeck?.status === 'ready'
  const initialStudyMode: StudyMode = activeView === 'mcq' ? 'mcq' : 'all'

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>
      <DeckListPanel
        decks={decks}
        activeDeck={activeDeck}
        onSelectDeck={handleSelectDeck}
        onNewDeck={handleNewDeck}
        onDeleteDeck={handleDeleteFromList}
        onRetryDeck={handleRetryFromList}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface-page)' }}>
        <SubTopbar
          activeView={activeView}
          setActiveView={setActiveView}
          selectedDeck={activeDeck}
          onStudyNow={() => setActiveView('study')}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {isLoadingDeck ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loader2 size={24} style={{ color: 'var(--color-purple)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {activeDeck?.status === 'processing' ? (
                <motion.div key={`proc-${activeDeck.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <ProcessingView deck={activeDeck} />
                </motion.div>
              ) : showStudyPanel && activeDeck ? (
                <motion.div key={`study-${activeDeck.id}-${activeView}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <StudyPanel
                    deck={activeDeck}
                    studyIndex={studyIndex}
                    studyMode={activeView === 'mcq' ? (initialStudyMode as StudyMode) : (studyMode as StudyMode)}
                    onDelete={(id) => { void removeDeck(id); setActiveView('create') }}
                    onIndexChange={setStudyIndex}
                    onModeChange={setStudyMode as (m: StudyMode) => void}
                    onAllMastered={handleAllMastered}
                  />
                </motion.div>
              ) : (
                <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {activeDeck?.status === 'error' ? (
                    <ErrorView deck={activeDeck} onRetry={handleRetrySelected} />
                  ) : (
                    <CreateView
                      isGenerating={isGenerating}
                      errorCount={errorCount}
                      onGenerate={generate}
                      onExtractDocument={extractDocument}
                      onRetryAll={retryAllFailed}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  )
}
