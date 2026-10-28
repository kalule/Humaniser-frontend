import type { PopulationDescription } from '../../types/proposalWorkflow'

const input = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm'
export function PopulationDecisionsEditor({ value, onChange }: { value?: PopulationDescription | null; onChange: (value: PopulationDescription) => void }) {
  const description: PopulationDescription = value ?? { accessStatus: 'NotDecided', samplingFrameDocumented: null, recordedCharacteristics: [] }
  const patch = (change: Partial<PopulationDescription>) => onChange({ ...description, ...change })
  return <fieldset className="space-y-3 rounded-lg border border-border p-4">
    <legend className="px-1 font-medium">Population access and characteristics</legend>
    <p className="text-sm text-text-secondary">These decisions describe access to the accepted population. Recorded characteristics do not restrict who is eligible. Leave unconfirmed access and sampling frames undecided.</p>
    <label className="grid gap-1 text-sm">Population access<select className={input} value={description.accessStatus} onChange={e => patch({ accessStatus: e.target.value as PopulationDescription['accessStatus'] })}>
      <option value="NotDecided">Not yet decided</option><option value="Proposed">Proposed, permission not confirmed</option><option value="Confirmed">Confirmed access and permission</option>
    </select></label>
    <label className="grid gap-1 text-sm">Documented sampling frame<select className={input} value={description.samplingFrameDocumented === null ? '' : String(description.samplingFrameDocumented)} onChange={e => patch({ samplingFrameDocumented: e.target.value === '' ? null : e.target.value === 'true' })}>
      <option value="">Not yet decided</option><option value="false">No documented frame</option><option value="true">Frame documented</option>
    </select></label>
    {description.recordedCharacteristics.map((characteristic, index) => {
      const change = (item: Partial<typeof characteristic>) => patch({ recordedCharacteristics: description.recordedCharacteristics.map((row, i) => i === index ? { ...row, ...item } : row) })
      return <fieldset key={index} className="space-y-2 border-t border-border pt-3"><legend className="text-sm">Recorded characteristic {index + 1}</legend>
        <label className="grid gap-1 text-sm">Characteristic name<input className={input} value={characteristic.name} onChange={e => change({ name: e.target.value })} onBlur={e => change({ name: e.target.value.trim() })} /></label>
        <label className="grid gap-1 text-sm">Accepted category labels (one per line)<textarea className={input} value={characteristic.categoryLabels.join('\n')} onChange={e => change({ categoryLabels: e.target.value.split('\n') })} onBlur={e => change({ categoryLabels: e.target.value.split('\n').map(label => label.trim()).filter(Boolean) })} /></label>
        <button type="button" className="text-sm text-red-600" onClick={() => patch({ recordedCharacteristics: description.recordedCharacteristics.filter((_, i) => i !== index) })}>Remove characteristic {index + 1}</button>
      </fieldset>
    })}
    <button type="button" className="text-sm font-medium text-violet-700" onClick={() => patch({ recordedCharacteristics: [...description.recordedCharacteristics, { name: '', categoryLabels: [] }] })}>Add recorded characteristic</button>
    <p className="text-xs text-text-secondary">Support any population count with a source that states the count, population scope and reference period in Supporting research.</p>
  </fieldset>
}
