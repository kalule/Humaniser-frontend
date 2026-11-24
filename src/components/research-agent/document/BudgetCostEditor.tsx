import { memo, useMemo, useState } from 'react'
import { Calculator } from 'lucide-react'
import {
  ADD_YOUR_COSTS, applyBudget, money, parseBudget, readBudgetCosts, type BudgetCosts,
} from '../../../lib/budgetTable'

/**
 * PR 9 (2026-11-24): "Add your costs" for the budget (6.2). The student types the unit cost of each line (nothing is filled
 * in for them); line totals, subtotal, an optional contingency and the total are calculated here and written into the
 * section, and the costs are saved so a regenerated budget keeps them.
 */

interface Props {
  content: string
  /** The saved costs (sectionContent.budgetCosts), if any. */
  stored: string | undefined
  onApply: (content: string, costs: BudgetCosts) => Promise<boolean>
}

export const BudgetCostEditor = memo(function BudgetCostEditor({ content, stored, onApply }: Props) {
  const lines = useMemo(() => parseBudget(content), [content])
  const saved = useMemo(() => readBudgetCosts(stored), [stored])
  const [open, setOpen] = useState(false)
  const [currency, setCurrency] = useState(saved?.currency ?? '')
  const [contingency, setContingency] = useState(saved?.contingencyPercent != null ? String(saved.contingencyPercent) : '')
  const [costs, setCosts] = useState<Record<number, string>>(() =>
    Object.fromEntries((lines ?? []).map((l, i) => [i, l.unitCost != null ? String(l.unitCost) : (saved?.lines.find(s => s.item.trim().toLowerCase() === l.item.trim().toLowerCase())?.unitCost?.toString() ?? '')])))
  const [saving, setSaving] = useState(false)

  const draftCosts = useMemo((): BudgetCosts => ({
    currency: currency.trim() || null,
    contingencyPercent: contingency.trim() !== '' && Number.isFinite(Number(contingency)) ? Number(contingency) : null,
    lines: (lines ?? []).flatMap((l, i) => {
      const v = Number((costs[i] ?? '').replace(/[,\s]/g, ''))
      return (costs[i] ?? '').trim() !== '' && Number.isFinite(v) && v >= 0 ? [{ category: l.category || null, item: l.item, unitCost: v }] : []
    }),
  }), [currency, contingency, costs, lines])
  const preview = useMemo(() => applyBudget(content, draftCosts), [content, draftCosts])
  const current = useMemo(() => applyBudget(content, saved), [content, saved])

  if (!lines || lines.length === 0) return null

  const inputStyle = { border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }
  const totalText = (t: number | null) => (t === null ? ADD_YOUR_COSTS : `${currency || saved?.currency || ''} ${money(t)}`.trim())

  return (
    <section aria-label="Budget costs" className="mb-8 rounded-[10px] p-3" style={{ border: '0.5px solid var(--border-strong)' }}>
      <div className="flex items-center gap-2">
        <Calculator size={13} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} />
        <span className="flex-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          Budget total: <strong style={{ color: 'var(--text-primary)' }} data-testid="budget-total">{totalText(current.total)}</strong>
          {current.uncosted > 0 && current.costed > 0 && <> · {current.uncosted} line{current.uncosted === 1 ? '' : 's'} not yet costed</>}
        </span>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="dm-action rounded-md px-2 py-1 text-[12px] font-semibold hover:bg-slate-50" style={{ color: 'var(--color-purple-text)' }}>
          {open ? 'Close' : 'Add your costs'}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="m-0 text-[12px] leading-[1.45]" style={{ color: 'var(--text-secondary)' }}>
            Enter the unit cost of each line from your own quotes or your institution's rates. Totals are calculated for you; nothing is priced for you.
          </p>
          <div className="flex flex-wrap gap-3 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            <label className="flex items-center gap-1.5">Currency
              <input value={currency} onChange={e => setCurrency(e.target.value)} placeholder="e.g. ZAR" aria-label="Currency"
                className="w-20 rounded-md px-2 py-1" style={inputStyle} />
            </label>
            <label className="flex items-center gap-1.5">Contingency %
              <input value={contingency} onChange={e => setContingency(e.target.value)} placeholder="none" inputMode="decimal" aria-label="Contingency percent"
                className="w-16 rounded-md px-2 py-1" style={inputStyle} />
            </label>
          </div>
          <table className="w-full text-[12px]" style={{ color: 'var(--text-primary)' }}>
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th className="text-left font-semibold py-1">Item</th>
                <th className="text-right font-semibold py-1">Quantity</th>
                <th className="text-right font-semibold py-1">Unit cost</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={`${l.category}-${l.item}-${i}`}>
                  <td className="py-0.5 pr-2">{l.category ? `${l.category}: ` : ''}{l.item}</td>
                  <td className="py-0.5 pr-2 text-right">{l.quantity ?? '—'}</td>
                  <td className="py-0.5 text-right">
                    <input value={costs[i] ?? ''} inputMode="decimal" aria-label={`Unit cost of ${l.item}`} placeholder="Not yet costed"
                      onChange={e => { const v = e.target.value; setCosts(c => ({ ...c, [i]: v })) }}
                      className="w-28 rounded-md px-2 py-0.5 text-right" style={inputStyle} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              New total: <strong style={{ color: 'var(--text-primary)' }} data-testid="budget-preview-total">{totalText(preview.total)}</strong>
            </span>
            <button type="button" disabled={saving}
              onClick={() => { setSaving(true); void onApply(preview.content, draftCosts).then(ok => { setSaving(false); if (ok) setOpen(false) }) }}
              className="dm-action rounded-md px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60" style={{ background: 'var(--color-purple)', color: 'white' }}>
              {saving ? 'Saving…' : 'Apply costs'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
})
