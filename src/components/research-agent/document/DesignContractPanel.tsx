import { memo, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, FileSignature, Pencil } from 'lucide-react'
import { CONTRACT_FIELDS, type ContractFieldDef, type DesignContract } from '../../../lib/designContract'

interface Props {
  contract:  DesignContract
  /** Suggested values shown as placeholders when a field is empty (from the project setup). */
  hints?:    Partial<Record<ContractFieldDef['key'], string>>
  saving:    boolean
  /** Sections currently marked "may be out of date". */
  staleCount: number
  onSave:    (next: DesignContract) => Promise<boolean>
}

const OPEN_KEY = 'dm.designContract.open'
const readOpen = () => { try { return localStorage.getItem(OPEN_KEY) !== 'closed' } catch { return true } }
const writeOpen = (open: boolean) => { try { localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed') } catch { /* per-viewer convenience only */ } }

const GROUPS: ContractFieldDef['group'][] = ['Design', 'Variables', 'Sample', 'Delivery']

/**
 * The design contract, pinned at the top of the agent rail: the decisions every section must
 * state the same way. Drafting and rewriting read it (server-side), so parallel drafts agree.
 * Saving a change never rewrites text; it marks the sections that state the field as stale.
 */
function DesignContractPanelImpl({ contract, hints = {}, saving, staleCount, onSave }: Props) {
  const [open, setOpen] = useState(readOpen)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DesignContract>(contract)
  useEffect(() => { if (!editing) setDraft(contract) }, [contract, editing])

  const filled = CONTRACT_FIELDS.filter(f => contract[f.key])
  const toggle = () => { setOpen(o => { writeOpen(!o); return !o }) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await onSave(draft)) setEditing(false)
  }

  return (
    <section aria-label="Design contract" className="rounded-[10px]" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <button type="button" onClick={toggle} aria-expanded={open} aria-controls="design-contract-body"
          className="dm-action flex-1 min-w-0 flex items-center gap-1.5 text-left text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {open ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          <FileSignature size={13} aria-hidden="true" style={{ color: 'var(--color-purple-text)' }} />
          <span className="truncate">Design contract</span>
          <span className="font-normal text-[12px]" style={{ color: 'var(--text-muted)' }}>· {filled.length} of {CONTRACT_FIELDS.length} set</span>
        </button>
        {open && !editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="dm-action shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold hover:bg-slate-50"
            style={{ color: 'var(--color-purple-text)' }} aria-label="Edit the design contract">
            <Pencil size={11} aria-hidden="true" /> Edit
          </button>
        )}
      </div>

      {open && (
        <div id="design-contract-body" className="px-3.5 pb-3.5">
          {staleCount > 0 && !editing && (
            <p className="m-0 mb-2 text-[12px] leading-[1.45]" style={{ color: 'var(--color-amber-text)' }}>
              {staleCount} section{staleCount === 1 ? '' : 's'} may be out of date after a change here.
            </p>
          )}
          {!editing ? (
            filled.length ? (
              <dl className="m-0 flex flex-col gap-1.5 text-[12px] leading-[1.45]">
                {filled.map(f => (
                  <div key={f.key} className="grid grid-cols-[minmax(0,40%)_1fr] gap-2">
                    <dt style={{ color: 'var(--text-muted)' }}>{f.label}</dt>
                    <dd className="m-0 break-words" style={{ color: 'var(--text-primary)' }}>{contract[f.key]}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="m-0 text-[12px] leading-[1.5]" style={{ color: 'var(--text-secondary)' }}>
                Nothing set yet. Sections use the planning defaults (one software choice, the researcher collects data, one sample size).
                Set the decisions here so every section, including those drafted in parallel, states them the same way.
              </p>
            )
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3" aria-label="Edit the design contract">
              {GROUPS.map(group => (
                <fieldset key={group} className="m-0 p-0 border-0 flex flex-col gap-2">
                  <legend className="text-[11px] font-semibold tracking-[0.06em] mb-1" style={{ color: 'var(--text-secondary)' }}>{group.toUpperCase()}</legend>
                  {CONTRACT_FIELDS.filter(f => f.group === group).map(f => (
                    <label key={f.key} className="flex flex-col gap-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {f.label}
                      <input type="text" value={draft[f.key] ?? ''} placeholder={hints[f.key] ?? f.placeholder}
                        onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
                        className="rounded-md px-2 py-1.5 text-[12px] outline-none focus:ring-2"
                        style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }} />
                    </label>
                  ))}
                </fieldset>
              ))}
              <p className="m-0 text-[11px] leading-[1.45]" style={{ color: 'var(--text-muted)' }}>
                Saving changes no text. Drafted sections that state a changed decision are marked “may be out of date” for you to check.
              </p>
              <div className="flex gap-2">
                <button type="submit" disabled={saving}
                  className="dm-action rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60" style={{ background: 'var(--color-purple)' }}>
                  {saving ? 'Saving…' : 'Save contract'}
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
