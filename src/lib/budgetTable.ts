/**
 * PR 9 (2026-11-24): the budget table (section 6.2) read and recomputed in the browser, mirroring the server's BudgetTotals
 * (budget-totals.v1) so the app shows the totals the export will show. Unit costs come only from the student; Line Total =
 * Quantity × Unit Cost, Subtotal = sum of costed lines, Contingency (N%) on the subtotal, Total = Subtotal + Contingency, and
 * "Add your costs" when nothing is costed.
 */

export const BUDGET_COSTS_KEY = 'budgetCosts'
export const ADD_YOUR_COSTS = 'Add your costs'

export interface BudgetCostLine { category: string | null; item: string; unitCost: number }
export interface BudgetCosts { currency: string | null; contingencyPercent: number | null; lines: BudgetCostLine[] }

export interface BudgetLine {
  category: string
  item: string
  unit: string
  quantity: number | null
  /** The unit cost the table states, or null ("Not yet costed"). */
  unitCost: number | null
}

const DIVIDER = /^\s*\|?\s*:?-{3,}/
const CURRENCY_AFFIX = /^(?:[A-Z]{1,3}\s*|[R$€£¥₦]\s*)|\s*(?:[A-Z]{3})$/g
const PLAIN_NUMBER = /^\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?$|^\d+(?:\.\d+)?$/

/** A plain money or quantity cell as a number, or null for wording, ranges and "Not yet costed". */
export function amount(cell: string): number | null {
  const c = cell.trim().replace(/^\*+|\*+$/g, '').trim().replace(CURRENCY_AFFIX, '').trim()
  if (!PLAIN_NUMBER.test(c)) return null
  const v = Number(c.replace(/[,\s]/g, ''))
  return Number.isFinite(v) ? v : null
}

