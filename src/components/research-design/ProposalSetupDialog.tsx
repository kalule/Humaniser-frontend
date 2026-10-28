import { useRef, useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import type { AcademicLevel, CitationStyle } from '../../types/research'
import { proposalError } from '../../lib/proposalJourney'

export type ProposalStartMode = 'manual' | 'automated'
export interface ProposalSetup { topic: string; academicLevel: AcademicLevel; citationStyle: CitationStyle }

export const START_MODES: { value: ProposalStartMode; title: string; hint: string; action: string }[] = [
  { value: 'manual', title: 'Create a new proposal', hint: 'Work through your proposal step by step with AI help, and edit every section yourself.', action: 'Create proposal' },
  { value: 'automated', title: 'Automated proposal', hint: 'We write a complete first draft with cited sources. You review and edit it afterwards.', action: 'Continue' },
]

export function ProposalSetupDialog({ onClose, onCreate, onAutomate }: {
  onClose: () => void
  onCreate: (setup: ProposalSetup) => Promise<void>
  onAutomate: (setup: { topic: string; academicLevel: AcademicLevel }) => void
}) {
  const [topic, setTopic] = useState(''), [level, setLevel] = useState<AcademicLevel>('MASTERS'), [style, setStyle] = useState<CitationStyle>('harvard')
  const [mode, setMode] = useState<ProposalStartMode>('manual')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const locked = useRef(false)
  const submit = async () => {
    if (locked.current || !topic.trim()) return
    // The automated flow collects the remaining details itself, so hand over without creating anything here.
    if (mode === 'automated') { onAutomate({ topic: topic.trim(), academicLevel: level }); return }
    locked.current = true; setBusy(true); setError('')
    try { await onCreate({ topic: topic.trim(), academicLevel: level, citationStyle: style }) }
    catch (e) { setError(proposalError(e)) }
    finally { locked.current = false; setBusy(false) }
  }
  const action = START_MODES.find(m => m.value === mode)!.action
  return <Modal isOpen title="Start your proposal" onClose={() => { if (!busy) onClose() }} panelClassName="research-design">
    <p className="text-sm text-text-secondary mb-5">Start with your research idea.</p>
    <form onSubmit={e => { e.preventDefault(); void submit() }} className="space-y-5">
      <Input id="proposal-topic" label="Research topic or idea" autoFocus required maxLength={500} value={topic} disabled={busy} onChange={e => setTopic(e.target.value)} />
      <label className="grid gap-2 text-sm" htmlFor="proposal-level">Academic level<select id="proposal-level" className="rounded-lg border border-border bg-card p-3" disabled={busy} value={level} onChange={e => setLevel(e.target.value as AcademicLevel)}><option value="UNDERGRADUATE">Undergraduate</option><option value="MASTERS">Masters</option><option value="PHD">PhD</option></select></label>
      <fieldset className="grid gap-2" disabled={busy}>
        <legend className="text-sm mb-1">How would you like to write it?</legend>
        {START_MODES.map(m => (
          <label key={m.value} className={`flex gap-3 rounded-xl border p-3 cursor-pointer ${mode === m.value ? 'border-purple-accent bg-purple-tint/40' : 'border-border'}`}>
            <input type="radio" name="proposal-start" className="mt-1" checked={mode === m.value} onChange={() => setMode(m.value)} />
            <span><span className="block text-sm font-medium">{m.title}</span><span className="block text-xs text-text-secondary">{m.hint}</span></span>
          </label>
        ))}
      </fieldset>
      {mode === 'manual' && <details><summary className="text-sm cursor-pointer">Referencing preferences</summary><label className="mt-3 grid gap-2 text-sm" htmlFor="proposal-style">Citation style<select id="proposal-style" className="rounded-lg border border-border bg-card p-3" disabled={busy} value={style} onChange={e => setStyle(e.target.value as CitationStyle)}><option value="harvard">Harvard</option><option value="apa7">APA 7</option><option value="mla">MLA</option><option value="ieee">IEEE</option></select></label></details>}
      {error && <p role="alert" className="text-sm">{error}</p>}
      <div className="flex justify-end gap-3"><Button variant="ghost" type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" isLoading={busy} disabled={busy || !topic.trim()}>{action}</Button></div>
    </form>
  </Modal>
}
