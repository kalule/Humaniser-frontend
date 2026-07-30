import { useCallback, useRef, useState, type ElementType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Upload, Trash2, ChevronDown, ChevronRight,
  BookOpen, Tag, HelpCircle, AlignLeft, Clock, FileText,
  Loader2, AlertTriangle, Plus,
} from 'lucide-react'
import { useLectureStore } from '../../store/lectureStore'
import { useLecture } from '../../hooks/useLecture'
import type { LectureJob, SummarySection, DefinitionItem, ExamQuestion } from '../../types/lecture'

type Tab = 'summary' | 'definitions' | 'questions' | 'transcript'

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Left panel: job list ───────────────────────────────────────────────────────

function JobList({
  jobs,
  selectedJobId,
  isUploading,
  onSelect,
  onUpload,
  onDelete,
}: {
  jobs: LectureJob[]
  selectedJobId: string | null
  isUploading: boolean
  onSelect: (id: string) => void
  onUpload: (file: File) => void
  onDelete: (id: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (files: FileList | null) => {
    if (files?.[0]) onUpload(files[0])
  }

  return (
    <div style={{
      width: 272,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#ffffff',
      borderRight: '0.5px solid var(--border-hairline)',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '0.5px solid var(--border-hairline)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--color-purple-tint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={14} style={{ color: 'var(--color-purple)' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Lecture Notes
          </span>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          style={{
            width: '100%', height: 34, borderRadius: 7,
            background: isUploading ? '#c4b5fd' : 'var(--color-purple)',
            color: '#fff', border: 'none', fontSize: 12, fontWeight: 500,
            cursor: isUploading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          {isUploading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={13} />}
          {isUploading ? 'Uploading…' : 'New Lecture'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".mp3,.mp4,.wav,.m4a,.ogg,.webm,.flac"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Job list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {jobs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              No lectures yet.<br />Upload your first audio file.
            </div>
          </div>
        ) : (
          jobs.map((job) => {
            const active = job.id === selectedJobId
            const statusColor =
              job.status === 'processing' ? 'var(--color-amber)' :
              job.status === 'ready'      ? 'var(--color-green)' :
              'var(--color-red)'

            return (
              <div
                key={job.id}
                onClick={() => onSelect(job.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '11px 16px',
                  borderBottom: '0.5px solid #f1f5f9',
                  cursor: 'pointer',
                  background: active ? 'var(--color-purple-tint)' : 'transparent',
                  borderLeft: `2px solid ${active ? 'var(--color-purple)' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
                }}
              >
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                  background: statusColor,
                  ...(job.status === 'processing' ? { animation: 'pulse 1.5s infinite' } : {}),
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: active ? 500 : 400,
                    color: active ? 'var(--color-purple-text)' : 'var(--text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    marginBottom: 2,
                  }}>
                    {job.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {job.status === 'processing' ? 'Processing…' : formatDate(job.createdAt)}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(job.id) }}
                  aria-label={`Delete ${job.title}`}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, flexShrink: 0,
                    opacity: 0, transition: 'opacity 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1'
                    e.currentTarget.style.color = 'var(--color-red)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }}
                  onFocus={(e) => (e.currentTarget.style.opacity = '1')}
                  onBlur={(e) => (e.currentTarget.style.opacity = '0')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Upload drop zone ───────────────────────────────────────────────────────────

function UploadZone({ onUpload, isUploading }: { onUpload: (f: File) => void; isUploading: boolean }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }, [onUpload])

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? 'var(--color-purple)' : 'var(--border-strong)'}`,
            borderRadius: 16, padding: '48px 32px', textAlign: 'center',
            background: dragging ? 'var(--color-purple-tint)' : '#ffffff',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
            background: 'var(--color-purple-tint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={28} style={{ color: 'var(--color-purple)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
            Upload a Lecture
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Drop an audio or video file, or click to browse
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 24 }}>
            MP3, MP4, WAV, M4A, OGG, WEBM, FLAC · Max 500 MB
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            style={{
              padding: '10px 24px',
              background: isUploading ? '#c4b5fd' : 'var(--color-purple)',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 13, fontWeight: 500,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            {isUploading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
            {isUploading ? 'Uploading…' : 'Choose File'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".mp3,.mp4,.wav,.m4a,.ogg,.webm,.flac"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) onUpload(e.target.files[0]) }}
          />
        </div>

        <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { icon: Mic,       label: 'Transcription',  desc: 'Local Whisper AI — no data sent to third parties' },
            { icon: BookOpen,  label: 'Study Guide',    desc: 'Structured summary, definitions, and flashcards' },
            { icon: HelpCircle, label: 'Exam Prep',     desc: 'High-yield questions with model answers' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} style={{
              borderRadius: 10, background: '#ffffff',
              border: '0.5px solid var(--border-hairline)', padding: 14, textAlign: 'center',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8, margin: '0 auto 8px',
                background: 'var(--color-purple-tint)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} style={{ color: 'var(--color-purple)' }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Processing view ────────────────────────────────────────────────────────────

function ProcessingView({ job }: { job: LectureJob }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'var(--color-purple-tint)', animation: 'ping 1s ease infinite',
          }} />
          <div style={{
            position: 'relative', width: 80, height: 80, borderRadius: '50%',
            background: 'var(--color-purple-tint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={28} style={{ color: 'var(--color-purple)' }} />
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {job.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Transcribing and structuring your lecture…
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          This can take a few minutes for longer recordings.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          {['Transcribing', 'Cleaning', 'Structuring'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <ChevronRight size={12} style={{ color: 'var(--border-strong)' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: 'var(--color-purple)', animation: `bounce 1s ${i * 0.2}s infinite`,
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{step}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Error view ─────────────────────────────────────────────────────────────────

function ErrorView({ job, onDelete }: { job: LectureJob; onDelete: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
          background: 'var(--color-red-tint)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AlertTriangle size={28} style={{ color: 'var(--color-red)' }} />
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Processing Failed
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{job.title}</div>
        {job.errorMessage && (
          <div style={{
            fontSize: 11, color: 'var(--color-red)', marginTop: 12, padding: 12,
            background: 'var(--color-red-tint)', borderRadius: 10,
            border: '0.5px solid #fca5a5',
          }}>
            {job.errorMessage}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
          Make sure lecture-runner is running on port 8006.
        </div>
        <button
          onClick={onDelete}
          style={{
            marginTop: 20, padding: '8px 16px', fontSize: 13,
            color: 'var(--color-red)', border: '0.5px solid #fca5a5',
            background: 'transparent', borderRadius: 10, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-red-tint)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <Trash2 size={13} /> Remove
        </button>
      </div>
    </div>
  )
}

// ── Summary tab ────────────────────────────────────────────────────────────────

function SummaryTab({ sections }: { sections: SummarySection[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))

  const toggle = (i: number) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
      {sections.map((section, i) => (
        <div key={i} style={{
          borderRadius: 10, border: '0.5px solid var(--border-hairline)',
          background: '#ffffff', overflow: 'hidden',
        }}>
          <button
            onClick={() => toggle(i)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {section.topicHeading}
            </span>
            <ChevronDown
              size={15}
              style={{
                color: 'var(--text-muted)', flexShrink: 0,
                transform: expanded.has(i) ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </button>
          <AnimatePresence initial={false}>
            {expanded.has(i) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <ul style={{
                  padding: '0 18px 14px',
                  borderTop: '0.5px solid var(--border-hairline)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {section.bulletPoints.map((pt, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, paddingTop: 10 }}>
                      <span style={{
                        marginTop: 6, width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--color-purple)', flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{pt}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

// ── Definitions tab ────────────────────────────────────────────────────────────

function DefinitionsTab({ definitions }: { definitions: DefinitionItem[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 800 }}>
      {definitions.map((def, i) => (
        <div key={i} style={{
          borderRadius: 10, background: '#ffffff',
          border: '0.5px solid var(--border-hairline)', padding: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-purple)', marginBottom: 5 }}>
            {def.term}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {def.definition}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Exam Questions tab ─────────────────────────────────────────────────────────

function QuestionsTab({ questions }: { questions: ExamQuestion[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setRevealed((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
      {questions.map((q, i) => (
        <div key={i} style={{
          borderRadius: 10, border: '0.5px solid var(--border-hairline)',
          background: '#ffffff', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: 'var(--color-purple-tint)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'var(--color-purple)',
            }}>
              {i + 1}
            </div>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5, flex: 1 }}>
              {q.question}
            </p>
          </div>
          <div style={{ borderTop: '0.5px solid var(--border-hairline)', padding: '10px 18px' }}>
            {revealed.has(i) ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 6 }}>
                  {q.idealAnswer}
                </p>
                <button
                  onClick={() => toggle(i)}
                  style={{
                    fontSize: 11, color: 'var(--text-muted)', background: 'none',
                    border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  Hide answer
                </button>
              </motion.div>
            ) : (
              <button
                onClick={() => toggle(i)}
                style={{
                  fontSize: 12, fontWeight: 500, color: 'var(--color-purple)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Reveal ideal answer
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Transcript tab ─────────────────────────────────────────────────────────────

function TranscriptTab({ text }: { text: string }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{
        borderRadius: 10, background: '#ffffff',
        border: '0.5px solid var(--border-hairline)', padding: 20,
      }}>
        <pre style={{
          fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8,
          whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0,
        }}>
          {text || 'No transcript available.'}
        </pre>
      </div>
    </div>
  )
}

// ── Study guide view ───────────────────────────────────────────────────────────

const TAB_CONFIG: { key: Tab; label: string; icon: ElementType }[] = [
  { key: 'summary',     label: 'Summary',         icon: BookOpen  },
  { key: 'definitions', label: 'Key Definitions', icon: Tag       },
  { key: 'questions',   label: 'Exam Questions',  icon: HelpCircle },
  { key: 'transcript',  label: 'Transcript',      icon: AlignLeft },
]

function StudyGuideView({ job }: { job: LectureJob }) {
  const [tab, setTab] = useState<Tab>('summary')
  const guide = job.studyGuide
  if (!guide) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Study guide header */}
      <div style={{
        padding: '18px 28px 0',
        borderBottom: '0.5px solid var(--border-hairline)',
        flexShrink: 0, background: '#ffffff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--color-purple-tint)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mic size={14} style={{ color: 'var(--color-purple)' }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            {job.title}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: 'var(--text-muted)', paddingLeft: 42, marginBottom: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <FileText size={11} /> {job.fileName}
          </span>
          {job.durationSeconds > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} /> {formatDuration(job.durationSeconds)}
            </span>
          )}
          {job.wordCount > 0 && (
            <span>{job.wordCount.toLocaleString()} words</span>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TAB_CONFIG.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '8px 14px', borderRadius: '8px 8px 0 0',
                fontSize: 12, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer',
                color: tab === key ? 'var(--color-purple)' : 'var(--text-muted)',
                borderBottom: tab === key
                  ? '2px solid var(--color-purple)'
                  : '2px solid transparent',
                transition: 'all 0.12s ease',
                marginBottom: -1,
              }}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'summary'     && <SummaryTab     sections={guide.cleanSummary}      />}
            {tab === 'definitions' && <DefinitionsTab  definitions={guide.keyDefinitions} />}
            {tab === 'questions'   && <QuestionsTab    questions={guide.examQuestions}    />}
            {tab === 'transcript'  && <TranscriptTab   text={job.rawTranscript ?? ''}     />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LecturePage() {
  const { jobs, selectedJobId, isUploading, selectJob } = useLectureStore()
  const { upload, deleteJob } = useLecture()

  const selectedJob = jobs.find((j) => j?.id === selectedJobId) ?? null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--surface-page)' }}>
      <JobList
        jobs={jobs}
        selectedJobId={selectedJobId}
        isUploading={isUploading}
        onSelect={selectJob}
        onUpload={upload}
        onDelete={deleteJob}
      />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedJob ? (
          <UploadZone onUpload={upload} isUploading={isUploading} />
        ) : selectedJob.status === 'processing' ? (
          <ProcessingView job={selectedJob} />
        ) : selectedJob.status === 'error' ? (
          <ErrorView job={selectedJob} onDelete={() => deleteJob(selectedJob.id)} />
        ) : (
          <StudyGuideView job={selectedJob} />
        )}
      </main>
    </div>
  )
}
