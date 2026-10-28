import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Loader2, Check, Copy } from 'lucide-react'
import { useCitation } from '../../hooks/useCitation'
import { TwoColumnModulePage } from '../../components/shared/TwoColumnModulePage'
import type { CitationAuthor, CitationDto, FormatStyle, ResolvedCitation, SaveCitationRequest } from '../../types/citation'
import { FORMAT_LABELS, FORMAT_STYLES as FORMATS } from '../../types/citation'
import { citationRecordReference, cslCitationSaveRequest } from '../../lib/csl/citationRecord'

// ── Format config ──────────────────────────────────────────────────────────────

const INPUT_TABS = [
  { id: 'doi'  as const, label: 'DOI',       placeholder: '10.1016/j.example.2023.001' },
  { id: 'url'  as const, label: 'URL',       placeholder: 'https://www.nature.com/articles/...' },
  { id: 'text' as const, label: 'Paste Text', placeholder: 'Smith, J. A. (2023). Title of article. Journal, 12(3), 45–67.' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatAuthorsShort(authors: CitationAuthor[]): string {
  if (authors.length === 0) return 'Unknown author'
  const a0 = authors[0]
  const first = `${a0.lastName}${a0.firstName ? `, ${a0.firstName[0]}.` : ''}`
  if (authors.length === 1) return first
  if (authors.length === 2) return `${authors[0].lastName} & ${authors[1].lastName}`
  return `${authors[0].lastName} et al.`
}

// CSL plain-text output is text, including literal asterisks in source titles.
function CitationText({ text }: { text: string }) {
  return (
    <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
      {text || 'Citation needs review: check the reference details.'}
    </p>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button
      onClick={copy}
      disabled={!text}
      style={{
        height: 28, padding: '0 10px', borderRadius: 6, fontSize: 11,
        cursor: 'pointer', border: '0.5px solid var(--border-strong)',
        background: '#fff', color: 'var(--text-secondary)',
        display: 'flex', alignItems: 'center', gap: 4,
        transition: 'all 0.1s',
      }}
    >
      {copied
        ? <><Check size={11} style={{ color: 'var(--color-green)' }} /> Copied</>
        : <><Copy size={11} /> Copy</>
      }
    </button>
  )
}

// ── Citation style tabs ────────────────────────────────────────────────────────

function CitationStyleTabs({ active, onChange }: { active: FormatStyle; onChange: (f: FormatStyle) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
      {FORMATS.map((f) => (
        <button
          key={f}
          onClick={() => onChange(f)}
          style={{
            padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 500,
            cursor: 'pointer',
            border: `0.5px solid ${active === f ? '#c4b5fd' : 'var(--border-strong)'}`,
            background: active === f ? 'var(--color-purple-tint)' : '#ffffff',
            color: active === f ? 'var(--color-purple-text)' : 'var(--text-secondary)',
            transition: 'all 0.1s ease',
          }}
        >
          {FORMAT_LABELS[f]}
        </button>
      ))}
    </div>
  )
}

// ── Export dropdown ────────────────────────────────────────────────────────────

function ExportDropdown({ onExportDocx, onExportBibTex, disabled }: {
  onExportDocx: (f: FormatStyle) => void
  onExportBibTex: () => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        style={{
          height: 30, padding: '0 12px',
          background: disabled ? '#c4b5fd' : 'var(--color-purple)',
          color: '#fff', border: 'none', borderRadius: 7,
          fontSize: 12, fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        ↓ Export
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            onMouseLeave={() => setOpen(false)}
            style={{
              position: 'absolute', right: 0, top: '100%', marginTop: 6,
              width: 200, borderRadius: 10, zIndex: 50, overflow: 'hidden',
              background: '#fff',
              border: '0.5px solid var(--border-hairline)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ padding: 6 }}>
              <div style={{
                fontSize: 10, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                fontWeight: 600, padding: '6px 10px 4px',
              }}>
                Word Document
              </div>
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => { onExportDocx(f); setOpen(false) }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '8px 10px',
                    fontSize: 12, color: 'var(--text-secondary)',
                    background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-rail)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {FORMAT_LABELS[f]} (.docx)
                </button>
              ))}
              <div style={{ borderTop: '0.5px solid var(--border-hairline)', margin: '4px 0' }} />
              <button
                onClick={() => { onExportBibTex(); setOpen(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px',
                  fontSize: 12, color: 'var(--text-secondary)',
                  background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-rail)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                BibTeX (.bib)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Left panel ─────────────────────────────────────────────────────────────────

function CitationsLeftPanel({
  citations,
  selectedId,
  isLoading,
  onSelect,
  onAdd,
}: {
  citations: CitationDto[]
  selectedId: string | null
  isLoading: boolean
  onSelect: (id: string) => void
  onAdd: () => void
}) {
  const [search, setSearch] = useState('')

  const filtered = citations.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.authors.some((a) => a.lastName.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <>
      {/* Panel header */}
      <div style={{
        padding: '14px 16px 12px',
        borderBottom: '0.5px solid var(--border-hairline)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4,
        }}>
          Reference library
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          <strong style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {citations.length} reference{citations.length !== 1 ? 's' : ''}
          </strong>{' '}saved
        </div>

        {/* Search + Add */}
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="Search references…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search references"
            style={{
              flex: 1, height: 32,
              border: '0.5px solid var(--border-strong)',
              borderRadius: 7, padding: '0 10px',
              fontSize: 12, color: 'var(--text-primary)',
              background: '#fff', outline: 'none',
            }}
          />
          <button
            onClick={onAdd}
            style={{
              height: 32, padding: '0 12px',
              background: 'var(--color-purple)', color: '#fff',
              border: 'none', borderRadius: 7,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 16px' }}>
            <Loader2 size={18} style={{ color: 'var(--color-purple)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📑</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {search
                ? 'No references match your search.'
                : 'Add a reference via DOI, URL, or paste text.'}
            </div>
          </div>
        ) : (
          filtered.map((citation, i) => (
            <div
              key={citation.id}
              onClick={() => onSelect(citation.id)}
              role="button"
              tabIndex={0}
              aria-pressed={selectedId === citation.id}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(citation.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '12px 16px',
                borderBottom: '0.5px solid #f1f5f9',
                cursor: 'pointer',
                background: selectedId === citation.id ? 'var(--color-purple-tint)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (selectedId !== citation.id)
                  (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'
              }}
              onMouseLeave={(e) => {
                if (selectedId !== citation.id)
                  (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
            >
              {/* Number badge */}
              <div style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                background: selectedId === citation.id ? 'var(--color-purple)' : '#f1f5f9',
                border: `0.5px solid ${selectedId === citation.id ? 'var(--color-purple)' : 'var(--border-hairline)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 500,
                color: selectedId === citation.id ? '#fff' : 'var(--text-muted)',
              }}>
                {i + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Authors */}
                <div style={{
                  fontSize: 11, color: 'var(--color-purple)', fontWeight: 500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 2,
                }}>
                  {formatAuthorsShort(citation.authors)}
                </div>
                {/* Title */}
                <div style={{
                  fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {citation.title}
                </div>
                {/* Year · Journal */}
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {citation.publicationYear}
                  {citation.journalName ? ` · ${citation.journalName}` : ''}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}

// ── Main area ──────────────────────────────────────────────────────────────────

function CitationsMainArea({
  citations,
  selectedId,
  resolved,
  isResolving,
  isSaving,
  onResolve,
  onSave,
  onClearResolved,
}: {
  citations: CitationDto[]
  selectedId: string | null
  resolved: ResolvedCitation | null
  isResolving: boolean
  isSaving: boolean
  onResolve: (type: string, value: string) => void
  onSave: (data: SaveCitationRequest) => void
  onClearResolved: () => void
}) {
  const [inputTab, setInputTab] = useState<'doi' | 'url' | 'text'>('doi')
  const [inputValue, setInputValue] = useState('')
  const [formatStyle, setFormatStyle] = useState<FormatStyle>('apa7')

  const tab = INPUT_TABS.find((t) => t.id === inputTab)!
  const selectedCitation = citations.find((c) => c.id === selectedId) ?? null
  const resolvedText = useMemo(() => resolved ? citationRecordReference(resolved, formatStyle) ?? '' : '', [resolved, formatStyle])
  const selectedText = useMemo(() => selectedCitation ? citationRecordReference(selectedCitation, formatStyle) ?? '' : '', [selectedCitation, formatStyle])

  const handleResolve = () => {
    if (!inputValue.trim() || isResolving) return
    onResolve(inputTab, inputValue)
  }

  const handleSave = () => {
    if (!resolved) return
    const request = cslCitationSaveRequest(resolved)
    if (!request) return
    onSave(request)
    setInputValue('')
  }

  const helperText: Record<string, string> = {
    doi:  'Paste a DOI and we\'ll auto-fill authors, title, journal, and year.',
    url:  'Paste a URL and we\'ll extract the page title, author, and date.',
    text: 'Paste any reference format — Harvard, APA, MLA — and we\'ll reformat it.',
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Section label */}
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        Add reference
      </div>

      {/* Input type tab strip — white card */}
      <div style={{
        display: 'flex',
        background: '#ffffff',
        border: '0.5px solid var(--border-hairline)',
        borderRadius: 10, padding: 3, gap: 2,
      }}>
        {INPUT_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setInputTab(t.id); setInputValue(''); onClearResolved() }}
            style={{
              flex: 1, height: 30, borderRadius: 7, fontSize: 12,
              fontWeight: inputTab === t.id ? 500 : 400,
              cursor: 'pointer', border: 'none',
              background: inputTab === t.id ? 'var(--color-purple)' : 'transparent',
              color: inputTab === t.id ? '#ffffff' : 'var(--text-muted)',
              transition: 'all 0.12s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Input card */}
      <div style={{
        background: '#ffffff',
        border: '0.5px solid var(--border-hairline)',
        borderRadius: 10, padding: '14px 16px',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
        }}>
          {tab.label}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {inputTab === 'text' ? (
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={tab.placeholder}
              aria-label="Paste reference text"
              rows={3}
              style={{
                flex: 1, border: '0.5px solid var(--border-strong)',
                borderRadius: 7, padding: '8px 10px',
                fontSize: 13, color: 'var(--text-primary)',
                background: '#fff', outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
          ) : (
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={tab.placeholder}
              aria-label={`Enter ${tab.label}`}
              onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
              style={{
                flex: 1, height: 34,
                border: '0.5px solid var(--border-strong)',
                borderRadius: 7, padding: '0 10px',
                fontSize: 13, color: 'var(--text-primary)',
                background: '#fff', outline: 'none',
              }}
            />
          )}

          <button
            onClick={handleResolve}
            disabled={!inputValue.trim() || isResolving}
            style={{
              height: 34, padding: '0 16px',
              background: !inputValue.trim() || isResolving ? '#c4b5fd' : 'var(--color-purple)',
              color: '#fff', border: 'none', borderRadius: 7,
              fontSize: 12, fontWeight: 500,
              cursor: !inputValue.trim() || isResolving ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isResolving && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
            {isResolving ? 'Resolving…' : 'Resolve'}
          </button>
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
          {helperText[inputTab]}
        </div>
      </div>

      {/* Resolved preview — appears after resolving a DOI/URL/text */}
      <AnimatePresence>
        {resolved && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            style={{
              background: '#ffffff',
              border: '0.5px solid var(--border-hairline)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {/* Resolved header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '0.5px solid var(--border-hairline)',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>
                  {resolved.title}
                </div>
                {resolved.authors.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatAuthorsShort(resolved.authors)}
                    {resolved.publicationYear ? ` · ${resolved.publicationYear}` : ''}
                  </div>
                )}
              </div>
              <button
                onClick={onClearResolved}
                aria-label="Clear resolved citation"
                style={{
                  flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 2,
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Format preview */}
            <div style={{ padding: '14px 16px' }}>
              <CitationStyleTabs active={formatStyle} onChange={setFormatStyle} />
              <div style={{
                fontSize: 13, background: '#f8fafc', borderRadius: 6,
                padding: '10px 12px', borderLeft: '3px solid var(--color-purple)',
                minHeight: 56,
              }}>
                <CitationText text={resolvedText} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <CopyButton text={resolvedText} />
                <button
                  onClick={handleSave}
                  disabled={isSaving || !resolvedText}
                  style={{
                    height: 30, padding: '0 14px',
                    background: isSaving ? '#c4b5fd' : 'var(--color-purple)',
                    color: '#fff', border: 'none', borderRadius: 7,
                    fontSize: 12, fontWeight: 500,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {isSaving && <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />}
                  {isSaving ? 'Saving…' : '+ Save to Library'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected citation view */}
      <AnimatePresence>
        {!resolved && selectedCitation && (
          <motion.div
            key={selectedCitation.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              background: '#ffffff',
              border: '0.5px solid var(--border-hairline)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {/* Citation header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '0.5px solid var(--border-hairline)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 500, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
              }}>
                Formatted citation
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 3 }}>
                {selectedCitation.title}
              </div>
              {selectedCitation.authors.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatAuthorsShort(selectedCitation.authors)}
                  {selectedCitation.publicationYear ? ` · ${selectedCitation.publicationYear}` : ''}
                  {selectedCitation.journalName ? ` · ${selectedCitation.journalName}` : ''}
                </div>
              )}
            </div>

            {/* Format preview */}
            <div style={{ padding: '14px 16px' }}>
              <CitationStyleTabs active={formatStyle} onChange={setFormatStyle} />
              <div style={{
                fontSize: 13, background: '#f8fafc', borderRadius: 6,
                padding: '10px 12px', borderLeft: '3px solid var(--color-purple)',
                minHeight: 56,
              }}>
                <CitationText text={selectedText} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <CopyButton text={selectedText} />
              </div>
            </div>

            {/* Metadata */}
            {(selectedCitation.journalName || selectedCitation.volume || selectedCitation.pages || selectedCitation.publisher) && (
              <div style={{
                margin: '0 16px 14px',
                background: '#f8fafc',
                border: '0.5px solid var(--border-hairline)',
                borderRadius: 8, padding: '10px 12px',
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px',
              }}>
                {([
                  ['Journal', selectedCitation.journalName],
                  ['Vol / Issue', selectedCitation.volume
                    ? `${selectedCitation.volume}${selectedCitation.issue ? `(${selectedCitation.issue})` : ''}`
                    : null],
                  ['Pages', selectedCitation.pages],
                  ['Publisher', selectedCitation.publisher],
                ] as [string, string | null][]).map(([label, val]) =>
                  val ? (
                    <div key={label}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 1 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{val}</div>
                    </div>
                  ) : null
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!resolved && !selectedCitation && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '32px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📖</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Resolve a citation
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 280 }}>
            Enter a DOI, URL, or paste reference text above, then click Resolve.
            Select a saved reference from the list to view its formatted citation.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function CitationPage() {
  const {
    citations, resolved, selectedId, isLoading, isResolving, isSaving, isExporting,
    resolve, save, remove: _remove, exportDocx, exportBibTex,
    setResolved, setSelectedId,
  } = useCitation()

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setResolved(null)
  }

  const handleAdd = () => {
    setSelectedId(null)
    setResolved(null)
  }

  return (
    <TwoColumnModulePage
      topbarTitle="Citations"
      topbarDesc="Format references in APA, Harvard, IEEE, or MLA"
      topbarActions={
        <ExportDropdown
          onExportDocx={exportDocx}
          onExportBibTex={exportBibTex}
          disabled={isExporting || citations.length === 0}
        />
      }
      leftPanel={
        <CitationsLeftPanel
          citations={citations}
          selectedId={selectedId}
          isLoading={isLoading}
          onSelect={handleSelect}
          onAdd={handleAdd}
        />
      }
    >
      <CitationsMainArea
        citations={citations}
        selectedId={selectedId}
        resolved={resolved}
        isResolving={isResolving}
        isSaving={isSaving}
        onResolve={resolve}
        onSave={save}
        onClearResolved={() => setResolved(null)}
      />
    </TwoColumnModulePage>
  )
}
