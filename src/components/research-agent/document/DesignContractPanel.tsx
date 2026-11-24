import { memo, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, FileSignature, Pencil } from 'lucide-react'
import {
  KEY_FIELDS, MORE_FIELDS, type ContractFieldDef, type ContractFieldKey, type DesignContract,
} from '../../../lib/designContract'

interface Props {
  contract:  DesignContract
  /** Suggested values shown as placeholders when a field is empty. */
  hints?:    Partial<Record<ContractFieldKey, string>>
  saving:    boolean
  /** Sections currently marked "may be out of date". */
  staleCount: number
  onSave:    (next: DesignContract) => Promise<boolean>
  /** Writes the suggested values into every empty key decision. */
  onUseDefaults: () => void
  /** Shown as the panel's Next step: accent border and the panel's one primary button. */
  isNextStep?: boolean
  /** The section drafting is waiting at ("2.0 Literature Review"), when drafting is paused for the decisions. */
  pausedAt?: string | null
}

const OPEN_KEY = 'dm.designContract.open'
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== 'closed' } catch { return true } }
const writeOpen = (open: boolean) => { try { localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed') } catch { /* per-viewer convenience only */ } }

const MORE_GROUPS: ContractFieldDef['group'][] = ['Design', 'Variables', 'Sample', 'Delivery']

const inputId = (key: ContractFieldKey) => `study-decision-${key}`

/**
 * Study decisions (internally the design contract): the decisions every section must state the same
 * way. Five are key: the agent drafts nothing after 1.1 Background until they are set. Drafting and
 * rewriting read them server-side, so parallel drafts agree. Saving never rewrites text; it marks
 * drafted sections that state a changed decision as "may be out of date".
 */
function DesignContractPanelImpl({ contract, hints = {}, saving, staleCount, onSave, onUseDefaults, isNextStep = false, pausedAt }: Props) {
  const [open, setOpen] = useState(readOpen)
  const [editing, setEditing] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [draft, setDraft] = useState<DesignContract>(contract)
  const focusKey = useRef<ContractFieldKey | null>(null)
  useEffect(() => { if (!editing) setDraft(contract) }, [contract, editing])

  const keySet = KEY_FIELDS.filter(f => contract[f.key])
  const moreSet = MORE_FIELDS.filter(f => contract[f.key])
  const missing = KEY_FIELDS.length - keySet.length
  // The card cannot be folded away while it is the thing to do next.
  const expanded = isNextStep || open
  const toggle = () => { setOpen(o => { writeOpen(!o); return !o }) }

  // Opening the form from a chip focuses that decision's input.
  useEffect(() => {
    if (!editing || !focusKey.current) return
    document.getElementById(inputId(focusKey.current))?.focus()
    focusKey.current = null
  }, [editing, moreOpen])

  const startEditing = (key?: ContractFieldKey) => {
    const target = key ?? KEY_FIELDS.find(f => !contract[f.key])?.key ?? KEY_FIELDS[0].key
    focusKey.current = target
    if (MORE_FIELDS.some(f => f.key === target)) setMoreOpen(true)
    if (!open) { setOpen(true); writeOpen(true) }
    setEditing(true)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await onSave(draft)) setEditing(false)
  }

  const field = (f: ContractFieldDef) => (
    <label key={f.key} htmlFor={inputId(f.key)} className="flex flex-col gap-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
      {f.label}
      <input id={inputId(f.key)} type="text" value={draft[f.key] ?? ''} placeholder={hints[f.key] ?? f.placeholder}
        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
        className="rounded-md px-2 py-1.5 text-[12px] outline-none focus:ring-2"
        style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
    </label>
  )

  return (
    <section aria-label="Study decisions" className="rounded-[10px]"
      style={isNextStep ? { border: '1.5px solid var(--color-purple)' } : { border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1">
        {isNextStep ? (
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold tracking-[0.08em]" style={{ color: 'var(--color-purple-text)' }}>NEXT STEP</div>
            <h3 className="m-0 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              <FileSignature size={13} aria-hidden="true" style={{ color: 'var(--color-purple-text)' }} />
              Study decisions
              <span className="font-normal text-[12px]" style={{ color: 'var(--text-muted)' }}>· {keySet.length} of {KEY_FIELDS.length} set</span>
            </h3>
          </div>
        ) : (
          <button type="button" onClick={toggle} aria-expanded={expanded} aria-controls="study-decisions-body"
            className="dm-action flex-1 min-w-0 flex items-center gap-1.5 text-left text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            <FileSignature size={13} aria-hidden="true" style={{ color: 'var(--color-purple-text)' }} />
            <span className="truncate">Study decisions</span>
            <span className="font-normal text-[12px]" style={{ color: 'var(--text-muted)' }}>· {keySet.length} of {KEY_FIELDS.length} set</span>
          </button>
        )}
        {expanded && !editing && missing === 0 && (
          <button type="button" onClick={() => startEditing()}
            className="dm-action shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold hover:bg-slate-50"
            style={{ color: 'var(--color-purple-text)' }} aria-label="Edit the study decisions">
            <Pencil size={11} aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      {expanded && (
        <div id="study-decisions-body" className="px-3.5 pb-3.5">
          <p className="m-0 mb-2 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
            Every section uses these, so the draft stays consistent
          </p>
          {pausedAt && missing > 0 && (
            <p className="m-0 mb-2 text-[12px] leading-[1.45]" style={{ color: 'var(--color-amber-text)' }} role="status">
              Drafting is paused before {pausedAt} until the key decisions are set.
            </p>
          )}
          {staleCount > 0 && !editing && (
            <p className="m-0 mb-2 text-[12px] leading-[1.45]" style={{ color: 'var(--color-amber-text)' }}>
              {staleCount} section{staleCount === 1 ? '' : 's'} may be out of date after a change here.
            </p>
          )}

          {!editing ? (
            <>
              <ul className="list-none m-0 p-0 flex flex-wrap gap-1.5" aria-label="Key decisions">
                {KEY_FIELDS.map(f => {
                  const value = contract[f.key]
                  return (
                    <li key={f.key} className="max-w-full">
                      <button type="button" onClick={() => startEditing(f.key)}
                        aria-label={`${f.label}: ${value ?? 'not set'}. Edit`}
                        title={value ?? undefined}
                        className="dm-action max-w-full inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-left"
                        style={value
                          ? { background: 'var(--color-green-tint)', color: 'var(--color-green-text)' }
                          : { border: '1px dashed var(--text-muted)', color: 'var(--text-secondary)' }}>
                        {value && <Check size={10} strokeWidth={3} aria-hidden="true" className="shrink-0" />}
                        <span className="font-semibold shrink-0">{f.label}</span>
                        <span className="truncate">{value ? `· ${value}` : '· not set'}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {missing > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => startEditing()}
                    className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                    style={isNextStep ? { background: 'var(--color-purple)', color: 'white' } : { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                    Set remaining decisions
                  </button>
                  <button type="button" onClick={onUseDefaults} disabled={saving}
                    className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60"
                    style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                    {saving ? 'Saving…' : 'Use suggested defaults'}
                  </button>
                </div>
              )}

              <div className="mt-2.5 pt-2" style={{ borderTop: '0.5px solid var(--border-hairline)' }}>
                <button type="button" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} aria-controls="study-decisions-more"
                  className="dm-action inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {moreOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
                  More decisions <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· {moreSet.length} of {MORE_FIELDS.length} set, optional</span>
                </button>
                {moreOpen && (
                  <div id="study-decisions-more" className="mt-1.5">
                    {moreSet.length ? (
                      <dl className="m-0 flex flex-col gap-1.5 text-[12px] leading-[1.45]">
                        {moreSet.map(f => (
                          <div key={f.key} className="grid grid-cols-[minmax(0,40%)_1fr] gap-2">
                            <dt style={{ color: 'var(--text-muted)' }}>{f.label}</dt>
                            <dd className="m-0 break-words" style={{ color: 'var(--text-primary)' }}>{contract[f.key]}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-muted)' }}>
                        None set. Add variables, sampling frame or ethics status if your sections should state them the same way
                      </p>
                    )}
                    <button type="button" onClick={() => { setMoreOpen(true); startEditing(MORE_FIELDS.find(f => !contract[f.key])?.key ?? MORE_FIELDS[0].key) }}
                      className="dm-action mt-1.5 text-[12px] font-semibold hover:underline" style={{ color: 'var(--color-purple-text)' }}>
                      Edit more decisions
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Edit the study decisions">
              <fieldset className="m-0 p-0 border-0 flex flex-col gap-2">
                <legend className="text-[11px] font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--text-secondary)' }}>KEY DECISIONS</legend>
                {KEY_FIELDS.map(field)}
              </fieldset>
              <div>
                <button type="button" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}
                  className="dm-action inline-flex items-center gap-1 text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {moreOpen ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
                  More decisions <span className="font-normal" style={{ color: 'var(--text-muted)' }}>· optional</span>
                </button>
                {moreOpen && (
                  <div className="mt-2 flex flex-col gap-3">
                    {MORE_GROUPS.map(group => {
                      const fields = MORE_FIELDS.filter(f => f.group === group)
                      if (!fields.length) return null
                      return (
                        <fieldset key={group} className="m-0 p-0 border-0 flex flex-col gap-2">
                          <legend className="text-[11px] font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--text-secondary)' }}>{group.toUpperCase()}</legend>
                          {fields.map(field)}
                        </fieldset>
                      )
                    })}
                  </div>
                )}
              </div>
              <p className="m-0 text-[11px] leading-[1.45]" style={{ color: 'var(--text-muted)' }}>
                Saving changes no text. Drafted sections that state a changed decision are marked “may be out of date” for you to check.
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60" style={{ background: 'var(--color-purple)' }}>
                  {saving ? 'Saving…' : 'Save decisions'}
                </button>
                <button type="button" onClick={() => { setDraft(contract); setEditing(false) }}
                  className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                  style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  )
}

export const DesignContractPanel = memo(DesignContractPanelImpl)
