import { useEffect, useState } from 'react'
import { literatureMatrixApi } from '../../api/literatureMatrix'
import { failureMessage, materialLabel, studyLabel, type Evidence, type Matrix } from '../../lib/literatureMatrix'
import { Skeleton } from '../ui/Skeleton'
import { Dialog, ErrorAlert, StatusChip } from './parts'

/**
 * Two or three studies side by side, one row per column. Each value is shown exactly as stored, with its status
 * and the passage it came from: disagreeing findings are shown as they are, not reconciled.
 */
export function CompareDialog({ matrix, studyIds, onClose }: { matrix: Matrix; studyIds: string[]; onClose: () => void }) {
  const [items, setItems] = useState<Evidence[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Keyed on the ids, not the array: the caller builds a new array on every render.
  const key = studyIds.join(',')
  useEffect(() => {
    let live = true
    literatureMatrixApi.compare(matrix.id, key.split(',')).then(v => { if (live) setItems(v) }).catch(e => { if (live) setError(failureMessage(e, 'load')) })
    return () => { live = false }
  }, [matrix.id, key])
  const columns = matrix.columns.filter(c => c.isVisible).sort((a, b) => a.ordinal - b.ordinal)
  return (
    <Dialog title="Compare studies" onClose={onClose} wide>
      {error ? <ErrorAlert message={error} /> : !items ? <Skeleton lines={8} tone="light" /> : (
        <div className="overflow-x-auto">
          {/* Two studies fit a phone-to-tablet width; a third column scrolls sideways below ~700px. */}
          <table className="w-full table-fixed border-collapse text-left text-[13px]" style={{ minWidth: 112 + items.length * 210 }}>
            <thead>
              <tr>
                <th scope="col" className="w-28 border-b border-slate-200 p-2 text-slate-600"><span className="sr-only">Column</span></th>
                {items.map(ev => (
                  <th key={ev.study.id} scope="col" className="border-b border-slate-200 p-2 align-top">
                    <span className="block font-semibold text-slate-900">{studyLabel(ev.study)}</span>
                    <span className="block font-normal text-slate-700 [overflow-wrap:anywhere]">{ev.study.title}</span>
                    <span className="block text-[11px] font-normal text-slate-600">{materialLabel(ev.study.material).short}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map(col => (
                <tr key={col.id} className="align-top">
                  <th scope="row" className="border-b border-slate-200 p-2 font-medium text-slate-900 [overflow-wrap:anywhere]">{col.label}</th>
                  {items.map(ev => {
                    const cell = ev.cells.find(c => c.columnId === col.id)
                    return (
                      <td key={ev.study.id} className="border-b border-slate-200 p-2">
                        {cell?.value ? <p className="text-slate-900 [overflow-wrap:anywhere]">{cell.value}</p> : null}
                        <StatusChip status={cell?.status} verified={cell?.verified} interpretation={col.isInterpretation} className="mt-1" />
                        {cell?.passages[0] && cell.researcherValue === null ? <blockquote className="mt-1 border-l-2 border-slate-300 pl-2 text-[12px] italic text-slate-700 [overflow-wrap:anywhere]">"{cell.passages[0].text}"{cell.passages[0].locator && cell.passages[0].locator !== 'Abstract' ? ` (${cell.passages[0].locator})` : ''}</blockquote> : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  )
}