export const money = (v: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const key = (s: string) => s.trim().replace(/^\*+|\*+$/g, '').toLowerCase().replace(/\s+/g, ' ')
const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
const row = (c: string[]) => '|' + c.map(x => (x.length === 0 ? ' ' : ` ${x} `)).join('|') + '|'

interface Layout { header: number; head: string[]; qty: number; unit: number; total: number; category: number; item: number }

function layout(lines: string[]): Layout | null {
  const header = lines.findIndex(l => l.trimStart().startsWith('|') && /unit\s*cost/i.test(l) && /\btotal\b|\bamount\b/i.test(l))
  if (header < 0 || header + 1 >= lines.length || !DIVIDER.test(lines[header + 1])) return null
  const head = cells(lines[header])
  const col = (re: RegExp) => head.findIndex(h => re.test(h))
  const unit = col(/unit\s*cost|rate|price/i)
  const total = col(/line\s*total|^total|amount|^cost$/i)
  if (unit < 0 || total < 0) return null
  const category = col(/^category/i)
  let item = col(/^item|description|line/i)
  if (item < 0) item = category >= 0 ? category : 0
  return { header, head, qty: col(/^quantity$|^qty|^no\.?$|number/i), unit, total, category, item }
}

// Same rule as the server: a cell that is exactly "Subtotal"/"Total" (bold allowed), or starts with "Contingency".
const isSummary = (c: string[]) =>
  c.some(x => /^\**\s*(?:sub-?total|(?:grand\s+)?total)\s*\**$/i.test(x) || /^\**\s*contingency/i.test(x))

/** The cost lines of the budget table, or null when 6.2 has no table with Unit Cost and Line Total columns. */
export function parseBudget(content: string): BudgetLine[] | null {
  const lines = (content ?? '').replace(/\r\n/g, '\n').split('\n')
  const l = layout(lines)
  if (!l) return null
  const out: BudgetLine[] = []
  for (let i = l.header + 2; i < lines.length && lines[i].trimStart().startsWith('|'); i++) {
    const c = cells(lines[i])
    if (isSummary(c)) continue
    out.push({
      category: l.category >= 0 ? (c[l.category] ?? '') : '',
      item: c[l.item] ?? '',
      unit: '',
      quantity: l.qty >= 0 ? amount(c[l.qty] ?? '') : 1,
      unitCost: amount(c[l.unit] ?? ''),
    })
  }
  return out
}

export interface BudgetResult { content: string; costed: number; uncosted: number; subtotal: number | null; total: number | null }

/** Recomputes the table with the student's costs; text outside the table is unchanged. */
export function applyBudget(content: string, costs: BudgetCosts | null): BudgetResult {
  const lines = (content ?? '').replace(/\r\n/g, '\n').split('\n')
  const l = layout(lines)
  if (!l) return { content, costed: 0, uncosted: 0, subtotal: null, total: null }
  const lookup = new Map<string, BudgetCostLine[]>()
  for (const c of costs?.lines ?? []) {
    const k = key(c.item)
    lookup.set(k, [...(lookup.get(k) ?? []), c])
  }
  let sum = 0, costed = 0, uncosted = 0
  let pct = costs?.contingencyPercent ?? null
  const summaryRows: number[] = []
  let end = l.header + 2
  for (let i = l.header + 2; i < lines.length && lines[i].trimStart().startsWith('|'); i++, end = i) {
    let c = cells(lines[i])
    if (c.length < l.head.length) c = [...c, ...Array(l.head.length - c.length).fill('')]
    if (isSummary(c)) {
      if (pct === null && c.some(x => /^\**\s*contingency/i.test(x))) {
        const m = c.join(' ').match(/(\d+(?:\.\d+)?)\s*%/)
        if (m) pct = Number(m[1])
      }
      summaryRows.push(i)
      continue
    }
    const matches = lookup.get(key(c[l.item] ?? ''))
    if (matches?.length) {
      const m = matches.find(x => l.category < 0 || !x.category || key(x.category) === key(c[l.category] ?? '')) ?? matches[0]
      c[l.unit] = money(m.unitCost)
    }
    const q = l.qty >= 0 ? amount(c[l.qty] ?? '') : 1
    const u = amount(c[l.unit] ?? '')
    if (q !== null && u !== null) {
      const line = Math.round(q * u * 100) / 100
      c[l.unit] = money(u)
      c[l.total] = money(line)
      sum += line
      costed++
    } else {
      uncosted++
      if (u === null && !/[A-Za-z]/.test(c[l.unit] ?? '')) c[l.unit] = 'Not yet costed'
      if (!/[A-Za-z]/.test(c[l.total] ?? '') || amount(c[l.total] ?? '') !== null) c[l.total] = 'Not yet costed'
    }
    lines[i] = row(c)
  }
  const labelCol = Math.max(0, Math.min(l.category >= 0 ? l.category : l.item, l.head.length - 1))
  const summary = (label: string, value: string) => {
    const c = Array(l.head.length).fill('') as string[]
    c[labelCol] = `**${label}**`
    c[l.total] = `**${value}**`
    return row(c)
  }
  const contingency = costed > 0 && pct !== null ? Math.round(sum * pct) / 100 : null
  const rows = [summary('Subtotal', costed === 0 ? ADD_YOUR_COSTS : money(sum))]
  if (contingency !== null) rows.push(summary(`Contingency (${pct}%)`, money(contingency)))
  rows.push(summary('Total', costed === 0 ? ADD_YOUR_COSTS : money(sum + (contingency ?? 0))))
  for (const r of [...summaryRows].sort((a, b) => b - a)) { lines.splice(r, 1); end-- }
  lines.splice(end, 0, ...rows)
  return {
    content: lines.join('\n'), costed, uncosted,
    subtotal: costed > 0 ? sum : null, total: costed > 0 ? sum + (contingency ?? 0) : null,
  }
}

export function readBudgetCosts(raw: string | undefined): BudgetCosts | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as BudgetCosts
    return v && Array.isArray(v.lines) ? v : null
  } catch { return null }
}
